"use client";

import React, { useState, useMemo } from "react";
import { usePortal } from "src/context/PortalContext";
import type { Organisation, Verifier, Invoice, InvoiceActivity } from "src/context/PortalContext";
import { useAuth } from "src/context/AuthContext";

// ── Month names for selectors ──
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ManageInvoicesPage() {
  const { user, profile } = useAuth();
  const {
    organisations,
    verifiers,
    invoices,
    verifications,
    allSettings,
    addOrganisation,
    updateOrganisation,
    deleteOrganisation,
    deactivateOrganisation,
    activateOrganisation,
    generateMonthlyInvoice,
    inviteVerifier,
    updateInvoiceStatus,
    hasPaidInvoiceForMonth,
    updateOrgSettings,
    setOrganisationOwner,
  } = usePortal();

  // ── Selected organisation ──
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const selectedOrg = organisations.find((o) => o.id === selectedOrgId) || null;

  // ── Create Organisation form ──
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgRate, setNewOrgRate] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newMaxVerifiers, setNewMaxVerifiers] = useState("5");

  // ── Organisation Owner editing ──
  const [editingOwner, setEditingOwner] = useState(false);
  const [ownerNameInput, setOwnerNameInput] = useState("");
  const [ownerEmailInput, setOwnerEmailInput] = useState("");
  const [ownerPasswordInput, setOwnerPasswordInput] = useState("");
  const [maxVerifiersInput, setMaxVerifiersInput] = useState("5");
  const [ownerSaving, setOwnerSaving] = useState(false);

  const [orgError, setOrgError] = useState("");
  const [orgSuccess, setOrgSuccess] = useState("");

  // ── Payment Details editing ──
  const [editingPayment, setEditingPayment] = useState(false);
  const [payBankName, setPayBankName] = useState("");
  const [payAccountNumber, setPayAccountNumber] = useState("");
  const [payIfscCode, setPayIfscCode] = useState("");
  const [payUpiId, setPayUpiId] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  // ── Verifier creation under org ──
  const [vName, setVName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vDesignation, setVDesignation] = useState("");
  const [vPassword, setVPassword] = useState("");
  const [vRate, setVRate] = useState("");
  const [vError, setVError] = useState("");
  const [vSuccess, setVSuccess] = useState("");

  // ── Invoice generation ──
  const [invoiceMonth, setInvoiceMonth] = useState(MONTHS[new Date().getMonth()]);
  const [invoiceYear, setInvoiceYear] = useState(String(new Date().getFullYear()));
  const [invoiceSuccess, setInvoiceSuccess] = useState("");
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [invoiceStatusChange, setInvoiceStatusChange] = useState<{
    invoice: Invoice;
    targetStatus: "Paid" | "Unpaid" | "Overdue" | "Pending";
  } | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [invoiceRejection, setInvoiceRejection] = useState<{
    invoice: Invoice;
  } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [activeScreenshotPreview, setActiveScreenshotPreview] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [adminModalClosing, setAdminModalClosing] = useState<"details" | "status" | "rejection" | null>(null);

  const handleCloseAdminModal = (type: "details" | "status" | "rejection") => {
    setAdminModalClosing(type);
    setTimeout(() => {
      if (type === "details") setDetailInvoice(null);
      else if (type === "status") setInvoiceStatusChange(null);
      else if (type === "rejection") {
        setInvoiceRejection(null);
        setRejectionReasonInput("");
      }
      setAdminModalClosing(null);
    }, 600);
  };

  // ── Enterprise details editing ──
  const [editingEnterprise, setEditingEnterprise] = useState(false);
  const [enterpriseSaving, setEnterpriseSaving] = useState(false);
  const [entGstin, setEntGstin] = useState("");
  const [entCin, setEntCin] = useState("");
  const [entTin, setEntTin] = useState("");
  const [entLut, setEntLut] = useState("");
  const [entAddress, setEntAddress] = useState("");
  const [entCity, setEntCity] = useState("");
  const [entPostalCode, setEntPostalCode] = useState("");
  const [entBillingSameAsCompany, setEntBillingSameAsCompany] = useState(true);
  const [entBillingAddress, setEntBillingAddress] = useState("");
  const [entInvoiceEmail, setEntInvoiceEmail] = useState("");
  const [entContactFirstName, setEntContactFirstName] = useState("");
  const [entContactLastName, setEntContactLastName] = useState("");
  const [entContactEmail, setEntContactEmail] = useState("");

  // ── Detail panel active tab ──
  const [activeTab, setActiveTab] = useState<"overview" | "payment" | "verifiers" | "invoices">("overview");

  // ── Delete organisation modal ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ── Deactivate organisation modal ──
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateInvoiceOption, setDeactivateInvoiceOption] = useState<"keep" | "default">("keep");
  const [deactivateError, setDeactivateError] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  // ── Undo deletion state ──
  const [pendingDeleteOrg, setPendingDeleteOrg] = useState<Organisation | null>(null);
  const [undoTimer, setUndoTimer] = useState<number>(0);

  // ── Effect for Undo Countdown ──
  React.useEffect(() => {
    if (undoTimer > 0 && pendingDeleteOrg) {
      const timer = setTimeout(() => {
        setUndoTimer((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (undoTimer === 0 && pendingDeleteOrg) {
      deleteOrganisation(pendingDeleteOrg.id);
      setPendingDeleteOrg(null);
      localStorage.removeItem("pending_delete_org");
    }
  }, [undoTimer, pendingDeleteOrg, deleteOrganisation]);

  // ── Load pending delete on mount ──
  React.useEffect(() => {
    const stored = localStorage.getItem("pending_delete_org");
    if (stored) {
      try {
        const { org, timestamp } = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - timestamp) / 1000);
        if (elapsed >= 5) {
          deleteOrganisation(org.id);
          localStorage.removeItem("pending_delete_org");
        } else {
          setPendingDeleteOrg(org);
          setUndoTimer(5 - elapsed);
        }
      } catch (e) {
        localStorage.removeItem("pending_delete_org");
      }
    }
  }, [deleteOrganisation]);

  // ── Flush delete before tab/window close ──
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const stored = localStorage.getItem("pending_delete_org");
      if (stored) {
        try {
          const { org } = JSON.parse(stored);
          fetch("/api/portal-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "deleteOrganisation", payload: { id: org.id } }),
            keepalive: true
          });
          localStorage.removeItem("pending_delete_org");
        } catch (e) {}
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Derived data ──
  const visibleOrgs = useMemo(() => {
    return organisations.filter((org) => !pendingDeleteOrg || org.id !== pendingDeleteOrg.id);
  }, [organisations, pendingDeleteOrg]);

  const orgVerifiers = useMemo(() => {
    if (!selectedOrgId) return [];
    return verifiers.filter((v) => v.organisationId === selectedOrgId);
  }, [verifiers, selectedOrgId]);

  const orgInvoices = useMemo(() => {
    if (!selectedOrg) return [];
    return invoices.filter((inv) => inv.organisationId === selectedOrgId || inv.orgName === selectedOrg.name);
  }, [invoices, selectedOrgId, selectedOrg]);

  const isAutoInvoiceForPastMonth = useMemo(() => {
    if (!selectedOrg) return false;
    const now = new Date();
    const selectedMonthIndex = MONTHS.indexOf(invoiceMonth);
    const selectedYearNum = parseInt(invoiceYear);
    if (isNaN(selectedYearNum)) return false;
    const currentMonthIndex = now.getMonth();
    const currentYearNum = now.getFullYear();

    const hasMonthPassed = 
      selectedYearNum < currentYearNum || 
      (selectedYearNum === currentYearNum && selectedMonthIndex < currentMonthIndex);

    if (!hasMonthPassed) return false;

    // Check if an autogenerated invoice exists for this month/year (generationType === "Auto" or undefined/default to Auto)
    return orgInvoices.some(
      (inv) =>
        inv.month?.toLowerCase() === invoiceMonth.toLowerCase() &&
        inv.year === selectedYearNum &&
        (inv.generationType === "Auto" || !inv.generationType)
    );
  }, [orgInvoices, selectedOrg, invoiceMonth, invoiceYear]);

  const detailInvoiceVerifications = useMemo(() => {
    if (!detailInvoice || !selectedOrg) return [];
    return verifications.filter((v) => {
      if (v.orgName.toLowerCase() !== selectedOrg.name.toLowerCase() || v.status !== "Completed") return false;
      try {
        const d = new Date(v.completedAt || v.date);
        if (isNaN(d.getTime())) return false;
        const mName = d.toLocaleDateString("en-US", { month: "long" });
        const yVal = d.getFullYear();
        return (
          mName.toLowerCase() === detailInvoice.month?.toLowerCase() &&
          yVal === detailInvoice.year
        );
      } catch {
        return false;
      }
    });
  }, [detailInvoice, verifications, selectedOrg]);

  const getUpdatedActivityLog = (invoice: Invoice, newActivity: InvoiceActivity) => {
    const baseLog: InvoiceActivity[] = [...(invoice.activityLog || [])];
    if (baseLog.length === 0) {
      baseLog.push({
        id: `act-${Date.now()}-gen`,
        type: "generated",
        timestamp: invoice.date || new Date().toISOString(),
        actor: "System",
        note: "Invoice generated"
      });
    }
    if (invoice.paymentProofDate && !baseLog.some(a => a.type === "submitted")) {
      baseLog.push({
        id: `act-${Date.now()}-sub`,
        type: "submitted",
        timestamp: invoice.paymentProofDate,
        actor: invoice.orgName || "Client",
        note: invoice.clientNote || "",
        paymentProof: invoice.paymentProof
      });
    }
    return [...baseLog, newActivity];
  };

  const handleConfirmStatusChange = async () => {
    if (!invoiceStatusChange) return;
    const { invoice, targetStatus } = invoiceStatusChange;
    
    const extras: Partial<Invoice> = { adminNote: adminNoteInput };
    const adminActor = profile?.full_name || user?.email || "Admin";
    const timestamp = new Date().toISOString();

    if (targetStatus === "Paid") {
      extras.approvedBy = adminActor;
      extras.approvedDate = timestamp;
      extras.rejectionReason = "";
      extras.rejectedBy = "";
      extras.rejectedDate = "";

      const newActivity: InvoiceActivity = {
        id: `act-${Date.now()}-app`,
        type: "approved",
        timestamp,
        actor: adminActor,
        note: adminNoteInput || "Payment approved by administrator"
      };
      extras.activityLog = getUpdatedActivityLog(invoice, newActivity);
    } else {
      extras.approvedBy = "";
      extras.approvedDate = "";

      const newActivity: InvoiceActivity = {
        id: `act-${Date.now()}-status`,
        type: "status_change",
        status: targetStatus,
        timestamp,
        actor: adminActor,
        note: adminNoteInput || `Status manually changed to ${targetStatus}`
      };
      extras.activityLog = getUpdatedActivityLog(invoice, newActivity);
    }

    await updateInvoiceStatus(invoice.id, targetStatus, extras, invoice._id);
    setInvoiceStatusChange(null);
    setAdminNoteInput("");
  };

  const handleConfirmRejection = async () => {
    if (!invoiceRejection) return;
    const { invoice } = invoiceRejection;
    const adminActor = profile?.full_name || user?.email || "Admin";
    const timestamp = new Date().toISOString();

    const newActivity: InvoiceActivity = {
      id: `act-${Date.now()}-rej`,
      type: "rejected",
      timestamp,
      actor: adminActor,
      note: rejectionReasonInput || "Payment disapproved by administrator"
    };

    const updatedLog = getUpdatedActivityLog(invoice, newActivity);

    await updateInvoiceStatus(invoice.id, "Unpaid", {
      rejectionReason: rejectionReasonInput,
      rejectedBy: adminActor,
      rejectedDate: timestamp,
      paymentProof: "",
      paymentProofDate: undefined,
      approvedBy: "",
      approvedDate: "",
      activityLog: updatedLog
    }, invoice._id);
    setInvoiceRejection(null);
    setRejectionReasonInput("");
  };

  // ── Handlers ──
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError("");
    setOrgSuccess("");
    if (!newOrgName.trim()) { setOrgError("Organisation name is required"); return; }
    const rate = parseFloat(newOrgRate);
    if (!newOrgRate || isNaN(rate) || rate <= 0) { setOrgError("Enter a valid monthly rate"); return; }
    if (!newOwnerName.trim()) { setOrgError("Owner name is required"); return; }
    if (!newOwnerEmail.trim()) { setOrgError("Owner email is required"); return; }
    if (!newOwnerPassword.trim() || newOwnerPassword.length < 6) { setOrgError("Owner password must be at least 6 characters"); return; }
    const maxV = parseInt(newMaxVerifiers) || 5;

    await addOrganisation(newOrgName.trim(), rate, newOwnerName.trim(), newOwnerEmail.trim(), newOwnerPassword, maxV);
    setOrgSuccess(`Organisation "${newOrgName.trim()}" created with owner account ${newOwnerEmail.trim()}!`);
    setCreateOrgOpen(false);
    setNewOrgName(""); setNewOrgRate(""); setNewOwnerName(""); setNewOwnerEmail(""); setNewOwnerPassword(""); setNewMaxVerifiers("5");
    setTimeout(() => setOrgSuccess(""), 4000);
  };

  const openOrgDetail = (org: Organisation) => {
    setSelectedOrgId(org.id);
    setActiveTab("overview");
    setEditingPayment(false);
    setEditingEnterprise(false);
    setEditingOwner(false);
    // Preload payment fields
    setPayBankName(org.bankName || "");
    setPayAccountNumber(org.accountNumber || "");
    setPayIfscCode(org.ifscCode || "");
    setPayUpiId(org.upiId || "");
    setPayNotes(org.paymentNotes || "");
  };

  const openEnterpriseEdit = (orgSettings: any) => {
    setEntGstin(orgSettings?.gstin || "");
    setEntCin(orgSettings?.cin || "");
    setEntTin(orgSettings?.tin || "");
    setEntLut(orgSettings?.lut || "");
    setEntAddress(orgSettings?.address || "");
    setEntCity(orgSettings?.city || "");
    setEntPostalCode(orgSettings?.postalCode || "");
    setEntBillingSameAsCompany(orgSettings?.billingSameAsCompany !== undefined ? orgSettings.billingSameAsCompany : true);
    setEntBillingAddress(orgSettings?.billingAddress || "");
    setEntInvoiceEmail(orgSettings?.invoiceEmail || "");
    setEntContactFirstName(orgSettings?.contactFirstName || "");
    setEntContactLastName(orgSettings?.contactLastName || "");
    setEntContactEmail(orgSettings?.contactEmail || "");
    setEditingEnterprise(true);
  };

  const handleSaveEnterprise = async () => {
    if (!selectedOrg) return;
    setEnterpriseSaving(true);
    await updateOrgSettings(selectedOrg.name, {
      gstin: entGstin,
      cin: entCin,
      tin: entTin,
      lut: entLut,
      address: entAddress,
      city: entCity,
      postalCode: entPostalCode,
      billingSameAsCompany: entBillingSameAsCompany,
      billingAddress: entBillingAddress,
      invoiceEmail: entInvoiceEmail,
      contactFirstName: entContactFirstName,
      contactLastName: entContactLastName,
      contactEmail: entContactEmail,
    });
    setEditingEnterprise(false);
    setEnterpriseSaving(false);
  };

  const handleSavePayment = async () => {
    if (!selectedOrgId) return;
    setPaymentSaving(true);
    await updateOrganisation(selectedOrgId, {
      bankName: payBankName,
      accountNumber: payAccountNumber,
      ifscCode: payIfscCode,
      upiId: payUpiId,
      paymentNotes: payNotes,
    });
    setEditingPayment(false);
    setPaymentSaving(false);
  };

  const openOwnerEdit = (org: Organisation) => {
    setOwnerNameInput(org.ownerName || "");
    setOwnerEmailInput(org.ownerEmail || "");
    setOwnerPasswordInput("");
    setMaxVerifiersInput(String(org.maxVerifiers ?? 5));
    setEditingOwner(true);
  };

  const handleSaveOwner = async () => {
    if (!selectedOrg) return;
    if (!ownerNameInput.trim()) { alert("Owner name is required"); return; }
    if (!ownerEmailInput.trim()) { alert("Owner email is required"); return; }

    setOwnerSaving(true);
    try {
      await setOrganisationOwner(
        selectedOrg.id,
        ownerNameInput.trim(),
        ownerEmailInput.trim(),
        ownerPasswordInput || undefined,
        parseInt(maxVerifiersInput) || 5
      );
      setEditingOwner(false);
    } catch (err) {
      console.error(err);
      alert("Failed saving owner");
    } finally {
      setOwnerSaving(false);
    }
  };

  const handleGeneratePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*";
    let pw = "";
    for (let i = 0; i < 16; i++) pw += charset.charAt(Math.floor(Math.random() * charset.length));
    setVPassword(pw);
  };

  const handleAddVerifier = async (e: React.FormEvent) => {
    e.preventDefault();
    setVError(""); setVSuccess("");
    if (!vName.trim()) { setVError("Verifier name is required"); return; }
    if (!vEmail.trim() || !vEmail.includes("@")) { setVError("Valid email is required"); return; }
    if (!selectedOrg) return;

    // Use organization monthlyRate as the verifier's rate
    const orgRate = selectedOrg.monthlyRate || 0;
    await inviteVerifier(vName, vEmail, selectedOrg.name, vPassword || undefined, orgRate, selectedOrgId || undefined, vDesignation || undefined);
    setVSuccess(`Verifier ${vName} added successfully!`);
    setVName(""); setVEmail(""); setVDesignation(""); setVPassword(""); setVRate("");
    setTimeout(() => setVSuccess(""), 4000);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedOrgId || !selectedOrg) return;
    setInvoiceSuccess("");

    if (isAutoInvoiceForPastMonth) {
      alert(`The invoice for ${invoiceMonth} ${invoiceYear} was autogenerated and the month has passed. You cannot recreate or overwrite it.`);
      return;
    }

    const yearNum = parseInt(invoiceYear);

    // Check for any existing invoices for this org/month/year (auto-generated or manual)
    const existingInvoices = invoices.filter(
      (inv) =>
        (inv.organisationId === selectedOrgId || inv.orgName === selectedOrg.name) &&
        inv.month?.toLowerCase() === invoiceMonth.toLowerCase() &&
        inv.year === yearNum
    );

    const paidInvoice = existingInvoices.find((inv) => inv.status === "Paid");
    const unpaidInvoices = existingInvoices.filter((inv) => inv.status !== "Paid");

    if (paidInvoice) {
      alert(`A paid invoice already exists for ${invoiceMonth} ${invoiceYear}. You cannot overwrite or recreate a paid invoice.`);
      return;
    } else if (unpaidInvoices.length > 0) {
      const confirmReplace = window.confirm(
        `An existing unpaid invoice for ${invoiceMonth} ${invoiceYear} will be replaced with a recalculated invoice. Continue?`
      );
      if (!confirmReplace) return;
    }

    await generateMonthlyInvoice(selectedOrgId, invoiceMonth, yearNum);
    setInvoiceSuccess(`Invoice generated for ${invoiceMonth} ${invoiceYear}!`);
    setTimeout(() => setInvoiceSuccess(""), 4000);
  };


  const handleActivateOrg = async () => {
    if (!selectedOrgId) return;
    try {
      await activateOrganisation(selectedOrgId);
      setOrgSuccess("Organisation activated successfully!");
      setTimeout(() => setOrgSuccess(""), 4000);
    } catch (err: any) {
      setOrgError("Failed to activate organisation.");
      setTimeout(() => setOrgError(""), 4000);
    }
  };

  const handleDeactivateOrg = async () => {
    if (!selectedOrgId) return;
    setDeactivating(true);
    setDeactivateError("");
    try {
      await deactivateOrganisation(selectedOrgId, deactivateInvoiceOption);
      setOrgSuccess("Organisation deactivated successfully!");
      setShowDeactivateModal(false);
      setTimeout(() => setOrgSuccess(""), 4000);
    } catch (err: any) {
      setDeactivateError("Failed to deactivate organisation.");
    } finally {
      setDeactivating(false);
    }
  };

  // ── Status badge helper ──
  const statusBadge = (status: string) => {
    const cls =
      status === "Paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15" :
      status === "Pending" ? "bg-amber-500/10 text-amber-600 border-amber-500/15" :
      status === "Overdue" ? "bg-red-500/10 text-red-600 border-red-500/15" :
      status === "Defaulted" ? "bg-rose-500/10 text-rose-700 border-rose-500/15" :
      "bg-slate-100 text-slate-400 border-slate-200/50";
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${cls}`}>
        {status}
      </span>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-6 pt-4 animate-fade-in pb-12">
        {/* Page Header */}
      <div className="mb-4">
        <h2 className="font-display-lg text-slate-900 leading-none tracking-tight">Manage Invoices</h2>
        <p className="font-body-lg text-slate-500 mt-2.5 max-w-3xl">
          Create and manage organisations, configure billing plans, assign verifier logins, and generate monthly invoices.
        </p>
      </div>

      {orgSuccess && (
        <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/15 rounded-xl p-4 font-body-sm flex items-center gap-3 max-w-5xl animate-fade-in">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span className="font-medium">{orgSuccess}</span>
        </div>
      )}
      {orgError && (
        <div className="bg-red-500/5 text-red-600 border border-red-500/15 rounded-xl p-4 font-body-sm flex items-center gap-3 max-w-5xl animate-fade-in">
          <span className="material-symbols-outlined text-lg">error_outline</span>
          <span className="font-medium">{orgError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 max-w-6xl">
        {/* ════════════ Organisation Directory ════════════ */}
        <section className="bg-white border border-[#42C2FF]/12 rounded-2xl p-6 flex flex-col gap-5 shadow-[0_4px_25px_rgba(66,194,255,0.03)]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-headline-md text-slate-900 font-extrabold">Organisation Directory</h3>
              <span className="text-[10px] text-[#0369a1] bg-[#B8FFF9]/40 border border-[#85F4FF]/30 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-label-caps">
                {visibleOrgs.length} Org{visibleOrgs.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => {
                setCreateOrgOpen(true);
                // Reset form fields
                setNewOrgName("");
                setNewOrgRate("1");
                setNewMaxVerifiers("5");
                setNewOwnerName("");
                setNewOwnerEmail("");
                setNewOwnerPassword("");
              }}
              className="px-4 py-2 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border-none shadow-sm shadow-sky-500/15"
            >
              <span className="material-symbols-outlined text-[15px] font-bold">domain_add</span>
              <span>Create Organisation</span>
            </button>
          </div>

          {visibleOrgs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-5xl opacity-30 font-light">domain_add</span>
              <p className="font-body-sm font-medium">No organisations created yet. Use the form to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleOrgs.map((org) => {
                const orgVCount = verifiers.filter((v) => v.organisationId === org.id).length;
                const orgInvCount = invoices.filter((i) => i.organisationId === org.id || i.orgName === org.name).length;
                const isSelected = selectedOrgId === org.id;

                // Calculate current dues
                const orgInvs = invoices.filter((i) => i.organisationId === org.id || i.orgName === org.name);
                const unpaid = orgInvs
                  .filter((inv) => inv.status === "Unpaid" || inv.status === "Overdue")
                  .reduce((sum, inv) => sum + inv.amount, 0);

                // Only count live verifications if NO invoice exists for the current month
                // (if an invoice exists, those verifications are already captured in its amount)
                const nowVal = new Date();
                const currentMonthName = nowVal.toLocaleDateString("en-US", { month: "long" });
                const currentYear = nowVal.getFullYear();
                const hasCurrentMonthInvoice = orgInvs.some(
                  (inv) => inv.month?.toLowerCase() === currentMonthName.toLowerCase() && inv.year === currentYear
                );

                let liveTotal = 0;
                if (!hasCurrentMonthInvoice) {
                  const orgVers = verifications.filter(
                    (v) => v.orgName.toLowerCase() === org.name.toLowerCase()
                  );
                  const completedCount = orgVers.filter((v) => {
                    if (v.status !== "Completed") return false;
                    try {
                      const d = new Date(v.completedAt || v.date);
                      if (isNaN(d.getTime())) return false;
                      return d.getMonth() === nowVal.getMonth() && d.getFullYear() === nowVal.getFullYear();
                    } catch {
                      return false;
                    }
                  }).length;
                  liveTotal = completedCount * org.monthlyRate;
                }
                const totalDues = unpaid + liveTotal;

                return (
                  <div
                    key={org.id}
                    onClick={() => openOrgDetail(org)}
                    className={`relative bg-slate-50/40 border rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:bg-white hover:shadow-lg group ${
                      isSelected
                        ? "border-[#42C2FF] ring-4 ring-[#42C2FF]/10 shadow-md bg-white"
                        : "border-slate-200/70 hover:border-[#42C2FF]/40"
                    }`}
                  >
                    {/* Org icon + name */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${
                        isSelected ? "bg-gradient-to-br from-[#42C2FF] to-[#0099ff] text-white" : "bg-gradient-to-br from-[#EFFFFD] via-[#B8FFF9] to-[#85F4FF] text-[#0284c7]"
                      }`}>
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-headline-md text-slate-900 font-extrabold text-sm truncate leading-tight group-hover:text-[#0ea5e9] transition-colors">{org.name}</h4>
                        <span className="text-[10px] text-slate-400 font-bold font-mono block mt-1">{String(org.orgNumber || 0).padStart(3, "0")}</span>
                      </div>
                      <span className="material-symbols-outlined text-[16px] text-slate-400 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        open_in_new
                      </span>
                    </div>

                    {/* Plan badge */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-[#42C2FF]/10 text-[#0369a1] border-[#42C2FF]/15">
                        <span className="material-symbols-outlined text-[11px] mr-1">calendar_month</span>
                        Monthly
                      </span>
                      {org.status === "Deactivated" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-rose-500/10 text-rose-700 border-rose-500/15">
                          <span className="material-symbols-outlined text-[11px] mr-1">block</span>
                          Deactivated
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-emerald-500/10 text-emerald-600 border-emerald-500/15">
                          <span className="material-symbols-outlined text-[11px] mr-1">check_circle</span>
                          Active
                        </span>
                      )}
                      <span className="font-body-sm font-extrabold text-slate-800">${org.monthlyRate.toLocaleString("en-US")} <span className="text-[10px] font-medium text-slate-400">/ verification</span></span>
                      
                      <span className="font-body-sm font-bold text-[#0369a1] bg-[#B8FFF9]/40 border border-[#85F4FF]/30 px-2 py-0.5 rounded-md text-[10px] ml-auto">Dues: ${totalDues.toFixed(2)}</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3.5 text-[11px] text-slate-500 border-t border-slate-100 pt-3 mt-1 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">badge</span>
                        {orgVCount} Verifier{orgVCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">receipt_long</span>
                        {orgInvCount} Invoice{orgInvCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5 ml-auto">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">event</span>
                        End of Month
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>

      {/* ════════════ CREATE ORGANISATION MODAL ════════════ */}
      {createOrgOpen && (
        <div
          className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setCreateOrgOpen(false)}
        >
          <div
            className="bg-white border border-[#42C2FF]/12 rounded-3xl shadow-3xl w-full max-w-3xl overflow-hidden flex flex-col relative my-auto animate-fade-in text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#B8FFF9]/40 border border-[#85F4FF]/30 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#0ea5e9]">domain_add</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-slate-900 font-extrabold leading-none">Create Organisation</h3>
                  <p className="text-[11px] text-slate-550 font-semibold mt-1">Register a new client organisation and set up their administrator account.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#B8FFF9]/30 border border-[#85F4FF]/30">
                    <span className="material-symbols-outlined text-[13px] text-[#0ea5e9] font-bold">tag</span>
                    <span className="text-[10px] font-black text-[#0369a1] tracking-wide">
                      Organisation #{String((organisations.reduce((max, o) => Math.max(max, o.orgNumber || 0), 0)) + 1).padStart(3, "0")}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCreateOrgOpen(false)}
                className="p-2 hover:bg-slate-100 transition-colors rounded-xl text-slate-500 cursor-pointer border-none bg-transparent flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreateOrg(e);
              }}
              className="p-6 overflow-y-auto flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Organisation Details */}
                <div className="flex flex-col gap-4">
                  <h4 className="font-bold text-xs text-[#0369a1] font-label-caps uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm font-bold">domain</span>
                    <span>1. Organisation Details</span>
                  </h4>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      Organisation Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      required
                      className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400 text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      Rate per Verification ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 50"
                      value={newOrgRate}
                      onChange={(e) => setNewOrgRate(e.target.value)}
                      required
                      className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400 text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      Max Verifiers Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={newMaxVerifiers}
                      onChange={(e) => setNewMaxVerifiers(e.target.value)}
                      required
                      className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400 text-xs font-semibold"
                    />
                  </div>

                  {/* Payment Plan (Monthly only) */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Payment Plan</label>
                    <div className="flex gap-3">
                      <div className="flex-1 p-2.5 rounded-xl border border-[#42C2FF] bg-[#B8FFF9]/10 text-center">
                        <p className="font-body-sm font-extrabold text-[#0369a1] text-xs leading-none">Monthly</p>
                        <p className="text-[8px] text-[#0ea5e9]/70 font-semibold uppercase tracking-wider mt-1.5">Active Plan</p>
                      </div>
                      <div className="flex-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-center opacity-40 cursor-not-allowed">
                        <p className="font-body-sm font-bold text-slate-400 text-xs leading-none">Pay As You Go</p>
                        <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider mt-1.5">Disabled</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Owner Details */}
                <div className="flex flex-col gap-4">
                  <h4 className="font-bold text-xs text-[#0369a1] font-label-caps uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm font-bold">person</span>
                    <span>2. Owner Details</span>
                  </h4>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      Owner Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      required
                      className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400 text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      Owner Login Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. owner@acme.com"
                      value={newOwnerEmail}
                      onChange={(e) => setNewOwnerEmail(e.target.value)}
                      required
                      className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400 text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                      Owner Login Password
                    </label>
                    <input
                      type="password"
                      placeholder="Set login password"
                      value={newOwnerPassword}
                      onChange={(e) => setNewOwnerPassword(e.target.value)}
                      required
                      className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400 text-xs font-semibold"
                    />
                  </div>

                  {/* Auto-billing info */}
                  <div className="flex items-center gap-2.5 bg-[#B8FFF9]/10 border border-[#85F4FF]/20 rounded-xl px-4 py-2.5 mt-2">
                    <span className="material-symbols-outlined text-[#0ea5e9] text-base">schedule</span>
                    <p className="text-[10px] text-[#0369a1] font-semibold leading-snug">
                      Invoices auto-generate on the <span className="font-extrabold">last day</span> of each month at <span className="font-extrabold">11:59 PM</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer / Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setCreateOrgOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-br from-[#0F172A] to-[#1E293B] hover:brightness-110 text-white font-bold text-xs rounded-xl cursor-pointer border-none flex items-center gap-1.5 shadow-sm"
                >
                  <span>Create Organisation</span>
                  <span className="material-symbols-outlined text-sm font-bold">add_business</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════ ORGANISATION DETAIL PANEL ════════════ */}
      {selectedOrg && (
        <div
          className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedOrgId(null)}
        >
          <div
            className="bg-white border border-[#42C2FF]/12 rounded-3xl shadow-3xl w-full max-w-6xl h-[85vh] max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Detail Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/30 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-[#42C2FF] to-[#0099ff] text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md shadow-sky-500/10">
                  {selectedOrg.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-headline-md text-slate-900 font-extrabold text-lg leading-none">{selectedOrg.name}</h3>
                    {selectedOrg.status === "Deactivated" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-700 border border-rose-500/15 uppercase tracking-wide leading-none">
                        Deactivated
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 uppercase tracking-wide leading-none">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{String(selectedOrg.orgNumber || 0).padStart(3, "0")}</span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[11px] text-slate-500 font-medium">Created {selectedOrg.createdAt}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {selectedOrg.status !== "Deactivated" ? (
                  <button
                    onClick={() => {
                      setShowDeactivateModal(true);
                      setDeactivateInvoiceOption("keep");
                      setDeactivateError("");
                    }}
                    className="text-xs text-amber-600 hover:bg-amber-500/5 border border-amber-500/10 px-3.5 py-2 rounded-xl transition-all font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px] font-bold">block</span>
                    Deactivate Org
                  </button>
                ) : (
                  <button
                    onClick={handleActivateOrg}
                    className="text-xs text-emerald-600 hover:bg-emerald-500/5 border border-emerald-500/10 px-3.5 py-2 rounded-xl transition-all font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px] font-bold">check_circle</span>
                    Activate Org
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDeleteModal(true);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="text-xs text-red-600 hover:bg-red-500/5 border border-red-500/10 px-3.5 py-2 rounded-xl transition-all font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] font-bold">delete</span>
                  Delete Org
                </button>
                <button
                  onClick={() => setSelectedOrgId(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Segmented control tabs */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/20 shrink-0">
              <div className="flex bg-slate-100/70 border border-slate-200/50 rounded-xl p-1 max-w-2xl">
                {(["overview", "payment", "verifiers", "invoices"] as const).map((tab) => {
                  const icons = { overview: "dashboard", payment: "account_balance", verifiers: "badge", invoices: "receipt_long" };
                  const labels = { overview: "Overview", payment: "Payment details", verifiers: "Verifier Accounts", invoices: "Monthly Invoices" };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-button-text text-xs transition-all cursor-pointer ${
                        activeTab === tab
                          ? "bg-white text-slate-800 shadow-sm border border-slate-200/40 font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] font-medium" style={{ fontVariationSettings: `'FILL' ${activeTab === tab ? 1 : 0}` }}>{icons[tab]}</span>
                      <span>{labels[tab]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ──── OVERVIEW TAB ──── */}
              {activeTab === "overview" && (() => {
                const orgUnpaidBalance = orgInvoices
                  .filter((inv) => inv.status === "Unpaid" || inv.status === "Overdue")
                  .reduce((sum, inv) => sum + inv.amount, 0);

                const nowVal = new Date();
                const currentMonthName = nowVal.toLocaleDateString("en-US", { month: "long" });
                const currentYear = nowVal.getFullYear();

                // Only count live verifications if NO invoice exists for the current month
                const hasCurrentMonthInvoice = orgInvoices.some(
                  (inv) => inv.month?.toLowerCase() === currentMonthName.toLowerCase() && inv.year === currentYear
                );

                let completedCount = 0;
                let liveTotal = 0;
                if (!hasCurrentMonthInvoice) {
                  const orgVers = verifications.filter(
                    (v) => v.orgName.toLowerCase() === selectedOrg.name.toLowerCase()
                  );
                  completedCount = orgVers.filter((v) => {
                    if (v.status !== "Completed") return false;
                    try {
                      const d = new Date(v.completedAt || v.date);
                      if (isNaN(d.getTime())) return false;
                      return d.getMonth() === nowVal.getMonth() && d.getFullYear() === currentYear;
                    } catch {
                      return false;
                    }
                  }).length;
                  liveTotal = completedCount * selectedOrg.monthlyRate;
                }
                const totalDues = orgUnpaidBalance + liveTotal;

                const orgSettings = allSettings.find(
                  (s) => s.companyName?.toLowerCase() === selectedOrg.name?.toLowerCase()
                );

                return (
                  <div className="flex flex-col gap-5 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      {/* Payment Plan Card */}
                      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/50">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-[16px] text-slate-400 font-bold">payments</span>
                          <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Payment Plan</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-[#42C2FF]/10 text-[#0369a1] border-[#42C2FF]/15">
                            Monthly
                          </span>
                        </div>
                        <p className="font-body-md font-extrabold text-slate-900 text-2xl mt-4 tracking-tight">
                          ${selectedOrg.monthlyRate.toLocaleString("en-US")}
                          <span className="text-xs font-medium text-slate-400"> / verification</span>
                        </p>
                        <div className="mt-4 pt-3.5 border-t border-slate-100">
                          <div className="flex items-center gap-2 opacity-40">
                            <span className="material-symbols-outlined text-[14px] text-slate-500">block</span>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Pay As You Go — Disabled</span>
                          </div>
                        </div>
                      </div>

                      {/* Billing Details Card */}
                      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 font-bold">event</span>
                            <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Billing Cycle</span>
                          </div>
                          <p className="font-body-sm text-slate-600 leading-normal mb-4">
                            Invoices are automatically generated on the <span className="font-extrabold text-slate-900">last day</span> of every month at <span className="font-extrabold text-slate-900">11:59 PM</span>.
                          </p>
                          <div className="flex items-center gap-4 border-b border-slate-100 pb-4 mb-4">
                            <div className="text-center flex-1">
                              <p className="text-xl font-extrabold text-slate-900 tracking-tight">{orgInvoices.length}</p>
                              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Invoices</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200"></div>
                            <div className="text-center flex-1">
                              <p className="text-xl font-extrabold text-emerald-600 tracking-tight">{orgInvoices.filter(i => i.status === "Paid").length}</p>
                              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Paid</p>
                            </div>
                            <div className="w-px h-8 bg-slate-200"></div>
                            <div className="text-center flex-1">
                              <p className="text-xl font-extrabold text-red-600 tracking-tight">{orgInvoices.filter(i => i.status !== "Paid").length}</p>
                              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Outstanding</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 bg-[#42C2FF]/5 border border-[#42C2FF]/10 rounded-xl p-3.5 mt-auto">
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Unpaid Invoices</span>
                            <span className="font-bold text-slate-800 font-mono">${orgUnpaidBalance.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-baseline text-xs border-b border-slate-100/50 pb-2 mb-1.5">
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">{currentMonthName} {currentYear} (Live)</span>
                            <span className="font-bold text-slate-850 font-mono">${liveTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-[9px] text-[#0369a1] uppercase tracking-wider font-extrabold">Current Dues</span>
                            <span className="font-black text-base text-[#0369a1] font-mono">${totalDues.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Verifiers Card */}
                      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/50">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-[16px] text-slate-400 font-bold">groups</span>
                          <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Assigned Team</span>
                        </div>
                        <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{orgVerifiers.length}</p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-1">
                          {orgVerifiers.filter(v => v.status === "Active").length} Active
                          {orgVerifiers.filter(v => v.status === "Pending").length > 0 && `, ${orgVerifiers.filter(v => v.status === "Pending").length} Pending`}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-1">
                          {orgVerifiers.slice(0, 5).map((v) => (
                            <div key={v.id} className="w-7 h-7 bg-gradient-to-br from-[#EFFFFD] via-[#B8FFF9] to-[#85F4FF] rounded-full flex items-center justify-center text-[10px] font-black text-[#0284c7] border-2 border-white shadow-sm" title={v.name}>
                              {v.name.charAt(0)}
                            </div>
                          ))}
                          {orgVerifiers.length > 5 && (
                            <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-extrabold text-slate-500 border-2 border-white shadow-sm">
                              +{orgVerifiers.length - 5}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Owner & Verifiers Limit Card */}
                      <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/50 flex flex-col justify-between min-h-[190px]">
                        {editingOwner ? (
                          <div className="flex flex-col gap-2.5 text-left flex-1 justify-between">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="material-symbols-outlined text-[16px] text-[#0ea5e9] font-bold">shield_person</span>
                              <span className="font-label-caps text-[#0ea5e9] text-[9px] uppercase tracking-wider font-extrabold">Configure Owner</span>
                            </div>
                            <input
                              type="text"
                              placeholder="Owner Full Name"
                              value={ownerNameInput}
                              onChange={(e) => setOwnerNameInput(e.target.value)}
                              className="w-full border border-slate-200/80 rounded-lg p-2 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#42C2FF]/30 transition-all text-xs"
                            />
                            <input
                              type="email"
                              placeholder="Owner Email"
                              value={ownerEmailInput}
                              onChange={(e) => setOwnerEmailInput(e.target.value)}
                              className="w-full border border-slate-200/80 rounded-lg p-2 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#42C2FF]/30 transition-all text-xs"
                            />
                            <input
                              type="password"
                              placeholder={selectedOrg.ownerEmail ? "Password (empty to keep old)" : "Password (min 6 chars)"}
                              value={ownerPasswordInput}
                              onChange={(e) => setOwnerPasswordInput(e.target.value)}
                              className="w-full border border-slate-200/80 rounded-lg p-2 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#42C2FF]/30 transition-all text-xs"
                            />
                            <div className="flex items-center justify-between text-xs mt-0.5">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Verifiers Limit:</span>
                              <input
                                type="number"
                                min="1"
                                value={maxVerifiersInput}
                                onChange={(e) => setMaxVerifiersInput(e.target.value)}
                                className="w-16 border border-slate-200/80 rounded-lg p-1.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#42C2FF]/30 transition-all text-xs text-center"
                              />
                            </div>
                            <div className="flex gap-2 mt-1.5 shrink-0">
                              <button
                                onClick={handleSaveOwner}
                                disabled={ownerSaving}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer border-none shadow-sm shadow-emerald-500/10"
                              >
                                {ownerSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={() => setEditingOwner(false)}
                                className="flex-1 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg text-[10px] transition-all cursor-pointer bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 flex flex-col">
                              <div className="flex items-center justify-between mb-3 shrink-0">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-slate-400 font-bold">shield_person</span>
                                  <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Organisation Owner</span>
                                </div>
                                {selectedOrg.ownerEmail && (
                                  <button
                                    onClick={() => openOwnerEdit(selectedOrg)}
                                    className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center justify-center p-1 rounded-md hover:bg-slate-100"
                                    title="Edit Owner Details"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                  </button>
                                )}
                              </div>
                              {selectedOrg.ownerEmail ? (
                                <div className="text-left flex-1 flex flex-col justify-center">
                                  <p className="font-body-md font-extrabold text-slate-800 leading-tight">
                                    {selectedOrg.ownerName || "Unnamed Owner"}
                                  </p>
                                  <p className="text-[11px] text-[#0284c7] font-mono mt-1 select-all">{selectedOrg.ownerEmail}</p>
                                </div>
                              ) : (
                                <div className="text-left flex-1 flex flex-col justify-center items-start py-2">
                                  <p className="font-body-md font-bold text-slate-400 text-xs italic">No Owner Assigned</p>
                                  <button
                                    onClick={() => openOwnerEdit(selectedOrg)}
                                    className="mt-3.5 px-3 py-1.5 bg-[#42C2FF]/10 text-[#0369a1] border border-[#42C2FF]/25 hover:bg-[#42C2FF]/20 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-xs font-bold">add</span>
                                    Add Owner Account
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="mt-4 pt-3.5 border-t border-slate-100/50 flex justify-between items-center shrink-0">
                              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Verifier Accounts Limit</span>
                              <span className="font-mono text-xs font-black text-[#0369a1] bg-[#B8FFF9]/40 border border-[#85F4FF]/30 px-2 py-0.5 rounded-md">
                                {orgVerifiers.length} / {selectedOrg.maxVerifiers ?? 5}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Enterprise Registration & Contact Details */}
                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-200/50">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 font-bold">business</span>
                          <h4 className="font-headline-md text-slate-900 font-extrabold text-sm">Enterprise Registration & Contact Details</h4>
                        </div>
                        {!editingEnterprise && (
                          <button
                            onClick={() => openEnterpriseEdit(orgSettings)}
                            className="px-3.5 py-2 apple-button-secondary rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            Edit Details
                          </button>
                        )}
                      </div>

                      {editingEnterprise ? (
                        <div className="flex flex-col gap-5 animate-fade-in">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Section 1: Business Identification */}
                            <div className="flex flex-col gap-3">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1">Identification</span>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">State Tax ID / Sales Tax ID</label>
                                <input type="text" placeholder="e.g. 1234567-8" value={entGstin} onChange={(e) => setEntGstin(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 font-mono text-xs" />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Employer Identification Number (EIN)</label>
                                <input type="text" placeholder="e.g. 12-3456789" value={entCin} onChange={(e) => setEntCin(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 font-mono text-xs" />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">DUNS Number</label>
                                <input type="text" placeholder="e.g. 12-345-6789" value={entTin} onChange={(e) => setEntTin(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 font-mono text-xs" />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">State of Incorporation</label>
                                <input type="text" placeholder="e.g. Delaware" value={entLut} onChange={(e) => setEntLut(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 font-mono text-xs" />
                              </div>
                            </div>

                            {/* Section 2: Addresses */}
                            <div className="flex flex-col gap-3">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1">Addresses</span>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Street Address</label>
                                <input type="text" placeholder="e.g. 123 Business Park, MG Road" value={entAddress} onChange={(e) => setEntAddress(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 text-xs" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1.5">
                                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">City</label>
                                  <input type="text" placeholder="e.g. Mumbai" value={entCity} onChange={(e) => setEntCity(e.target.value)}
                                    className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 text-xs" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Postal Code</label>
                                  <input type="text" placeholder="e.g. 400001" value={entPostalCode} onChange={(e) => setEntPostalCode(e.target.value)}
                                    className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 text-xs" />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <button
                                  type="button"
                                  onClick={() => setEntBillingSameAsCompany(!entBillingSameAsCompany)}
                                  className={`w-9 h-5 rounded-full relative transition-all duration-300 cursor-pointer border ${
                                    entBillingSameAsCompany ? "bg-[#42C2FF] border-[#42C2FF]/50" : "bg-slate-200 border-slate-300"
                                  }`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${
                                    entBillingSameAsCompany ? "left-[18px]" : "left-0.5"
                                  }`} />
                                </button>
                                <span className="text-[10px] text-slate-600 font-bold">Billing same as company address</span>
                              </div>
                              {!entBillingSameAsCompany && (
                                <div className="flex flex-col gap-1.5 animate-fade-in">
                                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Billing Address</label>
                                  <textarea placeholder="Enter separate billing address..." value={entBillingAddress} onChange={(e) => setEntBillingAddress(e.target.value)} rows={2}
                                    className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 resize-none text-xs" />
                                </div>
                              )}
                            </div>

                            {/* Section 3: Contact Info */}
                            <div className="flex flex-col gap-3">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1">Contact Details</span>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Invoice Email</label>
                                <input type="email" placeholder="e.g. billing@company.com" value={entInvoiceEmail} onChange={(e) => setEntInvoiceEmail(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 font-mono text-xs" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1.5">
                                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">First Name</label>
                                  <input type="text" placeholder="e.g. Rahul" value={entContactFirstName} onChange={(e) => setEntContactFirstName(e.target.value)}
                                    className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 text-xs" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Last Name</label>
                                  <input type="text" placeholder="e.g. Sharma" value={entContactLastName} onChange={(e) => setEntContactLastName(e.target.value)}
                                    className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 text-xs" />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Contact Email</label>
                                <input type="email" placeholder="e.g. contact@company.com" value={entContactEmail} onChange={(e) => setEntContactEmail(e.target.value)}
                                  className="w-full border border-slate-200/80 rounded-xl p-2.5 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 font-mono text-xs" />
                              </div>
                            </div>
                          </div>

                          {/* Save / Cancel buttons */}
                          <div className="flex gap-2.5 mt-1 pt-3 border-t border-slate-100">
                            <button onClick={handleSaveEnterprise} disabled={enterpriseSaving}
                              className="px-5 py-2.5 apple-button-primary rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                              {enterpriseSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[15px] font-bold">save</span>}
                              Save Enterprise Details
                            </button>
                            <button onClick={() => setEditingEnterprise(false)}
                              className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs transition-all cursor-pointer">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : orgSettings ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {/* Section 1: Business Identification */}
                          <div className="flex flex-col gap-3">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1">Identification</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 font-medium">State Tax ID / Sales Tax ID</span>
                              <span className="font-mono text-xs font-bold text-slate-800">{orgSettings.gstin || "-"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 font-medium">Employer Identification Number (EIN)</span>
                              <span className="font-mono text-xs font-bold text-slate-800">{orgSettings.cin || "-"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 font-medium">DUNS Number</span>
                              <span className="font-mono text-xs font-bold text-slate-800">{orgSettings.tin || "-"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 font-medium">State of Incorporation</span>
                              <span className="font-mono text-xs font-bold text-slate-800">{orgSettings.lut || "-"}</span>
                            </div>
                          </div>

                          {/* Section 2: Addresses */}
                          <div className="flex flex-col gap-3">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1">Addresses</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-450 font-medium">Registered Address</span>
                              <span className="text-xs font-medium text-slate-800 leading-snug">
                                {orgSettings.address ? `${orgSettings.address}, ${orgSettings.city || ""}, ${orgSettings.postalCode || ""}`.trim() : "-"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-450 font-medium">Billing Same As Company</span>
                              <span className="text-xs font-bold text-slate-800">{orgSettings.billingSameAsCompany ? "Yes" : "No"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-450 font-medium">Billing Address</span>
                              <span className="text-xs font-medium text-slate-800 leading-snug">
                                {orgSettings.billingSameAsCompany 
                                  ? (orgSettings.address ? `${orgSettings.address}, ${orgSettings.city || ""}, ${orgSettings.postalCode || ""}`.trim() : "-")
                                  : (orgSettings.billingAddress || "-")}
                              </span>
                            </div>
                          </div>

                          {/* Section 3: Contact Info */}
                          <div className="flex flex-col gap-3">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-100 pb-1">Contact Details</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-450 font-medium">Invoice Email</span>
                              <span className="font-mono text-xs font-bold text-[#0284c7]">{orgSettings.invoiceEmail || "-"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-450 font-medium">Contact Person Name</span>
                              <span className="text-xs font-bold text-slate-800">
                                {orgSettings.contactFirstName || orgSettings.contactLastName 
                                  ? `${orgSettings.contactFirstName || ""} ${orgSettings.contactLastName || ""}`.trim() 
                                  : "-"}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-450 font-medium">Contact Email</span>
                              <span className="font-mono text-xs font-bold text-slate-800">{orgSettings.contactEmail || "-"}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 flex flex-col items-center gap-3">
                          <span className="material-symbols-outlined text-3xl opacity-30 font-light">info</span>
                          <p className="font-body-sm font-medium text-xs">No enterprise settings configured yet.</p>
                          <button
                            onClick={() => openEnterpriseEdit(null)}
                            className="px-4 py-2 apple-button-primary rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer mt-1"
                          >
                            <span className="material-symbols-outlined text-[15px]">add</span>
                            Add Enterprise Details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ──── PAYMENT DETAILS TAB ──── */}
              {activeTab === "payment" && (
                <div className="animate-fade-in max-w-3xl">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-headline-md text-slate-900 font-extrabold text-base">Payment & Bank Details</h4>
                      <p className="font-body-sm text-slate-500 mt-1">These details will be displayed on the client&apos;s website for invoice payment processing.</p>
                    </div>
                    {!editingPayment && (
                      <button
                        onClick={() => setEditingPayment(true)}
                        className="px-3.5 py-2 apple-button-secondary rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">edit</span>
                        Edit Details
                      </button>
                    )}
                  </div>

                  {editingPayment ? (
                    <div className="flex flex-col gap-4 bg-slate-50/50 rounded-2xl p-6 border border-slate-200/60">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Bank Name</label>
                          <input type="text" placeholder="e.g. Silicon Valley Bank" value={payBankName} onChange={(e) => setPayBankName(e.target.value)}
                            className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Account Number</label>
                          <input type="text" placeholder="e.g. 1092830918" value={payAccountNumber} onChange={(e) => setPayAccountNumber(e.target.value)}
                            className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">IFSC / Routing Code</label>
                          <input type="text" placeholder="e.g. IFSC0002" value={payIfscCode} onChange={(e) => setPayIfscCode(e.target.value)}
                            className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">UPI ID</label>
                          <input type="text" placeholder="e.g. acme@upi" value={payUpiId} onChange={(e) => setPayUpiId(e.target.value)}
                            className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Payment Notes & Wire Instructions</label>
                        <textarea placeholder="Special instructions for wire transfers..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={3}
                          className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400 resize-none" />
                      </div>
                      <div className="flex gap-2.5 mt-2">
                        <button onClick={handleSavePayment} disabled={paymentSaving}
                          className="px-5 py-2.5 apple-button-primary rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                          {paymentSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[15px] font-bold">save</span>}
                          Save Payment Details
                        </button>
                        <button onClick={() => setEditingPayment(false)}
                          className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs transition-all cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { icon: "account_balance", label: "Bank Name", value: selectedOrg.bankName },
                        { icon: "pin", label: "Account Number", value: selectedOrg.accountNumber },
                        { icon: "code", label: "IFSC Code", value: selectedOrg.ifscCode },
                        { icon: "qr_code", label: "UPI ID", value: selectedOrg.upiId },
                      ].map((item) => (
                        <div key={item.label} className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">{item.icon}</span>
                            <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">{item.label}</span>
                          </div>
                          <p className="font-body-md font-bold text-slate-800 mt-1">{item.value || "—"}</p>
                        </div>
                      ))}
                      {selectedOrg.paymentNotes && (
                        <div className="md:col-span-2 bg-slate-50/50 rounded-xl p-4 border border-slate-200/60">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">description</span>
                            <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Payment Notes</span>
                          </div>
                          <p className="font-body-sm text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">{selectedOrg.paymentNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ──── VERIFIER LOGINS TAB ──── */}
              {activeTab === "verifiers" && (
                <div className="animate-fade-in">
                  <div className="mb-4 border-b border-slate-100 pb-3">
                    <h4 className="font-headline-md text-slate-900 font-extrabold text-base">Verifier Logins</h4>
                    <p className="font-body-sm text-slate-500 mt-1">Manage compliance analyst accounts assigned to work under {selectedOrg.name}.</p>
                  </div>

                  {vSuccess && (
                    <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/15 rounded-xl p-3.5 font-body-sm flex items-center gap-3 mb-4 animate-fade-in">
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      <span className="font-medium">{vSuccess}</span>
                    </div>
                  )}
                  {vError && (
                    <div className="bg-red-500/5 text-red-600 border border-red-500/15 rounded-xl p-3.5 font-body-sm flex items-center gap-3 mb-4 animate-fade-in">
                      <span className="material-symbols-outlined text-lg">error_outline</span>
                      <span className="font-medium">{vError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    {/* Verifiers Table */}
                    <div className="xl:col-span-3">
                      {orgVerifiers.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-200/50 flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-4xl opacity-30 font-light">person_off</span>
                          <p className="font-body-sm font-medium">No verifiers assigned to this organisation yet.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/50">
                          <table className="w-full text-left font-body-sm whitespace-nowrap">
                            <thead>
                              <tr className="border-b border-slate-200/50 bg-slate-50/50">
                                <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">NAME</th>
                                <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">EMAIL</th>
                                <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">DESIGNATION</th>
                                <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">RATE ($)</th>
                                <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-right text-[9px]">STATUS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {orgVerifiers.map((v) => (
                                <tr key={v.id} className="hover:bg-slate-50/40 transition-colors">
                                  <td className="py-3 px-4 font-bold text-slate-800">{v.name}</td>
                                  <td className="py-3 px-4 text-slate-500 font-mono text-xs">{v.email}</td>
                                  <td className="py-3 px-4 text-slate-600 font-medium">{v.designation || "—"}</td>
                                  <td className="py-3 px-4 font-bold text-[#0369a1]">${(v.ratePerVerification ?? 0).toLocaleString("en-US")}</td>
                                  <td className="py-3 px-4 text-right">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                      v.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15" : "bg-slate-100 text-slate-400 border-slate-200/50"
                                    }`}>
                                      {v.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Add Verifier Form */}
                    <div className="xl:col-span-2 bg-slate-50/50 rounded-2xl p-5 border border-slate-200/50 h-fit">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200/40">
                        <span className="material-symbols-outlined text-slate-700 text-[18px]">person_add</span>
                        <h5 className="font-headline-md text-slate-900 font-extrabold text-sm">Add Verifier</h5>
                      </div>
                      <form onSubmit={handleAddVerifier} className="flex flex-col gap-3.5">
                        <input type="text" placeholder="Full name (e.g. David Miller)" value={vName} onChange={(e) => setVName(e.target.value)}
                          autoComplete="off" className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        
                        <input type="email" placeholder="Email address" value={vEmail} onChange={(e) => setVEmail(e.target.value)}
                          autoComplete="off" className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        
                        <input type="text" placeholder="Job title / Designation" value={vDesignation} onChange={(e) => setVDesignation(e.target.value)}
                          autoComplete="off" className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />

                        
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Password</label>
                            <button type="button" onClick={handleGeneratePassword} className="text-[10px] text-[#0ea5e9] hover:underline font-bold cursor-pointer">
                              Auto-Generate
                            </button>
                          </div>
                          <div className="relative">
                            <input type="text" placeholder="Set temporary login password" value={vPassword} onChange={(e) => setVPassword(e.target.value)}
                              autoComplete="new-password" className="w-full border border-slate-200/80 rounded-xl p-3 pr-10 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                            {vPassword && (
                              <button type="button" onClick={() => navigator.clipboard.writeText(vPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center" title="Copy Password">
                                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <button type="submit" className="w-full apple-button-primary py-3 rounded-xl font-button-text text-xs flex items-center justify-center gap-1.5 mt-1">
                          <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                          Create Verifier Login
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* ──── MONTHLY INVOICES TAB ──── */}
              {activeTab === "invoices" && (
                <div className="animate-fade-in flex flex-col gap-6">
                  {/* Generate Invoice Selector */}
                  <div className="flex flex-col gap-2 bg-slate-50/50 rounded-2xl p-5 border border-slate-200/60 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-4 items-end w-full">
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Invoice Month</label>
                        <select value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)}
                          className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all cursor-pointer">
                          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="w-full sm:w-36 flex flex-col gap-2">
                        <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Invoice Year</label>
                        <input type="number" min="2020" max="2100" value={invoiceYear} onChange={(e) => setInvoiceYear(e.target.value)}
                          className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all" />
                      </div>
                      <button 
                        onClick={handleGenerateInvoice}
                        disabled={isAutoInvoiceForPastMonth}
                        className={`px-5 py-3.5 rounded-xl font-button-text text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap h-[46px] w-full sm:w-auto justify-center ${
                          isAutoInvoiceForPastMonth 
                            ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed" 
                            : "apple-button-primary hover:brightness-105"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] font-bold">receipt_long</span>
                        Generate Month Invoice
                      </button>
                    </div>
                    {isAutoInvoiceForPastMonth && (
                      <div className="flex items-center gap-1.5 text-rose-650 mt-1">
                        <span className="material-symbols-outlined text-xs">info</span>
                        <span className="text-[11px] font-bold">An autogenerated invoice already exists for this past month and cannot be overwritten.</span>
                      </div>
                    )}
                  </div>

                  {invoiceSuccess && (
                    <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/15 rounded-xl p-3.5 font-body-sm flex items-center gap-3 animate-fade-in">
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      <span className="font-medium">{invoiceSuccess}</span>
                    </div>
                  )}

                  {/* Pending Payment Proof Approvals Section */}
                  {orgInvoices.filter((inv) => inv.status === "Pending").length > 0 && (
                    <div className="mb-2 flex flex-col gap-3.5 animate-fade-in bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5 shadow-sm">
                      <h5 className="font-label-caps text-[#9a3412] font-bold text-xs flex items-center gap-2 w-fit">
                        <span className="material-symbols-outlined text-[18px] animate-pulse">pending_actions</span>
                        <span>Pending Payment Proof Approvals ({orgInvoices.filter((inv) => inv.status === "Pending").length})</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1.5">
                        {orgInvoices
                          .filter((inv) => inv.status === "Pending")
                          .map((inv) => (
                            <div key={inv._id || inv.id} className="bg-white border border-[#fde68a] rounded-xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-slate-800 font-mono">{inv.id}</p>
                                  <p className="text-xs text-slate-500 mt-1 font-medium">Amount Due: <strong className="text-slate-900 font-black">${inv.amount.toLocaleString("en-US")}</strong></p>
                                  {inv.paymentProofDate && (
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Submitted: {new Date(inv.paymentProofDate).toLocaleString()}</p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      const adminActor = profile?.full_name || user?.email || "Admin";
                                      const timestamp = new Date().toISOString();
                                      const newActivity: InvoiceActivity = {
                                        id: `act-${Date.now()}-app`,
                                        type: "approved",
                                        timestamp,
                                        actor: adminActor,
                                        note: "Payment approved by administrator"
                                      };
                                      const updatedLog = getUpdatedActivityLog(inv, newActivity);
                                      updateInvoiceStatus(inv.id, "Paid", {
                                        approvedBy: adminActor,
                                        approvedDate: timestamp,
                                        rejectionReason: "",
                                        rejectedBy: "",
                                        rejectedDate: "",
                                        activityLog: updatedLog
                                      }, inv._id);
                                    }}
                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10 border-none"
                                  >
                                    <span className="material-symbols-outlined text-[15px] font-bold">check_circle</span>
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setInvoiceRejection({ invoice: inv });
                                      setRejectionReasonInput("");
                                    }}
                                    className="px-3.5 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[15px] font-bold">cancel</span>
                                    <span>Reject</span>
                                  </button>
                                </div>
                              </div>

                              {inv.clientNote && (
                                <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/15 text-xs text-left mb-2.5">
                                  <span className="font-label-caps text-slate-500 text-[9px] uppercase tracking-wider font-bold block mb-1">Note from Client</span>
                                  <p className="text-slate-800 font-medium italic">{inv.clientNote}</p>
                                </div>
                              )}

                              {inv.paymentProof ? (
                                <div className="flex flex-col gap-2">
                                  <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Payment Proof Screenshot</span>
                                  {inv.paymentProof.startsWith("data:image/") ? (
                                    <div className="relative group overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/50 flex items-center justify-center h-48 cursor-zoom-in">
                                      <img
                                        src={inv.paymentProof}
                                        alt="Payment proof screenshot"
                                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                        onClick={() => setActiveScreenshotPreview(inv.paymentProof ?? null)}
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                                      <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                                      <span className="text-xs text-slate-700 font-bold truncate flex-1">Document Attachment</span>
                                      <button
                                        onClick={() => window.open(inv.paymentProof, "_blank")}
                                        className="text-xs text-[#0ea5e9] underline hover:no-underline font-extrabold"
                                      >
                                        View File
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No proof screenshot was uploaded.</p>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly Invoice Directory */}
                  <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/50">
                    <table className="w-full text-left font-body-sm whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200/50 bg-slate-50/50">
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">INVOICE ID</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">MONTH</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">DATE GENERATED</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">DUE DATE</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">AMOUNT</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">STATUS</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-[9px]">TYPE</th>
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-right text-[9px]">DETAILS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orgInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                              No invoices generated yet for this organisation.
                            </td>
                          </tr>
                        ) : (
                          orgInvoices.map((inv) => (
                            <React.Fragment key={inv._id || inv.id}>
                              <tr className="hover:bg-slate-50/40 transition-colors">
                                <td 
                                  className="py-3.5 px-4"
                                >
                                  <span
                                    onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                                    className="font-bold text-sky-600 hover:text-sky-850 hover:underline font-mono text-xs cursor-pointer block"
                                  >
                                    {inv.id}
                                  </span>
                                  {inv.adminNote && (
                                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-normal max-w-xs truncate" title={inv.adminNote}>
                                      Note: <span className="italic font-medium">{inv.adminNote}</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 font-medium">{inv.month ? `${inv.month} ${inv.year}` : "—"}</td>
                                <td className="py-3.5 px-4 text-slate-500 font-medium">{inv.date}</td>
                                <td className="py-3.5 px-4 text-slate-500 font-medium">{inv.dueDate}</td>
                                <td className="py-3.5 px-4 font-black text-slate-900">${inv.amount.toLocaleString("en-US")}</td>
                                <td className="py-3.5 px-4">{statusBadge(inv.status)}</td>
                                <td className="py-3.5 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                    inv.generationType === "Manual"
                                      ? "bg-purple-500/10 text-purple-600 border-purple-500/15"
                                      : "bg-blue-500/10 text-blue-600 border-blue-500/15"
                                  }`}>
                                    {inv.generationType === "Manual" ? "Manual" : "Autogenerated"}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                                    className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-655 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-auto shadow-2xs"
                                  >
                                    <span>{expandedInvoiceId === inv.id ? "Hide Details" : "View Details"}</span>
                                    <span className="material-symbols-outlined text-[16px] transition-transform duration-200">
                                      {expandedInvoiceId === inv.id ? "expand_less" : "expand_more"}
                                    </span>
                                  </button>
                                </td>
                              </tr>
                              {expandedInvoiceId === inv.id && (
                                <tr className="bg-slate-50/25">
                                  <td colSpan={8} className="p-6 border-b border-slate-200">
                                    <div className="flex flex-col lg:flex-row gap-8 justify-between items-start">
                                      {/* Left: Activity Timeline */}
                                      <div className="flex-1 flex flex-col gap-4">
                                        <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider font-label-caps border-b border-slate-200 pb-2 mb-2">
                                          <span className="material-symbols-outlined text-[18px] text-slate-400">history</span>
                                          <span>Invoice Activity History</span>
                                        </h5>
                                        
                                        <div className="relative border-l border-slate-250/80 pl-6 ml-3 flex flex-col gap-6">
                                          {(() => {
                                            const baseLog: InvoiceActivity[] = [...(inv.activityLog || [])];
                                            if (baseLog.length === 0) {
                                              baseLog.push({
                                                id: `fallback-gen`,
                                                type: "generated",
                                                timestamp: inv.date ? new Date(inv.date).toISOString() : new Date().toISOString(),
                                                actor: "System",
                                                note: "Invoice generated"
                                              });
                                              if (inv.paymentProofDate) {
                                                baseLog.push({
                                                  id: `fallback-sub`,
                                                  type: "submitted",
                                                  timestamp: inv.paymentProofDate,
                                                  actor: inv.orgName || "Client",
                                                  note: inv.clientNote || "",
                                                  paymentProof: inv.paymentProof
                                                });
                                              }
                                              if (inv.status === "Paid") {
                                                baseLog.push({
                                                  id: `fallback-app`,
                                                  type: "approved",
                                                  timestamp: inv.approvedDate || new Date().toISOString(),
                                                  actor: inv.approvedBy || "Admin",
                                                  note: inv.adminNote || "Payment approved by administrator"
                                                });
                                              } else if (inv.status === "Unpaid" && inv.rejectionReason) {
                                                baseLog.push({
                                                  id: `fallback-rej`,
                                                  type: "rejected",
                                                  timestamp: inv.rejectedDate || new Date().toISOString(),
                                                  actor: inv.rejectedBy || "Administrator",
                                                  note: inv.rejectionReason
                                                });
                                              }
                                            }
                                            const sorted = baseLog.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                                            return sorted.map((act, index) => {
                                              let icon = "receipt";
                                              let iconBg = "bg-sky-500 text-white";
                                              let title = "";
                                              let content = null;

                                              if (act.type === "generated") {
                                                icon = "receipt";
                                                iconBg = "bg-sky-500 text-white";
                                                title = "Invoice Generated";
                                                content = (
                                                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                                    Generated on {new Date(act.timestamp).toLocaleString()} (Type: {inv.generationType || "Auto"})
                                                  </p>
                                                );
                                              } else if (act.type === "submitted") {
                                                icon = "payments";
                                                iconBg = "bg-amber-500 text-white";
                                                title = "Payment Submitted";
                                                content = (
                                                  <div className="flex flex-col gap-2 mt-1">
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                      Submitted by <strong className="text-slate-700 font-semibold">{act.actor}</strong> on {new Date(act.timestamp).toLocaleString()}
                                                    </p>
                                                    {act.note && (
                                                      <p className="text-xs italic text-slate-600 bg-white border border-slate-200 rounded-lg p-2 max-w-md font-medium leading-relaxed">
                                                        Note: "{act.note}"
                                                      </p>
                                                    )}
                                                    {act.paymentProof && (
                                                      <div className="mt-1">
                                                        {act.paymentProof.startsWith("data:image/") ? (
                                                          <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-white max-w-xs h-36 flex items-center justify-center cursor-zoom-in">
                                                            <img
                                                              src={act.paymentProof}
                                                              alt="Payment proof"
                                                              className="w-full h-full object-contain"
                                                              onClick={() => setActiveScreenshotPreview(act.paymentProof ?? null)}
                                                            />
                                                          </div>
                                                        ) : (
                                                          <button
                                                            type="button"
                                                            onClick={() => window.open(act.paymentProof, "_blank")}
                                                            className="text-xs text-sky-600 underline hover:no-underline font-extrabold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                                                          >
                                                            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                                                            <span>View Document</span>
                                                          </button>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              } else if (act.type === "approved") {
                                                icon = "check_circle";
                                                iconBg = "bg-emerald-500 text-white";
                                                title = "Payment Approved";
                                                content = (
                                                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                                    Approved by <strong className="text-slate-700 font-semibold">{act.actor}</strong> on {new Date(act.timestamp).toLocaleString()}
                                                    {act.note && act.note !== "Payment approved by administrator" && (
                                                      <span className="block mt-1 text-xs text-slate-600 italic">
                                                        Note: "{act.note}"
                                                      </span>
                                                    )}
                                                  </p>
                                                );
                                              } else if (act.type === "rejected") {
                                                icon = "cancel";
                                                iconBg = "bg-rose-500 text-white";
                                                title = "Payment Disapproved / Rejected";
                                                content = (
                                                  <div className="flex flex-col gap-2 mt-1.5">
                                                    <p className="text-[11px] text-slate-500 font-medium">
                                                      Disapproved by <strong className="text-rose-700 font-semibold">{act.actor}</strong> on {new Date(act.timestamp).toLocaleString()}
                                                    </p>
                                                    {act.note && (
                                                      <div className="bg-rose-50/80 border border-rose-200/60 rounded-xl p-3 max-w-md">
                                                        <div className="flex items-start gap-2">
                                                          <span className="material-symbols-outlined text-rose-400 text-[14px] mt-px shrink-0">info</span>
                                                          <div>
                                                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Rejection Reason</p>
                                                            <p className="text-xs text-rose-700 font-medium leading-relaxed">
                                                              {act.note}
                                                            </p>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              } else if (act.type === "status_change") {
                                                icon = "swap_horiz";
                                                iconBg = "bg-slate-500 text-white";
                                                title = `Status Updated to ${act.status}`;
                                                content = (
                                                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                                    Changed by <strong className="text-slate-700 font-semibold">{act.actor}</strong> on {new Date(act.timestamp).toLocaleString()}
                                                    {act.note && (
                                                      <span className="block mt-1 text-xs text-slate-655 italic">
                                                        Note: "{act.note}"
                                                      </span>
                                                    )}
                                                  </p>
                                                );
                                              }

                                              return (
                                                <div key={act.id || index} className="relative">
                                                  <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${iconBg}`}>
                                                    <span className="material-symbols-outlined text-[10px] font-bold">{icon}</span>
                                                  </div>
                                                  <div className="text-left">
                                                    <p className="text-xs font-bold text-slate-800">{title}</p>
                                                    {content}
                                                  </div>
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
                                      </div>

                                      {/* Right: Actions */}
                                      <div className="w-full lg:w-64 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4 text-left shrink-0">
                                        <h6 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                                          <span>Invoice Actions</span>
                                        </h6>
                                        
                                        <div className="flex flex-col gap-1.5">
                                          <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">Update Status</label>
                                          <select
                                            value={inv.status}
                                            onChange={(e) => {
                                              setInvoiceStatusChange({
                                                invoice: inv,
                                                targetStatus: e.target.value as any
                                              });
                                              setAdminNoteInput(inv.adminNote || "");
                                            }}
                                            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all text-xs cursor-pointer font-semibold text-slate-700"
                                          >
                                            <option value="Paid">Paid</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Unpaid">Unpaid</option>
                                            <option value="Overdue">Overdue</option>
                                            <option value="Defaulted">Defaulted</option>
                                          </select>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                          <span className="text-[10px] text-slate-400 font-medium">Internal Admin Note</span>
                                          <span className="text-xs font-semibold text-slate-700 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 min-h-[40px] block leading-normal">
                                            {inv.adminNote || "No notes added yet."}
                                          </span>
                                        </div>
                                        
                                        <button
                                          type="button"
                                          onClick={() => setDetailInvoice(inv)}
                                          className="w-full px-4 py-2.5 border border-[#42C2FF]/20 hover:border-[#42C2FF]/40 bg-[#B8FFF9]/20 hover:bg-[#85F4FF]/20 text-[#0284c7] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                          <span className="material-symbols-outlined text-[16px] font-bold">visibility</span>
                                          <span>View Itemized Details</span>
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ DELETE ORGANISATION PASSWORD MODAL ════════════ */}
      {showDeleteModal && selectedOrg && (
        <div
          className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white border border-[#42C2FF]/12 rounded-3xl shadow-3xl w-full max-w-md mx-4 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-red-500 font-bold">lock</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-red-600 font-extrabold text-base leading-none">Delete Organisation</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-1.5">
                <p className="font-body-sm text-slate-400 font-bold text-[9px] uppercase tracking-wider">Confirm Delete Request</p>
                <div className="flex items-center gap-2.5 mt-1">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#EFFFFD] via-[#B8FFF9] to-[#85F4FF] rounded-lg flex items-center justify-center text-[#0284c7] font-black text-sm">
                    {selectedOrg.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-body-sm font-bold text-slate-800 leading-none">{selectedOrg.name}</p>
                    <p className="text-[10px] text-slate-450 font-mono mt-1 font-bold">{String(selectedOrg.orgNumber || 0).padStart(3, "0")}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">
                  Type <span className="text-red-500 font-black">{selectedOrg.name}</span> to confirm
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-400">
                    <span className="material-symbols-outlined text-[18px]">key</span>
                  </span>
                  <input
                    type="text"
                    placeholder={`Type "${selectedOrg.name}" to delete`}
                    value={deletePassword}
                    onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (deletePassword === selectedOrg.name) {
                          setDeleting(true);
                          if (pendingDeleteOrg) {
                            deleteOrganisation(pendingDeleteOrg.id);
                          }
                          setPendingDeleteOrg(selectedOrg);
                          setUndoTimer(5);
                          localStorage.setItem("pending_delete_org", JSON.stringify({
                            org: selectedOrg,
                            timestamp: Date.now()
                          }));
                          setSelectedOrgId(null);
                          setShowDeleteModal(false);
                          setDeletePassword("");
                          setDeleting(false);
                        } else {
                          setDeleteError("Organisation name does not match.");
                        }
                      }
                    }}
                    autoFocus
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 transition-all ${
                      deleteError
                        ? "border-red-500 focus:ring-red-500/10 bg-white"
                        : "border-slate-200/80 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white"
                    }`}
                  />
                </div>
                {deleteError && (
                  <div className="flex items-center gap-1.5 text-red-650 mt-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span className="text-xs font-bold">{deleteError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-2 border-t border-slate-100 bg-slate-50/20 flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-button-text rounded-xl transition-all cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deletePassword === selectedOrg.name) {
                    setDeleting(true);
                    if (pendingDeleteOrg) {
                      deleteOrganisation(pendingDeleteOrg.id);
                    }
                    setPendingDeleteOrg(selectedOrg);
                    setUndoTimer(5);
                    localStorage.setItem("pending_delete_org", JSON.stringify({
                      org: selectedOrg,
                      timestamp: Date.now()
                    }));
                    setSelectedOrgId(null);
                    setShowDeleteModal(false);
                    setDeletePassword("");
                    setDeleting(false);
                  } else {
                    setDeleteError("Organisation name does not match.");
                  }
                }}
                disabled={deleting || !deletePassword}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white border-none font-button-text rounded-xl shadow-md shadow-red-600/15 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm font-semibold"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-[16px] font-bold">delete_forever</span>
                )}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ DEACTIVATE ORGANISATION MODAL ════════════ */}
      {showDeactivateModal && selectedOrg && (
        <div
          className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDeactivateModal(false)}
        >
          <div
            className="bg-white border border-[#42C2FF]/12 rounded-3xl shadow-3xl w-full max-w-md mx-4 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-amber-600 font-bold">warning</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-amber-700 font-extrabold text-base leading-none">Deactivate Organisation</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Temporarily block access</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <p className="font-body-sm text-slate-650 leading-relaxed">
                Deactivating <strong className="text-slate-800 font-extrabold">{selectedOrg.name}</strong> will immediately disable all user and verifier logins for this organization. Outstanding verification requests will also be suspended.
              </p>

              {/* Invoice handling options */}
              <div className="flex flex-col gap-2.5 mt-1">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  Invoice Settlement Option
                </label>
                
                <div className="flex flex-col gap-3">
                  {/* Option: Keep Invoices */}
                  <div
                    onClick={() => setDeactivateInvoiceOption("keep")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-300 flex items-start gap-3 ${
                      deactivateInvoiceOption === "keep"
                        ? "border-[#42C2FF] bg-[#B8FFF9]/10 shadow-sm"
                        : "border-slate-200/80 bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-base mt-0.5 ${
                      deactivateInvoiceOption === "keep" ? "text-[#0ea5e9] font-bold" : "text-slate-400"
                    }`}>
                      {deactivateInvoiceOption === "keep" ? "radio_button_checked" : "radio_button_unchecked"}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-body-sm font-bold text-slate-800 leading-tight">Keep Invoices Active</span>
                      <span className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                        Keep unpaid, pending, and overdue invoices as they are. Statuses will not be changed.
                      </span>
                    </div>
                  </div>

                  {/* Option: Default Invoices */}
                  <div
                    onClick={() => setDeactivateInvoiceOption("default")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-300 flex items-start gap-3 ${
                      deactivateInvoiceOption === "default"
                        ? "border-rose-450 bg-rose-500/5 shadow-sm"
                        : "border-slate-200/80 bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`material-symbols-outlined text-base mt-0.5 ${
                      deactivateInvoiceOption === "default" ? "text-rose-600 font-bold" : "text-slate-400"
                    }`}>
                      {deactivateInvoiceOption === "default" ? "radio_button_checked" : "radio_button_unchecked"}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-body-sm font-bold text-slate-800 leading-tight">Default Outstanding Invoices</span>
                      <span className="text-[10px] text-slate-450 font-medium mt-1 leading-normal">
                        Automatically update all Unpaid, Pending, and Overdue invoices for this organization to <strong className="text-rose-700 font-black">Defaulted</strong>.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {deactivateError && (
                <div className="flex items-center gap-1.5 text-red-650 mt-1.5">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span className="text-xs font-bold">{deactivateError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-2 border-t border-slate-100 bg-slate-50/20 flex gap-2">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-button-text rounded-xl transition-all cursor-pointer text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateOrg}
                disabled={deactivating}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white border-none font-button-text rounded-xl shadow-md shadow-amber-500/15 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm font-semibold"
              >
                {deactivating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-[16px] font-bold">block</span>
                )}
                <span>Confirm Deactivate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ INVOICE DETAILS MODAL ════════════ */}
      {detailInvoice && selectedOrg && (
        <div
          className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => {
            if (adminModalClosing !== "details") handleCloseAdminModal("details");
          }}
        >
          <div
            className="bg-white border border-[#42C2FF]/12 rounded-3xl shadow-3xl w-full max-w-4xl h-[70vh] max-h-[70vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {adminModalClosing === "details" ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="font-semibold text-sm text-slate-800">Closing Invoice Details...</h3>
                <p className="text-secondary text-[10px] mt-1 text-slate-500 font-medium">Please wait a moment</p>
              </div>
            ) : (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/30 shrink-0">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-sky-500/10 text-sky-600 rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px] font-bold">receipt_long</span>
                    </div>
                    <div>
                      <h3 className="font-headline-md text-slate-900 font-extrabold text-base leading-none font-sans">Invoice Details</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 font-mono">{detailInvoice.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCloseAdminModal("details")}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
                  {/* Status Grid info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Invoice ID</span>
                      <span className="text-xs font-mono font-bold text-slate-900 mt-1">{detailInvoice.id}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Month</span>
                      <span className="text-xs font-bold text-slate-900 mt-1">{detailInvoice.month ? `${detailInvoice.month} ${detailInvoice.year}` : "N/A"}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Amount Due</span>
                      <span className="text-xs font-black text-slate-900 mt-1">${detailInvoice.amount.toLocaleString("en-US")}</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Status</span>
                      <span className="mt-1">{statusBadge(detailInvoice.status)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Generation Type</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {detailInvoice.generationType === "Manual" ? "Manual Invoice" : "Auto-Generated Statement"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Issued Date</span>
                      <span className="text-xs font-semibold text-slate-700">{detailInvoice.date}</span>
                    </div>
                  </div>

                  {/* Verifications section */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans border-b border-slate-100 pb-2">
                      <span>Completed Verifications ({detailInvoiceVerifications.length})</span>
                    </span>
                    {detailInvoiceVerifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        No requests completed during this billing period.
                      </div>
                    ) : (
                      <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white max-h-[30vh] overflow-y-auto">
                        <table className="w-full text-left font-body-sm whitespace-nowrap">
                          <thead>
                            <tr className="border-b border-slate-200/50 bg-slate-50/50">
                              <th className="py-2.5 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">CANDIDATE ID</th>
                              <th className="py-2.5 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">NAME</th>
                              <th className="py-2.5 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">EMAIL</th>
                              <th className="py-2.5 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">COMPLETED DATE</th>
                              <th className="py-2.5 px-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right">BILLABLE RATE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailInvoiceVerifications.map((v) => {
                              const completedDateStr = v.completedAt
                                ? new Date(v.completedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                                : v.date;
                              return (
                                <tr key={v.id}>
                                  <td className="py-2.5 px-3 font-mono text-xs text-sky-600 font-bold">{v.id}</td>
                                  <td className="py-2.5 px-3 text-xs text-slate-700 font-medium">{v.name}</td>
                                  <td className="py-2.5 px-3 text-xs text-slate-500 font-mono">{v.email}</td>
                                  <td className="py-2.5 px-3 text-xs text-slate-600 font-medium">{completedDateStr}</td>
                                  <td className="py-2.5 px-3 text-xs font-black text-slate-900 text-right">
                                    ${(vRate ? parseFloat(vRate) : selectedOrg.monthlyRate || 0).toLocaleString("en-US")}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 pt-2 border-t border-slate-100 bg-slate-50/20 flex justify-between items-center shrink-0">
                  <button
                    onClick={() => {
                      if (detailInvoice) {
                        window.open(
                          `/admin/billable-summary?orgId=${selectedOrg.id}&month=${detailInvoice.month}&year=${detailInvoice.year}`,
                          "_blank"
                        );
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#134074] text-white hover:brightness-110 font-button-text rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-1.5 border-none shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    <span>Download Billable Summary</span>
                  </button>
                  <button
                    onClick={() => handleCloseAdminModal("details")}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-button-text rounded-xl transition-all cursor-pointer text-xs font-bold"
                  >
                    Close Details
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════ UNDO DELETION TOAST BANNER ════════════ */}
      {pendingDeleteOrg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-3xl p-4.5 flex items-center gap-4.5 animate-fade-in max-w-sm">
          <span className="material-symbols-outlined text-[#42C2FF] text-xl font-bold">delete</span>
          <div className="flex-1 min-w-0">
            <p className="font-body-sm font-bold text-white leading-none">Organisation Deleted</p>
            <p className="text-[11px] text-slate-400 font-semibold truncate mt-1">{pendingDeleteOrg.name}</p>
          </div>
          <button
            onClick={() => {
              setPendingDeleteOrg(null);
              setUndoTimer(0);
              localStorage.removeItem("pending_delete_org");
            }}
            className="text-white hover:text-[#42C2FF] px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-all font-button-text text-xs cursor-pointer flex items-center gap-1.5 font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px] font-bold">undo</span>
            <span>Undo ({undoTimer}s)</span>
          </button>
        </div>
      )}

      {/* ════════════ INVOICE STATUS CHANGE CONFIRMATION DIALOG ════════════ */}
      {invoiceStatusChange && (
        <div className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 max-w-md w-full shadow-2xl relative my-auto animate-fade-in text-left">
            {adminModalClosing === "status" ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in min-h-[160px]">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <h3 className="font-semibold text-xs text-[#0F172A]">Closing Dialog...</h3>
                <p className="text-slate-500 text-[10px] mt-1">Please wait</p>
              </div>
            ) : (
              <>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-amber-500 font-bold">warning</span>
                  <span>Confirm Invoice Status Change</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to change the status of invoice <strong className="text-slate-800 font-semibold">{invoiceStatusChange.invoice.id}</strong> to <strong className="text-slate-800 font-semibold">{invoiceStatusChange.targetStatus}</strong>?
                </p>

                <div className="flex flex-col gap-2 mt-4">
                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    Internal Note
                  </label>
                  <textarea
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    placeholder="Add comments or reference notes for this update..."
                    rows={3}
                    className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-850 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all resize-none text-xs"
                  />
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleCloseAdminModal("status")}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmStatusChange}
                    className="px-4 py-2 bg-gradient-to-br from-[#0F172A] to-[#1E293B] hover:brightness-110 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Confirm Update
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════ INVOICE PAYMENT REJECTION DIALOG ════════════ */}
      {invoiceRejection && (
        <div className="fixed inset-0 bg-slate-900/15 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 max-w-md w-full shadow-2xl relative my-auto animate-fade-in text-left">
            {adminModalClosing === "rejection" ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in min-h-[160px]">
                <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <h3 className="font-semibold text-xs text-[#0F172A]">Closing Dialog...</h3>
                <p className="text-slate-500 text-[10px] mt-1">Please wait</p>
              </div>
            ) : (
              <>
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-rose-500 font-bold">cancel</span>
                  <span>Disapprove Payment Proof</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Are you sure you want to reject the payment proof for invoice <strong className="text-slate-800 font-semibold">{invoiceRejection.invoice.id}</strong>? The status will revert to Unpaid.
                </p>

                <div className="flex flex-col gap-2 mt-4">
                  <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    Rejection Note / Reason
                  </label>
                  <textarea
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="Explain why this proof is invalid (e.g. Blurred receipt, Wrong amount)..."
                    rows={3}
                    className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-850 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all resize-none text-xs"
                  />
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleCloseAdminModal("rejection")}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRejection}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer border-none shadow-sm"
                  >
                    Reject Payment
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════ SCREENSHOT LIGHTBOX PREVIEW MODAL ════════════ */}
      {activeScreenshotPreview && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setActiveScreenshotPreview(null)}
        >
          <div
            className="relative bg-white border border-slate-200/40 rounded-3xl p-4 max-w-4xl w-full shadow-3xl flex flex-col items-center justify-center animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveScreenshotPreview(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors border-none shadow-md cursor-pointer z-10 flex items-center justify-center font-bold"
            >
              <span className="material-symbols-outlined text-sm font-bold">close</span>
            </button>
            <div className="overflow-auto max-h-[80vh] w-full flex justify-center items-center rounded-2xl bg-slate-50 border border-slate-100 p-2">
              <img
                src={activeScreenshotPreview}
                alt="Payment Proof Enlarge Preview"
                className="max-w-full max-h-[75vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
