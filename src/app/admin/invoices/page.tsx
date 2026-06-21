"use client";

import React, { useState, useMemo } from "react";
import { usePortal } from "src/context/PortalContext";
import type { Organisation, Verifier, Invoice } from "src/context/PortalContext";

// ── Month names for selectors ──
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ManageInvoicesPage() {
  const {
    organisations,
    verifiers,
    invoices,
    verifications,
    addOrganisation,
    updateOrganisation,
    deleteOrganisation,
    deactivateOrganisation,
    activateOrganisation,
    generateMonthlyInvoice,
    inviteVerifier,
    updateInvoiceStatus,
    hasPaidInvoiceForMonth,
  } = usePortal();

  // ── Selected organisation ──
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const selectedOrg = organisations.find((o) => o.id === selectedOrgId) || null;

  // ── Create Organisation form ──
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgRate, setNewOrgRate] = useState("");

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

  // ── Handlers ──
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError("");
    setOrgSuccess("");
    if (!newOrgName.trim()) { setOrgError("Organisation name is required"); return; }
    const rate = parseFloat(newOrgRate);
    if (!newOrgRate || isNaN(rate) || rate <= 0) { setOrgError("Enter a valid monthly rate"); return; }

    await addOrganisation(newOrgName.trim(), rate);
    setOrgSuccess(`Organisation "${newOrgName.trim()}" created successfully!`);
    setNewOrgName(""); setNewOrgRate("");
    setTimeout(() => setOrgSuccess(""), 4000);
  };

  const openOrgDetail = (org: Organisation) => {
    setSelectedOrgId(org.id);
    setActiveTab("overview");
    setEditingPayment(false);
    // Preload payment fields
    setPayBankName(org.bankName || "");
    setPayAccountNumber(org.accountNumber || "");
    setPayIfscCode(org.ifscCode || "");
    setPayUpiId(org.upiId || "");
    setPayNotes(org.paymentNotes || "");
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

    const parsedRate = vRate ? parseFloat(vRate) : 0;
    await inviteVerifier(vName, vEmail, selectedOrg.name, vPassword || undefined, parsedRate, selectedOrgId || undefined, vDesignation || undefined);
    setVSuccess(`Verifier ${vName} added successfully!`);
    setVName(""); setVEmail(""); setVDesignation(""); setVPassword(""); setVRate("");
    setTimeout(() => setVSuccess(""), 4000);
  };

  const handleGenerateInvoice = async () => {
    if (!selectedOrgId) return;
    setInvoiceSuccess("");

    if (hasPaidInvoiceForMonth(selectedOrgId, invoiceMonth, parseInt(invoiceYear))) {
      const confirmGen = window.confirm(
        `A paid invoice already exists for ${invoiceMonth} ${invoiceYear}. Are you sure you want to generate another invoice?`
      );
      if (!confirmGen) return;
    }

    await generateMonthlyInvoice(selectedOrgId, invoiceMonth, parseInt(invoiceYear));
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-7xl">
        {/* ════════════ Organisation Directory (left 2 cols) ════════════ */}
        <section className="xl:col-span-2 bg-white border border-[#42C2FF]/12 rounded-2xl p-6 flex flex-col gap-5 shadow-[0_4px_25px_rgba(66,194,255,0.03)]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-headline-md text-slate-900 font-extrabold">Organisation Directory</h3>
            <span className="text-[10px] text-[#0369a1] bg-[#B8FFF9]/40 border border-[#85F4FF]/30 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-label-caps">
              {visibleOrgs.length} Organisation{visibleOrgs.length !== 1 ? "s" : ""}
            </span>
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

                const orgVers = verifications.filter(
                  (v) => v.orgName.toLowerCase() === org.name.toLowerCase()
                );
                const completedCount = orgVers.filter((v) => {
                  if (v.status !== "Completed") return false;
                  try {
                    const d = new Date(v.completedAt || v.date);
                    if (isNaN(d.getTime())) return false;
                    const nowVal = new Date();
                    return d.getMonth() === nowVal.getMonth() && d.getFullYear() === nowVal.getFullYear();
                  } catch {
                    return false;
                  }
                }).length;
                const liveTotal = completedCount * org.monthlyRate;
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
                        <span className="text-[10px] text-slate-400 font-bold font-mono block mt-1">{org.id}</span>
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

        {/* ════════════ Create Organisation (right sidebar) ════════════ */}
        <section className="bg-white border border-[#42C2FF]/12 rounded-2xl p-6 shadow-[0_4px_25px_rgba(66,194,255,0.03)] h-fit">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#0369a1] bg-[#B8FFF9]/40 border border-[#85F4FF]/30 p-2 rounded-xl">
              domain_add
            </span>
            <h3 className="font-headline-md text-slate-900 font-extrabold">Create Organisation</h3>
          </div>

          <form onSubmit={handleCreateOrg} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Organisation Name
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corporation"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Rate per Verification ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-slate-400 text-sm font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 50"
                  value={newOrgRate}
                  onChange={(e) => setNewOrgRate(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Auto-billing info */}
            <div className="flex items-center gap-2.5 bg-[#B8FFF9]/15 border border-[#85F4FF]/20 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[#0ea5e9] text-base">schedule</span>
              <p className="font-body-sm text-[#0369a1] font-medium leading-snug">
                Invoices auto-generate on the <span className="font-extrabold">last day</span> of each month at <span className="font-extrabold">11:59 PM</span>.
              </p>
            </div>

            {/* Payment Plan Display (read-only) */}
            <div className="flex flex-col gap-2 mt-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Payment Plan</label>
              <div className="flex gap-3">
                <div className="flex-1 p-3.5 rounded-xl border border-[#42C2FF] bg-[#B8FFF9]/20 text-center shadow-[0_2px_8px_rgba(66,194,255,0.03)]">
                  <span className="material-symbols-outlined text-[#0ea5e9] text-base font-bold">check_circle</span>
                  <p className="font-body-sm font-extrabold text-[#0369a1] mt-1.5 leading-none">Monthly</p>
                  <p className="text-[9px] text-[#0ea5e9]/70 font-semibold uppercase tracking-wider mt-1.5">Active Plan</p>
                </div>
                <div className="flex-1 p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-center opacity-40 cursor-not-allowed">
                  <span className="material-symbols-outlined text-slate-400 text-base font-light">block</span>
                  <p className="font-body-sm font-bold text-slate-400 mt-1.5 leading-none">Pay As You Go</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-1.5">Disabled</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full apple-button-primary py-3.5 rounded-xl font-button-text hover:brightness-105 transition-all cursor-pointer flex justify-center items-center gap-2"
            >
              <span>Create Organisation</span>
              <span className="material-symbols-outlined text-base font-bold">add_business</span>
            </button>
          </form>
        </section>
      </div>

      {/* ════════════ ORGANISATION DETAIL PANEL ════════════ */}
      {selectedOrg && (
        <div
          className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
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
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{selectedOrg.id}</span>
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
                
                const orgVers = verifications.filter(
                  (v) => v.orgName.toLowerCase() === selectedOrg.name.toLowerCase()
                );
                const completedCount = orgVers.filter((v) => {
                  if (v.status !== "Completed") return false;
                  try {
                    const d = new Date(v.completedAt || v.date);
                    if (isNaN(d.getTime())) return false;
                    return d.getMonth() === nowVal.getMonth() && d.getFullYear() === currentYear;
                  } catch {
                    return false;
                  }
                }).length;
                const liveTotal = completedCount * selectedOrg.monthlyRate;
                const totalDues = orgUnpaidBalance + liveTotal;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in">
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
                          <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[9px] font-bold">UPI ID (optional)</label>
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
                        
                        <div className="relative">
                          <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">$</span>
                          <input type="number" min="0" step="1" placeholder="Rate per verification" value={vRate} onChange={(e) => setVRate(e.target.value)}
                            autoComplete="off" className="w-full pl-8 pr-4 py-3 border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all placeholder-slate-400" />
                        </div>
                        
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
                  <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-200/60 flex flex-col sm:flex-row gap-4 items-end shadow-sm">
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
                    <button onClick={handleGenerateInvoice}
                      className="px-5 py-3.5 apple-button-primary rounded-xl font-button-text text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap h-[46px] w-full sm:w-auto justify-center">
                      <span className="material-symbols-outlined text-[16px] font-bold">receipt_long</span>
                      Generate Month Invoice
                    </button>
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
                                    onClick={() => updateInvoiceStatus(inv.id, "Paid")}
                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/10 border-none"
                                  >
                                    <span className="material-symbols-outlined text-[15px] font-bold">check_circle</span>
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => updateInvoiceStatus(inv.id, "Unpaid")}
                                    className="px-3.5 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[15px] font-bold">cancel</span>
                                    <span>Reject</span>
                                  </button>
                                </div>
                              </div>

                              {inv.paymentProof ? (
                                <div className="flex flex-col gap-2">
                                  <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Payment Proof Screenshot</span>
                                  {inv.paymentProof.startsWith("data:image/") ? (
                                    <div className="relative group overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/50 flex items-center justify-center h-48 cursor-zoom-in">
                                      <img
                                        src={inv.paymentProof}
                                        alt="Payment proof screenshot"
                                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                        onClick={() => window.open("", "_blank")?.document.write(`<img src="${inv.paymentProof}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`)}
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
                          <th className="py-3 px-4 font-label-caps text-slate-500 font-bold text-right text-[9px]">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orgInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                              No invoices generated yet for this organisation.
                            </td>
                          </tr>
                        ) : (
                          orgInvoices.map((inv) => (
                            <tr key={inv._id || inv.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-850 font-mono text-xs">{inv.id}</td>
                              <td className="py-3.5 px-4 text-slate-700 font-medium">{inv.month ? `${inv.month} ${inv.year}` : "—"}</td>
                              <td className="py-3.5 px-4 text-slate-500 font-medium">{inv.date}</td>
                              <td className="py-3.5 px-4 text-slate-500 font-medium">{inv.dueDate}</td>
                              <td className="py-3.5 px-4 font-black text-slate-900">${inv.amount.toLocaleString("en-US")}</td>
                              <td className="py-3.5 px-4">{statusBadge(inv.status)}</td>
                              <td className="py-3.5 px-4 text-right">
                                <select
                                  value={inv.status}
                                  onChange={(e) => updateInvoiceStatus(inv.id, e.target.value as any)}
                                  className="p-1.5 border border-slate-200/80 rounded-lg font-body-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#42C2FF]/30 text-xs cursor-pointer font-semibold text-slate-700"
                                >
                                  <option value="Paid">Paid</option>
                                  <option value="Pending">Pending</option>
                                  <option value="Unpaid">Unpaid</option>
                                  <option value="Overdue">Overdue</option>
                                  <option value="Defaulted">Defaulted</option>
                                </select>
                              </td>
                            </tr>
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
          className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
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
                    <p className="text-[10px] text-slate-450 font-mono mt-1 font-bold">{selectedOrg.id}</p>
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
          className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
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
    </div>
  );
}
