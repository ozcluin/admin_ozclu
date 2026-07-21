"use client";

import React, { useState } from "react";
import { usePortal, Verification } from "src/context/PortalContext";

export default function CandidatesPage() {
  const { verifications, fetchVerificationDetail, logEmploymentAttempt, logVerificationAttempt, deleteEmploymentAttempt, logEducationAttempt, deleteEducationAttempt } = usePortal();

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [digilockerFilter, setDigilockerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, orgFilter, statusFilter, digilockerFilter, typeFilter]);

  // Selected candidate for details drawer
  const [selectedCandidate, setSelectedCandidate] = useState<Verification | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Verification | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Employment Log Attempt state
  const [empAttemptMode, setEmpAttemptMode] = useState("Manual");
  const [empAttemptResult, setEmpAttemptResult] = useState("In Progress");
  const [empAttemptComment, setEmpAttemptComment] = useState("");
  const [empAttemptVerifierNote, setEmpAttemptVerifierNote] = useState("");
  const [empAttemptRespondentName, setEmpAttemptRespondentName] = useState("");
  const [empAttemptRespondentEmail, setEmpAttemptRespondentEmail] = useState("");
  const [empAttemptRespondentComment, setEmpAttemptRespondentComment] = useState("");
  const [empAttemptExtraPayment, setEmpAttemptExtraPayment] = useState(false);
  const [empAttemptMarkAsPaid, setEmpAttemptMarkAsPaid] = useState(false);
  const [empAttemptAskApproval, setEmpAttemptAskApproval] = useState(false);
  const [empAttemptScreenshot, setEmpAttemptScreenshot] = useState("");
  const [empAttemptSendEmail, setEmpAttemptSendEmail] = useState(false);
  const [empAttemptSubmitting, setEmpAttemptSubmitting] = useState(false);
  const [empAttemptSuccess, setEmpAttemptSuccess] = useState("");
  const [empAttemptError, setEmpAttemptError] = useState("");
  const [showLogAttemptForm, setShowLogAttemptForm] = useState(false);

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
    
    const matchesDigilocker = digilockerFilter === "all" ||
      (digilockerFilter === "Verified" && v.digilockerStatus === "Verified") ||
      (digilockerFilter === "Pending" && v.digilockerStatus !== "Verified");

    const matchesType = typeFilter === "all" ||
      (typeFilter === "employment" && v.type === "employment") ||
      (typeFilter === "education" && v.type === "education") ||
      (typeFilter === "identity" && (!v.type || v.type === "identity")) ||
      (typeFilter === "court_record" && v.type === "court_record") ||
      (typeFilter === "interpol" && v.type === "interpol");

    const matchesSearch =
      !searchQuery ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.digilockerAadhaar && v.digilockerAadhaar.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.digilockerPan && v.digilockerPan.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.digilockerId && v.digilockerId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesOrg && matchesStatus && matchesDigilocker && matchesType && matchesSearch;
  });

  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage) || 1;
  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

        {/* Type filter */}
        <div className="w-full xl:w-48 flex flex-col gap-1">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="identity">Identity</option>
            <option value="court_record">Court Record</option>
            <option value="employment">Employment</option>
            <option value="education">Education</option>
            <option value="interpol">Interpol Check</option>
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

      {/* Main Directory Table - Desktop View */}
      <section className="hidden xl:block apple-card-static overflow-hidden border border-[#016e1c]/10 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm table-fixed">
            <thead>
              <tr className="border-b border-[#016e1c]/10 bg-slate-50/50">
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[260px]">CANDIDATE</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[140px]">CLIENT ORG</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[130px]">REGISTRATION DATE</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[130px]">DIGILOCKER IDENTITY</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[110px]">VERIFICATION FLOW</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[180px]">VERIFIED DOCUMENTS</th>
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
                paginatedCandidates.map((c) => {
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
                      <td className="py-4 px-6 text-slate-800 whitespace-normal break-words">
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
                            <span className="text-xs text-slate-400 mt-0.5 font-semibold">
                              {c.type === "court_record"
                                ? (c.courtRecordSummary || "Court record search")
                                : c.type === "education"
                                ? ((c.educationData?.courseName && `${c.educationData.courseName} @ ${c.educationData.boardUniversity}`) || c.email)
                                : c.type === "interpol"
                                ? (c.interpolHasRecords ? `${c.interpolMatches?.length || 0} Record Match(es)` : "Clean Record")
                                : c.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Client Org */}
                      <td className="py-4 px-6 text-slate-600 font-medium whitespace-normal break-words leading-relaxed">{c.orgName}</td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 font-medium whitespace-nowrap">{c.date}</td>

                      {/* DigiLocker Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                          {c.type === "employment" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-blue-500/10 text-blue-700 border-blue-500/15">
                              Employment
                            </span>
                          ) : c.type === "court_record" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-amber-500/10 text-amber-700 border-amber-500/15">
                              Court Record
                            </span>
                          ) : c.type === "education" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-purple-500/10 text-purple-700 border-purple-500/15">
                              Education
                            </span>
                          ) : c.type === "interpol" ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border bg-indigo-500/10 text-indigo-700 border-indigo-500/15">
                              Interpol
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
                      <td className="py-4 px-6 whitespace-nowrap">
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
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                            <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200/50 px-2 py-0.5 rounded font-bold whitespace-nowrap">
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

      {/* Mobile/Tablet Cards View - One Block per Row */}
      <div className="block xl:hidden space-y-4">
        {filteredCandidates.length === 0 ? (
          <div className="bg-white border border-[#016e1c]/10 rounded-2xl p-8 text-center text-slate-400 font-medium shadow-sm">
            No candidates found matching your filters.
          </div>
        ) : (
          paginatedCandidates.map((c) => {
            const isVerified = c.digilockerStatus === "Verified";
            const hasAadhaar = !!c.digilockerAadhaar;
            const hasPan = !!c.digilockerPan;
            return (
              <div
                key={c.id}
                onClick={() => handleSelectCandidate(c)}
                className="bg-white border border-[#016e1c]/10 rounded-2xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] flex flex-col gap-4 cursor-pointer hover:border-[#016e1c]/30 transition-all"
              >
                {/* Header: Photo + Name + Flow Status */}
                <div className="flex justify-between items-start gap-2">
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
                        {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{c.name}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono mt-0.5">{c.id}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                      c.status === "Completed"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                        : c.status === "Processing"
                        ? "bg-[#016e1c]/10 text-[#00450e] border-[#016e1c]/15"
                        : "bg-red-500/10 text-red-600 border-red-500/15"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Sub-label text description */}
                <div className="text-xs text-slate-500 leading-relaxed font-semibold">
                  {c.type === "court_record"
                    ? (c.courtRecordSummary || "Court record search")
                    : c.type === "education"
                    ? ((c.educationData?.courseName && `${c.educationData.courseName} @ ${c.educationData.boardUniversity}`) || c.email)
                    : c.type === "interpol"
                    ? (c.interpolHasRecords ? `${c.interpolMatches?.length || 0} Record Match(es)` : "Clean Record")
                    : c.email}
                </div>

                {/* Metadata Details Grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider font-semibold">Client Org</span>
                    <span className="font-semibold text-slate-700">{c.orgName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider font-semibold">Registration Date</span>
                    <span className="font-semibold text-slate-700">{c.date}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider font-semibold">Flow Type</span>
                    {c.type === "court_record" ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border bg-amber-500/10 text-amber-700 border-amber-500/15 mt-1">
                        Court Record
                      </span>
                    ) : c.type === "education" ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border bg-purple-500/10 text-purple-700 border-purple-500/15 mt-1">
                        Education
                      </span>
                    ) : c.type === "interpol" ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border bg-indigo-500/10 text-indigo-700 border-indigo-500/15 mt-1">
                        Interpol
                      </span>
                    ) : c.type === "employment" ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border bg-blue-500/10 text-blue-700 border-blue-500/15 mt-1">
                        Employment
                      </span>
                    ) : isVerified ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border bg-emerald-500/10 text-emerald-600 border-emerald-500/15 mt-1">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border bg-slate-100 text-slate-400 border-slate-200/50 mt-1">
                        Pending
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider font-semibold">Identity Tokens</span>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {hasAadhaar ? (
                        <span className="text-[8px] bg-[#016e1c]/10 text-[#00450e] border border-[#016e1c]/15 px-1.5 py-0.5 rounded font-extrabold">
                          AADHAAR
                        </span>
                      ) : (
                        <span className="text-[8px] bg-slate-50 text-slate-400 border border-slate-200/60 px-1.5 py-0.5 rounded font-bold">
                          NO AADHAAR
                        </span>
                      )}
                      {hasPan ? (
                        <span className="text-[8px] bg-indigo-500/10 text-indigo-700 border border-indigo-500/15 px-1.5 py-0.5 rounded font-extrabold">
                          PAN
                        </span>
                      ) : (
                        <span className="text-[8px] bg-slate-50 text-slate-400 border border-slate-200/60 px-1.5 py-0.5 rounded font-bold">
                          NO PAN
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Link Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectCandidate(c);
                  }}
                  className="w-full py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">folder_open</span>
                  View Profile
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#016e1c]/12 rounded-2xl p-4 shadow-sm mt-4">
          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredCandidates.length)}</span> of{" "}
            <span className="font-bold text-slate-900">{filteredCandidates.length}</span> reports / candidates
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              <span>Previous</span>
            </button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, i, arr) => {
                  const prevPage = arr[i - 1];
                  const showDots = prevPage && page - prevPage > 1;
                  return (
                    <React.Fragment key={page}>
                      {showDots && <span className="text-xs text-slate-400 font-bold px-1">...</span>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? "bg-[#016e1c] text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1"
            >
              <span>Next</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}

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
                        : (displayCandidate.courtRecordStatus === "error" || displayCandidate.courtRecordStatus === "needs_admin_retry")
                          ? "bg-amber-500/5 border-amber-500/15"
                          : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        displayCandidate.courtRecordStatus === "completed"
                          ? displayCandidate.courtRecordHasRecords ? "text-rose-500" : "text-emerald-500"
                          : (displayCandidate.courtRecordStatus === "error" || displayCandidate.courtRecordStatus === "needs_admin_retry") ? "text-amber-500" : "text-blue-500"
                      }`}>
                        {displayCandidate.courtRecordStatus === "completed"
                          ? displayCandidate.courtRecordHasRecords ? "gavel" : "verified_user"
                          : (displayCandidate.courtRecordStatus === "error" || displayCandidate.courtRecordStatus === "needs_admin_retry") ? "warning" : "hourglass_top"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          displayCandidate.courtRecordStatus === "completed"
                            ? displayCandidate.courtRecordHasRecords ? "text-rose-800" : "text-emerald-800"
                            : (displayCandidate.courtRecordStatus === "error" || displayCandidate.courtRecordStatus === "needs_admin_retry") ? "text-amber-800" : "text-blue-800"
                        }`}>
                          {displayCandidate.courtRecordStatus === "completed"
                            ? displayCandidate.courtRecordHasRecords
                              ? `${displayCandidate.courtRecordTotalCases} Court Record(s) Found`
                              : "No Court Records Found"
                            : displayCandidate.courtRecordStatus === "needs_admin_retry"
                              ? "Search Failed — Admin Retry Required"
                              : displayCandidate.courtRecordStatus === "error"
                              ? "Search Encountered Errors"
                              : "Court Record Search In Progress..."}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {displayCandidate.courtRecordSummary || displayCandidate.courtRecordProgress || "Searching eCourts India..."}
                        </span>
                      </div>
                    </div>

                    {/* Candidate Info */}
                    <div className="grid grid-cols-2 gap-3">
                      {renderDetailField("Full Name", displayCandidate.name, false, "person")}
                      {displayCandidate.gender && renderDetailField("Gender", displayCandidate.gender, false, "wc")}
                      {renderDetailField("Date of Birth", displayCandidate.candidateDob, false, "calendar_today")}
                      {displayCandidate.idProofType && renderDetailField("ID Type", displayCandidate.idProofType, false, "id_card")}
                      {displayCandidate.idProofNumber && renderDetailField("ID Number", displayCandidate.idProofNumber, false, "pin")}
                      {renderDetailField("Father's Name", displayCandidate.candidateFatherName, false, "person")}
                      {renderDetailField("Mother's Name", displayCandidate.candidateMotherName, false, "person")}
                      {displayCandidate.candidateIsMarried && renderDetailField("Husband's Name", displayCandidate.candidateHusbandName, false, "person")}
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

                {/* Employment Verification Details Section */}
                {(displayCandidate?.type === "employment" || displayCandidate?.type === "education") && (
                  <div className="flex flex-col gap-6 border-t border-slate-100 pt-4">
                    {/* Employment / Education Status Banner */}
                    <div className={`border rounded-2xl p-4 flex items-center gap-3.5 ${
                      (displayCandidate.type === "employment" ? displayCandidate.employmentDataSubmitted : displayCandidate.educationDataSubmitted)
                        ? "bg-emerald-500/5 border-emerald-500/15"
                        : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        (displayCandidate.type === "employment" ? displayCandidate.employmentDataSubmitted : displayCandidate.educationDataSubmitted) ? "text-emerald-500" : "text-blue-500"
                      }`}>
                        {(displayCandidate.type === "employment" ? displayCandidate.employmentDataSubmitted : displayCandidate.educationDataSubmitted) ? "task_alt" : "hourglass_top"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          (displayCandidate.type === "employment" ? displayCandidate.employmentDataSubmitted : displayCandidate.educationDataSubmitted) ? "text-emerald-800" : "text-blue-800"
                        }`}>
                          {displayCandidate.skipCandidateLogin
                            ? "Direct Client Submission (No Candidate Login)"
                            : displayCandidate.type === "employment"
                            ? (displayCandidate.employmentDataSubmitted ? "Employment Data Submitted by Candidate" : "Awaiting Candidate Submission")
                            : (displayCandidate.educationDataSubmitted ? "Education Data Submitted by Candidate" : "Awaiting Candidate Submission")}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {displayCandidate.skipCandidateLogin
                            ? "Candidate login creation was skipped by client during request initiation"
                            : displayCandidate.type === "employment"
                            ? (displayCandidate.employmentDataSubmittedAt
                              ? `Submitted on ${new Date(displayCandidate.employmentDataSubmittedAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
                              : "Candidate has not yet filled the employment form")
                            : (displayCandidate.educationDataSubmittedAt
                              ? `Submitted on ${new Date(displayCandidate.educationDataSubmittedAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
                              : "Candidate has not yet filled the education form")}
                        </span>
                      </div>
                    </div>

                    {/* ═══ PERSONAL DETAILS TABLE ═══ */}
                    <div className="flex flex-col gap-2">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">person</span>
                        Personal Details
                      </h5>
                      <div className="overflow-x-auto border border-slate-200/60 rounded-xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <th className="p-2.5 border-r border-slate-200 w-2/5">Information Required</th>
                              <th className="p-2.5">Provided Response</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Full name (as per government ID)</td>
                              <td className="p-2.5 font-bold text-slate-900">{displayCandidate.digilockerName || displayCandidate.name || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Date of birth</td>
                              <td className="p-2.5">{displayCandidate.digilockerDob || displayCandidate.candidateDob || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Mobile number</td>
                              <td className="p-2.5">{displayCandidate.digilockerMobile || displayCandidate.candidateMobile || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Current residential address</td>
                              <td className="p-2.5">{displayCandidate.addresses && displayCandidate.addresses.length > 0
                                ? [displayCandidate.addresses[0].address, displayCandidate.addresses[0].city, displayCandidate.addresses[0].state, displayCandidate.addresses[0].country].filter(Boolean).join(", ")
                                : "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Primary government ID number</td>
                              <td className="p-2.5 font-mono">{displayCandidate.digilockerAadhaar || displayCandidate.digilockerPan || displayCandidate.idProofNumber || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Email address</td>
                              <td className="p-2.5">{displayCandidate.digilockerEmail || displayCandidate.email || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Nationality</td>
                              <td className="p-2.5">{"Indian"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Gender</td>
                              <td className="p-2.5">{displayCandidate.digilockerGender || displayCandidate.gender || "-"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ═══ EDUCATION CHECK TABLE ═══ */}
                    {displayCandidate.type === "education" && displayCandidate.educationData && (
                      <div className="flex flex-col gap-2">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">school</span>
                          Education Details
                        </h5>
                        <div className="overflow-x-auto border border-slate-200/60 rounded-xl mb-4">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-2.5 border-r border-slate-200 w-2/5">Academic Field</th>
                                <th className="p-2.5">Candidate Input Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Degree Category</td>
                                <td className="p-2.5">{displayCandidate.educationData.degreeType || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Course / Degree Name</td>
                                <td className="p-2.5 font-bold text-slate-900">{displayCandidate.educationData.courseName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Board / University</td>
                                <td className="p-2.5">{displayCandidate.educationData.boardUniversity || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">School / College Name</td>
                                <td className="p-2.5">{displayCandidate.educationData.institutionName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Roll / Registration No.</td>
                                <td className="p-2.5 font-mono">{displayCandidate.educationData.rollNumber || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Passing Year</td>
                                <td className="p-2.5 font-mono">{displayCandidate.educationData.passingYear || "-"}</td>
                              </tr>
                              {displayCandidate.educationData.certificateFile && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Degree / Marksheet Proof</td>
                                  <td className="p-2.5">
                                    <a
                                      href={displayCandidate.educationData.certificateFile}
                                      download={displayCandidate.educationData.certificateFileName || `certificate-${displayCandidate.id}.png`}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-650 text-white rounded-lg hover:bg-purple-800 transition-colors font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-xs"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">download</span>
                                      Download Certificate
                                    </a>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ═══ EMPLOYMENT CHECK TABLE ═══ */}
                    {displayCandidate.employmentData && (
                      <div className="flex flex-col gap-2">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">work</span>
                          Employment Check
                        </h5>
                        <div className="overflow-x-auto border border-slate-200/60 rounded-xl">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-2.5 border-r border-slate-200 w-2/5">Information Required</th>
                                <th className="p-2.5">Provided Response</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800 font-semibold">
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Country</td>
                                <td className="p-2.5">{displayCandidate.employmentData.country || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">State</td>
                                <td className="p-2.5">{displayCandidate.employmentData.state || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">City</td>
                                <td className="p-2.5">{displayCandidate.employmentData.city || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Company Name</td>
                                <td className="p-2.5 font-bold text-slate-900">{displayCandidate.employmentData.companyName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Address - Line 1</td>
                                <td className="p-2.5">{displayCandidate.employmentData.addressLine1 || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Address - Line 2</td>
                                <td className="p-2.5">{displayCandidate.employmentData.addressLine2 || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Company Telephone</td>
                                <td className="p-2.5">{displayCandidate.employmentData.companyTelephone ? `${displayCandidate.employmentData.companyTelephoneCode || ""} ${displayCandidate.employmentData.companyTelephone}` : "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Department</td>
                                <td className="p-2.5">{displayCandidate.employmentData.department || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Position</td>
                                <td className="p-2.5">{displayCandidate.employmentData.position || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employment Period - From</td>
                                <td className="p-2.5 font-mono">{displayCandidate.employmentData.employmentPeriodFrom || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employment Period - To</td>
                                <td className="p-2.5 font-mono">{displayCandidate.employmentData.employmentPeriodTo || "Present"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employee Code</td>
                                <td className="p-2.5 font-mono">{displayCandidate.employmentData.employeeCode || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Reporting Manager Name</td>
                                <td className="p-2.5">{displayCandidate.employmentData.reportingManagerName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Department of Reporting Manager</td>
                                <td className="p-2.5">{displayCandidate.employmentData.reportingManagerDepartment || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Contact No of Reporting Manager</td>
                                <td className="p-2.5">{displayCandidate.employmentData.reportingManagerContact ? `${displayCandidate.employmentData.reportingManagerContactCode || ""} ${displayCandidate.employmentData.reportingManagerContact}` : "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Email ID of Reporting Manager</td>
                                <td className="p-2.5">{displayCandidate.employmentData.reportingManagerEmail || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Annual CTC</td>
                                <td className="p-2.5 font-mono">{displayCandidate.employmentData.annualCTC || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employment is Permanent or Temporary</td>
                                <td className="p-2.5">{displayCandidate.employmentData.employmentType || "-"}</td>
                              </tr>
                              {displayCandidate.employmentData.agencyDetails && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Agency Details (if temporary or contractual)</td>
                                  <td className="p-2.5">{displayCandidate.employmentData.agencyDetails}</td>
                                </tr>
                              )}
                              {displayCandidate.employmentData.reasonForLeaving && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Reason(s) for Leaving</td>
                                  <td className="p-2.5 font-normal text-slate-700">{displayCandidate.employmentData.reasonForLeaving}</td>
                                </tr>
                              )}
                              {displayCandidate.employmentData.remarks && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Remarks If any</td>
                                  <td className="p-2.5 italic font-normal text-slate-500">{displayCandidate.employmentData.remarks}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Log Attempt Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 flex-1">
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      Log Verification Attempt
                    </h5>
                    <button
                      onClick={() => setShowLogAttemptForm(!showLogAttemptForm)}
                      className="text-[10px] font-bold uppercase tracking-wider text-[#016e1c] bg-[#016e1c]/10 hover:bg-[#016e1c]/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">{showLogAttemptForm ? "expand_less" : "add"}</span>
                      {showLogAttemptForm ? "Collapse" : "New Attempt"}
                    </button>
                  </div>

                  {empAttemptSuccess && (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                      {empAttemptSuccess}
                    </div>
                  )}
                  {empAttemptError && (
                    <div className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-red-600">error</span>
                      {empAttemptError}
                    </div>
                  )}

                  {showLogAttemptForm && (
                    <div className="bg-slate-50/60 border border-slate-200/60 rounded-2xl p-5 flex flex-col gap-4 animate-fade-in">
                      {/* Row 1: Mode + Result */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Verification Mode</label>
                          <select value={empAttemptMode} onChange={e => setEmpAttemptMode(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer">
                            <option value="field">Field Verification</option>
                            <option value="Manual">Manual</option>
                            <option value="Email">Email</option>
                            <option value="Phone">Phone</option>
                            <option value="In-Person">In-Person</option>
                            <option value="Database">Database Check</option>
                            <option value="Document">Document Check</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Result</label>
                          <select value={empAttemptResult} onChange={e => setEmpAttemptResult(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all cursor-pointer">
                            <option value="In Progress">In Progress</option>
                            <option value="Verified">Verified / Completed</option>
                            <option value="Discrepancy">Discrepancy</option>
                            <option value="Unable to Verify">Unable to Verify</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Comment */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comment</label>
                        <textarea value={empAttemptComment} onChange={e => setEmpAttemptComment(e.target.value)} rows={2}
                          className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none"
                          placeholder="Add attempt comment" />
                      </div>

                      {/* Row 3: Verifier Note */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Verifier Note (Internal)</label>
                        <textarea value={empAttemptVerifierNote} onChange={e => setEmpAttemptVerifierNote(e.target.value)} rows={2}
                          className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none"
                          placeholder="Internal note for verification method (not shown in report)" />
                      </div>

                      {/* Row 4: Respondent Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Respondent Name</label>
                          <input type="text" value={empAttemptRespondentName} onChange={e => setEmpAttemptRespondentName(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400"
                            placeholder="Enter respondent name" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Respondent Email ID</label>
                          <input type="email" value={empAttemptRespondentEmail} onChange={e => setEmpAttemptRespondentEmail(e.target.value)}
                            className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400"
                            placeholder="Enter respondent email" />
                        </div>
                      </div>

                      {/* Row 5: Respondent Comment */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Respondent Comment</label>
                        <textarea value={empAttemptRespondentComment} onChange={e => setEmpAttemptRespondentComment(e.target.value)} rows={2}
                          className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none"
                          placeholder="Add respondent comment" />
                      </div>

                      {/* Row 6: Toggles */}
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={empAttemptExtraPayment} onChange={e => setEmpAttemptExtraPayment(e.target.checked)}
                            className="w-4 h-4 border border-slate-300 rounded text-[#016e1c] focus:ring-[#016e1c] cursor-pointer" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Extra Payment</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={empAttemptMarkAsPaid} onChange={e => setEmpAttemptMarkAsPaid(e.target.checked)}
                            className="w-4 h-4 border border-slate-300 rounded text-[#016e1c] focus:ring-[#016e1c] cursor-pointer" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Mark As Paid</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={empAttemptAskApproval} onChange={e => setEmpAttemptAskApproval(e.target.checked)}
                            className="w-4 h-4 border border-slate-300 rounded text-[#016e1c] focus:ring-[#016e1c] cursor-pointer" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Ask Customer Approval</span>
                        </label>
                      </div>

                      {/* Row 7: Screenshot Upload */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Screenshot / Receipt (Max 2MB)</label>
                        <input type="file" accept="image/*,.pdf" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              setEmpAttemptError("File size exceeds 2MB limit");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => setEmpAttemptScreenshot(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                          className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 file:cursor-pointer file:transition-colors" />
                        {empAttemptScreenshot && (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            File attached
                          </span>
                        )}
                      </div>

                      {/* Row 8: Email checkbox + Submit */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={empAttemptSendEmail} onChange={e => setEmpAttemptSendEmail(e.target.checked)}
                            className="w-4 h-4 border border-slate-300 rounded text-[#016e1c] focus:ring-[#016e1c] cursor-pointer" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Email Customer</span>
                        </label>
                        <button
                          onClick={async () => {
                            if (!displayCandidate?.id) return;
                            setEmpAttemptSubmitting(true);
                            setEmpAttemptError("");
                            setEmpAttemptSuccess("");
                            try {
                              if (displayCandidate.type === "employment") {
                                await logEmploymentAttempt(displayCandidate.id, {
                                  verificationMode: empAttemptMode,
                                  result: empAttemptResult,
                                  comment: empAttemptComment,
                                  verifierNote: empAttemptVerifierNote,
                                  respondentName: empAttemptRespondentName,
                                  respondentEmail: empAttemptRespondentEmail,
                                  respondentComment: empAttemptRespondentComment,
                                  extraPayment: empAttemptExtraPayment,
                                  markAsPaid: empAttemptMarkAsPaid,
                                  askCustomerApproval: empAttemptAskApproval,
                                  screenshot: empAttemptScreenshot,
                                  sendEmail: empAttemptSendEmail
                                });
                              } else if (displayCandidate.type === "education") {
                                await logEducationAttempt(displayCandidate.id, {
                                  verificationMode: empAttemptMode,
                                  result: empAttemptResult,
                                  comment: empAttemptComment,
                                  verifierNote: empAttemptVerifierNote,
                                  respondentName: empAttemptRespondentName,
                                  respondentEmail: empAttemptRespondentEmail,
                                  respondentComment: empAttemptRespondentComment,
                                  extraPayment: empAttemptExtraPayment,
                                  markAsPaid: empAttemptMarkAsPaid,
                                  askCustomerApproval: empAttemptAskApproval,
                                  screenshot: empAttemptScreenshot,
                                  sendEmail: empAttemptSendEmail
                                });
                              } else {
                                await logVerificationAttempt(displayCandidate.id, {
                                  verificationMode: empAttemptMode,
                                  status: empAttemptResult,
                                  comment: empAttemptComment,
                                  verifierNote: empAttemptVerifierNote,
                                  respondentName: empAttemptRespondentName,
                                  respondentEmail: empAttemptRespondentEmail,
                                  respondentComment: empAttemptRespondentComment,
                                  extraPayment: empAttemptExtraPayment,
                                  markAsPaid: empAttemptMarkAsPaid,
                                  askCustomerApproval: empAttemptAskApproval,
                                  screenshot: empAttemptScreenshot
                                });
                              }
                              setEmpAttemptSuccess("Attempt logged successfully!");
                              // Reset form
                              setEmpAttemptComment(""); setEmpAttemptVerifierNote("");
                              setEmpAttemptRespondentName(""); setEmpAttemptRespondentEmail("");
                              setEmpAttemptRespondentComment(""); setEmpAttemptScreenshot("");
                              setEmpAttemptExtraPayment(false); setEmpAttemptMarkAsPaid(false);
                              setEmpAttemptAskApproval(false); setEmpAttemptSendEmail(false);
                              // Re-fetch detail
                              const detail = await fetchVerificationDetail(displayCandidate.id);
                              setSelectedDetail(detail);
                            } catch (err: any) {
                              setEmpAttemptError(err.message || "Failed to log attempt");
                            } finally {
                              setEmpAttemptSubmitting(false);
                            }
                          }}
                          disabled={empAttemptSubmitting}
                          className="px-5 py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] text-white rounded-xl font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {empAttemptSubmitting ? (
                            <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Logging...</span></>
                          ) : (
                            <><span className="material-symbols-outlined text-[14px]">send</span><span>Log Attempt</span></>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attempts Timeline */}
                {(() => {
                  if (!displayCandidate) return null;
                  const attempts = displayCandidate.type === "employment"
                    ? displayCandidate.employmentAttempts || []
                    : displayCandidate.type === "education"
                    ? displayCandidate.educationAttempts || []
                    : displayCandidate.verificationAttempts || [];
                  if (attempts.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">history</span>
                        Attempts ({attempts.length})
                      </h5>
                      <div className="flex flex-col gap-3">
                        {attempts.map((att: any, idx: number) => {
                          const outcome = att.result || att.status || "In Progress";
                          return (
                            <div key={idx} className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-2 relative transition-all hover:bg-slate-50">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-mono text-slate-400 font-semibold">{att.date}</span>
                                  <span className={`inline-flex items-center w-fit px-2.5 py-0.5 mt-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                                    outcome === "Verified" || outcome === "Completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                                      : outcome === "In Progress" || outcome === "Processing" ? "bg-blue-500/10 text-blue-600 border-blue-500/15"
                                      : "bg-red-500/10 text-red-600 border-red-500/15"
                                  }`}>{outcome}</span>
                                </div>
                                {(displayCandidate?.type === "employment" || displayCandidate?.type === "education") && (
                                  <button
                                    onClick={async () => {
                                      if (!displayCandidate?.id) return;
                                      if (!confirm("Are you sure you want to delete this attempt log?")) return;
                                      try {
                                        if (displayCandidate.type === "education") {
                                          await deleteEducationAttempt(displayCandidate.id, idx);
                                        } else {
                                          await deleteEmploymentAttempt(displayCandidate.id, idx);
                                        }
                                        const detail = await fetchVerificationDetail(displayCandidate.id);
                                        setSelectedDetail(detail);
                                      } catch (err: any) {
                                        alert(err.message || "Failed to delete attempt");
                                      }
                                    }}
                                    className="text-[11px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                    Delete
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs font-semibold text-slate-700 border-t border-slate-100 pt-2">
                                <div><span className="text-slate-400 font-medium">Mode:</span> {att.verificationMode || "Manual"}</div>
                                <div><span className="text-slate-400 font-medium">Verifier:</span> {att.loggedBy || displayCandidate.verifier || "Prabir Kumar"}</div>
                                <div><span className="text-slate-400 font-medium">Manager:</span> {displayCandidate.verifier || "Prabir Kumar"}</div>
                                <div><span className="text-slate-400 font-medium">Respondent Name:</span> {att.respondentName || "-"}</div>
                                <div><span className="text-slate-400 font-medium">Respondent Email:</span> {att.respondentEmail || "-"}</div>
                                <div><span className="text-slate-400 font-medium">Extra Payment:</span> {att.extraPayment ? "Yes" : "No"}</div>
                                <div><span className="text-slate-400 font-medium">Extra Amount:</span> {att.extraAmount || "-"}</div>
                                <div><span className="text-slate-400 font-medium">Approval Status:</span> {att.askCustomerApproval ? "Pending" : "-"}</div>
                              </div>

                              {att.comment && (
                                <div className="text-xs text-slate-800 mt-1">
                                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Comment</span>
                                  <p className="bg-white p-2 rounded-lg border border-slate-200/60 font-body-sm leading-relaxed">{att.comment}</p>
                                </div>
                              )}

                              {att.verifierNote && (
                                <div className="text-xs text-slate-800 mt-1">
                                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Verifier Note (Internal)</span>
                                  <p className="bg-slate-100 p-2 rounded-lg italic text-slate-600 font-body-sm leading-relaxed">{att.verifierNote}</p>
                                </div>
                              )}

                              {att.respondentComment && (
                                <div className="text-xs text-slate-800 mt-1">
                                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Respondent Comment</span>
                                  <p className="bg-amber-50/50 p-2 rounded-lg text-slate-700 italic border-l-2 border-amber-300 font-body-sm leading-relaxed">"{att.respondentComment}"</p>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100/60">
                                {att.markAsPaid && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold uppercase">Marked As Paid</span>}
                                {att.askCustomerApproval && <span className="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold uppercase">Customer Approval</span>}
                                {att.sendEmail && <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold uppercase">Email Logged</span>}
                                {att.screenshot && (
                                  <a href={att.screenshot} target="_blank" rel="noreferrer" className="text-[9px] bg-slate-100 text-slate-800 hover:bg-slate-200 px-2.5 py-0.5 rounded-md font-bold uppercase transition-colors inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[12px]">attachment</span> View Screenshot / Receipt
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

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
                {(displayCandidate?.status === "Completed" || (displayCandidate?.status as string) === "Verified" || displayCandidate?.type === "interpol") && (
                  <button
                    onClick={() => {
                      if (!displayCandidate) return;
                      const reportPath = displayCandidate.type === "court_record"
                        ? `/admin/court-record-report?id=${displayCandidate.id}`
                        : displayCandidate.type === "employment"
                        ? `/admin/employment-report?id=${displayCandidate.id}`
                        : displayCandidate.type === "education"
                        ? `/admin/education-report?id=${displayCandidate.id}`
                        : displayCandidate.type === "interpol"
                        ? `/admin/interpol-report?id=${displayCandidate.id}`
                        : `/admin/report?id=${displayCandidate.id}`;
                      window.open(reportPath, "_blank");
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] hover:opacity-90 text-white font-button-text rounded-xl transition-all cursor-pointer text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/10"
                  >
                    <span className="material-symbols-outlined text-base">print</span>
                    View Report
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
