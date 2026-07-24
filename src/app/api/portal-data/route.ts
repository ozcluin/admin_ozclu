import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireRole,
  requireMfaVerified,
  isErrorResponse,
  sanitizeVerification,
  sanitizeInvoice,
} from "src/lib/apiAuth";
import { connectToDatabase } from "src/lib/mongodb";
import { getClientIp, getUserAgent, logAuditEvent } from "shared/audit";
import { softDeleteOne, softDeleteMany, notDeleted } from "shared/softDelete";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    // ── Auth: require authenticated admin session ──
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["admin"]);
    if (roleError) return roleError;

    const { db } = await connectToDatabase();

    const settings = await db.collection("settings").findOne({ id: "acme" });
    const allSettings = await db.collection("settings").find({}).toArray();
    // Admin has global view — return all records but strip password hashes and filter soft-deleted
    const verifications = await db.collection("verifications").find(
      { isDeleted: { $ne: true } },
      { projection: { password: 0 } }
    ).toArray();
    const invoices = await db.collection("invoices").find(
      { isDeleted: { $ne: true } },
      { projection: { password: 0 } }
    ).toArray();
    const verifiers = await db.collection("verifiers").find(
      { isDeleted: { $ne: true } },
      { projection: { password: 0 } }
    ).toArray();
    const organisations = await db.collection("organisations").find({ isDeleted: { $ne: true } }).toArray();

    // Backfill orgNumber for existing organisations that don't have one
    const orgsWithoutNumber = organisations.filter(o => !o.orgNumber);
    if (orgsWithoutNumber.length > 0) {
      const maxOrgNumber = organisations.reduce((max, o) => Math.max(max, o.orgNumber || 0), 0);
      // Sort orgs without number by createdAt so they get assigned in creation order
      orgsWithoutNumber.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      });
      for (let i = 0; i < orgsWithoutNumber.length; i++) {
        const assignedNumber = maxOrgNumber + i + 1;
        orgsWithoutNumber[i].orgNumber = assignedNumber;
        await db.collection("organisations").updateOne(
          { _id: orgsWithoutNumber[i]._id },
          { $set: { orgNumber: assignedNumber } }
        );
      }
    }

    // Sanitize _id fields
    const cleanSettings = settings ? { ...settings, _id: settings._id.toString() } : null;
    const cleanAllSettings = allSettings.map(s => ({ ...s, _id: s._id.toString() }));
    const cleanVerifications = verifications.map(sanitizeVerification);
    const cleanInvoices = invoices.map(sanitizeInvoice);
    const cleanVerifiers = verifiers.map(v => {
      const org = organisations.find(o => o.name === v.org || o.id === v.organisationId);
      return {
        ...v,
        _id: v._id.toString(),
        ratePerVerification: org ? (org.monthlyRate || 0) : (v.ratePerVerification || 0) // Display rate (identity); billing uses per-service org rates
      };
    });
    const cleanOrganisations = organisations.map(o => ({ ...o, _id: o._id.toString() }));

    return NextResponse.json({
      settings: cleanSettings,
      allSettings: cleanAllSettings,
      verifications: cleanVerifications,
      invoices: cleanInvoices,
      verifiers: cleanVerifiers,
      organisations: cleanOrganisations
    });
  } catch (error: any) {
    console.error("[DATA] Admin portal GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: require authenticated admin session ──
    const authResult = await requireAuth();
    if (isErrorResponse(authResult)) return authResult;
    const { user } = authResult;

    const roleError = requireRole(user, ["admin"]);
    if (roleError) return roleError;

    const mfaError = requireMfaVerified(user);
    if (mfaError) return mfaError;

    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    switch (action) {
      case "addVerification": {
        const { name, email, orgName, requestingOrgName, date, status, verifier, notes } = payload;
        
        const cleanOrg = orgName.replace(/[^a-zA-Z]/g, "").slice(0, 3).padEnd(3, "X").toUpperCase();
        
        const nowTime = new Date();
        const dd = String(nowTime.getDate()).padStart(2, "0");
        const mm = String(nowTime.getMonth() + 1).padStart(2, "0");
        const yy = String(nowTime.getFullYear()).slice(-2);
        const dateStr = `${dd}${mm}${yy}`;
        const prefix = `${cleanOrg}${dateStr}-`;
        
        const count = await db.collection("verifications").countDocuments({
          id: { $regex: `^${prefix}` }
        });
        const finalId = `${prefix}${String(count + 1).padStart(4, "0")}`;

        const { randomBytes } = await import("crypto");
        const bcrypt = await import("bcryptjs");

        // Generate a cryptographically secure 16-character temporary password
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let tempPassword = "";
        const randomBytesArr = randomBytes(16);
        for (let i = 0; i < 16; i++) {
          tempPassword += charset.charAt(randomBytesArr[i] % charset.length);
        }
        const hashedTempPassword = bcrypt.hashSync(tempPassword, 10);
        
        const existingUser = await db.collection("users").findOne({ email: email.toLowerCase().trim() });
        if (!existingUser) {
          await db.collection("users").insertOne({
            email: email.toLowerCase().trim(),
            password: hashedTempPassword,
            fullName: name,
            role: "candidate",
            orgName,
            createdAt: new Date()
          });
        } else {
          await db.collection("users").updateOne(
            { email: email.toLowerCase().trim() },
            { $set: { password: hashedTempPassword, role: "candidate", fullName: name } }
          );
        }

        const initialAttempt = {
          date,
          verifier: verifier || "Admin",
          status,
          notes: notes || "Verification flow initiated."
        };

        // Build the direct login URL (with email and password query parameters)
        const candidatePortalUrl = process.env.CANDIDATE_PORTAL_URL || "https://candidate.verify.ozclu.in";
        const setupUrl = `${candidatePortalUrl}/?email=${encodeURIComponent(email.toLowerCase().trim())}&password=${encodeURIComponent(tempPassword)}`;

        await db.collection("verifications").insertOne({
          id: finalId,
          name,
          email: email.toLowerCase().trim(),
          orgName,
          requestingOrgName: requestingOrgName || orgName,
          date,
          status,
          verifier,
          notes,
          onboardingStatus: "active",
          tempPassword,
          attempts: [initialAttempt],
          setupUrl
        });

        if (requestingOrgName && requestingOrgName.trim()) {
          const trimmedOrg = requestingOrgName.trim();
          await db.collection("settings").updateOne(
            { companyName: orgName },
            { $addToSet: { recentRequestingOrgs: trimmedOrg } },
            { upsert: true }
          );
        }
 
        return NextResponse.json({ success: true, id: finalId, setupUrl });
      }
      case "removeRecentRequestingOrg": {
        const { requestingOrgName, orgName } = payload;
        await db.collection("settings").updateOne(
          { companyName: orgName },
          { $pull: { recentRequestingOrgs: requestingOrgName } }
        );
        return NextResponse.json({ success: true });
      }
      case "updateSettings": {
        const { companyName, address, city, postalCode, contactFirstName, contactLastName, contactEmail, billingOption, cin, lut, tin, gstin, invoiceEmail, billingSameAsCompany, billingAddress, sac } = payload;
        await db.collection("settings").updateOne(
          { id: "acme" },
          {
            $set: {
              companyName, address, city, postalCode, contactFirstName, contactLastName, contactEmail, billingOption, cin, lut, tin, gstin, invoiceEmail, billingSameAsCompany, billingAddress, sac
            }
          },
          { upsert: true }
        );
        break;
      }
      case "updateOrgSettings": {
        const { orgName, settings } = payload;
        if (!orgName) {
          return NextResponse.json({ error: "orgName is required" }, { status: 400 });
        }
        // Build update object from provided settings fields
        const settingsUpdate: Record<string, any> = {};
        const allowedFields = [
          "companyName", "address", "city", "postalCode",
          "contactFirstName", "contactLastName", "contactEmail",
          "billingOption", "cin", "lut", "tin", "gstin",
          "invoiceEmail", "billingSameAsCompany", "billingAddress", "logo"
        ];
        for (const field of allowedFields) {
          if (settings[field] !== undefined) {
            settingsUpdate[field] = settings[field];
          }
        }
        // Always ensure companyName is set to orgName
        settingsUpdate.companyName = orgName;

        await db.collection("settings").updateOne(
          { companyName: orgName },
          { $set: settingsUpdate },
          { upsert: true }
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "org_settings_updated",
          targetType: "settings",
          targetId: orgName,
          ip,
          userAgent,
          outcome: "success"
        });
        break;
      }
      case "inviteVerifier": {
        const { id, name, email, org, status, password, organisationId, designation } = payload;
        // Verifier display rate uses identity rate; actual billing uses per-service org rates
        let verifierRate = 0;
        if (organisationId) {
          const orgDoc = await db.collection("organisations").findOne({ id: organisationId, isDeleted: { $ne: true } });
          if (orgDoc) verifierRate = orgDoc.monthlyRate || 0;
        }
        await db.collection("verifiers").insertOne({
          id, name, email, org, status, ratePerVerification: verifierRate, organisationId: organisationId || null, designation: designation || null
        });
        
        if (password) {
          const bcrypt = await import("bcryptjs");
          const hashedPassword = bcrypt.hashSync(password, 10);
          
          const existingUser = await db.collection("users").findOne({ email: email.toLowerCase().trim() });
          if (!existingUser) {
            await db.collection("users").insertOne({
              email: email.toLowerCase().trim(),
              password: hashedPassword,
              fullName: name,
              role: "client",
              orgName: org,
              createdAt: new Date()
            });
          }
        }
        break;
      }
      case "updateInvoiceStatus": {
        const { id, status, dbId, paymentProof, paymentProofDate, ...rest } = payload;
        const updateFields: any = { status, ...rest };
        if (paymentProof !== undefined) updateFields.paymentProof = paymentProof;
        if (paymentProofDate !== undefined) updateFields.paymentProofDate = paymentProofDate;

        let query: any = { id };
        if (dbId) {
          try {
            query = { _id: new ObjectId(dbId) };
          } catch (e) {
            console.error("Invalid ObjectId format:", dbId);
          }
        }
        await db.collection("invoices").updateOne(
          query,
          { $set: updateFields }
        );
        break;
      }
      case "deleteInvoice": {
        const { id, reason } = payload;
        const deleteReason = reason || "Invoice deleted by administrator";
        await softDeleteOne(db, "invoices", { id }, user.id, deleteReason);
        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "invoice_deleted",
          targetType: "invoice",
          targetId: id,
          ip,
          userAgent,
          outcome: "success"
        });
        break;
      }
      case "addInvoice": {
        const { id, orgName, date, dueDate, amount, status, generationType, activityLog } = payload;
        await db.collection("invoices").insertOne({
          id, orgName, date, dueDate, amount, status, generationType: generationType || "Manual", activityLog: activityLog || []
        });
        break;
      }
      case "assignVerifier": {
        const { verificationId, verifierName } = payload;
        await db.collection("verifications").updateOne(
          { id: verificationId },
          { $set: { verifier: verifierName } }
        );
        break;
      }
      case "sendToCustomer": {
        const { verificationId } = payload;
        if (!verificationId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }
        await db.collection("verifications").updateOne(
          { id: verificationId },
          { 
            $set: { 
              sendToCustomer: true,
              status: "Completed",
              completedAt: new Date(),
              updatedAt: new Date()
            }
          }
        );
        return NextResponse.json({ success: true });
      }
      case "updateVerificationStatus": {
        const { verificationId, status, notes, reportDetails } = payload;
        const updateDoc: any = { status };
        if (notes !== undefined) {
          updateDoc.notes = notes;
        }
        if (reportDetails !== undefined) {
          updateDoc.reportDetails = reportDetails;
        }

        // Retrieve existing record to attribute the update to the assigned verifier
        const verification = await db.collection("verifications").findOne({ id: verificationId });
        const verifierName = verification?.verifier || "Admin";

        // Set completedAt when marking as Completed
        if (status === "Completed") {
          updateDoc.completedAt = new Date();
        }

        const newAttempt = {
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          verifier: verifierName,
          status,
          notes: notes || "Flow status modified."
        };

        await db.collection("verifications").updateOne(
          { id: verificationId },
          { 
            $set: updateDoc,
            $push: { attempts: newAttempt } as any
          }
        );

        // Auto-create/update invoice when verification is completed
        if (status === "Completed" && verification) {
          const orgName = verification.orgName;
          const org = await db.collection("organisations").findOne({
            name: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") },
            isDeleted: { $ne: true }
          });

          if (org) {
            const verType = verification.type || "identity";
            let rate = 0;
            if (verification.serviceCharge) {
              rate = verification.serviceCharge;
            } else if (verType === "court_record") {
              rate = org.courtRecordRate !== undefined ? org.courtRecordRate : org.monthlyRate;
            } else if (verType === "interpol") {
              rate = org.interpolRate !== undefined ? org.interpolRate : org.monthlyRate;
            } else if (verType === "passport") {
              rate = org.passportRate !== undefined ? org.passportRate : 8;
            } else if (verType === "employment") {
              const c = verification.country || verification.employmentData?.country || "";
              if (c && org.employmentRates && org.employmentRates[c] !== undefined) {
                rate = org.employmentRates[c];
              } else if (org.employmentRates?.["Default"] !== undefined) {
                rate = org.employmentRates["Default"];
              } else {
                rate = org.employmentRate !== undefined ? org.employmentRate : 5;
              }
              rate = rate * (verification.itemCount || 1);
            } else if (verType === "education") {
              const c = verification.country || verification.educationData?.country || "";
              if (c && org.educationRates && org.educationRates[c] !== undefined) {
                rate = org.educationRates[c];
              } else if (org.educationRates?.["Default"] !== undefined) {
                rate = org.educationRates["Default"];
              } else {
                rate = org.educationRate !== undefined ? org.educationRate : 5;
              }
              rate = rate * (verification.itemCount || 1);
            } else {
              rate = org.monthlyRate;
            }

            if (rate) {
              const now = new Date();
              const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
              const currentYear = now.getFullYear();
              const resolvedOrgId = org.id || org._id.toString();
              const orgNumStr = String(org.orgNumber || 0).padStart(3, "0");
              const orgPrefix = orgName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
              const monthAbbr = currentMonth.substring(0, 3).toUpperCase();
              const invoiceId = `INV-${orgNumStr}-${orgPrefix}-${monthAbbr}-${currentYear}`;

              // Check if a PAID invoice already exists — if so, don't touch it
              const paidInvoice = await db.collection("invoices").findOne({
                $or: [
                  { organisationId: resolvedOrgId },
                  { orgName: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }
                ],
                month: { $regex: new RegExp("^" + currentMonth + "$", "i") },
                year: currentYear,
                status: "Paid",
                isDeleted: { $ne: true }
              });

              if (!paidInvoice) {
                // Check if an unpaid invoice already exists for this org + month + year
                const existingInvoice = await db.collection("invoices").findOne({
                  $or: [
                    { organisationId: resolvedOrgId },
                    { orgName: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }
                  ],
                  month: { $regex: new RegExp("^" + currentMonth + "$", "i") },
                  year: currentYear,
                  status: { $ne: "Paid" },
                  isDeleted: { $ne: true }
                });

                if (existingInvoice) {
                  // Increment the existing invoice amount and ensure organisationId is set
                  await db.collection("invoices").updateOne(
                    { _id: existingInvoice._id },
                    { $inc: { amount: rate }, $set: { organisationId: resolvedOrgId, generationType: existingInvoice.generationType || "Auto" } }
                  );
                } else {
                  // Create a new invoice for this month
                  const generatedDate = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
                  const monthIndex = now.getMonth();
                  const lastDayOfMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
                  const dueDate = new Date(currentYear, monthIndex, lastDayOfMonth, 23, 59).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

                  await db.collection("invoices").insertOne({
                    id: invoiceId,
                    orgName,
                    organisationId: resolvedOrgId,
                    date: generatedDate,
                    dueDate,
                    amount: rate,
                    status: "Unpaid",
                    month: currentMonth,
                    year: currentYear,
                    generationType: "Auto"
                  });
                }
              }
            }
          }
        }

        break;
      }
      case "updateVerifierRate": {
        const { verifierId, rate } = payload;
        await db.collection("verifiers").updateOne(
          { id: verifierId },
          { $set: { ratePerVerification: rate } }
        );
        break;
      }
      case "updateVerifierStatus": {
        const { verifierId, status } = payload;
        await db.collection("verifiers").updateOne(
          { id: verifierId },
          { $set: { status } }
        );
        break;
      }
      case "deleteVerifier": {
        const { verifierId, reason } = payload;
        const deleteReason = reason || "Verifier deleted by administrator";

        // Retrieve existing verifier to get the email before soft-deleting
        const verifier = await db.collection("verifiers").findOne({ id: verifierId });
        
        await softDeleteOne(db, "verifiers", { id: verifierId }, user.id, deleteReason);
        
        if (verifier?.email) {
          await softDeleteOne(db, "users", { email: verifier.email.toLowerCase().trim() }, user.id, deleteReason);
        }

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "verifier_deleted",
          targetType: "verifier",
          targetId: verifierId,
          ip,
          userAgent,
          outcome: "success"
        });
        break;
      }
      case "addOrganisation": {
        const { id, name, paymentPlan, monthlyRate, billingDay, createdAt, ownerEmail, ownerName, ownerPassword, maxVerifiers, orgNumber, courtRecordRate, identityEnabled, courtRecordEnabled } = payload;
        // If orgNumber was provided by the client, use it; otherwise compute from DB
        let finalOrgNumber = orgNumber;
        if (!finalOrgNumber) {
          const maxDoc = await db.collection("organisations").find({}).sort({ orgNumber: -1 }).limit(1).toArray();
          finalOrgNumber = (maxDoc.length > 0 && maxDoc[0].orgNumber ? maxDoc[0].orgNumber : 0) + 1;
        }
        await db.collection("organisations").insertOne({
          id, name, orgNumber: finalOrgNumber, paymentPlan, monthlyRate, billingDay, createdAt, status: "Active",
          courtRecordRate: courtRecordRate ?? monthlyRate,
          identityEnabled: identityEnabled ?? true,
          courtRecordEnabled: courtRecordEnabled ?? true,
          ownerEmail: ownerEmail || null,
          ownerName: ownerName || null,
          maxVerifiers: maxVerifiers ?? 5
        });

        // Auto-create org owner account if owner details are provided
        if (ownerEmail && ownerPassword) {
          const bcrypt = await import("bcryptjs");
          const hashedPassword = bcrypt.hashSync(ownerPassword, 10);
          const ownerEmailClean = ownerEmail.toLowerCase().trim();

          // Create user with role "org_owner"
          const existingUser = await db.collection("users").findOne({ email: ownerEmailClean });
          if (!existingUser) {
            await db.collection("users").insertOne({
              email: ownerEmailClean,
              password: hashedPassword,
              fullName: ownerName || name,
              role: "org_owner",
              orgName: name,
              createdAt: new Date()
            });
          }

          // Create a verifier record for the owner
          const ownerVerifierId = `V-OWN-${Math.floor(1000 + Math.random() * 9000)}`;
          await db.collection("verifiers").insertOne({
            id: ownerVerifierId,
            name: ownerName || name,
            email: ownerEmailClean,
            org: name,
            organisationId: id,
            designation: "Organisation Owner",
            status: "Active",
            ratePerVerification: monthlyRate,
            isOwner: true,
            createdBy: user.email
          });

          // Create org settings record (for billable summary)
          const existingSettings = await db.collection("settings").findOne({ companyName: name });
          if (!existingSettings) {
            await db.collection("settings").insertOne({
              id: name.replace(/\s+/g, "").toLowerCase(),
              companyName: name,
              contactEmail: ownerEmailClean,
              address: "",
              city: "",
              postalCode: "",
              contactFirstName: ownerName?.split(" ")[0] || "",
              contactLastName: ownerName?.split(" ").slice(1).join(" ") || "",
              billingOption: "invoice",
              cin: "",
              lut: "",
              tin: "",
              gstin: "",
              invoiceEmail: ownerEmailClean,
              billingSameAsCompany: true,
              billingAddress: ""
            });
          }

          await logAuditEvent(db, {
            actorUserId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
            portal: "admin",
            action: "org_owner_created",
            targetType: "user",
            targetId: ownerEmailClean,
            ip,
            userAgent,
            outcome: "success",
            metadata: { organisationId: id, organisationName: name }
          });
        }
        break;
      }
      case "updateOrganisationServiceRates": {
        const { orgId, updates } = payload;
        await db.collection("organisations").updateOne(
          { id: orgId },
          { $set: updates }
        );
        return NextResponse.json({ success: true });
      }

      case "addEmploymentVerification": {
        const { name, mobile, email, orgName, requestingOrgName, skipCandidateLogin, employments, country } = payload;
        const validEmployments = Array.isArray(employments) ? employments.filter((e: any) => e.companyName && e.companyName.trim() !== "") : [];
        const itemCount = validEmployments.length > 0 ? validEmployments.length : 1;

        const defaultCountryRates: Record<string, number> = { Singapore: 15, Malaysia: 12, Philippines: 10, UAE: 20, India: 5 };
        const orgDoc = await db.collection("organisations").findOne({
          name: { $regex: new RegExp("^" + (orgName || "").replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") }
        });

        const employmentsWithCountry = validEmployments.map((e: any) => ({
          ...e,
          country: e.country || country || "India"
        }));

        const serviceCharge = employmentsWithCountry.length > 0
          ? employmentsWithCountry.reduce((sum: number, e: any) => {
              const itemCountry = e.country || "India";
              const rate = orgDoc?.employmentRates?.[itemCountry] ?? (defaultCountryRates[itemCountry] || 5);
              return sum + rate;
            }, 0)
          : (orgDoc?.employmentRates?.[country || "India"] ?? (defaultCountryRates[country || "India"] || 5));

        const countriesList = [...new Set(employmentsWithCountry.map((e: any) => e.country))];
        const selectedCountry = countriesList.join(", ") || country || "India";

        const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

        const maxDoc = await db.collection("verifications").find({ id: /^EMP-/ }).sort({ id: -1 }).limit(1).toArray();
        let nextSeq = 1;
        if (maxDoc.length > 0 && maxDoc[0].id) {
          const match = maxDoc[0].id.match(/^EMP-(\d+)$/);
          if (match) nextSeq = parseInt(match[1], 10) + 1;
        }
        const empId = `EMP-${String(nextSeq).padStart(4, "0")}`;

        const newVerification: any = {
          id: empId,
          type: "employment",
          name,
          email,
          candidateMobile: mobile,
          orgName,
          requestingOrgName: requestingOrgName || orgName,
          date: dateStr,
          status: "Processing",
          assignedVerifier: null,
          skipCandidateLogin: !!skipCandidateLogin,
          country: selectedCountry,
          itemCount,
          serviceCharge,
          employments: employmentsWithCountry,
          createdAt: new Date().toISOString()
        };

        const insertRes = await db.collection("verifications").insertOne(newVerification);

        if (requestingOrgName) {
          const existingSettings = await db.collection("settings").findOne({ orgName });
          const recentOrgs: string[] = existingSettings?.recentRequestingOrgs || [];
          if (!recentOrgs.includes(requestingOrgName)) {
            const updatedOrgs = [requestingOrgName, ...recentOrgs].slice(0, 10);
            await db.collection("settings").updateOne(
              { orgName },
              { $set: { recentRequestingOrgs: updatedOrgs } },
              { upsert: true }
            );
          }
        }

        return NextResponse.json({ success: true, verificationId: empId, dbId: insertRes.insertedId.toString() });
      }

      case "addEducationVerification": {
        const { name, mobile, email, orgName, requestingOrgName, skipCandidateLogin, educationList, country } = payload;
        const validEducation = Array.isArray(educationList) ? educationList.filter((e: any) => e.boardUniversity && e.boardUniversity.trim() !== "") : [];
        const itemCount = validEducation.length > 0 ? validEducation.length : 1;

        const defaultCountryRates: Record<string, number> = { Singapore: 15, Malaysia: 12, Philippines: 10, UAE: 20, India: 5 };
        const orgDoc = await db.collection("organisations").findOne({
          name: { $regex: new RegExp("^" + (orgName || "").replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") }
        });

        const educationWithCountry = validEducation.map((e: any) => ({
          ...e,
          country: e.country || country || "India"
        }));

        const serviceCharge = educationWithCountry.length > 0
          ? educationWithCountry.reduce((sum: number, e: any) => {
              const itemCountry = e.country || "India";
              const rate = orgDoc?.educationRates?.[itemCountry] ?? (defaultCountryRates[itemCountry] || 5);
              return sum + rate;
            }, 0)
          : (orgDoc?.educationRates?.[country || "India"] ?? (defaultCountryRates[country || "India"] || 5));

        const countriesList = [...new Set(educationWithCountry.map((e: any) => e.country))];
        const selectedCountry = countriesList.join(", ") || country || "India";

        const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

        const maxDoc = await db.collection("verifications").find({ id: /^EDU-/ }).sort({ id: -1 }).limit(1).toArray();
        let nextSeq = 1;
        if (maxDoc.length > 0 && maxDoc[0].id) {
          const match = maxDoc[0].id.match(/^EDU-(\d+)$/);
          if (match) nextSeq = parseInt(match[1], 10) + 1;
        }
        const eduId = `EDU-${String(nextSeq).padStart(4, "0")}`;

        const newVerification: any = {
          id: eduId,
          type: "education",
          name,
          email,
          candidateMobile: mobile,
          orgName,
          requestingOrgName: requestingOrgName || orgName,
          date: dateStr,
          status: "Processing",
          assignedVerifier: null,
          skipCandidateLogin: !!skipCandidateLogin,
          country: selectedCountry,
          itemCount,
          serviceCharge,
          educationList: educationWithCountry,
          createdAt: new Date().toISOString()
        };

        const insertRes = await db.collection("verifications").insertOne(newVerification);

        if (requestingOrgName) {
          const existingSettings = await db.collection("settings").findOne({ orgName });
          const recentOrgs: string[] = existingSettings?.recentRequestingOrgs || [];
          if (!recentOrgs.includes(requestingOrgName)) {
            const updatedOrgs = [requestingOrgName, ...recentOrgs].slice(0, 10);
            await db.collection("settings").updateOne(
              { orgName },
              { $set: { recentRequestingOrgs: updatedOrgs } },
              { upsert: true }
            );
          }
        }

        return NextResponse.json({ success: true, verificationId: eduId, dbId: insertRes.insertedId.toString() });
      }
      case "submitEmploymentData": {
        const { verificationId, employmentData } = payload;
        if (!verificationId || !employmentData) {
          return NextResponse.json({ error: "Verification ID and employment data are required" }, { status: 400 });
        }

        const existingVer = await db.collection("verifications").findOne({ id: verificationId });
        if (!existingVer) {
          return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
        }

        const submittedEmployments = Array.isArray(employmentData.employments) && employmentData.employments.length > 0
          ? employmentData.employments
          : (Array.isArray(employmentData.pastOrganisations) && employmentData.pastOrganisations.length > 0
              ? employmentData.pastOrganisations
              : [employmentData]);

        const validEmps = submittedEmployments.filter((e: any) => e?.companyName?.trim() || e?.position?.trim());
        const itemCount = validEmps.length > 0 ? validEmps.length : 1;

        const defaultCountryRates: Record<string, number> = { Singapore: 15, Malaysia: 12, Philippines: 10, UAE: 20, India: 5 };
        const safeOrgName = existingVer.orgName;
        const orgDoc = await db.collection("organisations").findOne({
          name: { $regex: new RegExp("^" + (safeOrgName || "").replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") }
        });

        const serviceCharge = (validEmps.length > 0 ? validEmps : [employmentData]).reduce((sum: number, e: any) => {
          const itemCountry = e.country || "India";
          const rate = orgDoc?.employmentRates?.[itemCountry] ?? (defaultCountryRates[itemCountry] || 5);
          return sum + rate;
        }, 0);

        const countriesList = [...new Set((validEmps.length > 0 ? validEmps : [employmentData]).map((e: any) => e.country || "India"))];
        const country = countriesList.join(", ");

        const result = await db.collection("verifications").updateOne(
          { id: verificationId },
          {
            $set: {
              employmentData: {
                country: employmentData.country || "",
                state: employmentData.state || "",
                city: employmentData.city || "",
                companyName: employmentData.companyName || "",
                addressLine1: employmentData.addressLine1 || "",
                addressLine2: employmentData.addressLine2 || "",
                companyTelephoneCode: employmentData.companyTelephoneCode || "+91",
                companyTelephone: employmentData.companyTelephone || "",
                department: employmentData.department || "",
                position: employmentData.position || "",
                employmentPeriodFrom: employmentData.employmentPeriodFrom || "",
                employmentPeriodTo: employmentData.employmentPeriodTo || "",
                employeeCode: employmentData.employeeCode || "",
                reportingManagerName: employmentData.reportingManagerName || "",
                reportingManagerDepartment: employmentData.reportingManagerDepartment || "",
                reportingManagerContactCode: employmentData.reportingManagerContactCode || "+91",
                reportingManagerContact: employmentData.reportingManagerContact || "",
                reportingManagerEmail: employmentData.reportingManagerEmail || "",
                annualCTC: employmentData.annualCTC || "",
                employmentType: employmentData.employmentType || "",
                agencyDetails: employmentData.agencyDetails || "",
                reasonForLeaving: employmentData.reasonForLeaving || "",
                remarks: employmentData.remarks || "",
                experienceLetterFile: employmentData.experienceLetterFile || "",
                experienceLetterFileName: employmentData.experienceLetterFileName || "",
              },
              ...(Array.isArray(employmentData.pastOrganisations) ? { pastOrganisations: employmentData.pastOrganisations } : {}),
              ...(Array.isArray(employmentData.employments) ? { employments: employmentData.employments } : {}),
              itemCount,
              serviceCharge,
              country,
              employmentDataSubmitted: true,
              employmentDataSubmittedAt: new Date().toISOString(),
              updatedAt: new Date()
            }
          }
        );
        return NextResponse.json({ success: true });
      }
      case "submitEducationData": {
        const { verificationId, educationData } = payload;
        if (!verificationId || !educationData) {
          return NextResponse.json({ error: "Verification ID and education data are required" }, { status: 400 });
        }

        const existingVer = await db.collection("verifications").findOne({ id: verificationId });
        if (!existingVer) {
          return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
        }

        const defaultCountryRates: Record<string, number> = { Singapore: 15, Malaysia: 12, Philippines: 10, UAE: 20, India: 5 };
        const safeOrgName = existingVer.orgName;
        const orgDoc = await db.collection("organisations").findOne({
          name: { $regex: new RegExp("^" + (safeOrgName || "").replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") }
        });

        const itemCountry = educationData.country || "India";
        const serviceCharge = orgDoc?.educationRates?.[itemCountry] ?? (defaultCountryRates[itemCountry] || 5);
        const country = itemCountry;

        const result = await db.collection("verifications").updateOne(
          { id: verificationId },
          {
            $set: {
              educationData: {
                country: educationData.country || "",
                degreeType: educationData.degreeType || "",
                courseName: educationData.courseName || "",
                boardUniversity: educationData.boardUniversity || "",
                institutionName: educationData.institutionName || "",
                rollNumber: educationData.rollNumber || "",
                passingYear: educationData.passingYear || "",
                certificateFile: educationData.certificateFile || "",
                certificateFileName: educationData.certificateFileName || "",
              },
              serviceCharge,
              country,
              educationDataSubmitted: true,
              educationDataSubmittedAt: new Date().toISOString(),
              updatedAt: new Date()
            }
          }
        );
        return NextResponse.json({ success: true });
      }
      case "setOrganisationOwner": {
        const { orgId, ownerName, ownerEmail, ownerPassword, maxVerifiers } = payload;
        
        // Find organisation first
        const org = await db.collection("organisations").findOne({ id: orgId });
        if (!org) {
          return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
        }

        // Update organisation record
        await db.collection("organisations").updateOne(
          { id: orgId },
          {
            $set: {
              ownerEmail: ownerEmail || null,
              ownerName: ownerName || null,
              maxVerifiers: maxVerifiers ?? 5
            }
          }
        );

        // Create org owner account if password is provided
        if (ownerEmail && ownerPassword) {
          const bcrypt = await import("bcryptjs");
          const hashedPassword = bcrypt.hashSync(ownerPassword, 10);
          const ownerEmailClean = ownerEmail.toLowerCase().trim();

          // Create or update user with role "org_owner"
          await db.collection("users").updateOne(
            { email: ownerEmailClean },
            {
              $set: {
                email: ownerEmailClean,
                password: hashedPassword,
                fullName: ownerName || org.name,
                role: "org_owner",
                orgName: org.name,
                updatedAt: new Date()
              },
              $setOnInsert: {
                createdAt: new Date()
              }
            },
            { upsert: true }
          );

          // Create or update verifier record for the owner
          const ownerVerifierId = `V-OWN-${Math.floor(1000 + Math.random() * 9000)}`;
          await db.collection("verifiers").updateOne(
            { email: ownerEmailClean, org: org.name },
            {
              $set: {
                name: ownerName || org.name,
                organisationId: orgId,
                designation: "Organisation Owner",
                status: "Active",
                ratePerVerification: org.monthlyRate || 0, // Display rate (identity); billing uses per-service org rates
                isOwner: true,
                createdBy: user.email
              },
              $setOnInsert: {
                id: ownerVerifierId
              }
            },
            { upsert: true }
          );

          // Create org settings record if it doesn't exist
          const existingSettings = await db.collection("settings").findOne({ companyName: org.name });
          if (!existingSettings) {
            await db.collection("settings").insertOne({
              id: org.name.replace(/\s+/g, "").toLowerCase(),
              companyName: org.name,
              contactEmail: ownerEmailClean,
              address: "",
              city: "",
              postalCode: "",
              contactFirstName: ownerName?.split(" ")[0] || "",
              contactLastName: ownerName?.split(" ").slice(1).join(" ") || "",
              billingOption: "invoice",
              cin: "",
              lut: "",
              tin: "",
              gstin: "",
              invoiceEmail: ownerEmailClean,
              billingSameAsCompany: true,
              billingAddress: ""
            });
          }

          await logAuditEvent(db, {
            actorUserId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
            portal: "admin",
            action: "org_owner_assigned",
            targetType: "user",
            targetId: ownerEmailClean,
            ip,
            userAgent,
            outcome: "success",
            metadata: { organisationId: orgId, organisationName: org.name }
          });
        }
        break;
      }
      case "updateOrganisation": {
        const { id, updates } = payload;
        await db.collection("organisations").updateOne(
          { id },
          { $set: updates }
        );
        break;
      }
      case "deactivateOrganisation": {
        const { id, invoiceOption } = payload;
        await db.collection("organisations").updateOne(
          { id },
          { $set: { status: "Deactivated" } }
        );

        if (invoiceOption === "default") {
          await db.collection("invoices").updateMany(
            {
              organisationId: id,
              status: { $in: ["Unpaid", "Pending", "Overdue"] },
              isDeleted: { $ne: true }
            },
            { $set: { status: "Defaulted" } }
          );
        }

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "organisation_deactivated",
          targetType: "organisation",
          targetId: id,
          ip,
          userAgent,
          outcome: "success"
        });
        break;
      }
      case "activateOrganisation": {
        const { id } = payload;
        await db.collection("organisations").updateOne(
          { id },
          { $set: { status: "Active" } }
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "organisation_activated",
          targetType: "organisation",
          targetId: id,
          ip,
          userAgent,
          outcome: "success"
        });
        break;
      }
      case "deleteOrganisation": {
        const { id, reason } = payload;
        const deleteReason = reason || "Organisation deleted by administrator";
        const org = await db.collection("organisations").findOne({ id });
        if (org) {
          // 1. Soft-delete all invoices for this organisation
          await softDeleteMany(db, "invoices", {
            $or: [
              { organisationId: id },
              { orgName: org.name }
            ]
          }, user.id, deleteReason);

          // 2. Find all verifier accounts for this organisation
          const orgVerifiers = await db.collection("verifiers").find({
            $or: [
              { organisationId: id },
              { org: org.name }
            ]
          }).toArray();

          const verifierEmails = orgVerifiers
            .map((v) => v.email?.toLowerCase().trim())
            .filter(Boolean);

          // 3. Soft-delete those verifier logins from users collection
          if (verifierEmails.length > 0) {
            await softDeleteMany(db, "users", {
              email: { $in: verifierEmails }
            }, user.id, deleteReason);
          }

          // 4. Soft-delete verifiers from verifiers collection
          await softDeleteMany(db, "verifiers", {
            $or: [
              { organisationId: id },
              { org: org.name }
            ]
          }, user.id, deleteReason);

          // 5. Soft-delete the organisation itself
          await softDeleteOne(db, "organisations", { id }, user.id, deleteReason);

          await logAuditEvent(db, {
            actorUserId: user.id,
            actorEmail: user.email,
            actorRole: user.role,
            portal: "admin",
            action: "organisation_deleted",
            targetType: "organisation",
            targetId: id,
            ip,
            userAgent,
            outcome: "success"
          });
        }
        break;
      }
      case "generateMonthlyInvoice": {
        const { id, orgName, organisationId, date, dueDate, amount, status, month, year, generationType } = payload;
        // Soft-delete existing non-paid invoices for same org/month/year
        // Match by BOTH organisationId AND orgName to catch auto-generated invoices
        if (month && year) {
          const deleteFilter: any = {
            $or: [
              ...(organisationId ? [{ organisationId }] : []),
              ...(orgName ? [{ orgName: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }] : [])
            ],
            month: { $regex: new RegExp("^" + month + "$", "i") },
            year,
            status: { $ne: "Paid" },
            isDeleted: { $ne: true }
          };
          // Only proceed if we have at least one org identifier
          if (deleteFilter.$or.length > 0) {
            await softDeleteMany(db, "invoices", deleteFilter, user.id, "Replaced by newly generated monthly invoice");
          }
        }
        await db.collection("invoices").insertOne({
          id, orgName, organisationId, date, dueDate, amount, status, month, year, generationType: generationType || "Manual"
        });

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "invoice_generated",
          targetType: "invoice",
          targetId: id,
          ip,
          userAgent,
          outcome: "success"
        });
        break;
      }
      case "reviewCourtRecord": {
        const { verificationId, reviewedResults } = payload;

        if (!verificationId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }

        const verification = await db.collection("verifications").findOne({ id: verificationId });
        if (!verification) {
          return NextResponse.json({ error: "Verification not found" }, { status: 404 });
        }

        // Deep clone the court record results for modification
        const results = JSON.parse(JSON.stringify(verification.courtRecordResults || []));

        if (reviewedResults && Array.isArray(reviewedResults)) {
          // Sort deletions in reverse order so indices stay valid
          const deletions = reviewedResults
            .filter((r: any) => r.action === "delete")
            .sort((a: any, b: any) => {
              if (a.resultIndex !== b.resultIndex) return b.resultIndex - a.resultIndex;
              if (a.complexSearchIndex !== b.complexSearchIndex) return b.complexSearchIndex - a.complexSearchIndex;
              return b.caseIndex - a.caseIndex;
            });

          for (const del of deletions) {
            const result = results[del.resultIndex];
            if (!result || !result.complexSearches) continue;
            const cs = result.complexSearches[del.complexSearchIndex];
            if (!cs || !cs.cases) continue;
            if (del.caseIndex >= 0 && del.caseIndex < cs.cases.length) {
              cs.cases.splice(del.caseIndex, 1);
              cs.casesFound = cs.cases.length;
            }
          }
        }

        // Recalculate totals after deletions
        let newTotalCases = 0;
        for (const result of results) {
          for (const cs of (result.complexSearches || [])) {
            newTotalCases += (cs.cases?.length || 0);
          }
        }
        const newHasRecords = newTotalCases > 0;

        const reviewSummary = newHasRecords
          ? `${newTotalCases} court record(s) confirmed after admin review.`
          : `No court records confirmed after admin review. All records cleared.`;

        // Update the verification document
        const reviewUpdate: Record<string, any> = {
          courtRecordResults: results,
          courtRecordTotalCases: newTotalCases,
          courtRecordHasRecords: newHasRecords,
          courtRecordStatus: "completed",
          courtRecordAdminReview: false,
          courtRecordAdminReviewCompletedAt: new Date().toISOString(),
          courtRecordReviewedBy: user.email,
          courtRecordSummary: reviewSummary,
          status: "Completed",
          completedAt: new Date().toISOString(),
          reportDetails: reviewSummary,
        };

        const reviewAttempt = {
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          verifier: user.email,
          status: "Completed",
          notes: `Admin review completed. ${newTotalCases} record(s) confirmed, ${(verification.courtRecordTotalCases || 0) - newTotalCases} record(s) removed.`
        };

        await db.collection("verifications").updateOne(
          { id: verificationId },
          {
            $set: reviewUpdate,
            $push: { attempts: reviewAttempt } as any
          }
        );

        // Auto-create/update invoice when verification is completed (same logic as updateVerificationStatus)
        const orgName = verification.orgName;
        const org = await db.collection("organisations").findOne({
          name: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") },
          isDeleted: { $ne: true }
        });

        if (org) {
          const rate = org.courtRecordRate !== undefined ? org.courtRecordRate : org.monthlyRate;
          if (rate) {
            const now = new Date();
            const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
            const currentYear = now.getFullYear();
            const resolvedOrgId = org.id || org._id.toString();
            const orgNumStr = String(org.orgNumber || 0).padStart(3, "0");
            const orgPrefix = orgName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
            const monthAbbr = currentMonth.substring(0, 3).toUpperCase();
            const invoiceId = `INV-${orgNumStr}-${orgPrefix}-${monthAbbr}-${currentYear}`;

            const paidInvoice = await db.collection("invoices").findOne({
              $or: [
                { organisationId: resolvedOrgId },
                { orgName: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }
              ],
              month: { $regex: new RegExp("^" + currentMonth + "$", "i") },
              year: currentYear,
              status: "Paid",
              isDeleted: { $ne: true }
            });

            if (!paidInvoice) {
              const existingInvoice = await db.collection("invoices").findOne({
                $or: [
                  { organisationId: resolvedOrgId },
                  { orgName: { $regex: new RegExp("^" + orgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i") } }
                ],
                month: { $regex: new RegExp("^" + currentMonth + "$", "i") },
                year: currentYear,
                status: { $ne: "Paid" },
                isDeleted: { $ne: true }
              });

              if (existingInvoice) {
                await db.collection("invoices").updateOne(
                  { _id: existingInvoice._id },
                  { $inc: { amount: rate }, $set: { organisationId: resolvedOrgId } }
                );
              } else {
                const generatedDate = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
                const monthIndex = now.getMonth();
                const lastDayOfMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
                const dueDate = new Date(currentYear, monthIndex, lastDayOfMonth, 23, 59).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

                await db.collection("invoices").insertOne({
                  id: invoiceId,
                  orgName,
                  organisationId: resolvedOrgId,
                  date: generatedDate,
                  dueDate,
                  amount: rate,
                  status: "Unpaid",
                  month: currentMonth,
                  year: currentYear,
                  generationType: "Auto"
                });
              }
            }
          }
        }

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "court_record_reviewed",
          targetType: "verification",
          targetId: verificationId,
          ip,
          userAgent,
          outcome: "success",
          metadata: { confirmedRecords: newTotalCases, removedRecords: (verification.courtRecordTotalCases || 0) - newTotalCases }
        });

        return NextResponse.json({ success: true, totalCases: newTotalCases, hasRecords: newHasRecords });
      }
      case "adminRetryCourtSearch": {
        const { verificationId, candidateName: overrideName, addresses: overrideAddresses } = payload;

        if (!verificationId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }

        const verification = await db.collection("verifications").findOne({ id: verificationId });
        if (!verification) {
          return NextResponse.json({ error: "Verification not found" }, { status: 404 });
        }

        // Only allow retry on verifications that exhausted auto-retries or errored
        if (verification.courtRecordStatus !== "needs_admin_retry" && verification.courtRecordStatus !== "error") {
          return NextResponse.json({ error: "This verification is not in a retryable state" }, { status: 400 });
        }

        // Use overrides if provided (admin may have edited the search params)
        const searchName = overrideName?.trim() || verification.name;
        const searchAddresses = (overrideAddresses && Array.isArray(overrideAddresses) && overrideAddresses.length > 0)
          ? overrideAddresses
          : verification.addresses;

        // Reset the verification status for a fresh search
        await db.collection("verifications").updateOne(
          { id: verificationId },
          {
            $set: {
              status: "Processing",
              courtRecordStatus: "searching",
              courtRecordSummary: "Admin-initiated retry in progress...",
              courtRecordSearchStartedAt: new Date().toISOString(),
              courtRecordProgress: "Admin-initiated eCourts search...",
              // Update name/addresses if admin changed them
              ...(overrideName ? { name: searchName } : {}),
              ...(overrideAddresses && overrideAddresses.length > 0 ? { addresses: searchAddresses } : {}),
            },
            $unset: {
              courtRecordErrors: "",
              courtRecordResults: "",
              courtRecordTotalCases: "",
              courtRecordTotalComplexes: "",
              courtRecordCompletedAt: "",
              courtRecordHasRecords: "",
              courtRecordFailedAt: "",
              courtRecordRetryAttempts: "",
              courtRecordLastError: "",
              completedAt: "",
            },
          }
        );

        // Log audit event
        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "court_record_admin_retry",
          targetType: "verification",
          targetId: verificationId,
          ip,
          userAgent,
          outcome: "success",
          metadata: {
            previousStatus: verification.courtRecordStatus,
            previousAttempts: verification.courtRecordRetryAttempts || 0,
            nameOverridden: !!overrideName,
            addressesOverridden: !!(overrideAddresses && overrideAddresses.length > 0),
          }
        });

        // Fire and forget the eCourts search on the client portal
        const clientPortalUrl = process.env.CLIENT_PORTAL_URL || "https://verify.ozclu.com";
        const searchUrl = `${clientPortalUrl}/api/ecourts-search`;
        const internalSecret = process.env.NEXTAUTH_SECRET || "";

        fetch(searchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-api-key": internalSecret,
          },
          body: JSON.stringify({
            verificationId,
            candidateName: searchName,
            addresses: searchAddresses,
          }),
        }).catch((err) => {
          console.error(`[ADMIN] Failed to trigger eCourts retry for ${verificationId}:`, err.message);
        });

        // Add attempt record
        const retryAttempt = {
          date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase(),
          verifier: user.email,
          status: "Processing",
          notes: `Admin-initiated retry. Previous auto-retries: ${verification.courtRecordRetryAttempts || 0}. ${overrideName ? `Name updated to: ${searchName}.` : ""}`
        };

        await db.collection("verifications").updateOne(
          { id: verificationId },
          { $push: { attempts: retryAttempt } as any }
        );

        return NextResponse.json({ success: true });
      }
      case "logEmploymentAttempt": {
        const {
          verificationId, verificationMode, result, comment, verifierNote,
          respondentName, respondentEmail, respondentComment,
          extraPayment, markAsPaid, askCustomerApproval, screenshot, sendEmail
        } = payload;

        if (!verificationId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }

        const attemptEntry = {
          date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase(),
          verificationMode: verificationMode || "Manual",
          result: result || "In Progress",
          comment: comment || "",
          verifierNote: verifierNote || "",
          respondentName: respondentName || "",
          respondentEmail: respondentEmail || "",
          respondentComment: respondentComment || "",
          extraPayment: !!extraPayment,
          markAsPaid: !!markAsPaid,
          askCustomerApproval: !!askCustomerApproval,
          screenshot: screenshot || "",
          sendEmail: !!sendEmail,
          loggedBy: user.email
        };

        // Map result to verification status
        let statusUpdate: string | undefined;
        if (result === "Verified") statusUpdate = "Completed";
        else if (result === "Discrepancy" || result === "Unable to Verify") statusUpdate = "Needs Attention";
        else statusUpdate = "Processing";

        const updateDoc: any = {
          $push: { employmentAttempts: attemptEntry }
        };
        if (statusUpdate) {
          updateDoc.$set = { status: statusUpdate };
          if (statusUpdate === "Completed") {
            updateDoc.$set.completedAt = new Date();
          }
        }

        await db.collection("verifications").updateOne(
          { id: verificationId },
          updateDoc
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "employment_attempt_logged",
          targetType: "verification",
          targetId: verificationId,
          ip,
          userAgent,
          outcome: "success",
          metadata: { verificationMode, result }
        });

        return NextResponse.json({ success: true });
      }
      case "logVerificationAttempt": {
        const {
          verificationId, verificationMode, status: attemptStatus, comment, verifierNote,
          respondentName, respondentEmail, respondentComment,
          extraPayment, markAsPaid, askCustomerApproval, screenshot
        } = payload;

        if (!verificationId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }

        const attemptEntry = {
          date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase(),
          verificationMode: verificationMode || "Manual",
          status: attemptStatus || "In Progress",
          comment: comment || "",
          verifierNote: verifierNote || "",
          respondentName: respondentName || "",
          respondentEmail: respondentEmail || "",
          respondentComment: respondentComment || "",
          extraPayment: !!extraPayment,
          markAsPaid: !!markAsPaid,
          askCustomerApproval: !!askCustomerApproval,
          screenshot: screenshot || "",
          loggedBy: user.email
        };

        // Map status to verification status
        let vStatusUpdate: string | undefined;
        if (attemptStatus === "Verified") vStatusUpdate = "Completed";
        else if (attemptStatus === "Unverified" || attemptStatus === "Discrepancy") vStatusUpdate = "Needs Attention";
        else vStatusUpdate = "Processing";

        const vUpdateDoc: any = {
          $push: { verificationAttempts: attemptEntry }
        };
        if (vStatusUpdate) {
          vUpdateDoc.$set = { status: vStatusUpdate };
          if (vStatusUpdate === "Completed") {
            vUpdateDoc.$set.completedAt = new Date();
          }
        }

        await db.collection("verifications").updateOne(
          { id: verificationId },
          vUpdateDoc
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "verification_attempt_logged",
          targetType: "verification",
          targetId: verificationId,
          ip,
          userAgent,
          outcome: "success",
          metadata: { verificationMode, status: attemptStatus }
        });

        return NextResponse.json({ success: true });
      }
      case "deleteEmploymentAttempt": {
        const { verificationId: delVId, attemptIndex } = payload;

        if (!delVId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }
        if (typeof attemptIndex !== "number" || attemptIndex < 0) {
          return NextResponse.json({ error: "Valid attemptIndex is required" }, { status: 400 });
        }

        // Fetch the verification to get the current attempts array
        const delVerification = await db.collection("verifications").findOne({ id: delVId });
        if (!delVerification) {
          return NextResponse.json({ error: "Verification not found" }, { status: 404 });
        }

        const currentAttempts = delVerification.employmentAttempts || [];
        if (attemptIndex >= currentAttempts.length) {
          return NextResponse.json({ error: "Attempt index out of range" }, { status: 400 });
        }

        // Remove the attempt at the specified index
        currentAttempts.splice(attemptIndex, 1);

        await db.collection("verifications").updateOne(
          { id: delVId },
          { $set: { employmentAttempts: currentAttempts } }
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "employment_attempt_deleted",
          targetType: "verification",
          targetId: delVId,
          ip,
          userAgent,
          outcome: "success",
          metadata: { attemptIndex }
        });

        return NextResponse.json({ success: true });
      }
      case "logEducationAttempt": {
        const {
          verificationId, verificationMode, result, comment, verifierNote,
          respondentName, respondentEmail, respondentComment,
          extraPayment, markAsPaid, askCustomerApproval, screenshot, sendEmail
        } = payload;

        if (!verificationId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }

        const attemptEntry = {
          date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase(),
          verificationMode: verificationMode || "Manual",
          result: result || "In Progress",
          comment: comment || "",
          verifierNote: verifierNote || "",
          respondentName: respondentName || "",
          respondentEmail: respondentEmail || "",
          respondentComment: respondentComment || "",
          extraPayment: !!extraPayment,
          markAsPaid: !!markAsPaid,
          askCustomerApproval: !!askCustomerApproval,
          screenshot: screenshot || "",
          sendEmail: !!sendEmail,
          loggedBy: user.email
        };

        // Map result to verification status
        let statusUpdate: string | undefined;
        if (result === "Verified") statusUpdate = "Completed";
        else if (result === "Discrepancy" || result === "Unable to Verify") statusUpdate = "Needs Attention";
        else statusUpdate = "Processing";

        const updateDoc: any = {
          $push: { educationAttempts: attemptEntry }
        };
        if (statusUpdate) {
          updateDoc.$set = { status: statusUpdate };
          if (statusUpdate === "Completed") {
            updateDoc.$set.completedAt = new Date();
          }
        }

        await db.collection("verifications").updateOne(
          { id: verificationId },
          updateDoc
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "education_attempt_logged",
          targetType: "verification",
          targetId: verificationId,
          ip,
          userAgent,
          outcome: "success",
          metadata: { verificationMode, result }
        });

        return NextResponse.json({ success: true });
      }
      case "deleteEducationAttempt": {
        const { verificationId: delVId, attemptIndex } = payload;

        if (!delVId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }
        if (typeof attemptIndex !== "number" || attemptIndex < 0) {
          return NextResponse.json({ error: "Valid attemptIndex is required" }, { status: 400 });
        }

        // Fetch the verification to get the current attempts array
        const delVerification = await db.collection("verifications").findOne({ id: delVId });
        if (!delVerification) {
          return NextResponse.json({ error: "Verification not found" }, { status: 404 });
        }

        const currentAttempts = delVerification.educationAttempts || [];
        if (attemptIndex >= currentAttempts.length) {
          return NextResponse.json({ error: "Attempt index out of range" }, { status: 400 });
        }

        // Remove the attempt at the specified index
        currentAttempts.splice(attemptIndex, 1);

        await db.collection("verifications").updateOne(
          { id: delVId },
          { $set: { educationAttempts: currentAttempts } }
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "education_attempt_deleted",
          targetType: "verification",
          targetId: delVId,
          ip,
          userAgent,
          outcome: "success",
          metadata: { attemptIndex }
        });

        return NextResponse.json({ success: true });
      }
      case "saveReportData": {
        const { verificationId: reportVId, reportData } = payload;

        if (!reportVId) {
          return NextResponse.json({ error: "verificationId is required" }, { status: 400 });
        }

        await db.collection("verifications").updateOne(
          { id: reportVId },
          {
            $set: {
              reportData,
              reportGeneratedAt: new Date().toISOString(),
              reportGeneratedBy: user.email
            }
          }
        );

        await logAuditEvent(db, {
          actorUserId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          portal: "admin",
          action: "report_generated",
          targetType: "verification",
          targetId: reportVId,
          ip,
          userAgent,
          outcome: "success",
          metadata: {}
        });

        return NextResponse.json({ success: true });
      }
      case "delete_interpol_match":
      case "deleteInterpolMatch": {
        const { verificationId, matchIndex, noticeId, reason, deleteFromDatabase } = payload || {};
        
        if (!verificationId) {
          return NextResponse.json({ error: "Verification ID is required" }, { status: 400 });
        }

        const verification = await db.collection("verifications").findOne({ id: verificationId });

        if (!verification) {
          return NextResponse.json({ error: "Verification record not found" }, { status: 404 });
        }

        let matches: any[] = Array.isArray(verification.interpolMatches) ? [...verification.interpolMatches] : [];

        if (typeof matchIndex === "number" && matchIndex >= 0 && matchIndex < matches.length) {
          matches.splice(matchIndex, 1);
        } else if (noticeId) {
          matches = matches.filter((m: any) => (m.noticeId || m.details?.entity_id) !== noticeId);
        } else {
          return NextResponse.json({ error: "Valid matchIndex or noticeId is required" }, { status: 400 });
        }

        const hasRecords = matches.length > 0;
        const status = hasRecords ? "Needs Attention" : "Completed";
        const reevalNote = reason?.trim() || "Reevaluated: Potential match cleared after manual admin review.";
        const updatedNotes = hasRecords
          ? `Potential match removed after reevaluation (${reevalNote}). ${matches.length} record(s) remaining.`
          : `Reevaluated: All potential database match(es) cleared as false positive(s) (${reevalNote}).`;

        const newAttempt = {
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          verifier: user?.email || "Admin",
          status: status,
          notes: `Match deleted after re-evaluation: ${reevalNote}`
        };

        await db.collection("verifications").updateOne(
          { id: verificationId },
          {
            $set: {
              interpolMatches: matches,
              interpolHasRecords: hasRecords,
              status: status,
              notes: updatedNotes,
              updatedAt: new Date().toISOString()
            },
            $push: { attempts: newAttempt } as any
          }
        );

        if (deleteFromDatabase && noticeId) {
          try {
            await db.collection("interpol_notices").deleteMany({
              $or: [
                { noticeId: noticeId },
                { notice_id: noticeId },
                { entity_id: noticeId },
                { "details.entity_id": noticeId },
                { "details.notice_id": noticeId }
              ]
            });

            const fs = await import("fs");
            const path = await import("path");
            const dbPath = path.resolve(process.cwd(), "..", "database.json");
            const altDbPath = path.resolve(process.cwd(), "database.json");
            const targetDbPath = fs.existsSync(dbPath) ? dbPath : fs.existsSync(altDbPath) ? altDbPath : null;

            if (targetDbPath) {
              const raw = fs.readFileSync(targetDbPath, "utf-8");
              const dbObj = JSON.parse(raw);
              let modified = false;

              if (Array.isArray(dbObj.red_notices)) {
                const initLen = dbObj.red_notices.length;
                dbObj.red_notices = dbObj.red_notices.filter((item: any) => item.notice_id !== noticeId && item.details?.entity_id !== noticeId);
                if (dbObj.red_notices.length !== initLen) {
                  dbObj.red_notices_count = dbObj.red_notices.length;
                  modified = true;
                }
              }

              if (Array.isArray(dbObj.yellow_notices)) {
                const initLen = dbObj.yellow_notices.length;
                dbObj.yellow_notices = dbObj.yellow_notices.filter((item: any) => item.notice_id !== noticeId && item.details?.entity_id !== noticeId);
                if (dbObj.yellow_notices.length !== initLen) {
                  dbObj.yellow_notices_count = dbObj.yellow_notices.length;
                  modified = true;
                }
              }

              if (modified) {
                fs.writeFileSync(targetDbPath, JSON.stringify(dbObj, null, 4), "utf-8");
              }
            }
          } catch (dbErr) {
            console.error("[DATA] Error deleting notice from DB/file:", dbErr);
          }
        }

        await logAuditEvent(db, {
          actorUserId: user?.id || "admin",
          actorEmail: user?.email || "admin",
          actorRole: user?.role || "admin",
          portal: "admin",
          action: "delete_interpol_match",
          targetType: "verification",
          targetId: verificationId,
          ip,
          userAgent,
          outcome: "success"
        });

        return NextResponse.json({ 
          success: true, 
          interpolMatches: matches, 
          interpolHasRecords: hasRecords, 
          status 
        });
      }
      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Mutation failed" }, { status: 500 });
  }
}
