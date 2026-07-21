"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePortal, Verification } from "src/context/PortalContext";

export default function VerificationRosterPage() {
  const router = useRouter();
  const { verifications, refreshData } = usePortal();

  // Court record review state
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

  // Filters state
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterType, setDateFilterType] = useState("all");
  const [customDate, setCustomDate] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, orgFilter, typeFilter, searchQuery, dateFilterType, customDate]);

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

  const handleSelectVerification = (v: Verification) => {
    router.push(`/admin/roster/workspace?id=${v.id}`);
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

  const totalPages = Math.ceil(sortedVerifications.length / itemsPerPage) || 1;
  const paginatedVerifications = sortedVerifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: "id" | "date" | "name" | "orgName" | "status") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc");
    }
  };

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
                paginatedVerifications.map((v, idx) => (
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
          paginatedVerifications.map((v, idx) => {
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

                {/* Actions Button */}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleSelectVerification(v)}
                    className="px-4 py-2 apple-button-secondary rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    Details &amp; Audit
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls Bar */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#016e1c]/12 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, sortedVerifications.length)}</span> of{" "}
            <span className="font-bold text-slate-900">{sortedVerifications.length}</span> reports
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
    </div>
  );
}
