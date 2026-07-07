"use client";

import React, { useState } from "react";
import { usePortal, Verification } from "src/context/PortalContext";

export default function VerificationRosterPage() {
  const { verifications, updateVerificationStatus, fetchVerificationDetail, refreshData, reviewCourtRecord } = usePortal();

  // Court record review state
  const [reviewDeletedCases, setReviewDeletedCases] = useState<Set<string>>(new Set());
  const [reviewSelectedCases, setReviewSelectedCases] = useState<Set<string>>(new Set());
  const [expandedComplexes, setExpandedComplexes] = useState<Set<string>>(new Set());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

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

    return matchesStatus && matchesOrg && matchesSearch && matchesDate;
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

      {/* Main Roster Table */}
      <section className="apple-card-static overflow-hidden border border-[#016e1c]/10 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm whitespace-nowrap">
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
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">TYPE</th>
                <th
                  onClick={() => handleSort("name")}
                  className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] hover:text-[#016e1c] transition-colors cursor-pointer select-none"
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
                    className={`hover:bg-slate-50/50 transition-colors animate-fade-in ${v.courtRecordAdminReview && v.courtRecordStatus === "admin_review" ? "border-l-[3px] border-l-rose-500" : ""}`}
                    style={{
                      animationDelay: `${Math.min(idx * 20, 200)}ms`,
                      animationFillMode: "both"
                    }}
                  >
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">{v.id}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                        v.type === "court_record"
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/15"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                      }`}>
                        {v.type === "court_record" ? "Court" : "Identity"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{v.name}</span>
                        <span className="text-xs text-slate-400 mt-0.5">{v.type === "court_record" ? (v.courtRecordSummary || "Search in progress...") : v.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{v.orgName}</td>
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
                            : v.status === "Processing"
                            ? "bg-[#016e1c]"
                            : "bg-red-500"
                        }`}></span>
                        {(v.type === "court_record" && v.courtRecordStatus === "admin_review") ? "Review" : v.status}
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

                {displayVerification?.digilockerStatus === "Verified" ? (
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
                        : displayVerification.courtRecordStatus === "error"
                          ? "bg-amber-500/5 border-amber-500/15"
                          : "bg-blue-500/5 border-blue-500/15"
                    }`}>
                      <span className={`material-symbols-outlined text-2xl font-bold ${
                        displayVerification.courtRecordStatus === "completed"
                          ? displayVerification.courtRecordHasRecords ? "text-rose-500" : "text-emerald-500"
                          : displayVerification.courtRecordStatus === "error" ? "text-amber-500" : "text-blue-500"
                      }`}>
                        {displayVerification.courtRecordStatus === "completed"
                          ? displayVerification.courtRecordHasRecords ? "gavel" : "verified_user"
                          : displayVerification.courtRecordStatus === "error" ? "warning" : "hourglass_top"}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-body-sm font-bold ${
                          displayVerification.courtRecordStatus === "completed"
                            ? displayVerification.courtRecordHasRecords ? "text-rose-800" : "text-emerald-800"
                            : displayVerification.courtRecordStatus === "error" ? "text-amber-800" : "text-blue-800"
                        }`}>
                          {displayVerification.courtRecordStatus === "completed"
                            ? displayVerification.courtRecordHasRecords
                              ? `${displayVerification.courtRecordTotalCases} Court Record(s) Found`
                              : "No Court Records Found"
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
                        {renderDetailField("Date of Birth", displayVerification.candidateDob, false, "calendar_today")}
                        {renderDetailField("Organization", displayVerification.orgName, false, "business")}
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

                    {/* Search Errors */}
                    {displayVerification.courtRecordErrors && displayVerification.courtRecordErrors.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h5 className="font-label-caps text-amber-600 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          Search Notes
                        </h5>
                        <div className="p-3 bg-amber-50/50 border border-amber-200/50 rounded-xl">
                          <ul className="list-disc list-inside text-[11px] text-amber-800 font-semibold space-y-1">
                            {displayVerification.courtRecordErrors.map((err: string, i: number) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
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
                {displayVerification?.status === "Completed" && (
                  <button
                    onClick={() => {
                      const reportPath = displayVerification.type === "court_record"
                        ? `/admin/court-record-report?id=${displayVerification.id}`
                        : `/admin/report?id=${displayVerification.id}`;
                      window.open(reportPath, "_blank");
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    Print
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
