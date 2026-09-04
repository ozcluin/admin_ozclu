"use client";

import React, { useState } from "react";
import { usePortal, ClientSuggestion, Organisation } from "src/context/PortalContext";
import { getCurrencySymbol } from "src/lib/currencies";

export default function AdminSuggestionsPage() {
  const { suggestions, updateSuggestion, organisations, updateOrganisationRates } = usePortal();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"inbox" | "rates">("inbox");

  // Inbox Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Request Modal state
  const [selectedReq, setSelectedReq] = useState<ClientSuggestion | null>(null);
  const [replyStatus, setReplyStatus] = useState<string>("Under Review");
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [modalSuccess, setModalSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  // Rate Editing Modal state
  const [editingOrg, setEditingOrg] = useState<Organisation | null>(null);
  const [rateIdentity, setRateIdentity] = useState<number>(10);
  const [rateCourt, setRateCourt] = useState<number>(15);
  const [rateEmployment, setRateEmployment] = useState<number>(5);
  const [rateEducation, setRateEducation] = useState<number>(5);
  const [rateInterpol, setRateInterpol] = useState<number>(10);
  const [rateRednoticeWorldwide, setRateRednoticeWorldwide] = useState<number>(15);
  const [ratePassport, setRatePassport] = useState<number>(8);
  const [rateDigitalAddress, setRateDigitalAddress] = useState<number>(5);
  const [rateSapsWanted, setRateSapsWanted] = useState<number>(15);
  const [rateSafliiCourt, setRateSafliiCourt] = useState<number>(15);
  const [rateUkCourt, setRateUkCourt] = useState<number>(25);
  const [rateMalaysiaCourt, setRateMalaysiaCourt] = useState<number>(20);

  const [enableIdentity, setEnableIdentity] = useState<boolean>(true);
  const [enableCourt, setEnableCourt] = useState<boolean>(true);
  const [enableEmployment, setEnableEmployment] = useState<boolean>(true);
  const [enableEducation, setEnableEducation] = useState<boolean>(true);
  const [enableInterpol, setEnableInterpol] = useState<boolean>(true);
  const [enableRednoticeWorldwide, setEnableRednoticeWorldwide] = useState<boolean>(true);
  const [enablePassport, setEnablePassport] = useState<boolean>(true);
  const [enableDigitalAddress, setEnableDigitalAddress] = useState<boolean>(true);
  const [enableSapsWanted, setEnableSapsWanted] = useState<boolean>(true);
  const [enableSafliiCourt, setEnableSafliiCourt] = useState<boolean>(true);
  const [enableUkCourt, setEnableUkCourt] = useState<boolean>(true);
  const [enableMalaysiaCourt, setEnableMalaysiaCourt] = useState<boolean>(true);

  const [savingOrgRates, setSavingOrgRates] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState("");
  const [orgError, setOrgError] = useState("");

  // Unique orgs list for filter dropdown
  const uniqueOrgs = Array.from(new Set(suggestions.map((s) => s.orgName)));

  // Filtered Suggestions
  const filteredSuggestions = suggestions.filter((sug) => {
    const matchesStatus = statusFilter === "all" || sug.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || sug.type === categoryFilter;
    const matchesOrg = orgFilter === "all" || sug.orgName === orgFilter;
    const matchesQuery = !searchQuery.trim() || 
      sug.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      sug.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sug.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sug.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesOrg && matchesQuery;
  });

  // Counters
  const totalCount = suggestions.length;
  const pendingCount = suggestions.filter((s) => s.status === "Pending").length;
  const reviewCount = suggestions.filter((s) => s.status === "Under Review").length;
  const resolvedCount = suggestions.filter((s) => s.status === "Service Enabled" || s.status === "Resolved").length;

  const handleOpenReqModal = (sug: ClientSuggestion) => {
    setSelectedReq(sug);
    setReplyStatus(sug.status || "Under Review");
    setReplyText(sug.adminReply || "");
    setModalSuccess("");
    setModalError("");
  };

  const handleSaveResponse = async () => {
    if (!selectedReq) return;
    setSavingReply(true);
    setModalSuccess("");
    setModalError("");

    try {
      await updateSuggestion({
        id: selectedReq.id,
        status: replyStatus,
        adminReply: replyText.trim()
      });
      setModalSuccess("Response & status updated successfully!");
      setTimeout(() => {
        setSelectedReq(null);
      }, 1200);
    } catch (err: any) {
      setModalError(err.message || "Failed to update response");
    } finally {
      setSavingReply(false);
    }
  };

  const handleQuickEnableService = async (orgName: string, targetService?: string) => {
    if (!targetService || targetService === "General") return;
    setSavingReply(true);
    try {
      const fieldName = `${targetService}Enabled`;
      await updateOrganisationRates({
        orgName,
        enabledServices: { [fieldName]: true }
      });

      if (selectedReq) {
        await updateSuggestion({
          id: selectedReq.id,
          status: "Service Enabled",
          adminReply: replyText.trim() || `Service '${targetService}' has been enabled for your organisation.`
        });
      }
      setModalSuccess(`Service '${targetService}' successfully enabled for ${orgName}!`);
      setTimeout(() => setSelectedReq(null), 1200);
    } catch (err: any) {
      setModalError(err.message || "Failed to enable service.");
    } finally {
      setSavingReply(false);
    }
  };

  const handleOpenEditRates = (org: Organisation) => {
    setEditingOrg(org);
    setRateIdentity(org.identityRate ?? org.monthlyRate ?? 10);
    setRateCourt(org.courtRecordRate ?? org.monthlyRate ?? 15);
    setRateEmployment(org.employmentRate ?? 5);
    setRateEducation(org.educationRate ?? 5);
    setRateInterpol(org.interpolRate ?? 10);
    setRateRednoticeWorldwide(org.rednoticeWorldwideRate ?? 15);
    setRatePassport(org.passportRate ?? 8);
    setRateDigitalAddress(org.digitalAddressRate ?? 5);
    setRateSapsWanted(org.sapsWantedRate ?? 15);
    setRateSafliiCourt(org.safliiCourtRate ?? 15);
    setRateUkCourt(org.ukCourtRate ?? 25);
    setRateMalaysiaCourt(org.malaysiaCourtRate ?? 20);

    setEnableIdentity(org.identityEnabled !== false);
    setEnableCourt(org.courtRecordEnabled !== false);
    setEnableEmployment(org.employmentEnabled !== false);
    setEnableEducation(org.educationEnabled !== false);
    setEnableInterpol(org.interpolEnabled !== false);
    setEnableRednoticeWorldwide(org.rednoticeWorldwideEnabled !== false);
    setEnablePassport(org.passportEnabled !== false);
    setEnableDigitalAddress(org.digitalAddressEnabled !== false);
    setEnableSapsWanted(org.sapsWantedEnabled !== false);
    setEnableSafliiCourt(org.safliiCourtEnabled !== false);
    setEnableUkCourt(org.ukCourtEnabled !== false);
    setEnableMalaysiaCourt(org.malaysiaCourtEnabled !== false);

    setOrgSuccess("");
    setOrgError("");
  };

  const handleSaveOrgRates = async () => {
    if (!editingOrg) return;
    setSavingOrgRates(true);
    setOrgSuccess("");
    setOrgError("");

    try {
      await updateOrganisationRates({
        orgId: editingOrg.id,
        orgName: editingOrg.name,
        rates: {
          identityRate: rateIdentity,
          courtRecordRate: rateCourt,
          employmentRate: rateEmployment,
          educationRate: rateEducation,
          interpolRate: rateInterpol,
          rednoticeWorldwideRate: rateRednoticeWorldwide,
          passportRate: ratePassport,
          digitalAddressRate: rateDigitalAddress,
          sapsWantedRate: rateSapsWanted,
          safliiCourtRate: rateSafliiCourt,
          ukCourtRate: rateUkCourt,
          malaysiaCourtRate: rateMalaysiaCourt
        },
        enabledServices: {
          identityEnabled: enableIdentity,
          courtRecordEnabled: enableCourt,
          employmentEnabled: enableEmployment,
          educationEnabled: enableEducation,
          interpolEnabled: enableInterpol,
          rednoticeWorldwideEnabled: enableRednoticeWorldwide,
          passportEnabled: enablePassport,
          digitalAddressEnabled: enableDigitalAddress,
          sapsWantedEnabled: enableSapsWanted,
          safliiCourtEnabled: enableSafliiCourt,
          ukCourtEnabled: enableUkCourt,
          malaysiaCourtEnabled: enableMalaysiaCourt
        }
      });
      setOrgSuccess("Service rates and access rules updated successfully!");
      setTimeout(() => setEditingOrg(null), 1200);
    } catch (err: any) {
      setOrgError(err.message || "Failed to save organisation rates.");
    } finally {
      setSavingOrgRates(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#bfcab9]/30 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#016e1c] bg-[#eaf0e4]/50 px-2.5 py-1 rounded-full w-fit uppercase tracking-wider mb-2 border border-[#bfcab9]/30">
            <span className="material-symbols-outlined text-sm font-bold">rate_review</span>
            <span>CLIENT MANAGEMENT &amp; SUPPORT</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Client Rates &amp; Grievances</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Review client suggestions &amp; grievances, respond to service requests, and configure per-organisation service rates.</p>
        </div>

        {/* Tab Switchers */}
        <div className="flex items-center gap-2 bg-white/70 border border-slate-200/80 p-1.5 rounded-2xl shadow-2xs">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "inbox"
                ? "bg-[#016e1c] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined text-base">inbox</span>
            <span>Client Requests ({pendingCount > 0 ? `${pendingCount} new` : suggestions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("rates")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "rates"
                ? "bg-[#016e1c] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined text-base">payments</span>
            <span>Client Rates &amp; Features ({organisations.length})</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: CLIENT REQUESTS & GRIEVANCES INBOX ── */}
      {activeTab === "inbox" && (
        <div className="flex flex-col gap-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#bfcab9]/30 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Submissions</span>
                <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{totalCount}</span>
              </div>
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                <span className="material-symbols-outlined">forum</span>
              </div>
            </div>

            <div className="bg-white border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Pending Review</span>
                <span className="text-2xl font-extrabold text-amber-700 mt-0.5 block">{pendingCount}</span>
              </div>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <span className="material-symbols-outlined">pending_actions</span>
              </div>
            </div>

            <div className="bg-white border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">In Progress</span>
                <span className="text-2xl font-extrabold text-blue-700 mt-0.5 block">{reviewCount}</span>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <span className="material-symbols-outlined">sync</span>
              </div>
            </div>

            <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Services Enabled / Resolved</span>
                <span className="text-2xl font-extrabold text-emerald-700 mt-0.5 block">{resolvedCount}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white border border-[#bfcab9]/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                placeholder="Search subject, details, or org..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Service Enabled">Service Enabled</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="enable_service">Enable New Service</option>
                <option value="rate_query">Rate / Pricing Inquiry</option>
                <option value="suggestion">General Suggestion</option>
                <option value="grievance">Grievance / Ticket</option>
              </select>

              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="all">All Client Organisations</option>
                {uniqueOrgs.map((org) => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submissions Table / Cards */}
          <div className="bg-white border border-[#bfcab9]/30 rounded-3xl overflow-hidden shadow-xs">
            {filteredSuggestions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-40">inbox</span>
                <span className="text-sm font-semibold">No client requests found matching the selected filters.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredSuggestions.map((sug) => (
                  <div key={sug.id} className="p-5 hover:bg-slate-50/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-bold text-[#016e1c]">{sug.id}</span>
                        <span className="font-extrabold text-sm text-slate-900">{sug.title}</span>
                        <span className="bg-[#eaf0e4] text-[#00450e] text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase">
                          {sug.type.replace("_", " ")}
                        </span>
                        {sug.targetService && sug.targetService !== "General" && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            Target: {sug.targetService}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 font-medium line-clamp-2 leading-relaxed mb-2">
                        {sug.message}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-slate-400">corporate_fare</span>
                          <span>{sug.orgName}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-slate-400">mail</span>
                          <span>{sug.clientEmail}</span>
                        </span>
                        <span>{new Date(sug.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                      <div>
                        {sug.status === "Pending" && <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Pending</span>}
                        {sug.status === "Under Review" && <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold px-3 py-1 rounded-full">Under Review</span>}
                        {(sug.status === "Service Enabled" || sug.status === "Resolved") && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">Resolved / Enabled</span>}
                        {sug.status === "Closed" && <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold px-3 py-1 rounded-full">Closed</span>}
                      </div>

                      <button
                        onClick={() => handleOpenReqModal(sug)}
                        className="px-4 py-2 bg-[#181d16] hover:bg-[#00450e] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">edit_note</span>
                        <span>Review &amp; Respond</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: ORGANISATION SERVICE RATES & FEATURES CONTROL ── */}
      {activeTab === "rates" && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-[#bfcab9]/30 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900">Registered Organisation Rates &amp; Service Toggles</h3>
              <p className="text-xs text-slate-500 font-medium">Configure individual per-check rates and enable/disable services for each client organisation.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {organisations.map((org) => (
              <div key={org.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{org.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {org.id}</span>
                    </div>
                    <span className="bg-[#eaf0e4] text-[#00450e] text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {org.currency || "USD"} ({getCurrencySymbol(org.currency)}) · {org.paymentPlan || "Enterprise"}
                    </span>
                  </div>

                  {/* Service Rates Grid */}
                  <div className="space-y-2 text-xs font-semibold text-slate-700 my-4">
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">badge</span> Identity Verification</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.identityRate ?? org.monthlyRate ?? 10).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">gavel</span> Court Record Search</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.courtRecordRate ?? org.monthlyRate ?? 15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">work</span> Employment Verification</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.employmentRate ?? 5).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">school</span> Education Verification</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.educationRate ?? 5).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">travel_explore</span> Interpol Clearance</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.interpolRate ?? 10).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">public</span> Red Notice Worldwide</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.rednoticeWorldwideRate ?? 15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">assignment_ind</span> Passport Check</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.passportRate ?? 8).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">location_on</span> Digital Address</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.digitalAddressRate ?? 5).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">local_police</span> SAPS Wanted</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.sapsWantedRate ?? 15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">account_balance</span> SA Court Check</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.safliiCourtRate ?? 15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-slate-400">gavel</span> UK Court Check</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.ukCourtRate ?? 25).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm text-emerald-600">balance</span> Malaysia Court Check</span>
                      <span className="font-extrabold text-[#016e1c]">{getCurrencySymbol(org.currency)}{(org.malaysiaCourtRate ?? 20).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenEditRates(org)}
                  className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-[#016e1c] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  <span>Edit Rates &amp; Toggles</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL: RESPOND TO CLIENT REQUEST ── */}
      {selectedReq && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#bfcab9]/40 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl animate-fade-in relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#016e1c]">{selectedReq.id}</span>
                <h3 className="font-extrabold text-lg text-slate-900">{selectedReq.title}</h3>
              </div>
              <button onClick={() => setSelectedReq(null)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {modalSuccess && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-3 text-xs font-semibold mb-4">
                {modalSuccess}
              </div>
            )}
            {modalError && (
              <div className="bg-rose-50 text-rose-800 border border-rose-200 rounded-xl p-3 text-xs font-semibold mb-4">
                {modalError}
              </div>
            )}

            {/* Client Request Details Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-xs">
              <div className="flex justify-between text-slate-500 font-semibold mb-2">
                <span>Client: <strong>{selectedReq.orgName}</strong> ({selectedReq.clientEmail})</span>
                <span>Type: <strong>{selectedReq.type}</strong></span>
              </div>
              <p className="text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                {selectedReq.message}
              </p>
            </div>

            {/* Quick Action to Enable Requested Service */}
            {selectedReq.type === "enable_service" && selectedReq.targetService && selectedReq.targetService !== "General" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block">1-Click Service Activation</span>
                  <span className="text-[11px] text-emerald-700 font-medium">Enable '{selectedReq.targetService}' directly for {selectedReq.orgName}?</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickEnableService(selectedReq.orgName, selectedReq.targetService)}
                  disabled={savingReply}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shrink-0"
                >
                  Enable {selectedReq.targetService}
                </button>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-slate-500 uppercase text-[10px] font-bold block mb-1">Update Status</label>
                <select
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 font-bold focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Service Enabled">Service Enabled</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="text-slate-500 uppercase text-[10px] font-bold block mb-1">Admin Response Note to Client</label>
                <textarea
                  rows={4}
                  placeholder="Enter your response note that will be displayed in the client's Settings & Profile portal..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-medium focus:outline-none font-sans resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveResponse}
                disabled={savingReply}
                className="px-5 py-2.5 bg-[#016e1c] hover:bg-[#00450e] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {savingReply ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">send</span>
                )}
                Save &amp; Notify Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT ORGANISATION SERVICE RATES & TOGGLES ── */}
      {editingOrg && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#bfcab9]/40 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl animate-fade-in relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Configure Service Rates &amp; Access</h3>
                <p className="text-xs text-slate-500 font-medium">Organisation: <strong>{editingOrg.name}</strong> ({editingOrg.currency || "USD"})</p>
              </div>
              <button onClick={() => setEditingOrg(null)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {orgSuccess && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-3 text-xs font-semibold mb-4">
                {orgSuccess}
              </div>
            )}
            {orgError && (
              <div className="bg-rose-50 text-rose-800 border border-rose-200 rounded-xl p-3 text-xs font-semibold mb-4">
                {orgError}
              </div>
            )}

            <div className="space-y-4 divide-y divide-slate-100 text-xs font-semibold">
              {/* Identity */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Identity Verification</span>
                  <span className="text-[11px] text-slate-500 font-normal">Aadhaar, PAN &amp; DL checks</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateIdentity}
                      onChange={(e) => setRateIdentity(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableIdentity}
                      onChange={(e) => setEnableIdentity(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Court */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Court Record Search</span>
                  <span className="text-[11px] text-slate-500 font-normal">eCourts litigation checks</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateCourt}
                      onChange={(e) => setRateCourt(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableCourt}
                      onChange={(e) => setEnableCourt(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Employment */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Employment Verification</span>
                  <span className="text-[11px] text-slate-500 font-normal">Work history &amp; CTC check</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateEmployment}
                      onChange={(e) => setRateEmployment(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableEmployment}
                      onChange={(e) => setEnableEmployment(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Education */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Education Verification</span>
                  <span className="text-[11px] text-slate-500 font-normal">Degree &amp; roll check</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateEducation}
                      onChange={(e) => setRateEducation(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableEducation}
                      onChange={(e) => setEnableEducation(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Interpol */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Interpol &amp; Watchlist</span>
                  <span className="text-[11px] text-slate-500 font-normal">Global crime databases</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateInterpol}
                      onChange={(e) => setRateInterpol(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableInterpol}
                      onChange={(e) => setEnableInterpol(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Red Notice Worldwide */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Red Notice Worldwide</span>
                  <span className="text-[11px] text-slate-500 font-normal">196 member countries database</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateRednoticeWorldwide}
                      onChange={(e) => setRateRednoticeWorldwide(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableRednoticeWorldwide}
                      onChange={(e) => setEnableRednoticeWorldwide(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Passport */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Passport Verification</span>
                  <span className="text-[11px] text-slate-500 font-normal">Passport record check</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={ratePassport}
                      onChange={(e) => setRatePassport(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePassport}
                      onChange={(e) => setEnablePassport(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Digital Address */}
              <div className="pt-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-900 block">Digital Address Verification</span>
                  <span className="text-[11px] text-slate-500 font-normal">Geo-tagged selfie check</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateDigitalAddress}
                      onChange={(e) => setRateDigitalAddress(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableDigitalAddress}
                      onChange={(e) => setEnableDigitalAddress(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* SAPS Wanted Check */}
              <div className="pt-3 flex items-center justify-between gap-4 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-900 block">SAPS Wanted Persons Check</span>
                  <span className="text-[11px] text-slate-500 font-normal">South Africa Police wanted registry</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateSapsWanted}
                      onChange={(e) => setRateSapsWanted(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSapsWanted}
                      onChange={(e) => setEnableSapsWanted(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* SA Court Check */}
              <div className="pt-3 flex items-center justify-between gap-4 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-900 block">South African Court Check</span>
                  <span className="text-[11px] text-slate-500 font-normal">SAFLII Southern African Legal Information Institute</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateSafliiCourt}
                      onChange={(e) => setRateSafliiCourt(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSafliiCourt}
                      onChange={(e) => setEnableSafliiCourt(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* UK Court Check */}
              <div className="pt-3 flex items-center justify-between gap-4 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-900 block">UK Court Check</span>
                  <span className="text-[11px] text-slate-500 font-normal">Courts &amp; Tribunals Judiciary of England &amp; Wales</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateUkCourt}
                      onChange={(e) => setRateUkCourt(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableUkCourt}
                      onChange={(e) => setEnableUkCourt(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>

              {/* Malaysia Court Check */}
              <div className="pt-3 flex items-center justify-between gap-4 border-t border-slate-100">
                <div>
                  <span className="font-bold text-slate-900 block">Malaysia Court Check</span>
                  <span className="text-[11px] text-slate-500 font-normal">Mahkamah Persekutuan Malaysia • Portal eJudgment</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 font-bold">{getCurrencySymbol(editingOrg?.currency)}</span>
                    <input
                      type="number"
                      step="0.5"
                      value={rateMalaysiaCourt}
                      onChange={(e) => setRateMalaysiaCourt(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableMalaysiaCourt}
                      onChange={(e) => setEnableMalaysiaCourt(e.target.checked)}
                      className="w-4 h-4 text-[#016e1c] rounded"
                    />
                    <span className="text-xs">Enabled</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingOrg(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOrgRates}
                disabled={savingOrgRates}
                className="px-5 py-2.5 bg-[#016e1c] hover:bg-[#00450e] text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {savingOrgRates ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">save</span>
                )}
                Save Rates &amp; Toggles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
