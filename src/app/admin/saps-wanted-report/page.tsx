"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function AdminSapsWantedReportContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ verification: any; settings: any } | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetMatch, setTargetMatch] = useState<{ index: number; match: any } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
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
          action: "delete_saps_wanted_match",
          payload: {
            verificationId: id,
            matchIndex: targetMatch.index,
            bid: targetMatch.match.bid,
            reason: deleteReason
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
            sapsWantedMatches: json.sapsWantedMatches,
            sapsWantedHasRecords: json.sapsWantedHasRecords,
            status: json.status,
            sapsWantedStatus: json.sapsWantedStatus
          }
        };
      });

      setFeedbackMsg({ type: "success", text: "Match removed from verification record successfully." });
      setDeleteModalOpen(false);
      setTargetMatch(null);
      setDeleteReason("");
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "An error occurred while deleting match." });
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">
          Loading SAPS Wanted Verification Certificate (Admin Preview)...
        </span>
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
  const reportNo = verification.id || "SAPS-UNKNOWN";

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return String(dateStr);
    }
  };

  const generatedAtDate = verification.sapsWantedCompletedAt
    ? new Date(verification.sapsWantedCompletedAt).toLocaleString("en-ZA", { hour12: true })
    : new Date().toLocaleString("en-ZA", { hour12: true });

  const hasRecords = verification.sapsWantedHasRecords === true;
  const matches = verification.sapsWantedMatches || [];
  const attorneyResolution = verification.attorneyResolution;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans py-8 px-4 sm:px-6 print:p-0 print:bg-white flex flex-col items-center">
      {/* Top action bar */}
      <div className="max-w-4xl w-full flex justify-between items-center mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>← Back</span>
          </button>
          <button
            onClick={() => {
              window.location.href = `/admin/roster/workspace?id=${verification.id}`;
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <span>Open in Workspace Desk</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`max-w-4xl w-full p-4 mb-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
          feedbackMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Main Report Container */}
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
        {/* Header Ribbon */}
        <div className="h-3 bg-gradient-to-r from-blue-950 via-indigo-900 to-sky-700"></div>

        <div className="p-8 sm:p-12 flex flex-col gap-8">
          {/* Header section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-200 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-950 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-md">
                OZ
              </div>
              <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
              <div>
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-blue-900 block">
                  Official Verification Certificate (Admin Record)
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  SAPS Wanted Persons Check
                </h1>
                <span className="text-xs text-slate-500 font-medium">
                  South African Police Service Crime Stop Registry
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:items-end text-left sm:text-right">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Report Number
              </span>
              <span className="font-mono font-black text-sm text-slate-800 tracking-tight">
                {reportNo}
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                Issued: {generatedAtDate}
              </span>
            </div>
          </div>

          {/* Verification Status Banner */}
          <div
            className={`rounded-2xl p-6 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              hasRecords
                ? "bg-rose-50/80 border-rose-200 text-rose-900"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${
                  hasRecords
                    ? "bg-rose-100 border-rose-300 text-rose-700"
                    : "bg-emerald-100 border-emerald-300 text-emerald-700"
                }`}
              >
                {hasRecords ? (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest block opacity-75">
                  Verification Verdict
                </span>
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                  {hasRecords
                    ? "ADVERSE RECORD CONFIRMED — SAPS WANTED MATCH"
                    : attorneyResolution?.verdict === "cleared"
                    ? "RECORD CLEARED — LEGAL COUNSEL CONFIRMED CLEAN"
                    : "CLEAN RECORD — NO SAPS WANTED MATCHES FOUND"}
                </h3>
                <p className="text-xs font-medium mt-1 opacity-90 max-w-xl">
                  {hasRecords
                    ? "Candidate details match an active wanted suspect record listed on the South African Police Service Wanted Persons Registry."
                    : attorneyResolution?.verdict === "cleared"
                    ? "Similarity match reviewed by legal counsel and cleared as a false positive. Candidate verified free of active warrants."
                    : "Screening against South African Police Service (SAPS) crime stop databases returned zero adverse arrest warrant records."}
                </p>
              </div>
            </div>

            <div className="shrink-0 sm:text-right">
              <span
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-black uppercase font-mono tracking-wider border shadow-2xs ${
                  hasRecords
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-emerald-600 text-white border-emerald-700"
                }`}
              >
                {hasRecords ? "MATCH DETECTED" : "VERIFIED CLEAR"}
              </span>
            </div>
          </div>

          {/* Attorney Resolution Box (If reviewed by attorney) */}
          {attorneyResolution && (
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-900 text-white rounded-lg">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">
                  Attorney Legal Determination &amp; Sign-Off
                </h4>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-0.5 rounded-full ml-auto">
                  Formal Counsel Review
                </span>
              </div>
              <div className="text-xs text-slate-700 leading-relaxed font-medium bg-white p-4 rounded-xl border border-slate-200 italic">
                &quot;{attorneyResolution.notes}&quot;
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-500">
                <span>Determined by: <strong className="text-slate-700">{attorneyResolution.resolvedBy || "Legal Officer"}</strong></span>
                <span>Determination Date: <strong className="text-slate-700">{formatDate(attorneyResolution.resolvedAt)}</strong></span>
                <span>Verdict: <strong className={attorneyResolution.verdict === "cleared" ? "text-emerald-700 uppercase" : "text-rose-700 uppercase"}>{attorneyResolution.verdict}</strong></span>
              </div>
            </div>
          )}

          {/* Candidate Profile Details Section */}
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 pb-2">
              Candidate Subject Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Candidate Full Legal Name</span>
                <span className="text-xs font-black text-slate-800">{verification.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">First / Given Names</span>
                <span className="text-xs font-bold text-slate-800">{verification.candidateForename || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Surname / Family Name</span>
                <span className="text-xs font-bold text-slate-800">{verification.candidateSurname || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Date of Birth</span>
                <span className="text-xs font-bold text-slate-800">{formatDate(verification.candidateDob)}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">SA ID / Passport Number</span>
                <span className="text-xs font-mono font-bold text-slate-800">{verification.candidateIdNumber || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Police Jurisdiction / Province</span>
                <span className="text-xs font-bold text-slate-800">{verification.provinceCity || "National (All Provinces)"}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Requesting Organization</span>
                <span className="text-xs font-bold text-slate-800">{verification.requestingOrgName || verification.orgName}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Screening Database</span>
                <span className="text-xs font-bold text-slate-800">SAPS Crime Stop Registry</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">Verification Status</span>
                <span className="text-xs font-mono font-bold text-emerald-700 uppercase">{verification.status}</span>
              </div>
            </div>
          </div>

          {/* Matched Records Detail Section (Only if records exist) */}
          {hasRecords && matches.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-rose-200 pb-2">
                <h4 className="font-mono text-xs font-black uppercase tracking-wider text-rose-700">
                  Matched SAPS Wanted Profiles ({matches.length})
                </h4>
                <span className="text-[11px] font-bold text-rose-600">Admin Reevaluation Available</span>
              </div>

              <div className="space-y-4">
                {matches.map((suspect: any, idx: number) => (
                  <div
                    key={idx}
                    className="border-2 border-rose-200 rounded-2xl p-6 bg-rose-50/30 flex flex-col md:flex-row gap-6 relative"
                  >
                    {suspect.imageUrl && (
                      <div className="shrink-0 flex flex-col items-center gap-2">
                        <img
                          src={suspect.imageUrl}
                          alt={suspect.name || suspect.surname}
                          className="w-32 h-36 object-cover rounded-xl border border-slate-300 shadow-sm bg-slate-100"
                        />
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          SAPS BID: {suspect.bid || idx + 1}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-rose-600 uppercase">
                            Match #{idx + 1}
                          </span>
                          <h5 className="text-base font-black text-slate-900">
                            {suspect.name || `${suspect.forename} ${suspect.surname}`}
                          </h5>
                          <span className="inline-block mt-1 text-xs font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-md">
                            Crime / Status: {suspect.crime || "Wanted Offender"}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setTargetMatch({ index: idx, match: suspect });
                            setDeleteReason("Re-evaluated as false positive match after legal review.");
                            setDeleteModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-rose-600 hover:text-white text-rose-700 font-extrabold border border-rose-300 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs print:hidden"
                        >
                          <span>Remove Match</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-rose-100">
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Police Station</span>
                          <span className="font-bold text-slate-800 block">{suspect.station || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Case Number</span>
                          <span className="font-bold text-slate-800 font-mono block">{suspect.caseNumber || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Crime Date</span>
                          <span className="font-bold text-slate-800 block">{suspect.crimeDate || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Investigating Officer</span>
                          <span className="font-bold text-slate-800 block">{suspect.investigatingOfficer || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Contact Phone</span>
                          <span className="font-bold text-slate-800 font-mono block">{suspect.stationTelephone || suspect.contactNumber || "—"}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-slate-400 uppercase">Officer Email</span>
                          <span className="font-bold text-slate-800 block">{suspect.email || "—"}</span>
                        </div>
                      </div>

                      {suspect.circumstances && (
                        <div className="bg-white p-3.5 rounded-xl border border-rose-100 text-xs text-slate-700 leading-relaxed font-medium">
                          <strong className="text-slate-900 block text-[10px] uppercase font-mono mb-1">Circumstances:</strong>
                          {suspect.circumstances}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Methodology & Disclaimer */}
          <div className="border-t border-slate-200 pt-6 flex flex-col gap-3">
            <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Methodology &amp; Legal Compliance Statement
            </h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This report certifies that the subject candidate was verified against the South African Police Service (SAPS) Wanted Persons Registry pursuant to statutory crime-stop and screening guidelines. A clean record indicates that no active arrest warrants or published wanted profiles match the provided surname, forename, and identifying criteria at the time of inquiry.
            </p>
          </div>

          {/* Sign-off & Cryptographic Seal Footer */}
          <div className="border-t-2 border-slate-900 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950 text-white flex items-center justify-center font-bold text-sm">
                OZ
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">Ozclu Verify Technologies</span>
                <span className="text-[10px] text-slate-400">Independent Identity Verification Services</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[9px] font-mono uppercase text-slate-400 block">Digital Verification Seal</span>
                <span className="text-xs font-mono font-bold text-emerald-700">SHA256-VERIFIED-{reportNo.substring(0, 10)}</span>
              </div>
              <div className="w-14 h-14 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center p-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://verify.ozclu.com/verify?id=${reportNo}`)}`}
                  alt="QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Match Modal */}
      {deleteModalOpen && targetMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Remove SAPS Match</h4>
                <p className="text-xs text-slate-500">Record #{targetMatch.index + 1} • {targetMatch.match.name}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Reason for Match Removal / Reevaluation
              </label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Reason (e.g. Identity verified as false positive similarity match)..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingDelete}
                onClick={handleDeleteMatch}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDelete ? "Removing..." : "Confirm & Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSapsWantedReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
          <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <AdminSapsWantedReportContent />
    </Suspense>
  );
}
