"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePortal, Verification } from "src/context/PortalContext";

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const {
    verifications,
    fetchVerificationDetail,
    refreshData,
    reviewCourtRecord,
    adminRetryCourtSearch,
    logEmploymentAttempt,
    deleteEmploymentAttempt,
    deleteEducationAttempt,
    sendToCustomer
  } = usePortal();

  const [displayVerification, setDisplayVerification] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Court record review state
  const [reviewDeletedCases, setReviewDeletedCases] = useState<Set<string>>(new Set());
  const [reviewSelectedCases, setReviewSelectedCases] = useState<Set<string>>(new Set());
  const [expandedComplexes, setExpandedComplexes] = useState<Set<string>>(new Set());
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

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

  // Load details
  const loadDetail = useCallback(async () => {
    if (!id) {
      setErrorMsg("No verification ID provided in URL");
      setIsLoadingDetail(false);
      return;
    }
    setIsLoadingDetail(true);
    setErrorMsg("");
    try {
      const detail = await fetchVerificationDetail(id);
      if (detail) {
        setDisplayVerification(detail);
      } else {
        // Fallback to searching context array
        const found = verifications.find((v) => v.id === id);
        if (found) {
          setDisplayVerification(found);
        } else {
          setErrorMsg("Verification request not found");
        }
      }
    } catch (err) {
      console.error("Error loading verification workspace detail:", err);
      setErrorMsg("Failed to load verification detail.");
    } finally {
      setIsLoadingDetail(false);
    }
  }, [id, fetchVerificationDetail, verifications]);

  useEffect(() => {
    loadDetail();
  }, [id]);

  // Keep updated from global roster context if changes happen
  useEffect(() => {
    if (id && verifications.length > 0) {
      const live = verifications.find((v) => v.id === id);
      if (live) {
        setDisplayVerification((prev: any) => {
          if (!prev) return live;
          // Merge details
          return { ...live, ...prev, status: live.status, notes: live.notes, interpolMatches: live.interpolMatches, interpolHasRecords: live.interpolHasRecords };
        });
      }
    }
  }, [verifications, id]);

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

  const handleGenerateAndSendReport = async () => {
    if (!displayVerification) return;

    const interpolNoticeCount = displayVerification.type === "interpol" && displayVerification.interpolHasRecords
      ? (displayVerification.interpolMatches?.length || 0)
      : 0;

    const hasCourtReview = displayVerification.type === "court_record" && displayVerification.courtRecordStatus === "admin_review";

    let confirmMessage = "";
    if (interpolNoticeCount > 0) {
      confirmMessage = `⚠️ Attention: Candidate "${displayVerification.name}" has ${interpolNoticeCount} active Interpol notice match(es) remaining.\n\nAre you sure you want to generate the final report and send it to the client with these active notices?`;
    } else if (hasCourtReview) {
      confirmMessage = `⚠️ Attention: Court record review is currently pending for candidate "${displayVerification.name}".\n\nAre you sure you want to generate and send the report to the client now?`;
    } else {
      confirmMessage = `Are you sure you want to generate the final verification report for "${displayVerification.name}" and publish/send it to the client?`;
    }

    if (!window.confirm(confirmMessage)) return;

    const reportPath = displayVerification.type === "court_record"
      ? `/admin/court-record-report?id=${displayVerification.id}`
      : displayVerification.type === "employment"
      ? `/admin/employment-report?id=${displayVerification.id}`
      : displayVerification.type === "education"
      ? `/admin/education-report?id=${displayVerification.id}`
      : displayVerification.type === "interpol"
      ? `/admin/interpol-report?id=${displayVerification.id}`
      : `/admin/report?id=${displayVerification.id}`;

    // SAFARI COMPATIBILITY FIX:
    // Synchronously open a blank target tab BEFORE async await operations to prevent Safari's popup blocker from blocking the window.
    const reportWindow = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;

    try {
      await sendToCustomer(displayVerification.id);
      await loadDetail();
      refreshData();

      if (reportWindow && !reportWindow.closed) {
        reportWindow.location.href = reportPath;
      } else if (typeof window !== "undefined") {
        window.location.href = reportPath;
      }
    } catch (err: any) {
      if (reportWindow && !reportWindow.closed) {
        reportWindow.close();
      }
      alert("Failed to send report to client: " + (err.message || "Unknown error"));
    }
  };

  // Helper to render a field card inside details view with modern thin long typography
  const renderDetailField = (
    label: string,
    value: string | undefined,
    isBadge = false,
    icon?: string
  ) => {
    const displayValue = value || "-";
    return (
      <div className="group relative bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-slate-200/80 hover:border-[#016e1c]/40 flex flex-col gap-1.5 transition-all duration-300 hover:shadow-[0_8px_25px_rgba(1,110,28,0.06)] hover:-translate-y-0.5 overflow-hidden">
        {/* Subtle top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-[#016e1c]/30 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="flex items-center gap-1.5">
          {icon && (
            <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-[#016e1c] transition-colors">{icon}</span>
          )}
          {isBadge ? (
            <span className="bg-[#016e1c]/10 text-[#00450e] font-modern-caps text-[9px] tracking-[0.15em] font-light px-2 py-0.5 rounded-full border border-[#016e1c]/15">
              {label}
            </span>
          ) : (
            <span className="font-modern-caps text-slate-400 text-[9.5px] tracking-[0.15em] font-light">
              {label}
            </span>
          )}
        </div>
        <div className="font-modern-thin font-light text-slate-900 break-all mt-0.5 text-base tracking-[0.04em]">
          {displayValue}
        </div>
      </div>
    );
  };

  if (isLoadingDetail && !displayVerification) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-2 border-[#016e1c] border-t-transparent rounded-full animate-spin"></div>
        <span className="font-modern-thin text-slate-500 animate-pulse text-sm">Loading verification details...</span>
      </div>
    );
  }

  if (errorMsg || !displayVerification) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white border border-[#016e1c]/10 rounded-3xl max-w-xl mx-auto shadow-sm my-12">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">!</div>
        <h3 className="font-modern-title text-xl font-light text-slate-800">Workspace Error</h3>
        <p className="font-modern-thin text-sm text-slate-500 mt-2">{errorMsg || "Could not retrieve details."}</p>
        <Link
          href="/admin/roster"
          className="mt-6 px-5 py-2.5 bg-[#181d16] text-white rounded-xl font-modern-title text-xs tracking-wider uppercase hover:bg-[#1E293B] transition-all cursor-pointer shadow-sm"
        >
          Return to Roster
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-6 animate-fade-in pb-20">
      
      {/* Premium Glassmorphic Breadcrumbs */}
      <div className="flex items-center gap-2.5 text-xs text-slate-500 font-semibold tracking-wide select-none bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200/60 w-fit shadow-2xs">
        <Link href="/admin/roster" className="hover:text-[#016e1c] transition-colors flex items-center gap-1 text-slate-600 font-modern-thin text-xs">
          <span className="material-symbols-outlined text-base text-[#016e1c]">home</span>
          Roster
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-[#016e1c] font-modern-caps text-[10px] tracking-[0.15em] bg-[#016e1c]/10 px-2 py-0.5 rounded-md border border-[#016e1c]/15">Workspace</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-mono font-light text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 tracking-widest">{displayVerification.id}</span>
      </div>

      {/* Main Top Header & Action Row */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-[0_10px_35px_rgba(0,0,0,0.03)] flex flex-col xl:flex-row xl:items-center justify-between gap-6 overflow-hidden relative">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/5 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-4 shrink-0 relative z-10">
          {/* Custom Avatar Gradient Badge */}
          <div className={`p-4 rounded-2xl shadow-sm border flex items-center justify-center shrink-0 ${
            displayVerification.type === "court_record" ? "bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-700 border-amber-500/20 shadow-amber-500/10"
              : displayVerification.type === "employment" ? "bg-gradient-to-br from-blue-500/10 to-indigo-600/20 text-blue-700 border-blue-500/20 shadow-blue-500/10"
              : displayVerification.type === "education" ? "bg-gradient-to-br from-purple-500/10 to-pink-600/20 text-purple-700 border-purple-500/20 shadow-purple-500/10"
              : displayVerification.type === "interpol" ? "bg-gradient-to-br from-indigo-600/15 via-blue-600/10 to-sky-500/15 text-indigo-700 border-indigo-500/25 shadow-indigo-500/15"
              : "bg-gradient-to-br from-emerald-500/10 to-teal-600/20 text-emerald-700 border-emerald-500/20 shadow-emerald-500/10"
          }`}>
            <span className="material-symbols-outlined text-3xl font-light">
              {displayVerification.type === "court_record" ? "gavel"
                : displayVerification.type === "employment" ? "work"
                : displayVerification.type === "education" ? "school"
                : displayVerification.type === "interpol" ? "shield_locked"
                : "fingerprint"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-modern-title text-slate-900 text-3xl font-light tracking-[0.08em] leading-none uppercase">
                {displayVerification.name}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full font-modern-caps text-[9px] tracking-[0.14em] font-light border ${
                displayVerification.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                : displayVerification.status === "Processing" ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                : "bg-rose-500/10 text-rose-700 border-rose-500/20"
              }`}>
                {displayVerification.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-modern-thin mt-2 flex items-center gap-2">
              <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-700 font-light tracking-wider">{displayVerification.id}</span>
              <span>•</span>
              <span className="capitalize font-light tracking-wide text-slate-700">{displayVerification.type || "identity"} Verification</span>
            </p>
          </div>
        </div>

        {/* Global Action Buttons — Flex wrap into multiple clean rows when needed */}
        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 max-w-full relative z-10">
          <Link
            href="/admin/roster"
            className="group px-4 py-2.5 border border-slate-200/90 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2 bg-white shadow-2xs hover:shadow-xs active:scale-98"
          >
            <span className="material-symbols-outlined text-base transition-transform group-hover:-translate-x-0.5">arrow_back</span>
            Back to Roster
          </Link>

          {!displayVerification?.sendToCustomer ? (
            <button
              onClick={handleGenerateAndSendReport}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:opacity-95 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.25)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.35)] active:scale-98"
            >
              <span className="material-symbols-outlined text-base">send</span>
              Generate Report &amp; Send to Client
            </button>
          ) : (
            <>
              <span className="px-4 py-2.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs">
                <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                Report Published &amp; Sent to Client
              </span>
              <button
                onClick={handleGenerateAndSendReport}
                title="Regenerate and re-send updated report certificate if new data was received"
                className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs active:scale-98"
              >
                <span className="material-symbols-outlined text-base text-amber-600">published_with_changes</span>
                Regenerate &amp; Re-send Report
              </button>
            </>
          )}

          <button
            onClick={() => {
              const reportPath = displayVerification.type === "court_record"
                ? `/admin/court-record-report?id=${displayVerification.id}`
                : displayVerification.type === "employment"
                ? `/admin/employment-report?id=${displayVerification.id}`
                : displayVerification.type === "education"
                ? `/admin/education-report?id=${displayVerification.id}`
                : displayVerification.type === "interpol"
                ? `/admin/interpol-report?id=${displayVerification.id}`
                : `/admin/report?id=${displayVerification.id}`;
              const win = window.open(reportPath, "_blank");
              if (!win || win.closed || typeof win.closed === "undefined") {
                window.location.href = reportPath;
              }
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 hover:shadow-lg hover:shadow-slate-900/20 active:scale-98"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">workspace_premium</span>
            View Report Certificate
          </button>
        </div>
      </div>

      {/* Main Workspace Card Details */}
      <div className="bg-white border border-[#016e1c]/12 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col gap-6">

        {/* Onboarding Status / Client visibility banner */}
        {displayVerification?.onboardingStatus === "setup_pending" && (
          <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-sm flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl animate-pulse">hourglass_top</span>
            <div className="flex flex-col">
              <span className="font-bold text-amber-700 text-xs">Password Setup Pending</span>
              <span className="text-[10.5px] text-amber-600/80 mt-0.5 font-medium">Candidate has not yet set their password via the setup link.</span>
            </div>
          </div>
        )}

        <div className={`p-5 border rounded-2xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 shadow-2xs ${
          displayVerification?.sendToCustomer
            ? "bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-emerald-500/10 border-emerald-500/20"
            : "bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/10 border-amber-500/20"
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-xl border shrink-0 ${
              displayVerification?.sendToCustomer
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                : "bg-amber-500/10 border-amber-500/20 text-amber-600"
            }`}>
              <span className="material-symbols-outlined text-xl">
                {displayVerification?.sendToCustomer ? "visibility" : "visibility_off"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className={`font-extrabold text-xs tracking-tight ${
                displayVerification?.sendToCustomer ? "text-emerald-900" : "text-amber-900"
              }`}>
                {displayVerification?.sendToCustomer ? "Report Published to Client Portal" : "Draft Mode (Hidden from Client Portal)"}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
                {displayVerification?.sendToCustomer
                  ? "The client can view and download the official findings report PDF. If new data is updated, click 'Regenerate Report'."
                  : "The client sees 'Under Review' and cannot access the report until you click 'Generate Report & Send to Client'."}
              </span>
            </div>
          </div>

          {displayVerification?.sendToCustomer && (
            <button
              onClick={handleGenerateAndSendReport}
              className="px-4 py-2 bg-white border border-amber-600/30 hover:bg-amber-50 text-amber-900 font-extrabold rounded-xl transition-all cursor-pointer text-xs shrink-0 flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-98 w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-sm text-amber-600">published_with_changes</span>
              Regenerate Report
            </button>
          )}
        </div>

        {/* Dynamic Inner Layout according to Type */}
        {displayVerification?.type === "employment" || displayVerification?.type === "education" ? (
          /* ======================================================== */
          /* EMPLOYMENT / EDUCATION WORKSPACE                         */
          /* ======================================================== */
          <div className="flex flex-col gap-6">
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
                  {displayVerification.skipCandidateLogin
                    ? "Direct Client Submission (No Candidate Login)"
                    : displayVerification.type === "employment"
                    ? (displayVerification.employmentDataSubmitted ? "Employment Data Submitted by Candidate" : "Awaiting Candidate Submission")
                    : (displayVerification.educationDataSubmitted ? "Education Data Submitted by Candidate" : "Awaiting Candidate Submission")}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                  {displayVerification.skipCandidateLogin
                    ? "Candidate login creation was skipped by client during request initiation"
                    : displayVerification.type === "employment"
                    ? (displayVerification.employmentDataSubmittedAt
                      ? `Submitted on ${new Date(displayVerification.employmentDataSubmittedAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
                      : "Candidate has not yet filled the employment form")
                    : (displayVerification.educationDataSubmittedAt
                      ? `Submitted on ${new Date(displayVerification.educationDataSubmittedAt).toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
                      : "Candidate has not yet filled the education form")}
                </span>
              </div>
            </div>

            {/* Personal Details Table */}
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

            {/* Education Check Details */}
            {displayVerification.type === "education" && displayVerification.educationData && (
              <div className="flex flex-col gap-2">
                <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5">
                  <span className="material-symbols-outlined text-sm">school</span>
                  Education Details
                </h5>
                <div className="overflow-x-auto border border-slate-200/60 rounded-xl mb-2">
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#016e1c] text-white rounded-lg hover:opacity-90 transition-colors font-bold text-[10px] uppercase tracking-wider cursor-pointer shadow-2xs"
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

            {/* Employment Check Details */}
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
                <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 flex-1 select-none">
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Log Verification Attempt
                </h5>
                <button
                  onClick={() => setShowLogAttemptForm(!showLogAttemptForm)}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#016e1c] bg-[#016e1c]/10 hover:bg-[#016e1c]/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
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

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comment</label>
                    <textarea value={empAttemptComment} onChange={e => setEmpAttemptComment(e.target.value)} rows={2}
                      className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none"
                      placeholder="Add attempt comment" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Verifier Note (Internal)</label>
                    <textarea value={empAttemptVerifierNote} onChange={e => setEmpAttemptVerifierNote(e.target.value)} rows={2}
                      className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none"
                      placeholder="Internal note for verification method (not shown in report)" />
                  </div>

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

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Respondent Comment</label>
                    <textarea value={empAttemptRespondentComment} onChange={e => setEmpAttemptRespondentComment(e.target.value)} rows={2}
                      className="border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#016e1c]/20 focus:border-[#016e1c] transition-all placeholder-slate-400 resize-none"
                      placeholder="Add respondent comment" />
                  </div>

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

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={empAttemptSendEmail} onChange={e => setEmpAttemptSendEmail(e.target.checked)}
                        className="w-4 h-4 border border-slate-300 rounded text-[#016e1c] focus:ring-[#016e1c] cursor-pointer" />
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Email Customer</span>
                    </label>
                    <button
                      onClick={async () => {
                        setEmpAttemptSubmitting(true);
                        setEmpAttemptError("");
                        setEmpAttemptSuccess("");
                        try {
                          if (displayVerification.type === "education") {
                            // education check attempt logic
                            const res = await fetch("/api/portal-data", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "log_education_attempt",
                                payload: {
                                  verificationId: displayVerification.id,
                                  attempt: {
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
                                  }
                                }
                              })
                            });
                            if (!res.ok) throw new Error("Failed to log education attempt");
                          } else {
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
                          }
                          setEmpAttemptSuccess("Attempt logged successfully!");
                          // Reset form
                          setEmpAttemptComment(""); setEmpAttemptVerifierNote("");
                          setEmpAttemptRespondentName(""); setEmpAttemptRespondentEmail("");
                          setEmpAttemptRespondentComment(""); setEmpAttemptScreenshot("");
                          setEmpAttemptExtraPayment(false); setEmpAttemptMarkAsPaid(false);
                          setEmpAttemptAskApproval(false); setEmpAttemptSendEmail(false);
                          // Re-fetch detail
                          loadDetail();
                        } catch (err: any) {
                          setEmpAttemptError(err.message || "Failed to log attempt");
                        } finally {
                          setEmpAttemptSubmitting(false);
                        }
                      }}
                      disabled={empAttemptSubmitting}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] text-white rounded-xl font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
              const attempts = displayVerification.type === "education" 
                ? (displayVerification.educationAttempts || [])
                : (displayVerification.employmentAttempts || []);
              if (attempts.length === 0) return null;
              return (
                <div className="flex flex-col gap-3">
                  <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 select-none">
                    <span className="material-symbols-outlined text-sm">history</span>
                    Attempts Timeline ({attempts.length})
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
                                if (!confirm("Are you sure you want to delete this attempt log?")) return;
                                try {
                                  if (displayVerification.type === "education") {
                                    await deleteEducationAttempt(displayVerification.id, idx);
                                  } else {
                                    await deleteEmploymentAttempt(displayVerification.id, idx);
                                  }
                                  loadDetail();
                                } catch (err: any) {
                                  alert(err.message || "Failed to delete attempt");
                                }
                              }}
                              className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">delete</span>
                              Delete Log
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
                                    <span className="material-symbols-outlined text-xs">attachment</span> View Attachment
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
        ) : displayVerification?.type === "court_record" ? (
          /* ======================================================== */
          /* COURT RECORD WORKSPACE                                   */
          /* ======================================================== */
          <div className="flex flex-col gap-6">
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
                      : `eCourts Search In Progress (${displayVerification.courtRecordProgressPercent || 0}%)`}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                  {displayVerification.courtRecordStatus === "completed"
                    ? `Completed search in ${displayVerification.courtRecordSearchedEstablishmentsCount || 0} courts/establishments`
                    : displayVerification.courtRecordProgress || "Syncing records from national eCourts database..."}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 select-none">
                <span className="material-symbols-outlined text-sm">person</span>
                Candidate &amp; Search Query Details
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {renderDetailField("Candidate Name", displayVerification.name, false, "badge")}
                {renderDetailField("Date of Birth", displayVerification.candidateDob, false, "cake")}
                {renderDetailField("Father's Name", displayVerification.candidateFatherName, false, "person")}
                {renderDetailField("Gender", displayVerification.gender, false, "wc")}
              </div>
              <div className="mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Target Search Address(es)</span>
                <div className="grid grid-cols-1 gap-2 mt-1.5">
                  {(displayVerification.addresses || []).map((addr: any, index: number) => (
                    <div key={index} className="p-3.5 bg-slate-50/50 border border-slate-200/50 rounded-xl text-xs flex items-center justify-between gap-3 shadow-2xs">
                      <span className="font-semibold text-slate-700 leading-relaxed">
                        {[addr.address, addr.city, addr.state, addr.country].filter(Boolean).join(", ")}
                      </span>
                      {addr.pincode && (
                        <span className="font-mono text-slate-400 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                          PIN: {addr.pincode}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Inline Court Records Case Review */}
            {displayVerification.courtRecordStatus === "admin_review" && displayVerification.courtRecordResults && (
              <div className="p-5 bg-rose-50/50 border border-rose-200 rounded-3xl flex flex-col gap-3.5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-2xl font-bold animate-bounce-subtle">shield_alert</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-rose-800">Admin Review Required</span>
                      <span className="text-[11px] text-rose-600 font-semibold mt-0.5">Review each record below and confirm or delete before sending to client.</span>
                    </div>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
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

                {reviewSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                    <span className="text-xs font-bold text-emerald-700">Review submitted successfully! Results have been sent to the client.</span>
                  </div>
                )}
              </div>
            )}

            {/* Court Records Complexes List */}
            {displayVerification.courtRecordResults && (
              <div className="space-y-4">
                {displayVerification.courtRecordResults.map((result: any, rIdx: number) => {
                  const allComplexes = result.complexSearches || [];
                  const validComplexes = allComplexes.filter((cs: any) => !cs.error);
                  if (validComplexes.length === 0) return null;
                  return (
                    <div key={rIdx} className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-2xs bg-white">
                      <div className="bg-slate-50/50 px-4 py-3 flex items-center justify-between border-b border-slate-200/50">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                          {result.district}, {result.state}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {validComplexes.length} complex(es) searched
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {validComplexes.map((cs: any, csIdx: number) => {
                          const casesCount = cs.cases?.length || 0;
                          const isExpanded = expandedComplexes.has(`${rIdx}-${csIdx}`);
                          const canExpand = casesCount > 0;
                          return (
                            <div key={csIdx} className="flex flex-col">
                              <div
                                onClick={() => {
                                  if (!canExpand) return;
                                  setExpandedComplexes(prev => {
                                    const next = new Set(prev);
                                    const key = `${rIdx}-${csIdx}`;
                                    if (next.has(key)) next.delete(key);
                                    else next.add(key);
                                    return next;
                                  });
                                }}
                                className={`px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
                                  canExpand ? "hover:bg-slate-50/30 cursor-pointer" : ""
                                }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-semibold text-slate-800 leading-normal">{cs.establishmentName}</span>
                                  {cs.searchedUrls && cs.searchedUrls.length > 0 && (
                                    <span className="text-[9px] text-slate-400 font-mono">{cs.searchedUrls[0]}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    casesCount > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-150 text-[#00450e]"
                                  }`}>
                                    {casesCount} case(s) found
                                  </span>
                                  {canExpand && (
                                    <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                      expand_more
                                    </span>
                                  )}
                                </div>
                              </div>

                              {canExpand && isExpanded && (
                                <div className="px-4 pb-3 pt-1 bg-slate-50/20 border-t border-slate-100">
                                  {(cs.cases || []).map((c: any, cIdx: number) => {
                                    const caseKey = `${rIdx}-${csIdx}-${cIdx}`;
                                    const isDeleted = reviewDeletedCases.has(caseKey);
                                    const isChecked = reviewSelectedCases.has(caseKey);
                                    return (
                                      <div
                                        key={caseKey}
                                        className={`flex items-center p-3 rounded-xl border transition-all duration-200 mb-1.5 ${
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
                                              if (next.has(caseKey)) next.delete(caseKey);
                                              else next.add(caseKey);
                                              return next;
                                            });
                                          }}
                                          className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer accent-rose-600 shrink-0 mr-3 animate-scale-up"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-center gap-2">
                                            <span className="font-mono font-bold text-xs text-slate-900 select-all">{c.caseNumber}</span>
                                            {isDeleted ? (
                                              <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black uppercase">Removed</span>
                                            ) : (
                                              <span className="text-[9px] bg-emerald-100 text-[#00450e] px-1.5 py-0.5 rounded font-black uppercase">Confirmed Match</span>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-[10.5px] font-medium text-slate-500">
                                            <div>Petitioner: <span className="font-bold text-slate-800">{c.petitioner || "-"}</span></div>
                                            <div>Respondent: <span className="font-bold text-slate-800">{c.respondent || "-"}</span></div>
                                            <div>Filing Date: <span className="font-mono text-slate-700">{c.filingDate || "-"}</span></div>
                                          </div>
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
            )}

            {/* Bottom Actions for Roster Court Case Review Submit */}
            {displayVerification.courtRecordStatus === "admin_review" && (
              <div className="pt-4 border-t border-slate-200/60 flex items-center justify-end gap-3.5">
                {reviewSelectedCases.size > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setReviewDeletedCases(prev => {
                          const next = new Set(prev);
                          reviewSelectedCases.forEach(k => next.add(k));
                          return next;
                        });
                        setReviewSelectedCases(new Set());
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
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
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200 cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">check</span>
                      Confirm Selected ({reviewSelectedCases.size})
                    </button>
                  </div>
                )}

                <button
                  disabled={isSubmittingReview}
                  onClick={async () => {
                    setIsSubmittingReview(true);
                    setReviewSuccess(false);
                    try {
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
                      loadDetail();
                    } catch (err) {
                      console.error("Review failed:", err);
                    } finally {
                      setIsSubmittingReview(false);
                    }
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md"
                >
                  {isSubmittingReview ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[15px]">send</span>
                  )}
                  Send Reviewed Results to Client
                </button>
              </div>
            )}

            {/* Admin Search Retry Trigger */}
            {displayVerification.courtRecordStatus === "needs_admin_retry" && (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-between flex-wrap gap-4 mt-2">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-500 text-2xl font-bold animate-pulse">sync_problem</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-amber-800">Connection Failed During eCourts Fetch</span>
                    <span className="text-[10.5px] text-amber-600/80 mt-0.5">Please check captcha solver state and retry the fetch.</span>
                  </div>
                </div>
                <button
                  disabled={isRetrying}
                  onClick={async () => {
                    setIsRetrying(true);
                    try {
                      await adminRetryCourtSearch(displayVerification.id);
                      router.push("/admin/roster");
                    } catch (err) {
                      console.error("Admin retry failed:", err);
                    } finally {
                      setIsRetrying(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md shadow-amber-500/10"
                >
                  {isRetrying ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                  )}
                  Retry Search
                </button>
              </div>
            )}
          </div>
        ) : displayVerification?.type === "interpol" ? (
          /* ======================================================== */
          /* INTERPOL WORKSPACE - MODERNIZED                          */
          /* ======================================================== */
          <div className="flex flex-col gap-6">
            {/* Status Summary Banner */}
            <div className={`border rounded-2xl p-5 flex items-center gap-4 shadow-2xs transition-all ${
              displayVerification.interpolHasRecords
                ? "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-rose-500/10 border-rose-500/25"
                : "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-emerald-500/10 border-emerald-500/25"
            }`}>
              <div className={`p-3 rounded-2xl border shrink-0 ${
                displayVerification.interpolHasRecords
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 shadow-rose-500/10"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 shadow-emerald-500/10"
              }`}>
                <span className="material-symbols-outlined text-2xl font-bold">
                  {displayVerification.interpolHasRecords ? "warning" : "verified_user"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className={`font-extrabold text-sm tracking-tight ${
                  displayVerification.interpolHasRecords ? "text-rose-950" : "text-emerald-950"
                }`}>
                  {displayVerification.interpolHasRecords
                    ? `${displayVerification.interpolMatches?.length || 0} Interpol Record Match(es) Found`
                    : "Clean Record — No Interpol Matches Found"}
                </span>
                <span className="text-xs text-slate-500 font-semibold mt-0.5">
                  Verified against Global Interpol Red (Wanted Persons) &amp; Yellow (Missing Persons) Databases
                </span>
              </div>
            </div>

            {/* Candidate & Query Metadata Grid */}
            <div className="flex flex-col gap-3">
              <h5 className="font-label-caps text-slate-400 text-[10.5px] uppercase tracking-wider font-extrabold flex items-center gap-2 border-b border-slate-100 pb-2 select-none">
                <span className="material-symbols-outlined text-base text-slate-500">person</span>
                Candidate &amp; Search Query Details
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {renderDetailField("Candidate Full Name", displayVerification.name, false, "badge")}
                {renderDetailField("Date of Birth", displayVerification.candidateDob, false, "cake")}
                {renderDetailField("Place / City of Birth", displayVerification.birthCity, false, "location_city")}
                {renderDetailField("Requesting Organization", displayVerification.requestingOrgName || displayVerification.orgName, false, "business")}
              </div>
            </div>

            {/* Matched Notices List */}
            {displayVerification.interpolHasRecords && displayVerification.interpolMatches && displayVerification.interpolMatches.length > 0 && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex justify-between items-center border-b border-rose-200/60 pb-2.5">
                  <h5 className="font-label-caps text-rose-700 text-xs uppercase tracking-wider font-extrabold flex items-center gap-2 select-none">
                    <span className="material-symbols-outlined text-base text-rose-600">report_problem</span>
                    Matched Interpol Notices ({displayVerification.interpolMatches.length})
                  </h5>
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-100/80 px-2.5 py-0.5 rounded-full border border-rose-200">
                    Action Required
                  </span>
                </div>

                <div className="space-y-4">
                  {displayVerification.interpolMatches.map((notice: any, idx: number) => (
                    <div key={idx} className="bg-gradient-to-b from-rose-50/70 via-white to-rose-50/30 border-2 border-rose-200/80 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row gap-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                      {/* Left accent stripe */}
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-500 to-rose-600"></div>

                      {notice.photo && (
                        <div className="relative shrink-0">
                          <img src={getPhotoSrc(notice.photo)} alt={notice.name} className="w-24 h-28 object-cover rounded-xl border border-slate-200/80 shadow-xs" />
                          <span className="absolute bottom-1 right-1 bg-slate-900/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded font-bold backdrop-blur-xs">
                            INTERPOL
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex justify-between items-start flex-wrap gap-2 pb-3 border-b border-rose-100">
                          <div>
                            <span className="text-[10px] uppercase font-mono font-extrabold text-rose-600 tracking-wider">
                              Notice #{idx + 1} • {notice.entity_id || notice.notice_id || "ID-RESERVED"}
                            </span>
                            <h6 className="font-extrabold text-slate-900 text-base mt-0.5 break-words">{notice.name}</h6>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Re-evaluate and delete match "${notice.name}" for candidate ${displayVerification.name}?`)) return;
                                try {
                                  const res = await fetch("/api/portal-data", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "delete_interpol_match",
                                      payload: {
                                        verificationId: displayVerification.id,
                                        matchIndex: idx,
                                        noticeId: notice.notice_id || notice.noticeId || notice.entity_id,
                                        reason: "Reevaluated as false positive match by Admin"
                                      }
                                    })
                                  });
                                  const json = await res.json();
                                  if (json.success) {
                                    alert("Match deleted successfully!");
                                    setDisplayVerification((prev: any) => prev ? {
                                      ...prev,
                                      interpolMatches: json.interpolMatches,
                                      interpolHasRecords: json.interpolHasRecords,
                                      status: json.status,
                                      notes: json.notes
                                    } : null);
                                    refreshData();
                                  } else {
                                    alert(json.error || "Failed to delete match");
                                  }
                                } catch (err: any) {
                                  alert("Error deleting match: " + err.message);
                                }
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-rose-600 hover:text-white text-rose-700 font-extrabold border border-rose-300 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Delete this match after re-evaluation"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              <span>Delete Match</span>
                            </button>
                          </div>
                        </div>

                        {((notice.nationalities || notice.details?.nationalities)) && (
                          <div className="mt-3 text-xs text-slate-600 font-bold flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Nationalities:</span>
                            <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-slate-800 font-mono text-[11px]">
                              {Array.isArray(notice.nationalities || notice.details?.nationalities) 
                                ? (notice.nationalities || notice.details?.nationalities).join(", ") 
                                : String(notice.nationalities || notice.details?.nationalities)}
                            </span>
                          </div>
                        )}

                        {(notice.charges || notice.warrants || (notice.details?.arrest_warrants && notice.details.arrest_warrants.length > 0)) && (
                          <div className="mt-3 bg-white/90 border border-rose-200/80 rounded-xl p-3.5 flex flex-col gap-1 shadow-2xs">
                            <span className="text-[9.5px] uppercase font-extrabold text-rose-700 tracking-wider font-mono flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">gavel</span>
                              Arrest Warrants / Charges:
                            </span>
                            <div className="text-xs text-slate-800 font-semibold leading-relaxed break-words">
                              {notice.details?.arrest_warrants && notice.details.arrest_warrants.length > 0 ? (
                                notice.details.arrest_warrants.map((w: any, wIdx: number) => (
                                  <div key={wIdx} className="mb-1 last:mb-0">
                                    {w.charge} {w.issuing_country_id && `(Issued by: ${w.issuing_country_id})`}
                                  </div>
                                ))
                              ) : (
                                notice.charges || notice.warrants
                              )}
                            </div>
                          </div>
                        )}

                        {notice.link && (
                          <div className="mt-3 pt-2">
                            <button
                              onClick={() => window.open(notice.link, "_blank")}
                              className="text-xs text-blue-700 hover:text-blue-900 font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <span>View Official Interpol Notice Page</span>
                              <span className="material-symbols-outlined text-sm">open_in_new</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Notes Section */}
            {displayVerification.notes && (
              <div className="mt-4">
                <span className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold block mb-1 select-none">Status Notes</span>
                <p className="text-rose-800 font-semibold pl-3 border-l-2 border-rose-400 text-xs italic">
                  {displayVerification.notes}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* DEFAULT DIGILOCKER WORKSPACE                             */
          /* ======================================================== */
          <div className="flex flex-col gap-6">
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 flex items-center gap-3.5">
              <span className="material-symbols-outlined text-emerald-500 text-2xl font-bold animate-bounce-subtle">
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

            <div className="flex items-start gap-4 p-1">
              {displayVerification.digilockerPhoto ? (
                <div className="w-20 h-24 bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/50 shrink-0 flex items-center justify-center shadow-sm">
                  <img
                    src={getPhotoSrc(displayVerification.digilockerPhoto)}
                    alt="Candidate Photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-1 pt-1">
                <h4 className="font-headline-md text-slate-900 font-extrabold text-xl leading-none">
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

            <div className="flex flex-col gap-3">
              <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 select-none">
                <span className="material-symbols-outlined text-sm">person</span>
                Personal Details
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {renderDetailField("Full Name", displayVerification.digilockerName, false, "badge")}
                {renderDetailField("Age", displayVerification.digilockerAge, false, "cake")}
                {renderDetailField("Gender", displayVerification.digilockerGender, false, "wc")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderDetailField("Date of Birth", displayVerification.digilockerDob, false, "calendar_today")}
                {renderDetailField("Mobile", displayVerification.digilockerMobile, false, "phone")}
              </div>
              <div className="grid grid-cols-1 gap-3">
                {renderDetailField("Email Address", displayVerification.digilockerEmail, false, "email")}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 select-none">
                <span className="material-symbols-outlined text-sm">description</span>
                Identity Documents
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {renderDetailField("Aadhaar Number", displayVerification.digilockerAadhaar, false, "fingerprint")}
                {renderDetailField("PAN Number", displayVerification.digilockerPan, true, "credit_card")}
                {renderDetailField("Driving Licence", displayVerification.digilockerDrivingLicence, true, "directions_car")}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 select-none">
                <span className="material-symbols-outlined text-sm">key</span>
                DigiLocker Identifiers
              </h5>
              <div className="grid grid-cols-1 gap-3">
                {renderDetailField("DigiLocker ID", displayVerification.digilockerId, true, "link")}
                {renderDetailField("Reference Key", displayVerification.digilockerReferenceKey, true, "vpn_key")}
              </div>
            </div>

            {displayVerification.digilockerDocuments && displayVerification.digilockerDocuments.length > 0 && (
              <div className="flex flex-col gap-3">
                <h5 className="font-label-caps text-slate-400 text-[10px] uppercase tracking-wider font-bold flex items-center gap-2 border-b border-slate-100 pb-1.5 select-none">
                  <span className="material-symbols-outlined text-sm">folder_open</span>
                  Verified Documents ({displayVerification.digilockerDocuments.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayVerification.digilockerDocuments.map((doc: any) => (
                    <div key={doc.id} className="p-4 bg-slate-50/50 border border-slate-200/50 rounded-2xl flex flex-col gap-1.5 hover:bg-slate-50 transition-colors shadow-2xs">
                      <span className="font-bold text-xs text-slate-800 leading-normal">{doc.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{doc.issuer}</span>
                      <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2">
                        <span className="text-[9px] font-mono text-slate-400 truncate max-w-[150px]">{doc.uri}</span>
                        <span className="text-[9px] bg-emerald-500/10 text-[#00450e] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">{doc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-8 h-8 border-2 border-[#016e1c] border-t-transparent rounded-full animate-spin"></div>
      <span className="font-body-sm text-slate-500 animate-pulse">Syncing verification workspace...</span>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<LoadingWorkspace />}>
      <WorkspaceContent />
    </Suspense>
  );
}
