"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function AdminInterpolReportContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ verification: any; settings: any } | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetMatch, setTargetMatch] = useState<{ index: number; match: any } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteFromDb, setDeleteFromDb] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No Verification ID provided.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/portal-data/verification-detail?id=${id}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch verification details");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDeleteMatch = async () => {
    if (!targetMatch || !id) return;
    setIsSubmittingDelete(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/portal-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_interpol_match",
          payload: {
            verificationId: id,
            matchIndex: targetMatch.index,
            noticeId: targetMatch.match.noticeId || targetMatch.match.details?.entity_id,
            reason: deleteReason,
            deleteFromDatabase: deleteFromDb
          }
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to delete potential match");
      }

      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          verification: {
            ...prev.verification,
            interpolMatches: json.interpolMatches,
            interpolHasRecords: json.interpolHasRecords,
            status: json.status
          }
        };
      });

      setFeedbackMsg({
        type: "success",
        text: json.interpolHasRecords
          ? "Potential database match deleted successfully."
          : "Match deleted! Candidate record reevaluated and verified as CLEAN."
      });
      setDeleteModalOpen(false);
      setTargetMatch(null);
      setDeleteReason("");
      setDeleteFromDb(false);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Could not delete match" });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">Generating Interpol Report...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">!</div>
        <h2 className="text-lg font-bold text-slate-800 font-sans">Report Generation Failed</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md">{error || "Could not retrieve verification details."}</p>
        <button
          onClick={() => window.close()}
          className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs hover:bg-slate-700 cursor-pointer"
        >
          Close Window
        </button>
      </div>
    );
  }

  const { verification, settings } = data;
  const reportNo = verification.id || "INT-UNKNOWN";

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return String(dateStr);
    }
  };

  const generatedAtDate = verification.interpolCompletedAt
    ? new Date(verification.interpolCompletedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase()
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase();

  const hasRecords = verification.interpolHasRecords === true;
  const matches = verification.interpolMatches || [];

  const verdictColor = hasRecords ? "text-rose-700" : "text-emerald-700";
  const verdictBg = hasRecords ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200";
  const verdictText = hasRecords
    ? `${matches.length} Similarity Match(es) Found`
    : "No Similarity Matches Found (Clear Record)";

  const maskDob = (dobStr?: string) => {
    if (!dobStr) return "xx/xx/xxxx";
    const yearMatch = dobStr.match(/\d{4}/);
    return yearMatch ? `xx/xx/${yearMatch[0]}` : dobStr;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-[#181d16] print:bg-white print:p-0 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-start font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .print-page-block {
            border: 5px double #1e3a8a !important;
            padding: 22px 26px !important;
            margin-bottom: 0 !important;
            box-sizing: border-box !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            background: white !important;
            min-height: 265mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-card h1 {
            font-size: 16px !important;
            margin-bottom: 5px !important;
          }
          .print-card h2 {
            font-size: 17px !important;
          }
          .print-card h3 {
            font-size: 11px !important;
          }
          .print-card .grid {
            gap: 10px !important;
          }
          .print-card p, .print-card div, .print-card span {
            line-height: 1.45 !important;
          }
          .print-card .mb-8 {
            margin-bottom: 18px !important;
          }
          .print-card .mb-6 {
            margin-bottom: 12px !important;
          }
          .print-card .p-8, .print-card .p-6, .print-card .p-5 {
            padding: 12px !important;
          }
          .print-card .pb-6 {
            padding-bottom: 10px !important;
          }
          .print-card .pt-6 {
            padding-top: 10px !important;
          }
          .print-card .mt-8 {
            margin-top: 16px !important;
          }
          .print-card .gap-6 {
            gap: 11px !important;
          }
          .print-card .gap-4 {
            gap: 8px !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-break-before {
            break-before: page !important;
            page-break-before: always !important;
          }
        }
      `}</style>

      {/* Print Control Toolbar */}
      <div className="no-print print:hidden w-full max-w-[800px] bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800">Interpol Database Check Report</span>
          <span className="text-xs text-[#64748B]">Ready to save, print or review.</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#181d16] text-white rounded-lg font-bold text-xs hover:bg-[#1E293B] cursor-pointer shadow-xs transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Print Certificate</span>
          </button>
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-50 cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="print-card w-full max-w-[800px] bg-white border-[6px] border-double border-[#1e3a8a] p-8 sm:p-10 shadow-lg relative my-0 mx-auto print:shadow-none print:p-8 print:max-w-full print:w-full">
        
        {/* Page Block */}
        <div className="print-page-block">
          {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div className={`no-print print:hidden mb-6 p-4 rounded-xl text-xs font-bold flex items-center justify-between border shadow-xs animate-in fade-in ${
            feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
          }`}>
            <div className="flex items-center gap-2">
              <span>{feedbackMsg.text}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 cursor-pointer">&times;</button>
          </div>
        )}

        {/* Header */}
        <div className="grid grid-cols-3 items-center gap-4 mb-8 border-b-2 border-slate-100 pb-6">
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div className="w-24 h-12 sm:w-28 sm:h-14 flex items-center justify-start shrink-0">
                <img src="/ozclu-logo-long-default.svg" alt="Ozclu Logo" className="object-contain max-h-full" />
              </div>
              {settings && settings.logo && (
                <>
                  <div className="h-8 w-[1px] bg-slate-300 self-center mx-1 shrink-0" />
                  <div className="w-20 h-10 sm:w-24 sm:h-12 flex items-center justify-start shrink-0">
                    <img src={settings.logo} alt="Client Logo" className="object-contain max-h-full max-w-full" />
                  </div>
                </>
              )}
            </div>
          </div>
          <h1 className="text-center font-sans text-[#1e3a8a] text-lg sm:text-xl font-extrabold tracking-widest uppercase mt-2 leading-tight">
            INTERPOL DATABASE<br />CHECK REPORT
          </h1>
          <div className="text-right text-[11px] sm:text-xs font-bold text-slate-800 space-y-0.5">
            <div>Report #: <span className="font-mono text-slate-900">{reportNo}</span></div>
            <div>Date: <span className="text-slate-900">{formatDate(verification.interpolCompletedAt || verification.date)}</span></div>
          </div>
        </div>

        {/* Metadata Card */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700 mb-6">
          <div className="space-y-1.5">
            <div>Report Number: <span className="font-mono font-bold text-slate-900">{reportNo}</span></div>
            <div>Request Created: <span className="text-slate-900 font-mono">{verification.date}</span></div>
            <div>Search Status: <span className="font-bold text-emerald-600 uppercase">COMPLETED</span></div>
          </div>
          <div className="space-y-1.5 sm:text-right">
            <div>Generated At: <span className="text-slate-900 font-mono">{generatedAtDate}</span></div>
            <div>Verified By: <span className="text-slate-900 font-bold">Ozclu Verify</span></div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <span className="text-slate-500">Verified Through:</span>
              <img src="/Notice-removebg-preview.png" alt="Notice Authority" className="h-6 object-contain" />
            </div>
          </div>
        </div>

        {/* Candidate & Request Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#1e3a8a] border-b border-slate-200 pb-1 mb-2">Candidate Details</h3>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-slate-500 font-semibold">Full Name:</span> <span className="font-bold text-slate-800">{verification.name || "Suresh Kumar"}</span></div>
              <div><span className="text-slate-500 font-semibold">Date of Birth:</span> <span className="font-semibold text-slate-800">{maskDob(verification.candidateDob || "13 Jun 2000")}</span></div>
              <div><span className="text-slate-500 font-semibold">Place of Birth (City):</span> <span className="font-semibold text-slate-800">{verification.birthCity || "Not Provided"}</span></div>
            </div>
          </div>
          <div>
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#1e3a8a] border-b border-slate-200 pb-1 mb-2">Request Details</h3>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-slate-500 font-semibold">Requesting Org:</span> <span className="font-bold text-slate-800">{verification.requestingOrgName || verification.orgName}</span></div>
              <div><span className="text-slate-500 font-semibold">Client Org:</span> <span className="font-bold text-slate-800">{verification.orgName || verification.requestingOrgName || "Ozclu"}</span></div>
            </div>
          </div>
        </div>

        {/* Overall Verdict Card */}
        <div className={`mb-8 p-6 border-2 rounded-xl ${verdictBg} print-avoid-break relative overflow-hidden`}>
          <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="space-y-2 text-center md:text-left flex-1">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <span className="text-xs uppercase font-extrabold tracking-wider text-[#1e3a8a]">Status:</span>
                <span className={`px-3 py-0.5 rounded-full font-extrabold text-xs tracking-wide uppercase ${hasRecords ? "bg-rose-700 text-white" : "bg-emerald-700 text-white"}`}>
                  {hasRecords ? "Failed" : "Passed"}
                </span>
              </div>
              
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-center md:justify-start">
                <span>Issued by:</span>
                <span className="font-extrabold text-[#1e3a8a]">Ozclu Verify</span>
              </div>

              <p className="text-xs text-slate-700 font-semibold leading-relaxed max-w-[560px] mt-2 bg-white/80 p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                {hasRecords
                  ? "Similarity matches or notices were detected in the database check query."
                  : "The check query matched the candidate details against records consisting of Central Bureau of Investigation (CBI) Announced Rewards lists, Interpol Red Notices, and Interpol Yellow Notices. No similarity matches or notices were detected."}
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <img src="/Notice-removebg-preview.png" alt="Notice Authority" className="h-14 object-contain" />
              <span className="text-[9px] font-extrabold text-[#1e3a8a] uppercase tracking-wider mt-1">Verified Authority</span>
            </div>
          </div>
        </div>

        {/* Certificate Display if CLEAN */}
        {!hasRecords && (
          <div className="mb-8 p-6 sm:p-8 border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/40 to-white rounded-2xl print-avoid-break relative overflow-hidden text-center shadow-xs">
            <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-900 mb-1">
              {verification.name || "SURESH KUMAR"}
            </h3>

            <p className="text-xs text-slate-600 font-semibold mb-4">
              with Date of Birth <span className="font-bold text-slate-800">{verification.candidateDob || "13 Jun 2000"}</span>.
            </p>

            <div className="my-6 max-w-[620px] mx-auto">
              <p className="text-xs text-slate-700 italic font-medium leading-relaxed bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                &ldquo;The check query matched the candidate details against records consisting of Central Bureau of Investigation (CBI) Announced Rewards lists, Interpol Red Notices, and Interpol Yellow Notices. No similarity matches or notices were detected.&rdquo;
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-amber-200/70 pt-4 text-[10px] font-extrabold uppercase tracking-wider">
              <div className="text-emerald-700">STATUS: <span className="text-emerald-700 font-extrabold">PASSED</span></div>
              <div className="text-slate-700">ISSUED BY: <span className="text-[#1e3a8a] font-extrabold">OZCLU VERIFY</span></div>
            </div>
          </div>
        )}

        {hasRecords && (
          /* Notice List Display if MATCHES FOUND */
          <div className="space-y-6 mb-8 print-avoid-break">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#1e3a8a] mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>Potential Database Match Details</span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] rounded-md font-bold">{matches.length} Record(s)</span>
              </div>
              <span className="no-print print:hidden text-[10px] text-rose-600 font-bold">
                [Admin Mode: Click &ldquo;Delete Match&rdquo; to re-evaluate false positives]
              </span>
            </h3>
            
            {matches.map((match: any, index: number) => {
              const noticeTypeLabel = match.noticeType === "red_notice" 
                ? "Interpol Red Notice" 
                : match.noticeType === "yellow_notice" 
                ? "Interpol Yellow Notice" 
                : "CBI Announced Reward";

              const typeBadgeColor = match.noticeType === "red_notice"
                ? "bg-rose-100 text-rose-800 border-rose-200"
                : match.noticeType === "yellow_notice"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-blue-100 text-blue-800 border-blue-200";

              return (
                <div key={index} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300">
                  {/* Match Header Bar */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-rose-50 border border-rose-100 rounded-lg text-xs font-bold text-rose-700">
                        {index + 1}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-lg uppercase tracking-wide ${typeBadgeColor}`}>
                        {noticeTypeLabel}
                      </span>
                    </div>
                    {match.noticeId && (
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        ID: {match.noticeId}
                      </span>
                    )}
                  </div>

                  {/* Match Details Grid */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                    <div className="space-y-1.5">
                      <div>Name in notice: <span className="text-slate-900 font-bold uppercase">{typeof match.name === "string" ? match.name : String(match.name || "")}</span></div>
                      <div>Date of Birth: <span className="text-slate-900 font-mono">{typeof match.dateOfBirth === "string" ? match.dateOfBirth : String(match.dateOfBirth || "Not Specified")}</span></div>
                      {match.placeOfBirth && typeof match.placeOfBirth === "string" && (
                        <div>Place of Birth / Address: <span className="text-slate-900">{match.placeOfBirth}</span></div>
                      )}
                    </div>
                    <div className="space-y-1.5 flex flex-col sm:flex-row gap-2 justify-between sm:items-end">
                      <button
                        onClick={() => {
                          setTargetMatch({ index, match });
                          setDeleteReason("DOB/Address mismatch upon candidate detail verification by Admin. Confirmed false positive match.");
                          setDeleteModalOpen(true);
                        }}
                        className="no-print print:hidden w-fit px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg transition-all cursor-pointer text-[10px] inline-flex items-center gap-1.5 shadow-xs"
                        title="Re-evaluate and delete this potential database match"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Match (Re-evaluate)</span>
                      </button>
                      {match.link && (
                        <button
                          onClick={() => window.open(match.link, "_blank")}
                          className="w-fit px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-all cursor-pointer text-[10px] inline-flex items-center gap-1"
                        >
                          <span>View Official Notice</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Charges Box */}
                  {match.details?.arrest_warrants && match.details.arrest_warrants.length > 0 && (
                    <div className="px-4 pb-4">
                      <div className="border border-rose-100 rounded-lg bg-rose-50/20 p-3">
                        <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block mb-1">Arrest Warrant Charges:</span>
                        <p className="text-xs text-rose-950 font-medium whitespace-pre-line leading-relaxed">
                          {match.details.arrest_warrants.map((w: any) => typeof w.charge === "string" ? w.charge : JSON.stringify(w.charge || "")).join("\n")}
                        </p>
                      </div>
                    </div>
                  )}

                  {match.details?.details && typeof match.details.details === "string" && match.details.details.trim() !== "" && (
                    <div className="px-4 pb-4">
                      <div className="border border-blue-100 rounded-lg bg-blue-50/10 p-3">
                        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Case Details:</span>
                        <p className="text-xs text-blue-950 font-medium leading-relaxed">
                          {match.details.details}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer/Disclaimer */}
        <div className="border-t border-slate-200 pt-6 mt-8 text-[9px] sm:text-[10px] text-slate-500 leading-relaxed print-avoid-break print:mt-auto">
          <p className="font-bold uppercase tracking-wider mb-1 text-slate-700">Disclaimer & Data Limitations</p>
          <p className="font-semibold">
            This verification check is a database-level query matching candidate details against publicly available notifications issued by the CBI and Interpol, as compiled on July 20, 2026. This search does not constitute an active physical or biometric verification. False positives may occur due to similar name phonetics or name sequences; client discretion is advised. Clean results indicate no matching notice records were found at the time of query.
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <div>Verification ID: {reportNo}</div>
            <div>Powered by Ozclu Integrity Network</div>
          </div>
        </div>

        </div>
      </div>

      {/* Re-evaluation & Deletion Modal */}
      {deleteModalOpen && targetMatch && (
        <div className="no-print print:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center font-bold text-sm">
                  !
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Admin Re-evaluate & Delete Match</h3>
              </div>
              <button
                onClick={() => { setDeleteModalOpen(false); setTargetMatch(null); }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p className="font-medium">
                You are re-evaluating and deleting this potential database match for candidate <strong className="text-slate-900">{verification.name}</strong>:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-[11px] text-slate-800 space-y-1">
                <div><strong className="font-sans text-slate-500">Notice ID:</strong> {targetMatch.match.noticeId || targetMatch.match.details?.entity_id || "N/A"}</div>
                <div><strong className="font-sans text-slate-500">Name in Notice:</strong> <span className="uppercase font-bold">{targetMatch.match.name}</span></div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Re-evaluation Reason / Notes
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                placeholder="Enter re-evaluation justification..."
              />
            </div>

            <div className="flex items-start gap-2 bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
              <input
                type="checkbox"
                id="deleteFromDb"
                checked={deleteFromDb}
                onChange={(e) => setDeleteFromDb(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
              />
              <label htmlFor="deleteFromDb" className="text-[11px] text-slate-700 font-medium cursor-pointer leading-tight">
                <strong>Remove notice from database:</strong> Permanently remove this notice record from system database collection so it won&apos;t match future checks.
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => { setDeleteModalOpen(false); setTargetMatch(null); }}
                disabled={isSubmittingDelete}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMatch}
                disabled={isSubmittingDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              >
                {isSubmittingDelete ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Confirm & Delete Match</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminInterpolReport() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">Loading Admin Report...</span>
      </div>
    }>
      <AdminInterpolReportContent />
    </Suspense>
  );
}
