"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import OzcluLogo from "../../components/OzcluLogo";

function SafliiCourtReportContent() {
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
        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">Generating South African Court Check Report...</span>
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

  // If still searching
  if (verification.safliiCourtStatus === "searching") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-lg relative flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center bg-amber-50 rounded-full border border-amber-200">
            <svg className="w-12 h-12 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold text-slate-800 font-sans">SAFLII Search In Progress</h2>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm">
              The South African court database search is currently in progress. This usually completes within a few minutes.
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

  const reportNo = verification.id || "SAF-UNKNOWN";

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

  const generatedAtDate = verification.safliiCourtCompletedAt
    ? new Date(verification.safliiCourtCompletedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase()
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase();

  const hasRecords = verification.safliiCourtHasRecords === true;
  const results = verification.safliiCourtResults || [];

  const verdictColor = hasRecords ? "text-rose-700" : "text-emerald-700";
  const verdictBg = hasRecords ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200";
  const verdictText = hasRecords
    ? `${results.length} Court Record(s) Found`
    : "No Court Records Found (Clear Record)";

  const maskDob = (dobStr?: string) => {
    if (!dobStr) return "xx/xx/xxxx";
    const yearMatch = dobStr.match(/\d{4}/);
    return yearMatch ? `xx/xx/${yearMatch[0]}` : dobStr;
  };

  // Map court code to full name
  const courtCodeMap: Record<string, string> = {
    ZACC: "Constitutional Court of South Africa",
    ZASCA: "Supreme Court of Appeal",
    ZAGPJHC: "Gauteng High Court, Johannesburg",
    ZAGPPHC: "Gauteng High Court, Pretoria",
    ZAWCHC: "Western Cape High Court",
    ZAKZDHC: "KwaZulu-Natal High Court, Durban",
    ZAKZPHC: "KwaZulu-Natal High Court, Pietermaritzburg",
    ZAECGHC: "Eastern Cape High Court, Grahamstown",
    ZAECMHC: "Eastern Cape High Court, Mthatha",
    ZAFSHC: "Free State High Court",
    ZANCHC: "Northern Cape High Court",
    ZAMNPHC: "Mpumalanga High Court",
    ZALBHC: "Limpopo High Court",
    ZANWHC: "North West High Court",
    ZALAC: "Labour Appeal Court",
    ZALCJHB: "Labour Court, Johannesburg",
    ZALCCPT: "Labour Court, Cape Town",
    ZAECPEHC: "Eastern Cape High Court, Port Elizabeth",
    BWHC: "Botswana High Court",
    ZWSC: "Zimbabwe Supreme Court",
    NAHC: "Namibia High Court",
    NASC: "Namibia Supreme Court",
  };

  const getCourtName = (code: string) => {
    if (!code) return "Unknown Court";
    return courtCodeMap[code] || code;
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
            border: 5px double #166534 !important;
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
          <span className="text-sm font-bold text-slate-800">South African Court Check Report</span>
          <span className="text-xs text-slate-500">Ready to save, print or review.</span>
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
      <div className="print-card w-full max-w-[800px] bg-white border-[6px] border-double border-[#166534] p-8 sm:p-10 shadow-lg relative my-0 mx-auto print:shadow-none print:p-8 print:max-w-full print:w-full">

        {/* Page Block */}
        <div className="print-page-block">
          {/* Header */}
          <div className="grid grid-cols-3 items-center gap-4 mb-8 border-b-2 border-slate-100 pb-6">
            <div className="flex justify-start">
              <div className="flex items-center gap-2">
                {settings && settings.logo ? (
                  <div className="w-28 h-14 sm:w-36 sm:h-16 flex items-center justify-start shrink-0">
                    <img src={settings.logo} alt="Company Logo" className="object-contain max-h-full max-w-full" />
                  </div>
                ) : (
                  <div className="w-24 h-12 sm:w-28 sm:h-14 flex items-center justify-start shrink-0">
                    <img src="/ozclu-logo-long-default.svg" alt="Ozclu Logo" className="object-contain max-h-full" />
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-center font-sans text-[#166534] text-lg sm:text-xl font-extrabold tracking-widest uppercase mt-2 leading-tight">
              SOUTH AFRICAN COURT<br />CHECK REPORT
            </h1>
            <div className="text-right text-[11px] sm:text-xs font-bold text-slate-800 space-y-0.5">
              <div>Report #: <span className="font-mono text-slate-900">{reportNo}</span></div>
              <div>Date: <span className="text-slate-900">{formatDate(verification.safliiCourtCompletedAt || verification.date)}</span></div>
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
                <span className="text-slate-500">Source Database:</span>
                <span className="font-bold text-[#166534]">SAFLII</span>
              </div>
            </div>
          </div>

          {/* Candidate & Request Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#166534] border-b border-slate-200 pb-1 mb-2">Candidate Details</h3>
              <div className="space-y-1.5 text-xs">
                <div><span className="text-slate-500 font-semibold">Full Name:</span> <span className="font-bold text-slate-800">{verification.name || "Unknown"}</span></div>
                <div><span className="text-slate-500 font-semibold">Date of Birth:</span> <span className="font-semibold text-slate-800">{maskDob(verification.candidateDob)}</span></div>
                <div><span className="text-slate-500 font-semibold">Place of Birth (City):</span> <span className="font-semibold text-slate-800">{verification.birthCity || "Not Provided"}</span></div>
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#166534] border-b border-slate-200 pb-1 mb-2">Request Details</h3>
              <div className="space-y-1.5 text-xs">
                <div><span className="text-slate-500 font-semibold">Requesting Org:</span> <span className="font-bold text-slate-800">{verification.requestingOrgName || verification.orgName}</span></div>
                <div><span className="text-slate-500 font-semibold">Client Org:</span> <span className="font-bold text-slate-800">{verification.orgName || verification.requestingOrgName || "Ozclu"}</span></div>
                <div><span className="text-slate-500 font-semibold">Jurisdiction:</span> <span className="font-bold text-slate-800">Southern Africa (SAFLII)</span></div>
              </div>
            </div>
          </div>

          {/* Overall Verdict Card */}
          <div className={`mb-8 p-6 border-2 rounded-xl ${verdictBg} print-avoid-break relative overflow-hidden`}>
            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-[#166534]">Status:</span>
                  <span className={`px-3 py-0.5 rounded-full font-extrabold text-xs tracking-wide uppercase ${hasRecords ? "bg-rose-700 text-white" : "bg-emerald-700 text-white"}`}>
                    {hasRecords ? "Records Found" : "Clear"}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 justify-center md:justify-start">
                  <span>Issued by:</span>
                  <span className="font-extrabold text-[#166534]">Ozclu Verify</span>
                </div>

                <p className="text-xs text-slate-700 font-semibold leading-relaxed max-w-[560px] mt-2 bg-white/80 p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                  {hasRecords
                    ? `The search query returned ${results.length} court record(s) from the SAFLII (Southern African Legal Information Institute) database matching or relating to the candidate name.`
                    : "The search query matched the candidate name against the SAFLII (Southern African Legal Information Institute) database covering court records from South Africa, Botswana, Zimbabwe, Namibia, and other Southern African jurisdictions. No matching court records were found."}
                </p>
              </div>

              <div className="shrink-0 flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-50 rounded-full border border-emerald-200">
                  <svg className="w-8 h-8 text-[#166534]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
                  </svg>
                </div>
                <span className="text-[9px] font-extrabold text-[#166534] uppercase tracking-wider mt-1">SAFLII Database</span>
              </div>
            </div>
          </div>

          {/* Certificate Display if CLEAN */}
          {!hasRecords && (
            <div className="mb-8 p-6 sm:p-8 border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/40 to-white rounded-2xl print-avoid-break relative overflow-hidden text-center shadow-xs">
              <h3 className="text-lg font-extrabold uppercase tracking-wide text-slate-900 mb-1">
                {verification.name || "CANDIDATE NAME"}
              </h3>

              <p className="text-xs text-slate-600 font-semibold mb-4">
                with Date of Birth <span className="font-bold text-slate-800">{verification.candidateDob || "Not Provided"}</span>.
              </p>

              <div className="my-6 max-w-[620px] mx-auto">
                <p className="text-xs text-slate-700 italic font-medium leading-relaxed bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                  &ldquo;The search query matched the candidate name against court records in the SAFLII (Southern African Legal Information Institute) database, which includes judgments and rulings from courts across South Africa, Botswana, Zimbabwe, Namibia, Lesotho, Swaziland, Mozambique, Malawi, Uganda, and other Southern African jurisdictions. No matching court records were found.&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-amber-200/70 pt-4 text-[10px] font-extrabold uppercase tracking-wider">
                <div className="text-emerald-700">STATUS: <span className="text-emerald-700 font-extrabold">CLEAR</span></div>
                <div className="text-slate-700">ISSUED BY: <span className="text-[#166534] font-extrabold">OZCLU VERIFY</span></div>
              </div>
            </div>
          )}

          {hasRecords && (
            /* Court Records List */
            <div className="space-y-6 mb-8 print-avoid-break">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#166534] mb-2 flex items-center gap-1.5">
                <span>SAFLII Court Record Matches</span>
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] rounded-md font-bold">{results.length} Record(s)</span>
              </h3>

              {results.map((record: any, index: number) => {
                return (
                  <div key={index} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all duration-300">
                    {/* Record Header Bar */}
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-rose-50 border border-rose-100 rounded-lg text-xs font-bold text-rose-700">
                          {index + 1}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 border rounded-lg uppercase tracking-wide bg-amber-100 text-amber-800 border-amber-200">
                          Court Record
                        </span>
                        {record.court && (
                          <span className="text-[10px] font-bold px-2 py-0.5 border rounded-lg bg-blue-50 text-blue-700 border-blue-200">
                            {record.court}
                          </span>
                        )}
                      </div>
                      {record.date && (
                        <span className="text-[10px] font-bold text-slate-500 font-mono">
                          Year: {record.date}
                        </span>
                      )}
                    </div>

                    {/* Record Details */}
                    <div className="p-4 space-y-2 text-xs font-semibold text-slate-700">
                      <div>
                        <span className="text-slate-500">Case Title:</span>{" "}
                        <span className="text-slate-900 font-bold">{record.caseTitle}</span>
                      </div>
                      {record.court && (
                        <div>
                          <span className="text-slate-500">Court:</span>{" "}
                          <span className="text-slate-900">{getCourtName(record.court)}</span>
                        </div>
                      )}
                      {record.citation && (
                        <div>
                          <span className="text-slate-500">Citation:</span>{" "}
                          <span className="text-slate-900 font-mono">{record.citation}</span>
                        </div>
                      )}
                      {record.snippet && (
                        <div className="mt-2 border border-slate-100 rounded-lg bg-slate-50/50 p-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Excerpt:</span>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{record.snippet}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-end pt-1">
                        {record.url && (
                          <button
                            onClick={() => window.open(record.url, "_blank")}
                            className="w-fit px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-all cursor-pointer text-[10px] inline-flex items-center gap-1"
                          >
                            <span>View Full Case on SAFLII</span>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer/Disclaimer */}
          <div className="border-t border-slate-200 pt-6 mt-8 text-[9px] sm:text-[10px] text-slate-500 leading-relaxed print-avoid-break print:mt-auto">
            <p className="font-bold uppercase tracking-wider mb-1 text-slate-700">Disclaimer & Data Limitations</p>
            <p className="font-semibold">
              This verification check is a database-level query matching the candidate name against publicly available court records published by the Southern African Legal Information Institute (SAFLII). SAFLII aggregates judgments and rulings from courts across South Africa, Botswana, Zimbabwe, Namibia, Lesotho, Swaziland, Mozambique, Malawi, Uganda, and other jurisdictions. This is a name-based text search and may return results for different individuals with similar names. Client discretion is advised. Clean results indicate no matching court records were found at the time of query.
            </p>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              <div>Verification ID: {reportNo}</div>
              <div>Powered by Ozclu Integrity Network</div>
            </div>
          </div>

        </div>

        {/* Appendix: ID Proof Attachment */}
        {(() => {
          const file = verification?.idProofFile;
          const fileName = verification?.idProofFileName || "ID Proof Attachment";
          if (!file) return null;
          return (
            <div className="print-page-block print-break-before mt-8 border-t border-slate-200 pt-6">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#166534] mb-4">
                Appendix: ID Proof Attachment
              </h3>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 print-avoid-break">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">
                    Attachment: {fileName}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">Submitted ID Proof</span>
                </div>
                <div className="flex justify-center bg-white border border-slate-200 rounded-lg p-2 overflow-hidden">
                  {file.startsWith("data:application/pdf") ? (
                    <iframe src={file} className="w-full h-[600px] border-0 rounded" title={fileName} />
                  ) : (
                    <img src={file} alt={fileName} className="object-contain max-h-[600px] w-full" />
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function SafliiCourtReport() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">Loading Report...</span>
      </div>
    }>
      <SafliiCourtReportContent />
    </Suspense>
  );
}
