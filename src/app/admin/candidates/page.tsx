"use client";

import React, { useState } from "react";
import { usePortal, Verification } from "src/context/PortalContext";

export default function CandidatesPage() {
  const { verifications, fetchVerificationDetail } = usePortal();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [digilockerFilter, setDigilockerFilter] = useState("all");

  // Selected candidate for details drawer
  const [selectedCandidate, setSelectedCandidate] = useState<Verification | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Verification | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleSelectCandidate = async (candidate: Verification) => {
    setSelectedCandidate(candidate);
    setSelectedDetail(null);
    setIsLoadingDetail(true);
    try {
      const detail = await fetchVerificationDetail(candidate.id);
      setSelectedDetail(detail);
    } catch (err) {
      console.error("Error fetching candidate detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Helper to resolve base64 or other photo URI formats
  const getPhotoSrc = (photo: string) => {
    if (!photo) return "";
    if (photo.startsWith("data:image/jpeg") || photo.startsWith("data:image/png")) {
      return photo;
    }
    if (photo.startsWith("data:image/svg+xml;utf8,")) {
      return "data:image/svg+xml," + encodeURIComponent(photo.substring("data:image/svg+xml;utf8,".length));
    }
    if (photo.startsWith("data:image/svg+xml,") && photo.includes("<svg")) {
      return "data:image/svg+xml," + encodeURIComponent(photo.substring("data:image/svg+xml,".length));
    }
    if (photo.startsWith("data:")) return photo;
    if (photo.startsWith("http")) return photo;
    if (photo.length > 100 && /^[A-Za-z0-9+/=]/.test(photo)) {
      return `data:image/jpeg;base64,${photo}`;
    }
    return photo;
  };

  // Helper to extract or generate fallback attempts timeline
  const getAttemptsList = (candidate: Verification) => {
    if (candidate.attempts && candidate.attempts.length > 0) {
      return candidate.attempts;
    }
    // Fallback logic for legacy seeded records
    if (candidate.verifier || candidate.status !== "Processing") {
      return [
        {
          date: candidate.date,
          verifier: candidate.verifier || "Admin",
          status: candidate.status,
          notes: candidate.notes || "Initial verification audit completed."
        }
      ];
    }
    return [
      {
        date: candidate.date,
        verifier: "Admin",
        status: "Processing",
        notes: "Verification flow initiated."
      }
    ];
  };

  // Get unique organizations list for filter dropdown
  const organizations = Array.from(new Set(verifications.map((v) => v.orgName)));

  // Filtered list
  const filteredCandidates = verifications.filter((v) => {
    const matchesOrg = orgFilter === "all" || v.orgName === orgFilter;
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    
    const isVerified = v.digilockerStatus === "Verified";
    const matchesDigilocker =
      digilockerFilter === "all" ||
      (digilockerFilter === "Verified" && isVerified) ||
      (digilockerFilter === "Pending" && !isVerified);

    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.digilockerAadhaar && v.digilockerAadhaar.includes(searchQuery)) ||
      (v.digilockerPan && v.digilockerPan.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.digilockerId && v.digilockerId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesOrg && matchesStatus && matchesDigilocker && matchesSearch;
  });

  // Stats calculations
  const totalCount = verifications.length;
  const verifiedCount = verifications.filter((v) => v.digilockerStatus === "Verified").length;
  const pendingCount = totalCount - verifiedCount;
  const needsAttentionCount = verifications.filter((v) => v.status === "Needs Attention").length;

  const renderDetailField = (
    label: string,
    value: string | undefined,
    isBadge = false,
    icon?: string
  ) => {
    const displayValue = value || "N/A";
    return (
      <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/50 flex flex-col gap-1 transition-all hover:bg-slate-100/40">
        <div className="flex items-center gap-1.5">
          {icon && (
            <span className="material-symbols-outlined text-[13px] text-slate-400">{icon}</span>
          )}
          {isBadge ? (
            <span className="bg-[#016e1c]/10 text-[#00450e] text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded">
              {label}
            </span>
          ) : (
            <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-semibold">
              {label}
            </span>
          )}
        </div>
        <div className="font-body-md font-bold text-slate-800 break-all mt-0.5">
          {displayValue}
        </div>
      </div>
    );
  };

  const displayCandidate = selectedDetail || selectedCandidate;
  const attemptsList = displayCandidate ? getAttemptsList(displayCandidate) : [];

  return (
    <div className="flex flex-col gap-6 pt-4 animate-fade-in pb-12">
      <div className="mb-4">
        <h2 className="font-display-lg text-slate-900 leading-none tracking-tight">Candidate Database</h2>
        <p className="font-body-lg text-slate-500 mt-2.5 max-w-3xl">
          Global directory of all candidates registered for verification. Search credentials, access profiles, and inspect DigiLocker verified identity details.
        </p>
      </div>

      {/* Summary Stats Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: Total */}
        <div className="bg-white border border-[#016e1c]/12 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4 hover:shadow-[0_8px_30px_rgba(1, 110, 28,0.05)] transition-all">
          <div className="w-12 h-12 bg-gradient-to-br from-[#f6fbf0] via-[#eaf0e4] to-[#bfcab9] text-[#00450e] rounded-xl flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-2xl font-bold">groups</span>
          </div>
          <div>
            <span className="font-label-caps text-slate-400 text-[9.5px] uppercase tracking-wider block font-bold">Total Candidates</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block tracking-tight">{totalCount}</span>
          </div>
        </div>

        {/* Card: Verified */}
        <div className="bg-white border border-[#016e1c]/12 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4 hover:shadow-[0_8px_30px_rgba(1, 110, 28,0.05)] transition-all">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl font-bold">verified_user</span>
          </div>
          <div>
            <span className="font-label-caps text-emerald-600 text-[9.5px] uppercase tracking-wider block font-bold">Verified Profile</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-1 block tracking-tight">{verifiedCount}</span>
          </div>
        </div>

        {/* Card: Pending */}
        <div className="bg-white border border-[#016e1c]/12 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4 hover:shadow-[0_8px_30px_rgba(1, 110, 28,0.05)] transition-all">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl font-bold">pending</span>
          </div>
          <div>
            <span className="font-label-caps text-slate-400 text-[9.5px] uppercase tracking-wider block font-bold">Pending DigiLocker</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-1 block tracking-tight">{pendingCount}</span>
          </div>
        </div>

        {/* Card: Needs Attention */}
        <div className="bg-white border border-[#016e1c]/12 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.01)] flex items-center gap-4 hover:shadow-[0_8px_30px_rgba(1, 110, 28,0.05)] transition-all">
          <div className="w-12 h-12 bg-red-500/10 text-red-600 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl font-bold">report_problem</span>
          </div>
          <div>
            <span className="font-label-caps text-red-600 text-[9.5px] uppercase tracking-wider block font-bold">Needs Attention</span>
            <span className="text-2xl font-extrabold text-red-600 mt-1 block tracking-tight">{needsAttentionCount}</span>
          </div>
        </div>
      </section>

      {/* Roster Controls / Filters */}
      <section className="bg-white border border-[#016e1c]/12 rounded-2xl p-5 flex flex-col xl:flex-row gap-4 items-center shadow-[0_4px_25px_rgba(1, 110, 28,0.03)]">
        {/* Search */}
        <div className="w-full xl:flex-1 relative">
          <input
            type="text"
            placeholder="Search by ID, name, email, Aadhaar, PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all placeholder-slate-400"
          />
          <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg">search</span>
        </div>

        {/* Org filter */}
        <div className="w-full xl:w-56 flex flex-col gap-1">
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All Organizations</option>
            {organizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>

        {/* DigiLocker status filter */}
        <div className="w-full xl:w-56 flex flex-col gap-1">
          <select
            value={digilockerFilter}
            onChange={(e) => setDigilockerFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All DigiLocker Statuses</option>
            <option value="Verified">Verified Only</option>
            <option value="Pending">Pending Only</option>
          </select>
        </div>

        {/* Verification flow status filter */}
        <div className="w-full xl:w-48 flex flex-col gap-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All Flow Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Processing">Processing</option>
            <option value="Needs Attention">Needs Attention</option>
          </select>
        </div>
      </section>

      {/* Main Directory Table */}
      <section className="apple-card-static overflow-hidden border border-[#016e1c]/10 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#016e1c]/10 bg-slate-50/50">
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">CANDIDATE</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">CLIENT ORG</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">REGISTRATION DATE</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">DIGILOCKER IDENTITY</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">VERIFICATION FLOW</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">VERIFIED DOCUMENTS</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No candidates found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((c) => {
                  const isVerified = c.digilockerStatus === "Verified";
                  const hasAadhaar = !!c.digilockerAadhaar;
                  const hasPan = !!c.digilockerPan;
                  const documentCount = c.digilockerDocuments?.length || 0;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectCandidate(c)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    >
                      {/* Candidate Name & Email */}
                      <td className="py-4 px-6 text-slate-800">
                        <div className="flex items-center gap-3">
                          {c.digilockerPhoto ? (
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-50 shadow-inner">
                              <img
                                src={getPhotoSrc(c.digilockerPhoto)}
                                alt={c.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f6fbf0] via-[#eaf0e4] to-[#bfcab9] text-[#016e1c] border border-[#bfcab9]/30 flex items-center justify-center font-black text-sm shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-[#0ea5e9] transition-colors">
                              {c.name}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5">{c.type === "court_record" ? (c.courtRecordSummary || "Court record search") : c.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Client Org */}
                      <td className="py-4 px-6 text-slate-600 font-medium">{c.orgName}</td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 font-medium">{c.date}</td>

                      {/* DigiLocker Status */}
                      <td className="py-4 px-6">
                          {c.type === "court_record" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-amber-500/10 text-amber-700 border-amber-500/15">
                              Court Record
                            </span>
                          ) : isVerified ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-emerald-500/10 text-emerald-600 border-emerald-500/15">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-slate-100 text-slate-400 border-slate-200/50">
                              Pending
                            </span>
                          )}
                      </td>

                      {/* Verification Status */}
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                            c.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                              : c.status === "Processing"
                              ? "bg-[#016e1c]/10 text-[#00450e] border-[#016e1c]/15"
                              : "bg-red-500/10 text-red-600 border-red-500/15"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Aadhaar / PAN status chips */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          {hasAadhaar ? (
                            <span className="text-[9px] bg-[#016e1c]/10 text-[#00450e] border border-[#016e1c]/15 px-2 py-0.5 rounded font-extrabold" title={`Aadhaar: ${c.digilockerAadhaar}`}>
                              AADHAAR
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-50 text-slate-400 border border-slate-200/60 px-2 py-0.5 rounded font-bold">
                              NO AADHAAR
                            </span>
                          )}
                          {hasPan ? (
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-700 border border-indigo-500/15 px-2 py-0.5 rounded font-extrabold" title={`PAN: ${c.digilockerPan}`}>
                              PAN
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-50 text-slate-400 border border-slate-200/60 px-2 py-0.5 rounded font-bold">
                              NO PAN
                            </span>
                          )}
                          {documentCount > 0 && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200/50 px-2 py-0.5 rounded font-bold">
                              +{documentCount} DOCS
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleSelectCandidate(c)}
                          className="px-3.5 py-1.5 apple-button-secondary rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ml-auto"
                        >
                          <span className="material-symbols-outlined text-[15px]">folder_open</span>
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Candidate Inspector Fullscreen Popup */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="w-full h-full bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="border-b border-slate-100 bg-slate-50/30 shrink-0">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined p-2 rounded-xl text-lg ${
                      displayCandidate?.digilockerStatus === "Verified"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/10"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {displayCandidate?.digilockerStatus === "Verified" ? "verified_user" : "pending"}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline-md text-slate-900 font-extrabold text-lg">Candidate Profile</h3>
                      {isLoadingDetail && (
                        <div className="w-4 h-4 rounded-full border-2 border-[#016e1c] border-t-transparent animate-spin" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">ID: {displayCandidate?.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Popup Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
                {/* Photo + Primary Identity Block */}
                <div className="flex items-start gap-4 p-1">
                  {isLoadingDetail ? (
                    <div className="w-20 h-24 bg-slate-50 rounded-2xl border border-slate-200/60 shrink-0 flex items-center justify-center shadow-inner">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-[#016e1c] animate-spin" />
                    </div>
                  ) : displayCandidate?.digilockerPhoto ? (
                    <div className="w-20 h-24 bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center shadow-sm">
                      <img
                        src={getPhotoSrc(displayCandidate.digilockerPhoto)}
                        alt={displayCandidate.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-24 bg-gradient-to-br from-[#f6fbf0] via-[#eaf0e4] to-[#bfcab9] text-[#016e1c] rounded-2xl flex items-center justify-center font-black text-3xl shrink-0 border border-[#bfcab9]/30 shadow-inner">
                      {displayCandidate?.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-headline-md text-slate-900 font-extrabold text-xl leading-none">
                        {displayCandidate?.digilockerName || displayCandidate?.name}
                      </h4>
                      {displayCandidate?.digilockerStatus === "Verified" && (
                        <span className="inline-flex items-center text-[10px] text-emerald-600 font-bold bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-[10px] mr-1 font-bold">check_circle</span>
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="font-body-sm text-slate-500 mt-1">
                      {displayCandidate?.digilockerEmail || displayCandidate?.email}
                    </p>
                    {displayCandidate?.digilockerUsername && (
                      <span className="mt-1 bg-[#016e1c]/10 text-[#00450e] text-[9.5px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full w-fit">
                        @{displayCandidate.digilockerUsername}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">CLIENT: {displayCandidate?.orgName}</span>
                  </div>
                </div>

                {/* Section: Account Status */}
                <div className="p-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl text-sm flex flex-col gap-3">
                  <span className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-1.5 text-xs uppercase tracking-wider text-slate-400">
                    <span className="material-symbols-outlined text-base">account_circle</span>
                    Account Details
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block font-label-caps text-[9px] tracking-wide font-bold uppercase">LOGIN EMAIL</span>
                      <span className="font-mono font-bold text-slate-700 break-all">{displayCandidate?.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-label-caps text-[9px] tracking-wide font-bold uppercase">ONBOARDING STATUS</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border mt-1 ${
                        displayCandidate?.onboardingStatus === "setup_pending"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/15"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                      }`}>
                        {displayCandidate?.onboardingStatus === "setup_pending" ? "Setup Pending" : "Account Active"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* DigiLocker Verified Details */}
                {displayCandidate?.digilockerStatus === "Verified" ? (
                  <div className="flex flex-col gap-6 animate-fade-in">
                    {/* Verified Details Sub-Section */}
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">person</span>
                        Personal Details (DigiLocker Records)
                      </h5>
                      {isLoadingDetail ? (
                        <div className="text-xs text-slate-400 italic">Decrypting secure records...</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            {renderDetailField("Full Name", displayCandidate.digilockerName, false, "badge")}
                            {renderDetailField("Age", displayCandidate.digilockerAge, false, "cake")}
                            {renderDetailField("Gender", displayCandidate.digilockerGender, false, "wc")}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {renderDetailField("Date of Birth", displayCandidate.digilockerDob, false, "calendar_today")}
                            {renderDetailField("Mobile Number", displayCandidate.digilockerMobile, false, "phone")}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Section: Identity Documents */}
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">description</span>
                        Identity Documents
                      </h5>
                      {isLoadingDetail ? (
                        <div className="text-xs text-slate-400 italic">Retrieving identity tokens...</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {renderDetailField("Aadhaar", displayCandidate.digilockerAadhaar, false, "fingerprint")}
                            {renderDetailField("PAN Card", displayCandidate.digilockerPan, true, "credit_card")}
                            {renderDetailField("Driving Licence", displayCandidate.digilockerDrivingLicence, true, "directions_car")}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {renderDetailField("DigiLocker ID", displayCandidate.digilockerId, true, "link")}
                            {renderDetailField("Reference Key", displayCandidate.digilockerReferenceKey, true, "vpn_key")}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Verified Documents from DigiLocker */}
                    {isLoadingDetail ? (
                      <div className="flex flex-col gap-3">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                          Verified Documents List
                        </h5>
                        <div className="text-xs text-slate-400 italic">Fetching digital wallet documents...</div>
                      </div>
                    ) : displayCandidate.digilockerDocuments && displayCandidate.digilockerDocuments.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                          Verified Documents List ({displayCandidate.digilockerDocuments.length})
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {displayCandidate.digilockerDocuments.map((doc: any) => (
                            <div key={doc.id || doc.uri} className="p-3 bg-slate-50/60 border border-slate-200/50 rounded-2xl flex flex-col gap-1.5 hover:bg-slate-50 transition-colors">
                              <span className="font-bold text-xs text-slate-800">{doc.name}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{doc.issuer}</span>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[150px]">{doc.uri}</span>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">{doc.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  /* Pending state details card */
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 text-2xl font-light">hourglass_empty</span>
                    <div className="flex flex-col">
                      <span className="font-body-sm font-bold text-slate-800">Awaiting DigiLocker Account Link</span>
                      <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                        The candidate has been registered but has not yet completed their identity authentication via DigiLocker.
                      </span>
                    </div>
                  </div>
                )}

                {/* Court Record Details Section (for court_record type) */}
                {displayCandidate?.type === "court_record" && (
                  <div className="flex flex-col gap-4 border-t border-slate-100 pt-4">
                    {/* Court Record Search Banner */}
                    <div className={`border rounded-2xl p-4 flex items-center gap-3.5 ${
                      displayCandidate.courtRecordStatus === "completed"
                        ? displayCandidate.courtRecordHasRecords
                          ? "bg-rose-500/5 border-rose-500/15"
                          : "bg-emerald-500/5 border-emerald-500/15"
                        : displayCandidate.courtRecordStatus === "error"
                          ? "bg-amber-500/5 border-amber-500/15"
                          : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        displayCandidate.courtRecordStatus === "completed"
                          ? displayCandidate.courtRecordHasRecords ? "text-rose-500" : "text-emerald-500"
                          : displayCandidate.courtRecordStatus === "error" ? "text-amber-500" : "text-blue-500"
                      }`}>
                        {displayCandidate.courtRecordStatus === "completed"
                          ? displayCandidate.courtRecordHasRecords ? "gavel" : "verified_user"
                          : displayCandidate.courtRecordStatus === "error" ? "warning" : "hourglass_top"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          displayCandidate.courtRecordStatus === "completed"
                            ? displayCandidate.courtRecordHasRecords ? "text-rose-800" : "text-emerald-800"
                            : displayCandidate.courtRecordStatus === "error" ? "text-amber-800" : "text-blue-800"
                        }`}>
                          {displayCandidate.courtRecordStatus === "completed"
                            ? displayCandidate.courtRecordHasRecords
                              ? `${displayCandidate.courtRecordTotalCases} Court Record(s) Found`
                              : "No Court Records Found"
                            : displayCandidate.courtRecordStatus === "error"
                              ? "Search Encountered Errors"
                              : "Court Record Search In Progress..."}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {displayCandidate.courtRecordSummary || "Searching eCourts India..."}
                        </span>
                      </div>
                    </div>

                    {/* Candidate Info */}
                    <div className="grid grid-cols-2 gap-3">
                      {renderDetailField("Full Name", displayCandidate.name, false, "person")}
                      {renderDetailField("Date of Birth", displayCandidate.candidateDob, false, "calendar_today")}
                    </div>

                    {/* Addresses */}
                    {displayCandidate.addresses && displayCandidate.addresses.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold">Addresses Searched</span>
                        {displayCandidate.addresses.map((addr: any, i: number) => (
                          <div key={i} className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/50 text-xs font-semibold text-slate-700">
                            <span className="text-[10px] font-bold bg-slate-200/50 text-slate-600 px-1.5 py-0.5 rounded mr-2">{i + 1}</span>
                            {[addr.address, addr.city, addr.state, addr.country].filter(Boolean).join(", ")}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Search Results Summary */}
                    {displayCandidate.courtRecordResults && displayCandidate.courtRecordResults.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold">Court Complex Results</span>
                        {displayCandidate.courtRecordResults.map((result: any, rIdx: number) => (
                          <div key={rIdx} className="border border-slate-200/60 rounded-2xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200/40">
                              <span className="text-xs font-bold text-slate-800">{result.district}, {result.state}</span>
                              <span className="text-[10px] font-bold text-slate-500">{result.complexSearches?.length || 0} complex(es)</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {result.complexSearches?.map((cs: any, csIdx: number) => (
                                <div key={csIdx} className="px-4 py-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-700">{cs.complexName}</span>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    cs.error ? "bg-amber-50 text-amber-700" : cs.casesFound > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                                  }`}>
                                    {cs.error ? "Error" : cs.casesFound > 0 ? `${cs.casesFound} Record(s)` : "Clear"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section: Verification Flow Context */}
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                  <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                    Verification Flow Context
                  </h5>
                  <div className="grid grid-cols-3 gap-3">
                    {renderDetailField("Flow Status", displayCandidate?.status, false, "info")}
                    {renderDetailField("Date Initiated", displayCandidate?.date, false, "calendar_today")}
                    {renderDetailField("Verifier Assigned", displayCandidate?.verifier || "None", false, "badge")}
                  </div>

                  {displayCandidate?.reportDetails && (
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold">Latest Verification Findings</span>
                      <p className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-slate-655 leading-relaxed font-body-sm">
                        {displayCandidate.reportDetails}
                      </p>
                    </div>
                  )}

                  {displayCandidate?.notes && (
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                        Internal Flow Notes
                      </span>
                      <p className="text-slate-500 italic pl-3.5 border-l-2 border-[#016e1c] font-body-sm leading-relaxed">
                        {displayCandidate.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Section: Verification Attempts */}
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
                  <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                    <span className="material-symbols-outlined text-sm">history</span>
                    Verification Attempts ({attemptsList.length})
                  </h5>
                  <div className="flex flex-col gap-3">
                    {attemptsList.map((att, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-2 relative transition-all hover:bg-slate-50"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-[#0ea5e9] font-extrabold uppercase tracking-wider">
                              Attempt #{idx + 1}
                            </span>
                            <span className="text-xs text-slate-700 font-bold mt-0.5">
                              {att.date} · by <span className="text-[#00450e]">{att.verifier}</span>
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                              att.status === "Completed"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                                : att.status === "Processing"
                                ? "bg-[#016e1c]/10 text-[#00450e] border-[#016e1c]/15"
                                : "bg-red-500/10 text-red-600 border-red-500/15"
                            }`}
                          >
                            {att.status}
                          </span>
                        </div>
                        {att.notes && (
                          <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2.5 mt-1.5 font-body-sm leading-relaxed">
                            {att.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Popup Footer */}
            <div className="border-t border-slate-100 bg-slate-50/30 shrink-0">
              <div className="max-w-5xl mx-auto w-full p-6 flex gap-3">
                <button
                  onClick={() => setSelectedCandidate(null)}
                  className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-button-text rounded-xl transition-colors cursor-pointer text-sm font-semibold flex items-center justify-center gap-2"
                >
                  Close Inspector
                </button>
                {displayCandidate?.status === "Completed" && (
                  <button
                    onClick={() => {
                      const reportPath = displayCandidate.type === "court_record"
                        ? `/admin/court-record-report?id=${displayCandidate.id}`
                        : `/admin/report?id=${displayCandidate.id}`;
                      window.open(reportPath, "_blank");
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] hover:opacity-90 text-white font-button-text rounded-xl transition-all cursor-pointer text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/10"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    Print Report
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
