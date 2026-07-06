"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "src/context/AuthContext";

// Types
export interface Verification {
  id: string;
  name: string;
  email: string;
  orgName: string;
  requestingOrgName?: string;
  date: string;
  status: "Completed" | "Processing" | "Needs Attention";
  verifier: string | null;
  reportDetails?: string;
  notes?: string;
  onboardingStatus?: string;
  digilockerStatus?: string;
  digilockerUsername?: string;
  digilockerName?: string;
  digilockerAge?: string;
  digilockerDob?: string;
  digilockerGender?: string;
  digilockerAadhaar?: string;
  digilockerPan?: string;
  digilockerDrivingLicence?: string;
  digilockerMobile?: string;
  digilockerEmail?: string;
  digilockerId?: string;
  digilockerReferenceKey?: string;
  digilockerPhoto?: string;
  digilockerDocuments?: any[];
  completedAt?: Date | string;
  attempts?: Array<{
    date: string;
    verifier: string;
    status: string;
    notes?: string;
  }>;
  setupUrl?: string;
  // Court Record Verification fields
  type?: "identity" | "court_record";
  candidateDob?: string;
  addresses?: Array<{ address: string; city: string; state: string; country: string }>;
  courtRecordResults?: Array<{
    addressIndex: number;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    district: string;
    districtCode: string;
    complexSearches: Array<{
      complexName: string;
      complexCode: string;
      casesFound: number;
      cases: Array<{
        caseNumber: string;
        petitioner: string;
        respondent: string;
        orderDate: string;
      }>;
      error?: string;
    }>;
  }>;
  courtRecordSummary?: string;
  courtRecordStatus?: string;
  courtRecordHasRecords?: boolean;
  courtRecordTotalCases?: number;
  courtRecordTotalComplexes?: number;
  courtRecordErrors?: string[];
  courtRecordProgress?: string;
}

export interface InvoiceActivity {
  id: string;
  type: "generated" | "submitted" | "approved" | "rejected" | "status_change";
  status?: "Paid" | "Unpaid" | "Overdue" | "Pending" | "Defaulted";
  timestamp: string;
  actor: string;
  note?: string;
  paymentProof?: string;
}

export interface Invoice {
  _id?: string;
  id: string;
  orgName: string;
  organisationId?: string;
  date: string;
  dueDate: string;
  amount: number;
  status: "Paid" | "Unpaid" | "Overdue" | "Pending";
  month?: string;
  year?: number;
  paymentProof?: string;
  paymentProofDate?: string;
  generationType?: "Auto" | "Manual";
  adminNote?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  clientNote?: string;
  approvedBy?: string;
  approvedDate?: string;
  activityLog?: InvoiceActivity[];
}

export interface Verifier {
  id: string;
  name: string;
  email: string;
  org: string;
  organisationId?: string;
  designation?: string;
  status: "Active" | "Pending" | "Inactive";
  ratePerVerification: number;
}

export interface Organisation {
  id: string;
  name: string;
  orgNumber?: number;
  paymentPlan: "monthly" | "pay_as_you_go";
  monthlyRate: number;
  billingDay: number;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  paymentNotes?: string;
  createdAt: string;
  status?: "Active" | "Deactivated";
  ownerEmail?: string;
  ownerName?: string;
  maxVerifiers?: number;
}

export interface CompanySettings {
  companyName: string;
  address: string;
  city: string;
  postalCode: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  billingOption: "invoice" | "card";
  cin: string;
  lut: string;
  tin: string;
  gstin: string;
  invoiceEmail: string;
  billingSameAsCompany: boolean;
  billingAddress: string;
  sac?: string;
  logo?: string;
  recentRequestingOrgs?: string[];
}

interface PortalContextType {
  verifications: Verification[];
  invoices: Invoice[];
  verifiers: Verifier[];
  organisations: Organisation[];
  settings: CompanySettings;
  allSettings: CompanySettings[];
  addVerification: (name: string, email: string, orgName: string) => Promise<any>;
  updateSettings: (newSettings: CompanySettings) => Promise<void>;
  inviteVerifier: (name: string, email: string, org: string, password?: string, ratePerVerification?: number, organisationId?: string, designation?: string) => Promise<void>;
  updateVerifierRate: (verifierId: string, rate: number) => Promise<void>;
  updateVerifierStatus: (verifierId: string, status: "Active" | "Pending" | "Inactive") => Promise<void>;
  deleteVerifier: (verifierId: string) => Promise<void>;
  updateInvoiceStatus: (id: string, status: "Paid" | "Unpaid" | "Overdue" | "Pending", extras?: Partial<Invoice>, dbId?: string) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addInvoice: (orgName: string, amount: number, dueDate: string) => Promise<void>;
  assignVerifier: (verificationId: string, verifierName: string | null) => Promise<void>;
  updateVerificationStatus: (verificationId: string, status: "Completed" | "Processing" | "Needs Attention", notes?: string) => Promise<void>;
  addOrganisation: (name: string, monthlyRate: number, ownerName?: string, ownerEmail?: string, ownerPassword?: string, maxVerifiers?: number) => Promise<void>;
  updateOrganisation: (id: string, updates: Partial<Organisation>) => Promise<void>;
  deleteOrganisation: (id: string) => Promise<void>;
  deactivateOrganisation: (id: string, invoiceOption: "keep" | "default") => Promise<void>;
  activateOrganisation: (id: string) => Promise<void>;
  generateMonthlyInvoice: (orgId: string, month: string, year: number) => Promise<void>;
  hasPaidInvoiceForMonth: (orgId: string, month: string, year: number) => boolean;
  fetchVerificationDetail: (id: string) => Promise<Verification>;
  updateOrgSettings: (orgName: string, settings: Partial<CompanySettings>) => Promise<void>;
  setOrganisationOwner: (orgId: string, ownerName: string, ownerEmail: string, ownerPassword?: string, maxVerifiers?: number) => Promise<void>;
  refreshData: () => Promise<void>;
  removeRecentRequestingOrg: (requestingOrgName: string, orgName?: string) => Promise<void>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

// Default empty settings for fresh accounts
const defaultSettings: CompanySettings = {
  companyName: "",
  address: "",
  city: "",
  postalCode: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  billingOption: "invoice",
  cin: "",
  lut: "",
  tin: "",
  gstin: "",
  invoiceEmail: "",
  billingSameAsCompany: true,
  billingAddress: "",
  sac: ""
};

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, logout } = useAuth();
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [allSettings, setAllSettings] = useState<CompanySettings[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Sync / Fetch function from MongoDB API route
  const fetchAllData = async () => {
    try {
      const res = await fetch("/api/portal-data");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          await logout();
          return;
        }
        throw new Error("Failed to load dashboard data");
      }
      const data = await res.json();

      if (data.settings) {
        setSettings({
          companyName: data.settings.companyName,
          address: data.settings.address,
          city: data.settings.city,
          postalCode: data.settings.postalCode,
          contactFirstName: data.settings.contactFirstName,
          contactLastName: data.settings.contactLastName,
          contactEmail: data.settings.contactEmail,
          billingOption: data.settings.billingOption,
          cin: data.settings.cin || "",
          lut: data.settings.lut || "",
          tin: data.settings.tin || "",
          gstin: data.settings.gstin || "",
          invoiceEmail: data.settings.invoiceEmail || "",
          billingSameAsCompany: data.settings.billingSameAsCompany !== undefined ? data.settings.billingSameAsCompany : true,
          billingAddress: data.settings.billingAddress || "",
          sac: data.settings.sac || "",
          logo: data.settings.logo || "",
          recentRequestingOrgs: data.settings.recentRequestingOrgs || []
        });
      }

      if (data.verifications) {
        setVerifications(data.verifications);
      }

      if (data.invoices) {
        const formattedInvoices = data.invoices.map((inv: any) => ({
          ...inv,
          amount: parseFloat(inv.amount)
        }));
        setInvoices(formattedInvoices);
      }

      if (data.verifiers) {
        setVerifiers(data.verifiers);
      }

      if (data.organisations) {
        setOrganisations(data.organisations);
      }
      if (data.allSettings) {
        setAllSettings(data.allSettings);
      }
    } catch (err) {
      console.error("Error reading tables from API:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    } else {
      setVerifications([]);
      setInvoices([]);
      setVerifiers([]);
      setOrganisations([]);
      setAllSettings([]);
      setSettings(defaultSettings);
    }
  }, [isAuthenticated]);

  const addVerification = async (name: string, email: string, orgName: string) => {
    const cleanOrg = orgName.replace(/[^a-zA-Z]/g, "").slice(0, 3).padEnd(3, "X").toUpperCase();
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;
    const newId = `${cleanOrg}${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRecord: Verification = {
      id: newId,
      name,
      email,
      orgName,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      status: "Processing",
      verifier: null,
      notes: "Awaiting verifier assignment."
    };

    setVerifications((prev) => [newRecord, ...prev]);

    try {
      const res = await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addVerification", payload: newRecord })
      });
      if (res.ok) {
        const data = await res.json();
        fetchAllData();
        return data;
      }
    } catch (err) {
      console.error("Failed inserting verification:", err);
    }
    fetchAllData();
    return null;
  };

  const updateSettings = async (newSettings: CompanySettings) => {
    setSettings(newSettings);
    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateSettings", payload: newSettings })
      });
    } catch (err) {
      console.error("Failed updating settings:", err);
    }
    fetchAllData();
  };

  const inviteVerifier = async (name: string, email: string, org: string, password?: string, ratePerVerification?: number, organisationId?: string, designation?: string) => {
    const newId = `V-${Math.floor(100 + Math.random() * 900)}`;
    const rate = ratePerVerification ?? 0;
    const newVerifier: Verifier = {
      id: newId,
      name,
      email,
      org,
      organisationId,
      designation,
      status: "Pending",
      ratePerVerification: rate
    };

    setVerifiers((prev) => [...prev, newVerifier]);

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inviteVerifier", payload: { ...newVerifier, password } })
      });
    } catch (err) {
      console.error("Failed inviting verifier:", err);
    }
    fetchAllData();
  };

  const updateVerifierRate = async (verifierId: string, rate: number) => {
    setVerifiers((prev) =>
      prev.map((v) => (v.id === verifierId ? { ...v, ratePerVerification: rate } : v))
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateVerifierRate", payload: { verifierId, rate } })
      });
    } catch (err) {
      console.error("Failed updating verifier rate:", err);
    }
    fetchAllData();
  };

  const updateInvoiceStatus = async (id: string, status: "Paid" | "Unpaid" | "Overdue" | "Pending", extras?: Partial<Invoice>, dbId?: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (dbId && inv._id === dbId) return { ...inv, status, ...extras };
        if (!dbId && inv.id === id) return { ...inv, status, ...extras };
        return inv;
      })
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateInvoiceStatus", payload: { id, status, dbId, ...(extras || {}) } })
      });
    } catch (err) {
      console.error("Failed updating invoice status:", err);
    }
    await fetchAllData();
  };

  const deleteInvoice = async (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteInvoice", payload: { id } })
      });
    } catch (err) {
      console.error("Failed deleting invoice:", err);
    }
    fetchAllData();
  };

  const addInvoice = async (orgName: string, amount: number, dueDate: string) => {
    // Build new invoice ID: INV-{orgNumber}-{orgPrefix}-{month}-{year}
    const matchedOrg = organisations.find((o) => o.name === orgName);
    const orgNum = String(matchedOrg?.orgNumber || 0).padStart(3, "0");
    const orgPrefix = orgName.replace(/\s+/g, "").substring(0, 3).toUpperCase();
    const now = new Date();
    const monthAbbr = now.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const yearStr = now.getFullYear();
    const newId = `INV-${orgNum}-${orgPrefix}-${monthAbbr}-${yearStr}`;
    const timestamp = new Date().toISOString();
    const newInvoice: Invoice = {
      id: newId,
      orgName,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      dueDate,
      amount,
      status: "Unpaid",
      generationType: "Manual",
      activityLog: [
        {
          id: `act-${Date.now()}-gen`,
          type: "generated",
          timestamp,
          actor: "System / Admin",
          note: "Invoice generated manually"
        }
      ]
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addInvoice", payload: newInvoice })
      });
    } catch (err) {
      console.error("Failed adding invoice:", err);
    }
    fetchAllData();
  };

  const assignVerifier = async (verificationId: string, verifierName: string | null) => {
    setVerifications((prev) =>
      prev.map((v) => (v.id === verificationId ? { ...v, verifier: verifierName } : v))
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assignVerifier", payload: { verificationId, verifierName } })
      });
    } catch (err) {
      console.error("Failed assigning verifier:", err);
    }
    fetchAllData();
  };

  const updateVerificationStatus = async (
    verificationId: string,
    status: "Completed" | "Processing" | "Needs Attention",
    notes?: string
  ) => {
    setVerifications((prev) =>
      prev.map((v) => {
        if (v.id === verificationId) {
          const reportDetails = status === "Completed"
            ? "Verification completed successfully. Standard identity checks, credential confirmation, and credit history assessment validated without discrepancy."
            : v.reportDetails;
          return {
            ...v,
            status,
            reportDetails,
            notes: notes || v.notes
          };
        }
        return v;
      })
    );

    try {
      const updateObj: any = { status };
      if (notes !== undefined) updateObj.notes = notes;
      if (status === "Completed") {
        updateObj.reportDetails = "Verification completed successfully. Standard identity checks, credential confirmation, and credit history assessment validated without discrepancy.";
      }

      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateVerificationStatus", payload: { verificationId, ...updateObj } })
      });
    } catch (err) {
      console.error("Failed updating verification status:", err);
    }
    fetchAllData();
  };

  const updateVerifierStatus = async (verifierId: string, status: "Active" | "Pending" | "Inactive") => {
    setVerifiers((prev) =>
      prev.map((v) => (v.id === verifierId ? { ...v, status } : v))
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateVerifierStatus", payload: { verifierId, status } })
      });
    } catch (err) {
      console.error("Failed updating verifier status:", err);
    }
    fetchAllData();
  };

  const deleteVerifier = async (verifierId: string) => {
    setVerifiers((prev) => prev.filter((v) => v.id !== verifierId));

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteVerifier", payload: { verifierId } })
      });
    } catch (err) {
      console.error("Failed deleting verifier:", err);
    }
    fetchAllData();
  };

  // ── Organisation CRUD ──

  const addOrganisation = async (name: string, monthlyRate: number, ownerName?: string, ownerEmail?: string, ownerPassword?: string, maxVerifiers?: number) => {
    const newId = `ORG-${Math.floor(1000 + Math.random() * 9000)}`;
    // Compute next sequential org number
    const maxExisting = organisations.reduce((max, o) => Math.max(max, o.orgNumber || 0), 0);
    const nextOrgNumber = maxExisting + 1;
    const newOrg: Organisation = {
      id: newId,
      name,
      orgNumber: nextOrgNumber,
      paymentPlan: "monthly",
      monthlyRate,
      billingDay: 0,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      ownerEmail: ownerEmail || undefined,
      ownerName: ownerName || undefined,
      maxVerifiers: maxVerifiers ?? 5,
    };

    setOrganisations((prev) => [...prev, newOrg]);

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addOrganisation", payload: { ...newOrg, ownerPassword } })
      });
    } catch (err) {
      console.error("Failed adding organisation:", err);
    }
    fetchAllData();
  };

  const updateOrganisation = async (id: string, updates: Partial<Organisation>) => {
    setOrganisations((prev) =>
      prev.map((org) => (org.id === id ? { ...org, ...updates } : org))
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateOrganisation", payload: { id, updates } })
      });
    } catch (err) {
      console.error("Failed updating organisation:", err);
    }
    fetchAllData();
  };

  const setOrganisationOwner = async (orgId: string, ownerName: string, ownerEmail: string, ownerPassword?: string, maxVerifiers?: number) => {
    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setOrganisationOwner", payload: { orgId, ownerName, ownerEmail, ownerPassword, maxVerifiers } })
      });
    } catch (err) {
      console.error("Failed setting organisation owner:", err);
    }
    fetchAllData();
  };

  const deleteOrganisation = async (id: string) => {
    setOrganisations((prev) => prev.filter((org) => org.id !== id));

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteOrganisation", payload: { id } })
      });
    } catch (err) {
      console.error("Failed deleting organisation:", err);
    }
    fetchAllData();
  };

  const deactivateOrganisation = async (id: string, invoiceOption: "keep" | "default") => {
    setOrganisations((prev) =>
      prev.map((org) => (org.id === id ? { ...org, status: "Deactivated" } : org))
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivateOrganisation", payload: { id, invoiceOption } })
      });
    } catch (err) {
      console.error("Failed deactivating organisation:", err);
    }
    fetchAllData();
  };

  const activateOrganisation = async (id: string) => {
    setOrganisations((prev) =>
      prev.map((org) => (org.id === id ? { ...org, status: "Active" } : org))
    );

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activateOrganisation", payload: { id } })
      });
    } catch (err) {
      console.error("Failed activating organisation:", err);
    }
    fetchAllData();
  };

  const generateMonthlyInvoice = async (orgId: string, month: string, year: number) => {
    const org = organisations.find((o) => o.id === orgId);
    if (!org) return;

    // Count completed verifications for this organisation in the selected month & year
    const matchingVerifications = verifications.filter((v) => {
      if (v.orgName !== org.name || v.status !== "Completed") return false;
      try {
        // Use completedAt if available, fall back to date
        const d = new Date(v.completedAt || v.date);
        if (isNaN(d.getTime())) return false;
        const mName = d.toLocaleDateString("en-US", { month: "long" });
        const yVal = d.getFullYear();
        return mName.toLowerCase() === month.toLowerCase() && yVal === year;
      } catch {
        return false;
      }
    });

    const completedCount = matchingVerifications.length;
    const amount = completedCount * org.monthlyRate;

    const orgNum = String(org.orgNumber || 0).padStart(3, "0");
    const orgPrefix = org.name.replace(/\s+/g, "").substring(0, 3).toUpperCase();
    const monthAbbr = month.substring(0, 3).toUpperCase();
    const newId = `INV-${orgNum}-${orgPrefix}-${monthAbbr}-${year}`;
    const generatedDate = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    // Due date is last day of the billing month
    const monthIndex = new Date(`${month} 1, ${year}`).getMonth();
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const dueDate = new Date(year, monthIndex, lastDayOfMonth, 23, 59).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

    const newInvoice: Invoice = {
      id: newId,
      orgName: org.name,
      organisationId: orgId,
      date: generatedDate,
      dueDate,
      amount,
      status: "Unpaid",
      month,
      year,
      generationType: "Manual",
    };

    // Optimistic update: remove existing unpaid invoices for same org/month/year
    // Match by BOTH organisationId AND orgName to catch auto-generated invoices
    setInvoices((prev) => [
      newInvoice,
      ...prev.filter(
        (inv) =>
          !(
            (inv.organisationId === orgId || inv.orgName === org.name) &&
            inv.month?.toLowerCase() === month.toLowerCase() &&
            inv.year === year &&
            inv.status !== "Paid"
          )
      )
    ]);

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateMonthlyInvoice", payload: newInvoice })
      });
    } catch (err) {
      console.error("Failed generating monthly invoice:", err);
    }
    fetchAllData();
  };


  // Check if a paid invoice already exists for the given org/month/year
  const hasPaidInvoiceForMonth = (orgId: string, month: string, year: number): boolean => {
    return invoices.some((inv) =>
      inv.organisationId === orgId &&
      inv.month?.toLowerCase() === month.toLowerCase() &&
      inv.year === year &&
      inv.status === "Paid"
    );
  };

  const fetchVerificationDetail = async (id: string): Promise<Verification> => {
    const res = await fetch(`/api/portal-data/verification-detail?id=${id}`);
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to load verification details");
    }
    const data = await res.json();
    return data.verification;
  };

  const updateOrgSettings = async (orgName: string, newSettings: Partial<CompanySettings>) => {
    // Optimistic update of allSettings
    setAllSettings((prev) => {
      const idx = prev.findIndex((s) => s.companyName?.toLowerCase() === orgName.toLowerCase());
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...newSettings };
        return updated;
      }
      return [...prev, { ...defaultSettings, companyName: orgName, ...newSettings }];
    });

    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateOrgSettings", payload: { orgName, settings: newSettings } })
      });
    } catch (err) {
      console.error("Failed updating org settings:", err);
    }
    fetchAllData();
  };

  const removeRecentRequestingOrg = async (requestingOrgName: string, orgName?: string) => {
    try {
      await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeRecentRequestingOrg", payload: { requestingOrgName, orgName } })
      });
      fetchAllData();
    } catch (err) {
      console.error("Failed removing recent requesting org:", err);
    }
  };

  return (
    <PortalContext.Provider
      value={{
        verifications,
        invoices,
        verifiers,
        organisations,
        settings,
        allSettings,
        addVerification,
        updateSettings,
        inviteVerifier,
        updateVerifierRate,
        updateVerifierStatus,
        deleteVerifier,
        updateInvoiceStatus,
        deleteInvoice,
        addInvoice,
        assignVerifier,
        updateVerificationStatus,
        addOrganisation,
        updateOrganisation,
        deleteOrganisation,
        deactivateOrganisation,
        activateOrganisation,
        generateMonthlyInvoice,
        hasPaidInvoiceForMonth,
        fetchVerificationDetail,
        updateOrgSettings,
        setOrganisationOwner,
        removeRecentRequestingOrg,
        refreshData: fetchAllData,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
};

export const usePortal = () => {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortal must be used within a PortalProvider");
  }
  return context;
};
