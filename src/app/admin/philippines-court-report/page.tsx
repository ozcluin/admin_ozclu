"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import OzcluLogo from "../../components/OzcluLogo";
import { isRecordFullNameMatch } from "src/lib/nameMatching";

function PhilippinesCourtReportContent() {
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
        <div className="w-10 h-10 border-4 border-amber-900 border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">
          Generating Philippines Court of Appeals Report...
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

  if (verification.philippinesCourtStatus === "searching") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-lg relative flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center bg-amber-50 rounded-full border border-amber-200">
            <svg
              className="w-12 h-12 text-amber-800 animate-pulse"
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
            <h2 className="text-xl font-extrabold text-slate-800 font-sans">Philippines Court Search In Progress</h2>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed max-w-sm">
              The official Court of Appeals of the Philippines (Case Status Inquiry System 3.0) query is in progress across judicial stations. This normally resolves in a few moments.
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

  const reportNo = verification.id || "PHC-UNKNOWN";

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

  const generatedAtDate = verification.philippinesCourtCompletedAt
    ? new Date(verification.philippinesCourtCompletedAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
      }).replace(/\u202f/g, " ").toLowerCase()
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase();

  const candidateName = verification.name || verification.philippinesCourtPartyName || "";
  const isCaseNoSearch = !!(verification.philippinesCourtCaseNo && String(verification.philippinesCourtCaseNo).trim());
  const rawResults = verification.philippinesCourtResults || [];
  const results = isCaseNoSearch
    ? rawResults
    : rawResults.filter((rec: any) =>
        isRecordFullNameMatch(candidateName, [rec.caseTitle, rec.parties])
      );
  const hasRecords = results.length > 0;
  const totalFound = results.length;

  const stationLabel =
    verification.philippinesCourtStation === "mnl"
      ? "Court of Appeals Manila Station"
      : verification.philippinesCourtStation === "ceb"
      ? "Court of Appeals Visayas Station (Cebu City)"
      : verification.philippinesCourtStation === "cdo"
      ? "Court of Appeals Mindanao Station (Cagayan de Oro)"
      : "All Court of Appeals Stations (Manila, Visayas, Mindanao)";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-800 print:bg-white print:p-0">
      <div className="max-w-[700px] mx-auto bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {/* Certificate Header Banner */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 text-white px-8 py-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-8 pointer-events-none">
            {/* Background seal effect */}
            <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>

          <div className="relative z-10">
            {/* Top row: Logo left (smaller), Court Logo middle (smaller), Report Number right */}
            <div className="flex items-center justify-between gap-4 mb-6 border-b border-white/20 pb-5">
              {/* Top Left: Ozclu Logo (smaller) */}
              <div className="flex justify-start items-center shrink-0 w-1/3">
                <img src="/ozclu-logo-long-default.svg" alt="Ozclu Logo" className="h-8 sm:h-9 w-auto object-contain brightness-0 invert opacity-90" />
              </div>
              
              {/* Top Middle: Court Logo (20% larger) */}
              <div className="flex justify-center items-center w-1/3 text-center">
                <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20 inline-flex items-center justify-center">
                  <img
                    src="/philippines-court-logo.png"
                    alt="Court of Appeals Philippines Crest"
                    className="h-10 sm:h-12 w-auto object-contain drop-shadow"
                  />
                </div>
              </div>

              {/* Top Right: Report Number & Date */}
              <div className="flex justify-end items-center shrink-0 w-1/3">
                <div className="text-right text-[11px] sm:text-xs font-bold text-white/90 space-y-0.5">
                  <div>Report #: <span className="font-mono text-white">{reportNo}</span></div>
                  <div>Date: <span className="text-white/80">{formatDate(verification.philippinesCourtCompletedAt || verification.date)}</span></div>
                </div>
              </div>
            </div>

            {/* Centered Title */}
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] uppercase tracking-widest font-extrabold text-amber-300 block mb-1">
                Republic of the Philippines • Judiciary
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight uppercase">
                Philippines Court Check Report
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Case Status Inquiry System (CSIS 3.0) Verification
              </p>
            </div>

            {/* Metadata Card */}
            <div className="border border-white/20 rounded-xl p-5 bg-white/10 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-white/90 mt-6 text-left">
              <div className="space-y-1.5">
                <div>Request Created: <span className="text-white font-mono">{verification.date}</span></div>
                <div>Search Status: <span className="font-bold text-emerald-300 uppercase">COMPLETED</span></div>
              </div>
              <div className="space-y-1.5 sm:text-right">
                <div>Generated At: <span className="text-white font-mono">{generatedAtDate} (IST)</span></div>
                <div>Verified By: <span className="text-white font-bold">Ozclu Verify</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Summary Banner */}
        <div className="px-8 py-6 border-b border-slate-200">
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border ${
              hasRecords
                ? "bg-amber-50 border-amber-300 text-amber-950"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  hasRecords ? "bg-amber-600 text-white shadow-md shadow-amber-600/20" : "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                }`}
              >
                {hasRecords ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                  Automated Judicial Register Clearance
                </span>
                <h2 className="text-xl font-extrabold tracking-tight">
                  {hasRecords
                    ? `${totalFound} Court of Appeals Record(s) Identified`
                    : "NO ADVERSE COURT OF APPEALS RECORDS IDENTIFIED"}
                </h2>
                <p className="text-xs opacity-85 mt-0.5">
                  {hasRecords
                    ? `Official Court of Appeals docket records match candidate "${candidateName}" in the queried stations.`
                    : `Candidate "${candidateName}" was checked across Court of Appeals stations. Zero matching appeal records found.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                  hasRecords
                    ? "bg-amber-100 text-amber-900 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {hasRecords ? "Adverse Record Identified" : "VERIFIED CLEAR"}
              </span>
            </div>
          </div>
        </div>

        {/* Query & Subject Dossier Section */}
        {/* Candidate Details & Search Parameters */}
        <div className="px-8 py-6 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                Candidate Details
              </h3>
              <div className="space-y-1.5 text-xs bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                Screening Parameters &amp; Case Search
              </h3>
              <div className="space-y-1.5 text-xs bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
                <div><span className="text-slate-500 font-semibold">Station Jurisdiction:</span> <span className="font-bold text-slate-800">{stationLabel}</span></div>
                <div><span className="text-slate-500 font-semibold">Case / Query:</span> <span className="font-semibold text-slate-800">{verification.philippinesCourtCaseNo ? `Case No: ${verification.philippinesCourtCaseNo}` : "Party Name Search"}</span></div>
                <div><span className="text-slate-500 font-semibold">Requesting Org:</span> <span className="font-bold text-slate-800">{verification.requestingOrgName || verification.orgName}</span></div>
                <div><span className="text-slate-500 font-semibold">Record Status:</span> <span className="font-bold text-slate-800">{hasRecords ? "Adverse Record Identified" : "Verified Clear"}</span></div>
                <div><span className="text-slate-500 font-semibold">Database:</span> <span className="font-semibold text-slate-800">Court of Appeals (CSIS 3.0)</span></div>
              </div>
            </div>
          </div>

          {/* Addresses Provided */}
          {verification.addresses && verification.addresses.length > 0 && (
            <div className="mt-4 print-avoid-break">
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
                        <td className="p-2">{addr.country || "Philippines"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Judicial Records / Case Docket Table */}
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Appellate Case Records &amp; Decisions ({results.length})
            </h3>
            {hasRecords && (
              <span className="text-[11px] font-semibold text-slate-400">
                Official source: services.ca.judiciary.gov.ph
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <>{/* Clean — no records to display */}</>
          ) : (
            <div className="space-y-4">
              {results.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-amber-400 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-extrabold text-amber-800 text-base">
                        {rec.caseNo}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                        {rec.station || "MANILA"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                          rec.hasDecision
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-amber-50 text-amber-800 border-amber-300"
                        }`}
                      >
                        {rec.decisionStatus}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Case Title / Parties
                      </span>
                      <p className="font-bold text-slate-900 text-sm leading-relaxed">
                        {rec.caseTitle}
                      </p>
                    </div>

                    {rec.parties && rec.parties.length > 0 && (
                      <div className="pt-2 border-t border-slate-50 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                          Litigants:
                        </span>
                        {rec.parties.map((p: string, pIdx: number) => (
                          <span
                            key={pIdx}
                            className="bg-slate-100 text-slate-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-md"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legal Disclaimer & Verification Seal Footer */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Official Disclaimer &amp; Notice</span>
            <OzcluLogo size="sm" />
          </div>
          <p>
            The electronic content in this verification report is retrieved via real-time queries from the official microsite of the Republic of the Philippines Court of Appeals (Case Status Inquiry System 3.0 at services.ca.judiciary.gov.ph). The electronic content may contain computer-generated deviations from official printed court orders. In case of discrepancies between official print and electronic versions, the official print version held by the Clerk of Court prevails. Certified true copies of official court documents may be requested directly from the Court of Appeals. This certificate is intended for background screening and compliance review as of the query timestamp.
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

export default function PhilippinesCourtReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="w-8 h-8 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <PhilippinesCourtReportContent />
    </Suspense>
  );
}
