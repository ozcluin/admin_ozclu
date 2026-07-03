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
        ratePerVerification: org ? (org.monthlyRate || 0) : (v.ratePerVerification || 0)
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
        // Look up org rate — all verifiers use the organisation's rate
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

          if (org && org.monthlyRate) {
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
                  { $inc: { amount: org.monthlyRate }, $set: { organisationId: resolvedOrgId, generationType: existingInvoice.generationType || "Auto" } }
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
                  amount: org.monthlyRate,
                  status: "Unpaid",
                  month: currentMonth,
                  year: currentYear,
                  generationType: "Auto"
                });
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
        const { id, name, paymentPlan, monthlyRate, billingDay, createdAt, ownerEmail, ownerName, ownerPassword, maxVerifiers, orgNumber } = payload;
        // If orgNumber was provided by the client, use it; otherwise compute from DB
        let finalOrgNumber = orgNumber;
        if (!finalOrgNumber) {
          const maxDoc = await db.collection("organisations").find({}).sort({ orgNumber: -1 }).limit(1).toArray();
          finalOrgNumber = (maxDoc.length > 0 && maxDoc[0].orgNumber ? maxDoc[0].orgNumber : 0) + 1;
        }
        await db.collection("organisations").insertOne({
          id, name, orgNumber: finalOrgNumber, paymentPlan, monthlyRate, billingDay, createdAt, status: "Active",
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
                ratePerVerification: org.monthlyRate || 0,
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
      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Mutation failed" }, { status: 500 });
  }
}
