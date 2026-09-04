"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import OzcluLogo from "../../components/OzcluLogo";

function MalaysiaCourtReportContent() {
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
        <div className="w-10 h-10 border-4 border-emerald-900 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">
          Generating Malaysia Court Check Report...
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

  const { verification, settings } = data;

  // If still searching
  if (verification.malaysiaCourtStatus === "searching") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-lg relative flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center bg-emerald-50 rounded-full border border-emerald-200">
            <svg
              className="w-12 h-12 text-emerald-700 animate-pulse"
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
            <h2 className="text-xl font-extrabold text-slate-800 font-sans">Malaysia Court Search In Progress</h2>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm">
              The official Mahkamah Persekutuan Malaysia (Portal eJudgment) database query is in progress. This
              normally resolves in a few moments.
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

  const reportNo = verification.id || "MYC-UNKNOWN";

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

  const generatedAtDate = verification.malaysiaCourtCompletedAt
    ? new Date(verification.malaysiaCourtCompletedAt).toLocaleString("en-GB", {
        timeZone: "Asia/Kuala_Lumpur",
        hour12: true,
      })
    : new Date().toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour12: true });

  const hasRecords = verification.malaysiaCourtHasRecords === true;
  const results = verification.malaysiaCourtResults || [];
  const totalFound = verification.malaysiaCourtTotalAvailable || results.length;

  const verdictBg = hasRecords ? "bg-rose-50 border-rose-200" : "bg-emerald-50/50 border-emerald-200";

  const courtCategoryNames: Record<string, string> = {
    "11": "Federal Court (Mahkamah Persekutuan)",
    "3": "Court of Appeal (Mahkamah Rayuan)",
    "2": "High Court (Mahkamah Tinggi)",
    "10": "Sessions Court (Mahkamah Sesyen)",
    "5": "Magistrate Court (Mahkamah Majistret)",
  };

  const caseTypeNames: Record<string, string> = {
    "7": "Appellate and Special Powers (Rayuan & Kuasa Khas)",
    "1": "Bankruptcy (Kebankrapan)",
    "9": "Caveat (Kaveat)",
    "3": "Civil (Sivil)",
    "8": "Commercial (Dagang)",
    "2": "Criminal (Jenayah)",
    "6": "Family (Keluarga)",
    "4": "Execution (Pelaksanaan)",
    "10": "Muamalat",
    "11": "Admiralty (Maritim)",
    "12": "Intellectual Property (Harta Intelek)",
    "13": "Coroners Court (Mahkamah Koroner)",
    "14": "Special Cyber Court (Mahkamah Siber)",
    "15": "Environmental Court (Mahkamah Alam Sekitar)",
  };

  return (
    <div className="min-h-screen bg-slate-100/60 py-10 px-4 sm:px-6 flex justify-center print:bg-white print:p-0">
      <div className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Top Accent Stripe */}
        <div className="h-2.5 bg-gradient-to-r from-emerald-800 via-teal-700 to-amber-600 print:h-2" />

        {/* Header Section */}
        <div className="p-8 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-b from-slate-50/70 to-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs p-1.5 shrink-0">
              <img src="/malaysia-court-logo.png" alt="Mahkamah Malaysia" className="h-11 w-11 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-black text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200">
                  Official Registry Search
                </span>
                <span className="text-xs font-semibold text-slate-400">Malaysia Jurisdiction</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 font-sans">
                Malaysia Court Record Check
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Mahkamah Persekutuan Malaysia • Portal eJudgment Judicial Registry
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end sm:text-right gap-1 self-stretch sm:self-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <div className="scale-90 origin-right">
              <OzcluLogo />
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              REPORT REF: <span className="font-bold text-slate-800">{reportNo}</span>
            </div>
            <div className="text-[10px] text-slate-400">Generated: {generatedAtDate} (MYT)</div>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div className="p-8 sm:p-10 border-b border-slate-100">
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
                      ? `ADVERSE COURT RECORD(S) IDENTIFIED (${totalFound} FOUND)`
                      : "NO ADVERSE MALAYSIAN COURT RECORDS FOUND"}
                  </div>
                  <p
                    className={`text-xs mt-1 leading-relaxed max-w-2xl font-medium ${
                      hasRecords ? "text-rose-700" : "text-emerald-800/90"
                    }`}
                  >
                    {hasRecords
                      ? `Official records in the Mahkamah Persekutuan Malaysia (Portal eJudgment) registry match the candidate's name or search criteria. Detailed grounds of judgment and court orders are listed below.`
                      : `A comprehensive live search of the official Mahkamah Persekutuan Malaysia (Portal eJudgment) database yielded zero matching adverse court judgments, grounds of judgment (GOJ), or penal legal orders for the specified search query.`}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <img src="/malaysia-court-logo.png" alt="Mahkamah Malaysia" className="h-9 w-9 object-contain hidden sm:block opacity-90 drop-shadow-xs" />
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase border shadow-sm ${
                    hasRecords
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : "bg-emerald-100 text-emerald-900 border-emerald-300"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${hasRecords ? "bg-rose-600 animate-ping" : "bg-emerald-600"}`}
                  />
                  {hasRecords ? "Records Identified" : "Clear Record"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Candidate & Search Audit Details */}
        <div className="p-8 sm:p-10 border-b border-slate-100 bg-slate-50/40">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Candidate & Search Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
              <span className="text-slate-400 font-semibold block text-[11px]">Subject / Candidate Name</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block truncate">
                {verification.name || "-"}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
              <span className="text-slate-400 font-semibold block text-[11px]">Target Jurisdiction</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {courtCategoryNames[verification.courtCategory] || "All Jurisdictions (Federal, Appeal, High, Sessions, Magistrate)"}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
              <span className="text-slate-400 font-semibold block text-[11px]">Case Type / Division</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                {caseTypeNames[verification.caseType] || "All Case Types"}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
              <span className="text-slate-400 font-semibold block text-[11px]">Court Location Filter</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                {verification.courtLocation || "All Malaysian Courts"}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
              <span className="text-slate-400 font-semibold block text-[11px]">Judge / Magistrate Filter</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                {verification.judgeName || "All Judges / Magistrates"}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs">
              <span className="text-slate-400 font-semibold block text-[11px]">Requesting Organisation</span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block truncate">
                {verification.requestingOrgName || verification.orgName || "Standard Client"}
              </span>
            </div>
          </div>
        </div>

        {/* Search Results Details */}
        <div className="p-8 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              Judicial Records Breakdown ({results.length} shown of {totalFound})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Source: ejudgment.kehakiman.gov.my</span>
          </div>

          {results.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Matching Court Records</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No judgments, Grounds of Judgment, criminal convictions, or court rulings were retrieved from the
                official database for this search criterion.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((rec: any, idx: number) => {
                const docs = rec.documents || [];
                return (
                  <div
                    key={idx}
                    className="border border-slate-200/90 rounded-xl p-5 bg-white shadow-xs hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-extrabold uppercase tracking-wide">
                            Case #{rec.no || idx + 1}
                          </span>
                          {rec.courtLevel && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                              {rec.courtLevel}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 mt-1 font-mono">{rec.caseNo}</h4>
                      </div>

                      <div className="flex flex-col sm:items-end text-xs text-slate-500">
                        <div>
                          <span className="text-slate-400">Decision Date:</span>{" "}
                          <span className="font-bold text-slate-800">{rec.dateOfResult || "-"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">GOJ Filing Date:</span>{" "}
                          <span className="font-bold text-slate-800">{rec.dateOfAP || "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                          Parties to Case
                        </span>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-800 whitespace-pre-line font-medium leading-relaxed max-h-48 overflow-y-auto">
                          {rec.parties || "Not specified"}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                          Presiding Judge & Subject
                        </span>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                          <div>
                            <span className="text-slate-400 text-[10px] uppercase block">Judge / Magistrate:</span>
                            <span className="font-bold text-slate-900">{rec.judge || "Not specified"}</span>
                          </div>
                          {rec.corumJudge && (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase block">Corum Panel:</span>
                              <span className="font-medium text-slate-800 text-[11px]">{rec.corumJudge}</span>
                            </div>
                          )}
                          {rec.keyword && (
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase block">Keywords / Statutes:</span>
                              <p className="text-slate-600 text-[11px] line-clamp-3 leading-tight">{rec.keyword}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {docs.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                        <span className="text-slate-400 text-[11px] font-semibold">
                          Attached Official Documents ({docs.length}):
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {docs.map((doc: any, dIdx: number) => (
                            <a
                              key={dIdx}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>{doc.docName || "Download Grounds of Judgment (PDF)"}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Official Footer / Certification Seal */}
        <div className="p-8 sm:p-10 border-t border-slate-200 bg-slate-50/70">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="max-w-xl text-[11px] text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700 block mb-1">Official Registry Disclaimer & Notice</span>
              This background verification was conducted via automated electronic interface with the public Portal
              eJudgment service of the Mahkamah Persekutuan Malaysia. Records reflect grounds of judgment, orders, and
              rulings filed by the courts of Malaysia up to the query timestamp. This report is issued for candidate
              screening and due diligence purposes in accordance with applicable data protection regulations.
            </div>

            <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/60 px-4 py-3 rounded-xl shrink-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-base">
                ✓
              </div>
              <div className="text-[11px]">
                <div className="font-extrabold text-emerald-950 uppercase tracking-wider">Tamper-Proof Audit</div>
                <div className="text-emerald-800/80 font-mono text-[10px]">ID: {reportNo}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 print:hidden">
            <span>Ozclu Candidate Verification Portal</span>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg cursor-pointer transition-colors text-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save PDF
              </button>
              <button
                onClick={() => window.close()}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors text-xs"
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

export default function MalaysiaCourtReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-emerald-900 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <MalaysiaCourtReportContent />
    </Suspense>
  );
}
