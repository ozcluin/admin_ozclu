import { MongoClient, Db } from "mongodb";
import bcrypt from "bcryptjs";
import dns from "dns";
import { validateEnvironment } from "./envGuard";

// Use Google DNS to resolve MongoDB Atlas SRV records
// (the default local DNS may not support SRV lookups)
dns.setServers(["8.8.8.8", "8.8.4.4"]);


const uri = process.env.MONGODB_URI || "";
let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let seeded = false;
let envValidated = false;

if (!uri) {
  throw new Error("Please add your MongoDB URI to .env.local");
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!client) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  const connectedClient = await clientPromise!;
  const db = connectedClient.db("clusoverify");

  // Validate environment on first connection
  if (!envValidated) {
    validateEnvironment();
    envValidated = true;
  }

  // Run automatic seeding only in development with explicit opt-in
  if (!seeded) {
    if (process.env.NODE_ENV !== "production" && process.env.ALLOW_SEEDING === "true") {
      await seedDatabase(db);
    }
    seeded = true;
  }

  return { client: connectedClient, db };
}


async function seedDatabase(db: Db) {
  try {
    // Check if database is already seeded by checking users count
    const existingUsersCount = await db.collection("users").countDocuments();
    if (existingUsersCount > 0) {
      return;
    }

    // 1. Seed settings
    const settingsCount = await db.collection("settings").countDocuments();
    if (settingsCount === 0) {
      await db.collection("settings").insertOne({
        id: "acme",
        companyName: "Acme Corporation",
        address: "123 Innovation Drive",
        city: "Techville",
        postalCode: "90210",
        contactFirstName: "Jane",
        contactLastName: "Doe",
        contactEmail: "jane.doe@acmecorp.com",
        billingOption: "invoice",
        cin: "U74999DL2021PTC384912",
        lut: "LUT-2026-987654",
        tin: "TIN-987654321"
      });
    }

    // 2. Seed verifications
    const verificationsCount = await db.collection("verifications").countDocuments();
    if (verificationsCount === 0) {
      await db.collection("verifications").insertMany([
        {
          id: "REQ-8902",
          name: "John Doe",
          email: "john.doe@gmail.com",
          orgName: "Acme Corporation",
          date: "Oct 24, 2023",
          status: "Completed",
          verifier: "Alice Jones",
          reportDetails: "All verification checks passed. SSN validated, criminal record check returned clean, and past 3 employers verified successfully.",
          notes: "Completed without issues.",
          attempts: [
            {
              date: "Oct 22, 2023",
              verifier: "Alice Jones",
              status: "Processing",
              notes: "Initiated identity and background validation checks."
            },
            {
              date: "Oct 24, 2023",
              verifier: "Alice Jones",
              status: "Completed",
              notes: "Completed checking educational and employment history."
            }
          ]
        },
        {
          id: "REQ-8901",
          name: "Acme Corp KYB",
          email: "compliance@acmecorp.com",
          orgName: "Acme Corporation",
          date: "Oct 22, 2023",
          status: "Processing",
          verifier: "Bob Smith",
          reportDetails: null,
          notes: "Checking company records in municipal directory.",
          attempts: [
            {
              date: "Oct 22, 2023",
              verifier: "Bob Smith",
              status: "Processing",
              notes: "Initiated municipal register audits."
            }
          ]
        },
        {
          id: "REQ-8895",
          name: "Jane Smith",
          email: "jane.smith@yahoo.com",
          orgName: "Acme Corporation",
          date: "Oct 18, 2023",
          status: "Completed",
          verifier: "Alice Jones",
          reportDetails: "Identity verified. ID scan match score: 98%. Address history confirmed with postal utility database.",
          notes: "Verified using digital identification check.",
          attempts: [
            {
              date: "Oct 15, 2023",
              verifier: "Alice Jones",
              status: "Processing",
              notes: "Checking ID scan matching score and address history."
            },
            {
              date: "Oct 18, 2023",
              verifier: "Alice Jones",
              status: "Completed",
              notes: "Completed verification utilizing DigiLocker secure integration."
            }
          ]
        },
        {
          id: "REQ-8880",
          name: "Global Tech Screening",
          email: "hr@globaltech.com",
          orgName: "Global Tech Inc",
          date: "Oct 10, 2023",
          status: "Needs Attention",
          verifier: null,
          reportDetails: null,
          notes: "Missing scan of Passport bio-page. Notification sent to subject.",
          attempts: [
            {
              date: "Oct 10, 2023",
              verifier: "Admin",
              status: "Needs Attention",
              notes: "Passport scan mismatch. Requested subject upload."
            }
          ]
        },
        {
          id: "REQ-8875",
          name: "Michael Chen",
          email: "mchen@gmail.com",
          orgName: "Acme Corporation",
          date: "Oct 05, 2023",
          status: "Completed",
          verifier: "Charlie Brown",
          reportDetails: "International background check finished. National ID card and educational records verified with Shanghai Jiao Tong University.",
          notes: "Completed checks on foreign documents.",
          attempts: [
            {
              date: "Oct 02, 2023",
              verifier: "Charlie Brown",
              status: "Processing",
              notes: "Initiated contact with Shanghai Jiao Tong University registry."
            },
            {
              date: "Oct 05, 2023",
              verifier: "Charlie Brown",
              status: "Completed",
              notes: "Confirmed registry response; ID card verified."
            }
          ]
        }
      ]);
    }

    // 3. Seed invoices
    const invoicesCount = await db.collection("invoices").countDocuments();
    if (invoicesCount === 0) {
      await db.collection("invoices").insertMany([
        {
          id: "INV-2023-11",
          orgName: "Acme Corporation",
          organisationId: "ORG-1001",
          date: "Nov 01, 2023",
          dueDate: "Nov 15, 2023",
          amount: 15,
          status: "Unpaid",
          month: "November",
          year: 2023
        },
        {
          id: "INV-2023-10",
          orgName: "Acme Corporation",
          organisationId: "ORG-1001",
          date: "Oct 01, 2023",
          dueDate: "Oct 15, 2023",
          amount: 45,
          status: "Paid",
          month: "October",
          year: 2023
        },
        {
          id: "INV-2023-09",
          orgName: "Acme Corporation",
          organisationId: "ORG-1001",
          date: "Sep 01, 2023",
          dueDate: "Sep 15, 2023",
          amount: 30,
          status: "Paid",
          month: "September",
          year: 2023
        }
      ]);
    }

    // 3b. Seed organisations
    const organisationsCount = await db.collection("organisations").countDocuments();
    if (organisationsCount === 0) {
      await db.collection("organisations").insertMany([
        {
          id: "ORG-1001",
          name: "Acme Corporation",
          paymentPlan: "monthly",
          monthlyRate: 15,
          billingDay: 1,
          bankName: "State Bank of India",
          accountNumber: "1234567890123456",
          ifscCode: "SBIN0001234",
          upiId: "cluso@sbi",
          paymentNotes: "Please include your Organisation ID in the payment reference.",
          createdAt: "Jan 15, 2023",
          status: "Active"
        },
        {
          id: "ORG-1002",
          name: "Global Tech Inc",
          paymentPlan: "monthly",
          monthlyRate: 25,
          billingDay: 15,
          bankName: "HDFC Bank",
          accountNumber: "9876543210987654",
          ifscCode: "HDFC0005678",
          upiId: "cluso@hdfc",
          paymentNotes: "Net-30 payment terms apply.",
          createdAt: "Mar 10, 2023",
          status: "Active"
        }
      ]);
    }

    // 4. Seed verifiers
    const verifiersCount = await db.collection("verifiers").countDocuments();
    if (verifiersCount === 0) {
      await db.collection("verifiers").insertMany([
        {
          id: "V-001",
          name: "Alice Jones",
          email: "alice@cluso.in",
          org: "Cluso",
          organisationId: "ORG-1001",
          designation: "Senior Verification Analyst",
          status: "Active",
          ratePerVerification: 5
        },
        {
          id: "V-002",
          name: "Bob Smith",
          email: "bob@cluso.in",
          org: "Cluso",
          organisationId: "ORG-1001",
          designation: "Verification Specialist",
          status: "Active",
          ratePerVerification: 4
        },
        {
          id: "V-003",
          name: "Charlie Brown",
          email: "charlie@cluso.in",
          org: "Cluso",
          organisationId: "ORG-1002",
          designation: "Junior Analyst",
          status: "Pending",
          ratePerVerification: 3
        }
      ]);
    }

    // 5. Seed users (default accounts)
    const usersCount = await db.collection("users").countDocuments();
    if (usersCount === 0) {
      const hashedAdminPassword = bcrypt.hashSync("Cluso@2026", 10);
      const hashedClientPassword = bcrypt.hashSync("client123", 10);
      await db.collection("users").insertMany([
        {
          email: "admin@cluso.in",
          password: hashedAdminPassword,
          fullName: "Admin User",
          role: "admin",
          orgName: "Cluso",
          createdAt: new Date()
        },
        {
          email: "client@test.com",
          password: hashedClientPassword,
          fullName: "Client User",
          role: "client",
          orgName: "Acme Corporation",
          createdAt: new Date()
        }
      ]);
    }
  } catch (error) {
    console.error("Seeding error in MongoDB:", error);
  }
}
