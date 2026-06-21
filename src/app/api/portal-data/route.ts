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

    // Sanitize _id fields
    const cleanSettings = settings ? { ...settings, _id: settings._id.toString() } : null;
    const cleanVerifications = verifications.map(sanitizeVerification);
    const cleanInvoices = invoices.map(sanitizeInvoice);
    const cleanVerifiers = verifiers.map(v => ({ ...v, _id: v._id.toString() }));
    const cleanOrganisations = organisations.map(o => ({ ...o, _id: o._id.toString() }));

    return NextResponse.json({
      settings: cleanSettings,
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
        const { id, name, email, orgName, date, status, verifier, notes } = payload;
        
        const { randomBytes } = await import("crypto");
        const bcrypt = await import("bcryptjs");

        // Generate a temporary password matching Cluso@<random8chars>
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randStr = "";
        const randomBytesArr = randomBytes(8);
        for (let i = 0; i < 8; i++) {
          randStr += charset.charAt(randomBytesArr[i] % charset.length);
        }
        const tempPassword = `Cluso@${randStr}`;
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
        const candidatePortalUrl = process.env.CANDIDATE_PORTAL_URL || "https://candidate.verify.cluso.in";
        const setupUrl = `${candidatePortalUrl}/?email=${encodeURIComponent(email.toLowerCase().trim())}&password=${encodeURIComponent(tempPassword)}`;

        await db.collection("verifications").insertOne({
          id,
          name,
          email: email.toLowerCase().trim(),
          orgName,
          date,
          status,
          verifier,
          notes,
          onboardingStatus: "active",
          tempPassword,
          attempts: [initialAttempt],
          setupUrl
        });

        return NextResponse.json({ success: true, setupUrl });
      }
      case "updateSettings": {
        const { companyName, address, city, postalCode, contactFirstName, contactLastName, contactEmail, billingOption, cin, lut, tin } = payload;
        await db.collection("settings").updateOne(
          { id: "acme" },
          {
            $set: {
              companyName, address, city, postalCode, contactFirstName, contactLastName, contactEmail, billingOption, cin, lut, tin
            }
          },
          { upsert: true }
        );
        break;
      }
      case "inviteVerifier": {
        const { id, name, email, org, status, password, ratePerVerification, organisationId, designation } = payload;
        await db.collection("verifiers").insertOne({
          id, name, email, org, status, ratePerVerification: ratePerVerification ?? 0, organisationId: organisationId || null, designation: designation || null
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
        const { id, status, paymentProof, paymentProofDate, ...rest } = payload;
        const updateFields: any = { status };
        if (paymentProof !== undefined) updateFields.paymentProof = paymentProof;
        if (paymentProofDate !== undefined) updateFields.paymentProofDate = paymentProofDate;
        await db.collection("invoices").updateOne(
          { id },
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
        const { id, orgName, date, dueDate, amount, status } = payload;
        await db.collection("invoices").insertOne({
          id, orgName, date, dueDate, amount, status
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
            const invoiceId = `INV-${orgName.replace(/\s+/g, "").substring(0, 4).toUpperCase()}-${currentYear}-${currentMonth.substring(0, 3).toUpperCase()}`;

            // Check if an unpaid invoice already exists for this org + month + year
            const existingInvoice = await db.collection("invoices").findOne({
              orgName,
              month: currentMonth,
              year: currentYear,
              status: { $ne: "Paid" },
              isDeleted: { $ne: true }
            });

            if (existingInvoice) {
              // Increment the existing invoice amount
              await db.collection("invoices").updateOne(
                { _id: existingInvoice._id },
                { $inc: { amount: org.monthlyRate } }
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
                organisationId: org.id || org._id.toString(),
                date: generatedDate,
                dueDate,
                amount: org.monthlyRate,
                status: "Unpaid",
                month: currentMonth,
                year: currentYear,
              });
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
        const { id, name, paymentPlan, monthlyRate, billingDay, createdAt } = payload;
        await db.collection("organisations").insertOne({
          id, name, paymentPlan, monthlyRate, billingDay, createdAt, status: "Active"
        });
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
        const { id, orgName, organisationId, date, dueDate, amount, status, month, year } = payload;
        // Auto-delete existing non-paid invoice for same org/month/year
        if (organisationId && month && year) {
          await db.collection("invoices").deleteMany({
            organisationId,
            month: { $regex: new RegExp("^" + month + "$", "i") },
            year,
            status: { $ne: "Paid" }
          });
        }
        await db.collection("invoices").insertOne({
          id, orgName, organisationId, date, dueDate, amount, status, month, year
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
