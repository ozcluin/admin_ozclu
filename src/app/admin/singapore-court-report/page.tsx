"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import OzcluLogo from "../../components/OzcluLogo";
import { isRecordFullNameMatch } from "src/lib/nameMatching";

function SingaporeCourtReportContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ verification: any; settings: any } | null>(null);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-10 h-10 border-4 border-sky-900 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">
          Generating Singapore Court Check Report...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">
          !
        </div>
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

  const { verification } = data;

  if (verification.singaporeCourtStatus === "searching") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-lg relative flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center bg-sky-50 rounded-full border border-sky-200">
            <svg
              className="w-12 h-12 text-sky-700 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.333A48.24 48.24 0 0012 9.75c-2.551 0-5.056.2-7.5.583V21"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold text-slate-800 font-sans">Singapore Court Search In Progress</h2>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm">
              The official Singapore Judiciary (Supreme Court, State Courts & Family Justice Courts) database query is in progress. This normally resolves in a few moments.
            </p>
          </div>
          <button
            onClick={() => window.close()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  const reportNo = verification.id || "SGC-UNKNOWN";

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return String(dateStr);
    }
  };

  const generatedAtDate = verification.singaporeCourtCompletedAt
    ? new Date(verification.singaporeCourtCompletedAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
      }).replace(/\u202f/g, " ").toLowerCase()
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase();

  const candidateName = verification.name || verification.candidateName || "";
  const rawResults = verification.singaporeCourtResults || [];
  // Ensure only records matching the candidate's strict full name are shown
  const results = rawResults.filter((rec: any) =>
    isRecordFullNameMatch(candidateName, [rec.title, rec.partiesSummary])
  );
  const hasRecords = results.length > 0;
  const totalFound = results.length;

  const verdictBg = hasRecords ? "bg-rose-50 border-rose-200" : "bg-emerald-50/50 border-emerald-200";

  return (
    <div className="min-h-screen bg-slate-100/60 py-10 px-4 sm:px-6 flex justify-center print:bg-white print:p-0">
      <div className="w-full max-w-[700px] bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Top Accent Stripe */}
        <div className="h-2.5 bg-gradient-to-r from-[#751C24] via-red-800 to-slate-900 print:h-2" />

        {/* Header Section */}
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
          {/* Header Top Row: Left Ozclu logo (smaller), Middle Court logo (smaller), Right Report Number */}
          <div className="flex items-center justify-between gap-4 mb-6 border-b-2 border-slate-100 pb-5">
            {/* Top Left: Ozclu Logo (smaller) */}
            <div className="flex justify-start items-center shrink-0 w-1/3">
              <OzcluLogo size="sm" />
            </div>

            {/* Top Middle: Court Logo (20% larger) */}
            <div className="flex justify-center items-center w-1/3 text-center">
              <img
                src="/singapore-court-logo.png"
                alt="Singapore Judiciary"
                className="h-10 sm:h-12 w-auto max-w-[240px] object-contain drop-shadow-xs"
              />
            </div>

            {/* Top Right: Report Number & Date */}
            <div className="flex justify-end items-center shrink-0 w-1/3">
              <div className="text-right text-[11px] sm:text-xs font-bold text-slate-800 space-y-0.5">
                <div>Report #: <span className="font-mono text-slate-900">{reportNo}</span></div>
                <div>Date: <span className="text-slate-900">{formatDate(verification.singaporeCourtCompletedAt || verification.date)}</span></div>
              </div>
            </div>
          </div>

          {/* Report Title */}
          <div className="flex flex-col items-center text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-sans uppercase">
              Singapore Court Check Report
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Republic of Singapore • The Judiciary (Supreme Court, State Courts & Family Justice Courts)
            </p>
          </div>

          {/* Metadata Card */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
            <div className="space-y-1.5">
              <div>Request Created: <span className="text-slate-900 font-mono">{verification.date}</span></div>
              <div>Search Status: <span className="font-bold text-emerald-600 uppercase">COMPLETED</span></div>
            </div>
            <div className="space-y-1.5 sm:text-right">
              <div>Generated At: <span className="text-slate-900 font-mono">{generatedAtDate} (IST)</span></div>
              <div>Verified By: <span className="text-slate-900 font-bold">Ozclu Verify</span></div>
            </div>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div className="p-6 sm:p-8 border-b border-slate-100">
          <div className={`border rounded-2xl p-6 relative overflow-hidden ${verdictBg}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    hasRecords ? "bg-rose-600 text-white" : "bg-emerald-700 text-white"
                  }`}
                >
                  {hasRecords ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
                    Verification Outcome
                  </div>
                  <div
                    className={`text-lg sm:text-xl font-black tracking-tight mt-0.5 ${
                      hasRecords ? "text-rose-900" : "text-emerald-950"
                    }`}
                  >
                    {hasRecords
                      ? `ACTIVE COURT HEARING RECORD(S) IDENTIFIED (${totalFound} FOUND)`
                      : "NO ACTIVE COURT HEARINGS OR ADVERSE CASES IDENTIFIED"}
                  </div>
                  <p
                    className={`text-xs mt-1 leading-relaxed max-w-2xl font-medium ${
                      hasRecords ? "text-rose-700" : "text-emerald-800/90"
                    }`}
                  >
                    {hasRecords
                      ? `Official records in the Singapore Judiciary Registry match candidate "${candidateName}". Hearing schedules, designated courts, assigned judicial officers, and counsel representations are detailed below.`
                      : `Candidate "${candidateName}" was verified across the official Singapore Judiciary hearing list gateway (Supreme Court, State Courts & Family Justice Courts). Zero matching hearings, trials, or adverse judicial proceedings were identified.`}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <img src="/singapore-court-logo.png" alt="Singapore Courts" className="h-11 w-11 object-contain hidden sm:block opacity-90 drop-shadow-xs" />
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${
                    hasRecords
                      ? "bg-rose-100 border-rose-300 text-rose-800"
                      : "bg-emerald-100 border-emerald-300 text-emerald-800"
                  }`}
                >
                  {hasRecords ? "RECORD IDENTIFIED" : "VERIFIED CLEAR"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Candidate Details & Search Parameters */}
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <div className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-700" />
                Candidate Details
              </div>
              <div className="space-y-1.5 text-xs bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs">
                <div><span className="text-slate-500 font-semibold">Full Name:</span> <span className="font-bold text-slate-800">{candidateName || "-"}</span></div>
                {verification.gender && verification.gender !== "Not Given" && verification.gender !== "Not Provided" && verification.gender !== "Not required" && (
                  <div><span className="text-slate-500 font-semibold">Gender:</span> <span className="font-semibold text-slate-800">{verification.gender}</span></div>
                )}
                <div><span className="text-slate-500 font-semibold">Date of Birth:</span> <span className="font-semibold text-slate-800">{verification.candidateDob || "Not Given"}</span></div>
                {verification.idProofType && verification.idProofType !== "Not Given" && verification.idProofType !== "Not Provided" && (
                  <div><span className="text-slate-500 font-semibold">ID Type:</span> <span className="font-semibold text-slate-800">{verification.idProofType}</span></div>
                )}
                {verification.idProofNumber && verification.idProofNumber !== "Not Given" && verification.idProofNumber !== "Not Provided" && (
                  <div><span className="text-slate-500 font-semibold">ID Number:</span> <span className="font-semibold text-slate-800">{verification.idProofNumber}</span></div>
                )}
                <div><span className="text-slate-500 font-semibold">Father&apos;s Name:</span> <span className="font-semibold text-slate-800">{verification.candidateFatherName || "Not Given"}</span></div>
                {verification.candidateMotherName && verification.candidateMotherName !== "Not Given" && verification.candidateMotherName !== "Not Provided" && (
                  <div><span className="text-slate-500 font-semibold">Mother&apos;s Name:</span> <span className="font-semibold text-slate-800">{verification.candidateMotherName}</span></div>
                )}
                {verification.candidateHusbandName && verification.candidateHusbandName !== "Not Given" && verification.candidateHusbandName !== "Not Provided" && (
                  <div><span className="text-slate-500 font-semibold">Husband&apos;s Name:</span> <span className="font-semibold text-slate-800">{verification.candidateHusbandName}</span></div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-700" />
                Search &amp; Query Details
              </div>
              <div className="space-y-1.5 text-xs bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs">
                <div><span className="text-slate-500 font-semibold">Jurisdiction Court:</span> <span className="font-bold text-slate-800">{verification.singaporeCourtSelectedCourt || "All Singapore Courts"}</span></div>
                <div><span className="text-slate-500 font-semibold">Hearing Type:</span> <span className="font-bold text-slate-800">{verification.singaporeCourtSelectedHearingType || "All Hearing Types"}</span></div>
                <div><span className="text-slate-500 font-semibold">Requesting Org:</span> <span className="font-bold text-slate-800">{verification.requestingOrgName || verification.orgName || "Standard Client"}</span></div>
                <div><span className="text-slate-500 font-semibold">Verification Source:</span> <span className="font-semibold text-slate-800">Singapore Judiciary</span></div>
                <div><span className="text-slate-500 font-semibold">Record Status:</span> <span className="font-bold text-slate-800">{hasRecords ? "Adverse Match" : "Verified Clear"}</span></div>
              </div>
            </div>
          </div>

          {/* Addresses Provided */}
          {verification.addresses && verification.addresses.length > 0 && (
            <div className="mt-6 print-avoid-break">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-700 mb-2">Addresses Provided</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5 border-r border-slate-200 w-12">#</th>
                      <th className="p-2.5 border-r border-slate-200">Address</th>
                      <th className="p-2.5 border-r border-slate-200">City</th>
                      <th className="p-2.5 border-r border-slate-200">State / Province</th>
                      <th className="p-2.5">Country</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 font-semibold">
                    {verification.addresses.map((addr: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2.5 border-r border-slate-200 bg-slate-50/50 text-center">{i + 1}</td>
                        <td className="p-2.5 border-r border-slate-200">{addr.address || "Not Given"}</td>
                        <td className="p-2.5 border-r border-slate-200 font-bold">{addr.city || "Not Given"}</td>
                        <td className="p-2.5 border-r border-slate-200">{addr.state || "Not Given"}</td>
                        <td className="p-2">{addr.country || "Singapore"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Case Records Section */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight font-sans">
                Judicial Hearing Dossier ({results.length} of {totalFound} Records Displayed)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Live extracts retrieved from Singapore Supreme Court, State Courts & Family Justice Courts registries
              </p>
            </div>
            {totalFound > 0 && (
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                Total Matches: {totalFound}
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <>{/* Clean — no records to display */}</>
          ) : (
            <div className="flex flex-col gap-5">
              {results.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-2xl p-6 bg-white shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                        #{rec.no || idx + 1}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {rec.caseNo}
                      </span>
                      {rec.hearingType && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-50 text-rose-800 border border-rose-200">
                          {rec.hearingType}
                        </span>
                      )}
                    </div>
                    {rec.hearingDate && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{rec.hearingDate}</span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 leading-snug mb-3">
                    {rec.title}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Court Venue & Chamber</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">
                        {rec.venue || "Republic of Singapore Courts"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Judge / Judicial Officer</span>
                      <span className="font-semibold text-slate-700 mt-0.5 block">
                        {rec.judge || "Not Specified in Public Notice"}
                      </span>
                    </div>

                    {rec.natureOfCase && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Nature of Case</span>
                        <span className="font-semibold text-slate-700 mt-0.5 block">
                          {rec.natureOfCase}
                        </span>
                      </div>
                    )}

                    {rec.lastUpdated && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Schedule Last Updated</span>
                        <span className="font-semibold text-slate-500 mt-0.5 block">
                          {rec.lastUpdated}
                        </span>
                      </div>
                    )}
                  </div>

                  {rec.partiesSummary && (
                    <div className="mt-3 p-3 bg-amber-50/40 border border-amber-200/50 rounded-xl text-xs">
                      <span className="text-[10px] uppercase font-bold text-amber-900 block mb-1">
                        Parties Involved & Legal Representation
                      </span>
                      <p className="text-slate-700 leading-relaxed text-[11px] whitespace-pre-wrap">
                        {rec.partiesSummary}
                      </p>
                    </div>
                  )}

                  {rec.fullDetailUrl && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end">
                      <a
                        href={rec.fullDetailUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs font-bold text-rose-900 hover:text-rose-700 flex items-center gap-1"
                      >
                        <span>View Official Singapore Hearing Notice</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legal Disclaimer & Compliance Footer */}
        <div className="p-6 sm:p-8 border-t border-slate-200/80 bg-slate-50/80 text-[11px] text-slate-500 leading-relaxed">
          <div className="flex items-center gap-2 font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Regulatory & Verification Notice</span>
          </div>
          <p>
            This judicial background verification report was generated via automated real-time queries against the public hearing lists published by the Singapore Judiciary (Supreme Court, State Courts, and Family Justice Courts). Hearing schedules are subject to change, rescheduling, or adjournment at the court&apos;s discretion. In accordance with the Administration of Justice (Protection) Act, proceedings held in chambers or in camera are not open to the public and may be restricted by law. This certificate serves as an informational background screening record as of the timestamp indicated.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-600">Digital Audit Trail Verified • Ozclu Verify Platform</span>
            </div>
            <div className="flex items-center gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={() => window.close()}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SingaporeCourtReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <SingaporeCourtReportContent />
    </Suspense>
  );
}
