"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePortal, Verification } from "src/context/PortalContext";

export default function VerificationRosterPage() {
  const { verifications, updateVerificationStatus, fetchVerificationDetail, refreshData, reviewCourtRecord, adminRetryCourtSearch, logEmploymentAttempt, logVerificationAttempt, deleteEmploymentAttempt, logEducationAttempt, deleteEducationAttempt, sendToCustomer } = usePortal();

  // Court record review state
  const [reviewDeletedCases, setReviewDeletedCases] = useState<Set<string>>(new Set());
  const [reviewSelectedCases, setReviewSelectedCases] = useState<Set<string>>(new Set());
  const [expandedComplexes, setExpandedComplexes] = useState<Set<string>>(new Set());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Handle highlight-verification from notification clicks
  const checkAndHighlight = useCallback(() => {
    const id = sessionStorage.getItem("highlight_verification");
    if (id) {
      sessionStorage.removeItem("highlight_verification");
      setHighlightId(id);
      // Scroll to the row after a short delay for DOM render
      setTimeout(() => {
        const row = document.getElementById(`roster-row-${id}`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightId(null), 3000);
    }
  }, []);

  useEffect(() => {
    checkAndHighlight();
    window.addEventListener("highlight-verification", checkAndHighlight);
    return () => window.removeEventListener("highlight-verification", checkAndHighlight);
  }, [checkAndHighlight]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshData().catch((err) => {
        console.error("Auto-refresh failed:", err);
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

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

  // Filters state
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterType, setDateFilterType] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Sort state
  const [sortField, setSortField] = useState<"id" | "date" | "name" | "orgName" | "status">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Show time map state
  const [showTimeMap, setShowTimeMap] = useState<Record<string, boolean>>({});

  // Helper to extract exact creation timestamp (with time) from MongoDB ObjectId
  const getExactTime = (v: any) => {
    if (v._id && v._id.length === 24) {
      const timestampSec = parseInt(v._id.substring(0, 8), 16);
      if (!isNaN(timestampSec)) return timestampSec * 1000;
    }
    const parsed = new Date(v.date).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  const getExactTimeString = (v: any) => {
    if (v._id && v._id.length === 24) {
      const timestampSec = parseInt(v._id.substring(0, 8), 16);
      if (!isNaN(timestampSec)) {
        const d = new Date(timestampSec * 1000);
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      }
    }
    return "";
  };

  // Details drawer state
  const [selectedVerification, setSelectedVerification] = useState<Verification | null>(null);
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

  const handleSelectVerification = async (v: Verification) => {
    setSelectedVerification(v);
    setSelectedDetail(null);
    setIsLoadingDetail(true);
    try {
      const detail = await fetchVerificationDetail(v.id);
      setSelectedDetail(detail);
    } catch (err) {
      console.error("Error fetching verification detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };



  // Get unique organizations list for filter
  const organizations = Array.from(new Set(verifications.map((v) => v.orgName)));

  // Filtered verifications
  const filteredVerifications = verifications.filter((v) => {
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    const matchesOrg = orgFilter === "all" || v.orgName === orgFilter;
    const matchesType = typeFilter === "all" ||
      (typeFilter === "employment" && v.type === "employment") ||
      (typeFilter === "education" && v.type === "education") ||
      (typeFilter === "identity" && (!v.type || v.type === "identity")) ||
      (typeFilter === "court_record" && v.type === "court_record") ||
      (typeFilter === "interpol" && v.type === "interpol");
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = (() => {
      if (dateFilterType === "all") return true;

      const recordDate = new Date(v.date);
      if (isNaN(recordDate.getTime())) return true;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const compareDate = new Date(recordDate);
      compareDate.setHours(0, 0, 0, 0);

      if (dateFilterType === "today") {
        return compareDate.getTime() === today.getTime();
      }
      if (dateFilterType === "yesterday") {
        return compareDate.getTime() === yesterday.getTime();
      }
      if (dateFilterType === "last7") {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return compareDate >= sevenDaysAgo;
      }
      if (dateFilterType === "last30") {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return compareDate >= thirtyDaysAgo;
      }
      if (dateFilterType === "custom") {
        if (!customDate) return true;
        // Format both to local YYYY-MM-DD for comparison
        const formatDateToYYYYMMDD = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };
        return formatDateToYYYYMMDD(recordDate) === customDate;
      }
      return true;
    })();

    return matchesStatus && matchesOrg && matchesType && matchesSearch && matchesDate;
  });

  // Sorted verifications
  const sortedVerifications = [...filteredVerifications].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === "date") {
      const aTime = getExactTime(a);
      const bTime = getExactTime(b);
      return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
    }

    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
    }
    if (typeof bVal === "string") {
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field: "id" | "date" | "name" | "orgName" | "status") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc");
    }
  };



  // Helper to render a field card inside the details drawer
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

  const displayVerification = selectedDetail || selectedVerification;

  return (
    <div className="flex flex-col gap-6 pt-4 animate-fade-in pb-12">
      <div className="mb-4">
        <h2 className="font-display-lg text-slate-900 leading-none tracking-tight">Verification Roster</h2>
        <p className="font-body-lg text-slate-500 mt-2.5 max-w-3xl">
          Global log of all candidate verification orders submitted. View DigiLocker responses and manage status flows.
        </p>
      </div>

      {/* Roster Controls / Filters */}
      <section className="bg-white border border-[#016e1c]/12 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center shadow-[0_4px_25px_rgba(1, 110, 28,0.03)]">
        <div className="w-full md:flex-1 relative">
          <input
            type="text"
            placeholder="Search by ID, name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all placeholder-slate-400"
          />
          <span className="material-symbols-outlined absolute left-3.5 top-3 text-slate-400 text-lg">search</span>
        </div>

        <div className="w-full md:w-48 flex flex-col gap-1">
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

        <div className="w-full md:w-40 flex flex-col gap-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Processing">Processing</option>
            <option value="Needs Attention">Needs Attention</option>
          </select>
        </div>

        <div className="w-full md:w-44 flex flex-col gap-1">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All Service Types</option>
            <option value="identity">Identity Verification</option>
            <option value="court_record">Court Record</option>
            <option value="employment">Employment Check</option>
            <option value="education">Education Check</option>
            <option value="interpol">Interpol Check</option>
          </select>
        </div>

        <div className="w-full md:w-40 flex flex-col gap-1">
          <select
            value={dateFilterType}
            onChange={(e) => {
              setDateFilterType(e.target.value);
              if (e.target.value !== "custom") {
                setCustomDate("");
              }
            }}
            className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="custom">Specific Date...</option>
          </select>
        </div>

        {dateFilterType === "custom" && (
          <div className="w-full md:w-40 flex flex-col gap-1 animate-fade-in">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full p-2.5 border border-slate-200/80 rounded-xl font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all cursor-pointer"
            />
          </div>
        )}
      </section>

      {/* Main Roster Table - Desktop View */}
      <section className="hidden xl:block apple-card-static overflow-hidden border border-[#016e1c]/10 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm table-fixed">
            <thead>
              <tr className="border-b border-[#016e1c]/10 bg-slate-50/50">
                <th
                  onClick={() => handleSort("id")}
                  className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] hover:text-[#016e1c] transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>REQUEST ID</span>
                    <span className="material-symbols-outlined text-[12px] font-bold text-slate-400">
                      {sortField === "id"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </div>
                </th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] w-[130px]">TYPE</th>
                <th
                  onClick={() => handleSort("name")}
                  className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] hover:text-[#016e1c] transition-colors cursor-pointer select-none w-[240px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CANDIDATE</span>
                    <span className="material-symbols-outlined text-[12px] font-bold text-slate-400">
                      {sortField === "name"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort("orgName")}
                  className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] hover:text-[#016e1c] transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>CLIENT ORG</span>
                    <span className="material-symbols-outlined text-[12px] font-bold text-slate-400">
                      {sortField === "orgName"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort("date")}
                  className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] hover:text-[#016e1c] transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>DATE</span>
                    <span className="material-symbols-outlined text-[12px] font-bold text-slate-400">
                      {sortField === "date"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] hover:text-[#016e1c] transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>STATUS</span>
                    <span className="material-symbols-outlined text-[12px] font-bold text-slate-400">
                      {sortField === "status"
                        ? sortDirection === "asc"
                          ? "arrow_upward"
                          : "arrow_downward"
                        : "unfold_more"}
                    </span>
                  </div>
                </th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedVerifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No verifications found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedVerifications.map((v, idx) => (
                  <tr
                    key={`${v.id}-${sortField}-${sortDirection}`}
                    id={`roster-row-${v.id}`}
                    className={`hover:bg-slate-50/50 transition-all duration-500 animate-fade-in ${v.courtRecordAdminReview && v.courtRecordStatus === "admin_review" ? "border-l-[3px] border-l-rose-500" : v.courtRecordStatus === "needs_admin_retry" ? "border-l-[3px] border-l-amber-500" : ""} ${highlightId === v.id ? "!bg-[#eaf0e4] ring-2 ring-[#016e1c]/30 ring-inset" : ""}`}
                    style={{
                      animationDelay: `${Math.min(idx * 20, 200)}ms`,
                      animationFillMode: "both"
                    }}
                  >
                    <td className="py-4 px-6 font-mono font-bold text-slate-800 whitespace-nowrap">{v.id}</td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                        v.type === "court_record"
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/15"
                          : v.type === "employment"
                          ? "bg-blue-500/10 text-blue-700 border-blue-500/15"
                          : v.type === "education"
                          ? "bg-purple-550/10 text-purple-700 border-purple-550/15"
                          : v.type === "interpol"
                          ? "bg-indigo-500/10 text-indigo-700 border-indigo-500/15"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                      }`}>
                        {v.type === "court_record" ? "Court" : v.type === "employment" ? "Employment" : v.type === "education" ? "Education" : v.type === "interpol" ? "Interpol" : "Identity"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 truncate">{v.name}</span>
                        <span className="text-xs text-slate-400 mt-0.5 leading-relaxed whitespace-normal">
                          {v.type === "court_record"
                            ? (v.courtRecordSummary || "Search in progress...")
                            : v.type === "employment"
                            ? (v.employmentData?.companyName || v.email)
                            : v.type === "education"
                            ? ((v.educationData?.courseName && `${v.educationData.courseName} @ ${v.educationData.boardUniversity}`) || v.email)
                            : v.type === "interpol"
                            ? (v.interpolHasRecords ? `${v.interpolMatches?.length || 0} Record Match(es)` : "Clean Record")
                            : v.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium whitespace-normal break-words leading-relaxed">{v.orgName}</td>
                    <td
                      onClick={() => setShowTimeMap((prev) => ({ ...prev, [v.id]: !prev[v.id] }))}
                      className="py-4 px-6 text-slate-500 font-medium cursor-pointer select-none group"
                      title="Click to view time"
                    >
                      <div className="flex flex-col">
                        <span className="group-hover:text-[#016e1c] transition-colors">{v.date}</span>
                        {showTimeMap[v.id] && (
                          <span className="text-[10.5px] text-slate-400 font-mono mt-0.5 animate-fade-in font-bold">
                            {getExactTimeString(v)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                          v.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                            : (v.type === "court_record" && v.courtRecordStatus === "admin_review")
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/15"
                            : (v.type === "court_record" && v.courtRecordStatus === "needs_admin_retry")
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/15"
                            : v.status === "Processing"
                            ? "bg-[#016e1c]/10 text-[#00450e] border-[#016e1c]/15"
                            : "bg-red-500/10 text-red-600 border-red-500/15"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          v.status === "Completed"
                            ? "bg-emerald-500"
                            : (v.type === "court_record" && v.courtRecordStatus === "admin_review")
                            ? "bg-rose-500 animate-pulse"
                            : (v.type === "court_record" && v.courtRecordStatus === "needs_admin_retry")
                            ? "bg-amber-500 animate-pulse"
                            : v.status === "Processing"
                            ? "bg-[#016e1c]"
                            : "bg-red-500"
                        }`}></span>
                        {(v.type === "court_record" && v.courtRecordStatus === "admin_review") ? "Review" : (v.type === "court_record" && v.courtRecordStatus === "needs_admin_retry") ? "Under Review" : v.status === "Needs Attention" ? "Reviewing with attorney" : v.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleSelectVerification(v)}
                          className="px-3.5 py-1.5 apple-button-secondary rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile/Tablet Cards View - One Block per Row */}
      <div className="block xl:hidden space-y-4">
        {sortedVerifications.length === 0 ? (
          <div className="bg-white border border-[#016e1c]/10 rounded-2xl p-8 text-center text-slate-400 font-medium shadow-sm">
            No verifications found matching your filters.
          </div>
        ) : (
          sortedVerifications.map((v, idx) => {
            const hasReview = v.courtRecordAdminReview && v.courtRecordStatus === "admin_review";
            const needsRetry = v.courtRecordStatus === "needs_admin_retry";
            return (
              <div
                key={v.id}
                id={`roster-row-mobile-${v.id}`}
                className={`bg-white border border-[#016e1c]/10 rounded-2xl p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] flex flex-col gap-4 transition-all duration-500 animate-fade-in ${
                  hasReview
                    ? "border-l-[4px] border-l-rose-500"
                    : needsRetry
                    ? "border-l-[4px] border-l-amber-500"
                    : ""
                } ${highlightId === v.id ? "!bg-[#eaf0e4] ring-2 ring-[#016e1c]/30 ring-inset" : ""}`}
                style={{
                  animationDelay: `${Math.min(idx * 20, 200)}ms`,
                  animationFillMode: "both"
                }}
              >
                {/* ID & Status Badge Row */}
                <div className="flex justify-between items-center gap-2">
                  <span className="font-mono font-bold text-slate-800 text-xs">{v.id}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                      v.status === "Completed"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                        : (v.type === "court_record" && v.courtRecordStatus === "admin_review")
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/15"
                        : (v.type === "court_record" && v.courtRecordStatus === "needs_admin_retry")
                        ? "bg-amber-500/10 text-amber-700 border-amber-500/15"
                        : v.status === "Processing"
                        ? "bg-[#016e1c]/10 text-[#00450e] border-[#016e1c]/15"
                        : "bg-red-500/10 text-red-600 border-red-500/15"
                    }`}
                  >
                    {(v.type === "court_record" && v.courtRecordStatus === "admin_review") ? "Review" : (v.type === "court_record" && v.courtRecordStatus === "needs_admin_retry") ? "Under Review" : v.status === "Needs Attention" ? "Reviewing with attorney" : v.status}
                  </span>
                </div>

                {/* Candidate Name & Type Badge Row */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase border ${
                      v.type === "court_record"
                        ? "bg-amber-500/10 text-amber-700 border-amber-500/15"
                        : v.type === "employment"
                        ? "bg-blue-500/10 text-blue-700 border-blue-500/15"
                        : v.type === "education"
                        ? "bg-purple-550/10 text-purple-700 border-purple-550/15"
                        : v.type === "interpol"
                        ? "bg-indigo-500/10 text-indigo-700 border-indigo-500/15"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                    }`}>
                      {v.type === "court_record" ? "Court" : v.type === "employment" ? "Employment" : v.type === "education" ? "Education" : v.type === "interpol" ? "Interpol" : "Identity"}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{v.name}</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    {v.type === "court_record"
                      ? (v.courtRecordSummary || "Search in progress...")
                      : v.type === "employment"
                      ? (v.employmentData?.companyName || v.email)
                      : v.type === "education"
                      ? ((v.educationData?.courseName && `${v.educationData.courseName} @ ${v.educationData.boardUniversity}`) || v.email)
                      : v.type === "interpol"
                      ? (v.interpolHasRecords ? `${v.interpolMatches?.length || 0} Record Match(es)` : "Clean Record")
                      : v.email}
                  </p>
                </div>

                {/* Metadata Details Grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Client Org</span>
                    <span className="font-semibold text-slate-700">{v.orgName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Date Initiated</span>
                    <span className="font-semibold text-slate-700">{v.date}</span>
                  </div>
                </div>

                {/* View Details Action Button */}
                <button
                  onClick={() => handleSelectVerification(v)}
                  className="w-full py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                  Details
                </button>
              </div>
            );
          })
        )}
      </div>


      {/* DigiLocker Details Fullscreen Popup */}
      {selectedVerification && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center animate-fade-in"
          onClick={() => setSelectedVerification(null)}
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
                      displayVerification?.digilockerStatus === "Verified"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/10"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {displayVerification?.digilockerStatus === "Verified" ? "verified_user" : "pending"}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 select-none">
                      <button
                        onClick={() => setSelectedVerification(null)}
                        className="hover:text-[#016e1c] hover:underline cursor-pointer transition-colors"
                      >
                        Verification Roster
                      </button>
                      <span className="text-slate-300">/</span>
                      <span className="text-[#016e1c] font-black">Verification Details</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline-md text-slate-900 font-extrabold text-lg">Verification Details</h3>
                      {isLoadingDetail && (
                        <div className="w-4 h-4 rounded-full border-2 border-[#016e1c] border-t-transparent animate-spin" />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">{displayVerification?.id} · {displayVerification?.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedVerification(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Popup Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">

                {/* Candidate Onboarding Status */}
                 {displayVerification?.onboardingStatus === "setup_pending" && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-sm flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-xl">hourglass_top</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-amber-700 text-xs">Password Setup Pending</span>
                      <span className="text-[10.5px] text-amber-600/80 mt-0.5">Candidate has not yet set their password via the setup link.</span>
                    </div>
                  </div>
                )}

                {(displayVerification?.type === "employment" || displayVerification?.type === "education") && (
                  <div className={`p-4 border rounded-2xl text-sm flex items-center gap-3 ${
                    displayVerification.sendToCustomer
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : "bg-amber-500/5 border-amber-500/15"
                  }`}>
                    <span className={`material-symbols-outlined text-xl ${
                      displayVerification.sendToCustomer ? "text-emerald-500" : "text-amber-500"
                    }`}>
                      {displayVerification.sendToCustomer ? "visibility" : "visibility_off"}
                    </span>
                    <div className="flex flex-col">
                      <span className={`font-bold text-xs ${
                        displayVerification.sendToCustomer ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        {displayVerification.sendToCustomer ? "Report Published to Client" : "Draft (Hidden from Client)"}
                      </span>
                      <span className="text-[10.5px] text-slate-500 mt-0.5">
                        {displayVerification.sendToCustomer
                          ? "The client can view and download the findings report PDF."
                          : "The client sees 'Under Review' and cannot access the report until you click 'Send to Customer'."}
                      </span>
                    </div>
                  </div>
                )}

                {displayVerification?.type === "employment" || displayVerification?.type === "education" ? (
                  <div className="flex flex-col gap-6 animate-fade-in">
                    {/* Employment / Education Status Banner */}
                    <div className={`border rounded-2xl p-4 flex items-center gap-3.5 ${
                      (displayVerification.type === "employment" ? displayVerification.employmentDataSubmitted : displayVerification.educationDataSubmitted)
                        ? "bg-emerald-500/5 border-emerald-500/15"
                        : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        (displayVerification.type === "employment" ? displayVerification.employmentDataSubmitted : displayVerification.educationDataSubmitted) ? "text-emerald-500" : "text-blue-500"
                      }`}>
                        {(displayVerification.type === "employment" ? displayVerification.employmentDataSubmitted : displayVerification.educationDataSubmitted) ? "task_alt" : "hourglass_top"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          (displayVerification.type === "employment" ? displayVerification.employmentDataSubmitted : displayVerification.educationDataSubmitted) ? "text-emerald-800" : "text-blue-800"
                        }`}>
                          {displayVerification.type === "employment"
                            ? (displayVerification.employmentDataSubmitted ? "Employment Data Submitted by Candidate" : "Awaiting Candidate Submission")
                            : (displayVerification.educationDataSubmitted ? "Education Data Submitted by Candidate" : "Awaiting Candidate Submission")}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {displayVerification.type === "employment"
                            ? (displayVerification.employmentDataSubmittedAt
                              ? `Submitted on ${new Date(displayVerification.employmentDataSubmittedAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
                              : "Candidate has not yet filled the employment form")
                            : (displayVerification.educationDataSubmittedAt
                              ? `Submitted on ${new Date(displayVerification.educationDataSubmittedAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
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
                              <td className="p-2.5 font-bold text-slate-900">{displayVerification.digilockerName || displayVerification.name || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Date of birth</td>
                              <td className="p-2.5">{displayVerification.digilockerDob || displayVerification.candidateDob || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Mobile number</td>
                              <td className="p-2.5">{displayVerification.digilockerMobile || displayVerification.candidateMobile || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Current residential address</td>
                              <td className="p-2.5">{displayVerification.addresses && displayVerification.addresses.length > 0
                                ? [displayVerification.addresses[0].address, displayVerification.addresses[0].city, displayVerification.addresses[0].state, displayVerification.addresses[0].country].filter(Boolean).join(", ")
                                : "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Primary government ID number</td>
                              <td className="p-2.5 font-mono">{displayVerification.digilockerAadhaar || displayVerification.digilockerPan || displayVerification.idProofNumber || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Email address</td>
                              <td className="p-2.5">{displayVerification.digilockerEmail || displayVerification.email || "-"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Nationality</td>
                              <td className="p-2.5">{"Indian"}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Gender</td>
                              <td className="p-2.5">{displayVerification.digilockerGender || displayVerification.gender || "-"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ═══ EDUCATION CHECK TABLE ═══ */}
                    {displayVerification.type === "education" && displayVerification.educationData && (
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
                                <td className="p-2.5">{displayVerification.educationData.degreeType || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Course / Degree Name</td>
                                <td className="p-2.5 font-bold text-slate-900">{displayVerification.educationData.courseName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Board / University</td>
                                <td className="p-2.5">{displayVerification.educationData.boardUniversity || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">School / College Name</td>
                                <td className="p-2.5">{displayVerification.educationData.institutionName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Roll / Registration No.</td>
                                <td className="p-2.5 font-mono">{displayVerification.educationData.rollNumber || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Passing Year</td>
                                <td className="p-2.5 font-mono">{displayVerification.educationData.passingYear || "-"}</td>
                              </tr>
                              {displayVerification.educationData.certificateFile && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Degree / Marksheet Proof</td>
                                  <td className="p-2.5">
                                    <a
                                      href={displayVerification.educationData.certificateFile}
                                      download={displayVerification.educationData.certificateFileName || `certificate-${displayVerification.id}.png`}
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
                    {displayVerification.employmentData && (
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
                                <td className="p-2.5">{displayVerification.employmentData.country || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">State</td>
                                <td className="p-2.5">{displayVerification.employmentData.state || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">City</td>
                                <td className="p-2.5">{displayVerification.employmentData.city || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Company Name</td>
                                <td className="p-2.5 font-bold text-slate-900">{displayVerification.employmentData.companyName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Address - Line 1</td>
                                <td className="p-2.5">{displayVerification.employmentData.addressLine1 || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Address - Line 2</td>
                                <td className="p-2.5">{displayVerification.employmentData.addressLine2 || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Company Telephone</td>
                                <td className="p-2.5">{displayVerification.employmentData.companyTelephone ? `${displayVerification.employmentData.companyTelephoneCode || ""} ${displayVerification.employmentData.companyTelephone}` : "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Department</td>
                                <td className="p-2.5">{displayVerification.employmentData.department || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Position</td>
                                <td className="p-2.5">{displayVerification.employmentData.position || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employment Period - From</td>
                                <td className="p-2.5 font-mono">{displayVerification.employmentData.employmentPeriodFrom || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employment Period - To</td>
                                <td className="p-2.5 font-mono">{displayVerification.employmentData.employmentPeriodTo || "Present"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employee Code</td>
                                <td className="p-2.5 font-mono">{displayVerification.employmentData.employeeCode || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Reporting Manager Name</td>
                                <td className="p-2.5">{displayVerification.employmentData.reportingManagerName || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Department of Reporting Manager</td>
                                <td className="p-2.5">{displayVerification.employmentData.reportingManagerDepartment || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Contact No of Reporting Manager</td>
                                <td className="p-2.5">{displayVerification.employmentData.reportingManagerContact ? `${displayVerification.employmentData.reportingManagerContactCode || ""} ${displayVerification.employmentData.reportingManagerContact}` : "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Email ID of Reporting Manager</td>
                                <td className="p-2.5">{displayVerification.employmentData.reportingManagerEmail || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Annual CTC</td>
                                <td className="p-2.5 font-mono">{displayVerification.employmentData.annualCTC || "-"}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Employment is Permanent or Temporary</td>
                                <td className="p-2.5">{displayVerification.employmentData.employmentType || "-"}</td>
                              </tr>
                              {displayVerification.employmentData.agencyDetails && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Agency Details (if temporary or contractual)</td>
                                  <td className="p-2.5">{displayVerification.employmentData.agencyDetails}</td>
                                </tr>
                              )}
                              {displayVerification.employmentData.reasonForLeaving && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Reason(s) for Leaving</td>
                                  <td className="p-2.5 font-normal text-slate-700">{displayVerification.employmentData.reasonForLeaving}</td>
                                </tr>
                              )}
                              {displayVerification.employmentData.remarks && (
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/30 text-slate-600">Remarks If any</td>
                                  <td className="p-2.5 italic font-normal text-slate-500">{displayVerification.employmentData.remarks}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
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
                                if (!displayVerification?.id) return;
                                setEmpAttemptSubmitting(true);
                                setEmpAttemptError("");
                                setEmpAttemptSuccess("");
                                try {
                                  await logEmploymentAttempt(displayVerification.id, {
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
                                  setEmpAttemptSuccess("Attempt logged successfully!");
                                  // Reset form
                                  setEmpAttemptComment(""); setEmpAttemptVerifierNote("");
                                  setEmpAttemptRespondentName(""); setEmpAttemptRespondentEmail("");
                                  setEmpAttemptRespondentComment(""); setEmpAttemptScreenshot("");
                                  setEmpAttemptExtraPayment(false); setEmpAttemptMarkAsPaid(false);
                                  setEmpAttemptAskApproval(false); setEmpAttemptSendEmail(false);
                                  // Re-fetch detail
                                  const detail = await fetchVerificationDetail(displayVerification.id);
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
                      const attempts = displayVerification.employmentAttempts || [];
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
                                <div key={idx} className="bg-slate-50/40 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-3 relative transition-all hover:bg-slate-50">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                    <div className="flex flex-wrap items-center gap-3 font-semibold text-xs text-slate-700">
                                      <span className="font-mono text-slate-500">{att.date}</span>
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                                        outcome === "Verified" || outcome === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : outcome === "In Progress" || outcome === "Processing" ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-rose-50 text-rose-700 border-rose-200"
                                      }`}>{outcome}</span>
                                      <span className="text-[10px] text-slate-500 font-bold uppercase">Mode: {att.verificationMode || "field"}</span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        if (!displayVerification?.id) return;
                                        if (!confirm("Are you sure you want to delete this attempt log?")) return;
                                        try {
                                          if (displayVerification.type === "education") {
                                            await deleteEducationAttempt(displayVerification.id, idx);
                                          } else {
                                            await deleteEmploymentAttempt(displayVerification.id, idx);
                                          }
                                          const detail = await fetchVerificationDetail(displayVerification.id);
                                          setSelectedDetail(detail);
                                        } catch (err: any) {
                                          alert(err.message || "Failed to delete attempt");
                                        }
                                      }}
                                      className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[13px]">delete</span>
                                      Delete
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs leading-relaxed">
                                    <div className="col-span-1 sm:col-span-1">
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Comment</span>
                                      <span className="text-slate-800 font-bold">{att.comment || "-"}</span>
                                    </div>
                                    <div className="col-span-1 sm:col-span-1">
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Verifier Note</span>
                                      <span className="text-slate-800 font-bold">{att.verifierNote || "-"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Respondent Name</span>
                                      <span className="text-slate-800 font-bold">{att.respondentName || "-"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Respondent Email</span>
                                      <span className="text-slate-800 font-bold">{att.respondentEmail || "-"}</span>
                                    </div>
                                    <div className="col-span-1 sm:col-span-1">
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Respondent Comment</span>
                                      <span className="text-slate-800 font-bold">{att.respondentComment || "-"}</span>
                                    </div>

                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Extra Payment</span>
                                      <span className="text-slate-800 font-bold">{att.extraPayment ? "Yes" : "No"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Extra Amount</span>
                                      <span className="text-slate-800 font-bold">{att.extraAmount || "-"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Approval Status</span>
                                      <span className="text-slate-800 font-bold">{att.askCustomerApproval ? "Pending" : "-"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Verifier</span>
                                      <span className="text-[#00450e] font-bold">{att.loggedBy || displayVerification.verifier || "Prabir Kumar"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 font-medium block text-[9px] uppercase">Manager</span>
                                      <span className="text-slate-800 font-bold">{displayVerification.verifier || "Prabir Kumar"}</span>
                                    </div>

                                    <div className="col-span-1 sm:col-span-5 pt-1 border-t border-slate-100 flex items-center justify-between">
                                      <div>
                                        <span className="text-slate-400 font-medium inline-block text-[9px] uppercase mr-2">Screenshot:</span>
                                        {att.screenshot ? (
                                          <a href={att.screenshot} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5 text-xs">
                                            <span className="material-symbols-outlined text-xs">attachment</span> View Screenshot / Receipt
                                          </a>
                                        ) : (
                                          <span className="text-slate-800 font-semibold">-</span>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        {att.markAsPaid && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">Marked As Paid</span>}
                                        {att.askCustomerApproval && <span className="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase">Customer Approval</span>}
                                        {att.sendEmail && <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold uppercase">Email Logged</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : displayVerification?.digilockerStatus === "Verified" ? (
                  <div className="flex flex-col gap-6 animate-fade-in">
                    {/* Verified Banner */}
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 flex items-center gap-3.5">
                      <span className="material-symbols-outlined text-emerald-500 text-2xl font-bold">
                        verified_user
                      </span>
                      <div className="flex flex-col">
                        <span className="font-body-sm font-bold text-emerald-800">
                          Identity Verified via DigiLocker
                        </span>
                        <span className="text-[11px] text-emerald-600/80 font-semibold mt-0.5">
                          Verified on {displayVerification.completedAt ? new Date(displayVerification.completedAt).toLocaleString("en-US", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Photo + Primary Info */}
                    <div className="flex items-start gap-4 p-1">
                      {isLoadingDetail ? (
                        <div className="w-20 h-24 bg-slate-50 rounded-2xl border border-slate-200/50 shrink-0 flex items-center justify-center shadow-inner">
                          <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-[#016e1c] animate-spin" />
                        </div>
                      ) : displayVerification.digilockerPhoto ? (
                        <div className="w-20 h-24 bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/50 shrink-0 flex items-center justify-center shadow-sm">
                          <img
                            src={getPhotoSrc(displayVerification.digilockerPhoto)}
                            alt="Candidate Photo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-1 pt-1">
                        <h4 className="font-headline-md text-slate-900 font-extrabold text-xl">
                          {displayVerification.digilockerName || displayVerification.name}
                        </h4>
                        <p className="font-body-sm text-slate-500">
                          {displayVerification.digilockerEmail || displayVerification.email}
                        </p>
                        {displayVerification.digilockerUsername && (
                          <span className="mt-1 bg-[#016e1c]/10 text-[#00450e] text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full w-fit">
                            @{displayVerification.digilockerUsername}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Section: Personal Details */}
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">person</span>
                        Personal Details
                      </h5>
                      {isLoadingDetail ? (
                        <div className="text-xs text-slate-400 italic">Decrypting secure records...</div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            {renderDetailField("Full Name", displayVerification.digilockerName, false, "badge")}
                            {renderDetailField("Age", displayVerification.digilockerAge, false, "cake")}
                            {renderDetailField("Gender", displayVerification.digilockerGender, false, "wc")}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {renderDetailField("Date of Birth", displayVerification.digilockerDob, false, "calendar_today")}
                            {renderDetailField("Mobile", displayVerification.digilockerMobile, false, "phone")}
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            {renderDetailField("Email", displayVerification.digilockerEmail, false, "email")}
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {renderDetailField("Aadhaar", displayVerification.digilockerAadhaar, false, "fingerprint")}
                          {renderDetailField("PAN", displayVerification.digilockerPan, true, "credit_card")}
                          {renderDetailField("Driving Licence", displayVerification.digilockerDrivingLicence, true, "directions_car")}
                        </div>
                      )}
                    </div>

                    {/* Section: DigiLocker Identifiers */}
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">key</span>
                        DigiLocker Identifiers
                      </h5>
                      {isLoadingDetail ? (
                        <div className="text-xs text-slate-400 italic">Decrypting secure hashes...</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {renderDetailField("DigiLocker ID", displayVerification.digilockerId, true, "link")}
                          {renderDetailField("Reference Key", displayVerification.digilockerReferenceKey, true, "vpn_key")}
                        </div>
                      )}
                    </div>

                    {/* Section: Verified Documents List */}
                    {isLoadingDetail ? (
                      <div className="flex flex-col gap-3">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                          Verified Documents
                        </h5>
                        <div className="text-xs text-slate-400 italic">Fetching digital wallet documents...</div>
                      </div>
                    ) : displayVerification.digilockerDocuments && displayVerification.digilockerDocuments.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">folder_open</span>
                          Verified Documents ({displayVerification.digilockerDocuments.length})
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {displayVerification.digilockerDocuments.map((doc: any) => (
                            <div key={doc.id} className="p-3 bg-slate-50/60 border border-slate-200/50 rounded-2xl flex flex-col gap-1.5 hover:bg-slate-50 transition-colors">
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
                ) : displayVerification?.type === "court_record" ? (
                  /* Court Record Verification Details */
                  <div className="flex flex-col gap-6 animate-fade-in">
                    {/* Court Record Search Banner */}
                    <div className={`border rounded-2xl p-4 flex items-center gap-3.5 ${
                      displayVerification.courtRecordStatus === "completed"
                        ? displayVerification.courtRecordHasRecords
                          ? "bg-rose-500/5 border-rose-500/15"
                          : "bg-emerald-500/5 border-emerald-500/15"
                        : (displayVerification.courtRecordStatus === "error" || displayVerification.courtRecordStatus === "needs_admin_retry")
                          ? "bg-amber-500/5 border-amber-500/15"
                          : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        displayVerification.courtRecordStatus === "completed"
                          ? displayVerification.courtRecordHasRecords ? "text-rose-500" : "text-emerald-500"
                          : (displayVerification.courtRecordStatus === "error" || displayVerification.courtRecordStatus === "needs_admin_retry") ? "text-amber-500" : "text-blue-500"
                      }`}>
                        {displayVerification.courtRecordStatus === "completed"
                          ? displayVerification.courtRecordHasRecords ? "gavel" : "verified_user"
                          : (displayVerification.courtRecordStatus === "error" || displayVerification.courtRecordStatus === "needs_admin_retry") ? "warning" : "hourglass_top"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          displayVerification.courtRecordStatus === "completed"
                            ? displayVerification.courtRecordHasRecords ? "text-rose-800" : "text-emerald-800"
                            : (displayVerification.courtRecordStatus === "error" || displayVerification.courtRecordStatus === "needs_admin_retry") ? "text-amber-800" : "text-blue-800"
                        }`}>
                          {displayVerification.courtRecordStatus === "completed"
                            ? displayVerification.courtRecordHasRecords
                              ? `${displayVerification.courtRecordTotalCases} Court Record(s) Found`
                              : "No Court Records Found"
                            : displayVerification.courtRecordStatus === "needs_admin_retry"
                              ? "Search Failed — Admin Retry Required"
                              : displayVerification.courtRecordStatus === "error"
                              ? "Search Encountered Errors"
                              : "Court Record Search In Progress..."}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          {displayVerification.courtRecordSummary || displayVerification.courtRecordProgress || "Searching eCourts India..."}
                        </span>
                      </div>
                    </div>

                    {/* Candidate Details */}
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">person</span>
                        Candidate Details
                      </h5>
                      <div className="grid grid-cols-3 gap-3">
                        {renderDetailField("Full Name", displayVerification.name, false, "badge")}
                        {displayVerification.gender && renderDetailField("Gender", displayVerification.gender, false, "wc")}
                        {renderDetailField("Date of Birth", displayVerification.candidateDob, false, "calendar_today")}
                        {displayVerification.idProofType && renderDetailField("ID Type", displayVerification.idProofType, false, "id_card")}
                        {displayVerification.idProofNumber && renderDetailField("ID Number", displayVerification.idProofNumber, false, "pin")}
                        {renderDetailField("Organization", displayVerification.orgName, false, "business")}
                        {renderDetailField("Father's Name", displayVerification.candidateFatherName, false, "person")}
                        {renderDetailField("Mother's Name", displayVerification.candidateMotherName, false, "person")}
                        {displayVerification.candidateIsMarried && renderDetailField("Husband's Name", displayVerification.candidateHusbandName, false, "person")}
                      </div>
                    </div>

                    {/* Addresses Searched */}
                    {displayVerification.addresses && displayVerification.addresses.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">location_on</span>
                          Addresses Searched
                        </h5>
                        <div className="grid grid-cols-1 gap-2">
                          {displayVerification.addresses.map((addr: any, i: number) => (
                            <div key={i} className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/50 flex items-center gap-2">
                              <span className="text-[10px] font-bold bg-slate-200/50 text-slate-600 px-1.5 py-0.5 rounded">{i + 1}</span>
                              <span className="text-xs font-semibold text-slate-700">
                                {[addr.address, addr.city, addr.state, addr.country].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Search Results by District */}
                    {displayVerification.courtRecordResults && displayVerification.courtRecordResults.length > 0 && (() => {
                      const isReviewMode = displayVerification.courtRecordAdminReview && displayVerification.courtRecordStatus === "admin_review";
                      // Collect all case keys for Select All
                      const allCaseKeys: string[] = [];
                      if (isReviewMode) {
                        (displayVerification.courtRecordResults || []).forEach((result: any, rIdx: number) => {
                          (result.complexSearches || []).forEach((cs: any, csIdx: number) => {
                            (cs.cases || []).forEach((_: any, cIdx: number) => {
                              allCaseKeys.push(`${rIdx}-${csIdx}-${cIdx}`);
                            });
                          });
                        });
                      }
                      const allSelected = allCaseKeys.length > 0 && allCaseKeys.every(k => reviewSelectedCases.has(k));
                      const someSelected = reviewSelectedCases.size > 0;
                      return (
                        <div className="flex flex-col gap-3">
                          <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                            <span className="material-symbols-outlined text-sm">gavel</span>
                            Search Results ({displayVerification.courtRecordTotalComplexes} complexes)
                          </h5>

                          {/* Select All + Bulk Actions Bar (only in review mode) */}
                          {isReviewMode && allCaseKeys.length > 0 && (
                            <div className="flex items-center justify-between px-2 py-1.5 bg-rose-50/40 border border-rose-200/50 rounded-xl">
                              <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={() => {
                                    if (allSelected) {
                                      setReviewSelectedCases(new Set());
                                    } else {
                                      setReviewSelectedCases(new Set(allCaseKeys));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600"
                                />
                                <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                                  Select All ({allCaseKeys.length} cases)
                                </span>
                              </label>
                              {someSelected && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => {
                                      setReviewDeletedCases(prev => {
                                        const next = new Set(prev);
                                        reviewSelectedCases.forEach(k => next.add(k));
                                        return next;
                                      });
                                      setReviewSelectedCases(new Set());
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 cursor-pointer transition-all flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">delete</span>
                                    Delete Selected ({reviewSelectedCases.size})
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReviewDeletedCases(prev => {
                                        const next = new Set(prev);
                                        reviewSelectedCases.forEach(k => next.delete(k));
                                        return next;
                                      });
                                      setReviewSelectedCases(new Set());
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 cursor-pointer transition-all flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-[13px]">check</span>
                                    Confirm Selected ({reviewSelectedCases.size})
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {displayVerification.courtRecordResults.map((result: any, rIdx: number) => {
                            const allComplexes = result.complexSearches || [];
                            const validComplexes = allComplexes.filter((cs: any) => !cs.error);
                            if (validComplexes.length === 0) return null;
                            return (
                              <div key={rIdx} className="border border-slate-200/60 rounded-2xl overflow-hidden">
                                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200/40">
                                  <span className="text-xs font-bold text-slate-800">
                                    {result.district}, {result.state}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    {validComplexes.length} complex(es)
                                  </span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {allComplexes.map((cs: any, csIdx: number) => {
                                    if (cs.error) return null;
                                    const complexKey = `${rIdx}-${csIdx}`;
                                    const isExpanded = expandedComplexes.has(complexKey);
                                    const hasCases = cs.cases && cs.cases.length > 0;
                                    const canExpand = isReviewMode && hasCases;
                                    return (
                                      <div key={csIdx}>
                                        <div
                                          onClick={() => {
                                            if (!canExpand) return;
                                            setExpandedComplexes(prev => {
                                              const next = new Set(prev);
                                              if (next.has(complexKey)) {
                                                next.delete(complexKey);
                                              } else {
                                                next.add(complexKey);
                                              }
                                              return next;
                                            });
                                          }}
                                          className={`px-4 py-2.5 flex items-center justify-between ${
                                            canExpand ? "cursor-pointer hover:bg-slate-50/80 transition-colors" : ""
                                          } ${isExpanded ? "bg-rose-50/30" : ""}`}
                                        >
                                          <div className="flex items-center gap-2">
                                            {canExpand && (
                                              <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                                                chevron_right
                                              </span>
                                            )}
                                            <span className="text-xs font-semibold text-slate-700">{cs.complexName}</span>
                                          </div>
                                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                            cs.casesFound > 0
                                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          }`}>
                                            {cs.casesFound > 0 ? `${cs.casesFound} Record(s)` : "Clear"}
                                          </span>
                                        </div>
                                        {/* Expanded cases inline */}
                                        {canExpand && isExpanded && (
                                          <div className="px-4 pb-3 pt-1 bg-slate-50/30 border-t border-slate-100">
                                            {(cs.cases || []).map((c: any, cIdx: number) => {
                                              const caseKey = `${rIdx}-${csIdx}-${cIdx}`;
                                              const isDeleted = reviewDeletedCases.has(caseKey);
                                              const isChecked = reviewSelectedCases.has(caseKey);
                                              return (
                                                <div
                                                  key={caseKey}
                                                  className={`flex items-center p-2.5 rounded-xl border transition-all duration-200 mb-1.5 ${
                                                    isDeleted
                                                      ? "bg-slate-50 border-slate-200 opacity-50"
                                                      : isChecked
                                                        ? "bg-rose-50/30 border-rose-300 ring-1 ring-rose-200"
                                                        : "bg-white border-slate-200"
                                                  }`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                      setReviewSelectedCases(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(caseKey)) {
                                                          next.delete(caseKey);
                                                        } else {
                                                          next.add(caseKey);
                                                        }
                                                        return next;
                                                      });
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600 shrink-0 mr-3"
                                                  />
                                                  <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-xs font-bold text-slate-800 font-mono">{c.caseNumber}</span>
                                                    <span className="text-[11px] text-slate-500 font-semibold">
                                                      {c.petitioner} vs {c.respondent}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">Order: {c.orderDate}</span>
                                                  </div>
                                                  <div className="flex gap-1.5 shrink-0 ml-3">
                                                    {isDeleted ? (
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setReviewDeletedCases(prev => {
                                                            const next = new Set(prev);
                                                            next.delete(caseKey);
                                                            return next;
                                                          });
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer transition-all"
                                                      >
                                                        Undo
                                                      </button>
                                                    ) : (
                                                      <>
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReviewDeletedCases(prev => {
                                                              const next = new Set(prev);
                                                              next.add(caseKey);
                                                              return next;
                                                            });
                                                          }}
                                                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 cursor-pointer transition-all flex items-center gap-1"
                                                        >
                                                          <span className="material-symbols-outlined text-[13px]">delete</span>
                                                          Delete
                                                        </button>
                                                        <button
                                                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default flex items-center gap-1"
                                                        >
                                                          <span className="material-symbols-outlined text-[13px]">check</span>
                                                          Confirmed
                                                        </button>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}



                    {/* Admin Retry Panel — for searches that exhausted auto-retries */}
                    {displayVerification.type === "court_record" && displayVerification.courtRecordStatus === "needs_admin_retry" && (
                      <div className="flex flex-col gap-4 mt-2">
                        <div className="border-2 border-amber-300 bg-amber-50/50 rounded-2xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="material-symbols-outlined text-2xl text-amber-500 font-bold">refresh</span>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-amber-800">eCourts Search Failed — Admin Retry Required</span>
                              <span className="text-[11px] text-amber-600 font-semibold">
                                Automatic retries exhausted ({displayVerification.courtRecordRetryAttempts || 3} attempts). You can retry with the same or modified search parameters.
                              </span>
                            </div>
                          </div>

                          {displayVerification.courtRecordLastError && (
                            <div className="bg-amber-100/60 rounded-lg p-3 mb-3">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 block mb-1">Last Error</span>
                              <p className="text-xs text-amber-800 font-mono">{displayVerification.courtRecordLastError}</p>
                            </div>
                          )}

                          <div className="bg-white/70 rounded-xl p-3 border border-amber-200/50">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-700 block mb-2">Search Parameters</span>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-slate-400 font-semibold">Name:</span>
                                <span className="ml-1 text-slate-700 font-bold">{displayVerification.name}</span>
                              </div>
                              {displayVerification.addresses?.map((addr: any, i: number) => (
                                <div key={i}>
                                  <span className="text-slate-400 font-semibold">Address {i + 1}:</span>
                                  <span className="ml-1 text-slate-700 font-bold">
                                    {[addr.city, addr.state].filter(Boolean).join(", ")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}


                    {/* Admin Review Panel */}
                    {displayVerification.courtRecordAdminReview && displayVerification.courtRecordStatus === "admin_review" && (
                      <div className="flex flex-col gap-4 mt-2">
                        <div className="border-2 border-rose-300 bg-rose-50/50 rounded-2xl p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="material-symbols-outlined text-2xl text-rose-500 font-bold">rate_review</span>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-rose-800">Admin Review Required</span>
                              <span className="text-[11px] text-rose-600 font-semibold">Review each record below and confirm or delete before sending to client.</span>
                            </div>
                          </div>

                          {reviewSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 flex items-center gap-2">
                              <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                              <span className="text-xs font-bold text-emerald-700">Review submitted successfully! Results have been sent to the client.</span>
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-rose-200">
                            <button
                              onClick={() => {
                                // Mark ALL cases as deleted
                                const allKeys = new Set<string>();
                                (displayVerification.courtRecordResults || []).forEach((result: any, rIdx: number) => {
                                  (result.complexSearches || []).forEach((cs: any, csIdx: number) => {
                                    (cs.cases || []).forEach((_: any, cIdx: number) => {
                                      allKeys.add(`${rIdx}-${csIdx}-${cIdx}`);
                                    });
                                  });
                                });
                                setReviewDeletedCases(allKeys);
                              }}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 cursor-pointer transition-all flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                              Set All to No Records
                            </button>
                            <button
                              onClick={() => setReviewDeletedCases(new Set())}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-all flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-[14px]">undo</span>
                              Reset All
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : displayVerification?.type === "interpol" ? (
                  /* Interpol Verification Details */
                  <div className="flex flex-col gap-6 animate-fade-in">
                    {/* Interpol Search Summary Banner */}
                    <div className={`border rounded-2xl p-4 flex items-center gap-3.5 ${
                      displayVerification.interpolHasRecords
                        ? "bg-rose-500/5 border-rose-500/15"
                        : "bg-emerald-500/5 border-emerald-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        displayVerification.interpolHasRecords ? "text-rose-500" : "text-emerald-500"
                      }`}>
                        {displayVerification.interpolHasRecords ? "policy" : "verified_user"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          displayVerification.interpolHasRecords ? "text-rose-800" : "text-emerald-800"
                        }`}>
                          {displayVerification.interpolHasRecords
                            ? `${displayVerification.interpolMatches?.length || 0} Interpol Record Match(es) Found`
                            : "Clean Record — No Interpol Matches"}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          Checked against Global Interpol Red and Yellow Notice Databases
                        </span>
                      </div>
                    </div>

                    {/* Search Input Details */}
                    <div className="flex flex-col gap-3">
                      <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                        <span className="material-symbols-outlined text-sm">person</span>
                        Candidate & Search Query Details
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {renderDetailField("Candidate Name", displayVerification.name, false, "badge")}
                        {renderDetailField("Date of Birth", displayVerification.candidateDob, false, "cake")}
                        {renderDetailField("Place / City of Birth", displayVerification.birthCity, false, "location_city")}
                        {renderDetailField("Requesting Org", displayVerification.requestingOrgName || displayVerification.orgName, false, "business")}
                      </div>
                    </div>

                    {/* Interpol Notice Matches */}
                    {displayVerification.interpolHasRecords && displayVerification.interpolMatches && displayVerification.interpolMatches.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h5 className="font-label-caps text-rose-600 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-rose-100 pb-1.5">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          Matched Interpol Notices ({displayVerification.interpolMatches.length})
                        </h5>
                        <div className="space-y-3">
                          {displayVerification.interpolMatches.map((notice: any, idx: number) => (
                            <div key={idx} className="bg-rose-50/40 border border-rose-200/60 rounded-xl p-4 flex flex-col md:flex-row gap-4">
                              {notice.photo && (
                                <img src={notice.photo} alt={notice.name} className="w-20 h-24 object-cover rounded-lg border border-slate-200 shrink-0" />
                              )}
                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <h6 className="font-bold text-slate-900 text-sm">{notice.name}</h6>
                                  <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                    Notice #{notice.notice_id || notice.entity_id}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 font-semibold mt-1">
                                  Nationalities: {
                                    (Array.isArray(notice.nationalities) ? notice.nationalities.join(", ") : notice.nationalities) ||
                                    (Array.isArray(notice.details?.nationalities) ? notice.details.nationalities.join(", ") : notice.details?.nationalities) ||
                                    "N/A"
                                  }
                                </p>
                                {notice.charge && (
                                  <p className="text-xs text-slate-700 mt-2 bg-white/80 p-2.5 rounded-lg border border-rose-100">
                                    <span className="font-bold text-rose-900 block mb-0.5">Charges / Warrant:</span>
                                    {notice.charge}
                                  </p>
                                )}
                                {notice.link && (
                                  <a href={notice.link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 font-bold hover:underline mt-2 inline-flex items-center gap-1">
                                    <span>View Official Interpol Notice Page</span>
                                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Non-DigiLocker / Pending state (Identity Check) */
                  <div className="flex flex-col gap-4">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-2xl font-light">hourglass_empty</span>
                      <div className="flex flex-col">
                        <span className="font-body-sm font-bold text-slate-800">Awaiting DigiLocker Verification</span>
                        <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                          The candidate has not yet completed DigiLocker authentication.
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {renderDetailField("Candidate Name", displayVerification?.name, false, "person")}
                      {renderDetailField("Email", displayVerification?.email, false, "email")}
                      {renderDetailField("Organization", displayVerification?.orgName, false, "business")}
                      {renderDetailField("Date Initiated", displayVerification?.date, false, "calendar_today")}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {renderDetailField("Status", displayVerification?.status, false, "info")}
                    </div>

                    {displayVerification?.reportDetails && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold">Findings</span>
                        <p className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-slate-600 leading-relaxed font-body-sm">
                          {displayVerification.reportDetails}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Notes */}
                {selectedVerification.notes && (
                  <div className="flex flex-col gap-1.5 mt-2 border-t border-slate-100 pt-4">
                    <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                      Status Notes
                    </span>
                    <p className="text-slate-500 italic pl-3.5 border-l-2 border-[#016e1c] font-body-sm leading-relaxed">
                      {selectedVerification.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Popup Footer */}
            <div className="border-t border-slate-100 bg-slate-50/30 shrink-0">
              <div className="max-w-5xl mx-auto w-full p-6 flex gap-3">
                <button
                  onClick={() => setSelectedVerification(null)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-[#334155] font-semibold rounded-xl transition-colors cursor-pointer text-sm flex items-center justify-center"
                >
                  Close
                </button>
                {(displayVerification?.status === "Completed" || (displayVerification?.status as string) === "Verified" || displayVerification?.type === "interpol") && (
                  <button
                    onClick={() => {
                      if (!displayVerification) return;
                      const reportPath = displayVerification.type === "court_record"
                        ? `/admin/court-record-report?id=${displayVerification.id}`
                        : displayVerification.type === "employment"
                        ? `/admin/employment-report?id=${displayVerification.id}`
                        : displayVerification.type === "education"
                        ? `/admin/education-report?id=${displayVerification.id}`
                        : displayVerification.type === "interpol"
                        ? `/client/interpol-report?id=${displayVerification.id}`
                        : `/admin/report?id=${displayVerification.id}`;
                      window.open(reportPath, "_blank");
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    View Report
                  </button>
                )}
                {(displayVerification?.type === "employment" || displayVerification?.type === "education") && !displayVerification?.sendToCustomer && (
                  <button
                    onClick={async () => {
                      if (!displayVerification) return;
                      if (!confirm("Are you sure you want to complete this verification and send the report to the customer?")) return;
                      try {
                        await sendToCustomer(displayVerification.id);
                        // Refresh details
                        const detail = await fetchVerificationDetail(displayVerification.id);
                        setSelectedDetail(detail);
                      } catch (err: any) {
                        alert(err.message || "Failed to send report to customer");
                      }
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Send to Customer
                  </button>
                )}
                {(displayVerification?.type === "employment" || displayVerification?.type === "education") && displayVerification?.sendToCustomer && (
                  <button
                    disabled
                    className="flex-1 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl text-sm flex items-center justify-center gap-1 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Sent to Customer
                  </button>
                )}
                {displayVerification?.courtRecordAdminReview && displayVerification?.courtRecordStatus === "admin_review" && (
                  <button
                    disabled={isSubmittingReview}
                    onClick={async () => {
                      if (!displayVerification) return;
                      setIsSubmittingReview(true);
                      setReviewSuccess(false);
                      try {
                        // Build reviewed results from deleted cases set
                        const reviewedResults: Array<{ resultIndex: number; complexSearchIndex: number; caseIndex: number; action: "confirm" | "delete" }> = [];
                        (displayVerification.courtRecordResults || []).forEach((result: any, rIdx: number) => {
                          (result.complexSearches || []).forEach((cs: any, csIdx: number) => {
                            (cs.cases || []).forEach((_: any, cIdx: number) => {
                              const caseKey = `${rIdx}-${csIdx}-${cIdx}`;
                              reviewedResults.push({
                                resultIndex: rIdx,
                                complexSearchIndex: csIdx,
                                caseIndex: cIdx,
                                action: reviewDeletedCases.has(caseKey) ? "delete" : "confirm"
                              });
                            });
                          });
                        });
                        await reviewCourtRecord(displayVerification.id, reviewedResults);
                        setReviewSuccess(true);
                        setReviewDeletedCases(new Set());
                        // Refresh detail
                        const detail = await fetchVerificationDetail(displayVerification.id);
                        setSelectedDetail(detail);
                      } catch (err) {
                        console.error("Review failed:", err);
                      } finally {
                        setIsSubmittingReview(false);
                      }
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isSubmittingReview ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">send</span>
                    )}
                    Send to Client
                  </button>
                )}
                {displayVerification?.type === "court_record" && displayVerification?.courtRecordStatus === "needs_admin_retry" && (
                  <button
                    disabled={isRetrying}
                    onClick={async () => {
                      if (!displayVerification) return;
                      setIsRetrying(true);
                      try {
                        await adminRetryCourtSearch(displayVerification.id);
                        setSelectedVerification(null);
                      } catch (err) {
                        console.error("Admin retry failed:", err);
                      } finally {
                        setIsRetrying(false);
                      }
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isRetrying ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                    )}
                    Retry Search
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
