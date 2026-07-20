"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function EmploymentReportContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ verification: any; settings: any } | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No Verification ID provided in search query.");
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
        setError(err.message || "An unexpected error occurred while loading the report.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6">
        <div className="w-10 h-10 border-4 border-[#00450e] border-t-transparent rounded-full animate-spin"></div>
        <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">Generating Report...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-lg mb-4">!</div>
        <h2 className="text-lg font-bold text-slate-800">Report Generation Failed</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md">{error || "Could not retrieve verification detail record."}</p>
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
  const reportNo = verification.id ? verification.id.replace("REQ-", "RPT-").replace("EMP-", "RPT-") : "RPT-UNKNOWN";

  // Format Date functions
  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" });
    } catch {
      return String(dateStr);
    }
  };

  const generatedAtDate = verification.completedAt 
    ? new Date(verification.completedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase()
    : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }).replace(/\u202f/g, " ").toLowerCase();

  const generatedBy = verification.verifier || "indiaops@ozclu.com";

  const isVerified = verification.status === "Completed" || verification.status === "Verified";
  const isDiscrepancy = verification.status === "Needs Attention" || verification.status === "Discrepancy";

  const statusColor = isVerified
    ? "text-emerald-600"
    : isDiscrepancy
    ? "text-rose-600"
    : "text-amber-500";

  const verdictColor = isVerified
    ? "text-emerald-700"
    : isDiscrepancy
    ? "text-rose-700"
    : "text-amber-700";

  const verdictBg = isVerified
    ? "bg-emerald-50 border-emerald-200"
    : isDiscrepancy
    ? "bg-rose-50 border-rose-200"
    : "bg-amber-50 border-amber-200";

  const verdictText = isVerified
    ? "VERIFIED / COMPLETED"
    : isDiscrepancy
    ? "DISCREPANCY DETECTED"
    : "IN PROGRESS";

  const emp = verification.employmentData || {};
  const attempts = verification.employmentAttempts || [];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 print:bg-white print:p-0 p-4 sm:p-6 md:p-8 flex flex-col items-center print:block">
      {/* Repeating Fixed Border on Every Printed Page */}
      <div className="hidden print:block fixed inset-0 border-[6px] border-double border-[#00450e] pointer-events-none z-50" />
      
      {/* Print Control Toolbar */}
      <div className="no-print print:hidden w-full max-w-[800px] bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800">Employment Verification Report</span>
          <span className="text-xs text-slate-500">Ready to save or print on standard A4 paper size.</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00450e] text-white rounded-lg font-bold text-xs hover:bg-[#00300a] cursor-pointer shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Print Report</span>
          </button>
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-50 cursor-pointer transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="print-border w-full max-w-[800px] bg-white border-[6px] border-double border-[#00450e] print:border-0 p-8 sm:p-10 shadow-lg relative print:shadow-none print:my-0 print:mx-auto print:p-8">
        
        {/* Top Header */}
        <div className="grid grid-cols-3 items-center gap-4 mb-8">
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
          <h1 className="text-center font-sans text-[#00450e] text-lg sm:text-xl font-extrabold tracking-widest uppercase mt-2">EMPLOYMENT<br />REPORT</h1>
          <div className="text-right text-[11px] sm:text-xs font-bold text-slate-800 space-y-0.5">
            <div>Report #: <span className="font-mono text-slate-900">{reportNo}</span></div>
            <div>Date: <span className="text-slate-900">{formatDate(verification.completedAt || verification.date)}</span></div>
          </div>
        </div>

        {/* Boxed Metadata Card */}
        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-700 mb-6">
          <div className="space-y-1.5">
            <div>Report Number: <span className="font-mono font-bold text-slate-900">{reportNo}</span></div>
            <div>Request Created: <span className="text-slate-900 font-mono">{verification.date}</span></div>
            <div>
              Overall Status:{" "}
              <span className={`font-bold uppercase ${statusColor}`}>
                {verification.status}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 sm:text-right">
            <div>Generated At: <span className="text-slate-900 font-mono">{generatedAtDate}</span></div>
            <div>Generated By: <span className="text-slate-900">{generatedBy}</span></div>
          </div>
        </div>

        {/* Candidate & Company Details Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#00450e] border-b border-slate-200 pb-1 mb-2">Candidate Details</h3>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-slate-500 font-semibold">Name:</span> <span className="font-bold text-slate-800">{verification.name}</span></div>
              <div><span className="text-slate-500 font-semibold">Email:</span> <span className="font-semibold text-slate-800">{verification.email}</span></div>
              {verification.candidateMobile && <div><span className="text-slate-500 font-semibold">Mobile:</span> <span className="font-semibold text-slate-800">{verification.candidateMobile}</span></div>}
            </div>
          </div>
          <div>
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#00450e] border-b border-slate-200 pb-1 mb-2">Company Details</h3>
            <div className="space-y-1.5 text-xs">
              <div><span className="text-slate-500 font-semibold">Client Company:</span> <span className="font-bold text-slate-800">{verification.requestingOrgName || verification.orgName}</span></div>
              <div><span className="text-slate-500 font-semibold">Email:</span> <span className="font-semibold text-slate-800">{settings?.contactEmail || "contact@company.com"}</span></div>
            </div>
          </div>
        </div>

        {/* Overall Verdict Banner */}
        <div className={`mb-8 p-5 border-2 rounded-xl ${verdictBg} print-avoid-break`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#00450e] mb-1">Overall Verification Verdict</h3>
              <p className={`text-lg font-extrabold ${verdictColor}`}>{verdictText}</p>
              <p className="text-xs text-slate-600 mt-1 font-semibold">
                Completed manual & field checks with {attempts.length} attempts logged
              </p>
              <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed max-w-[480px]">
                This report is generated through a rigorous background check involving manual, email, and/or physical site verification to confirm the candidate's employment credentials against original organizational records.
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-0.5 bg-white border border-slate-200/80 p-3 rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-[#00450e] text-3xl">verified_user</span>
              <span className="text-[8px] font-extrabold uppercase text-[#00450e] tracking-wider mt-1">Secured</span>
            </div>
          </div>
        </div>

        {/* Employment Information Table */}
        <div className="mb-8 print-avoid-break">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#00450e] mb-2">Candidate Submitted Employment Details</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 border-r border-slate-200 w-1/2">Field</th>
                  <th className="p-2.5">Response Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-semibold">
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Company Name</td>
                  <td className="p-2.5 font-bold text-slate-900">{emp.companyName || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Department</td>
                  <td className="p-2.5">{emp.department || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Position / Designation</td>
                  <td className="p-2.5">{emp.position || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Location</td>
                  <td className="p-2.5">{[emp.city, emp.state, emp.country].filter(Boolean).join(", ") || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Employment Period</td>
                  <td className="p-2.5">{emp.employmentPeriodFrom || "-"} to {emp.employmentPeriodTo || "Present"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Employee Code</td>
                  <td className="p-2.5 font-mono">{emp.employeeCode || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Reporting Manager</td>
                  <td className="p-2.5">{emp.reportingManagerName ? `${emp.reportingManagerName} (${emp.reportingManagerDepartment || "N/A"})` : "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Manager Contact</td>
                  <td className="p-2.5">{[emp.reportingManagerEmail, emp.reportingManagerContact ? `${emp.reportingManagerContactCode || ""} ${emp.reportingManagerContact}` : null].filter(Boolean).join(" / ") || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Annual CTC</td>
                  <td className="p-2.5 font-mono">{emp.annualCTC || "-"}</td>
                </tr>
                <tr>
                  <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Employment Type</td>
                  <td className="p-2.5">{emp.employmentType || "-"} {emp.agencyDetails ? `(Agency: ${emp.agencyDetails})` : ""}</td>
                </tr>
                {emp.reasonForLeaving && (
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Reason for Leaving</td>
                    <td className="p-2.5 text-slate-700 font-normal">{emp.reasonForLeaving}</td>
                  </tr>
                )}
                {emp.remarks && (
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 bg-slate-50/50">Candidate Remarks</td>
                    <td className="p-2.5 italic font-normal text-slate-500">{emp.remarks}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Status & History Timeline */}
        <div className="mb-8 print-break-before">
          <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#00450e] border-b border-slate-200 pb-1 mb-3">Employment Verification Summary</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold text-slate-800">Verification Result Log History</span>
                <span className="text-xs text-slate-500 font-semibold">
                  Overall Verdict: <span className={`font-bold ${statusColor}`}>{verification.status}</span>
                </span>
              </div>

              {/* Audit Attempt History Log */}
              <div className="print-avoid-break">
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5 border-r border-slate-200 w-1/4">Date &amp; Time</th>
                        <th className="p-2.5 border-r border-slate-200 w-1/6">Status</th>
                        <th className="p-2.5 border-r border-slate-200 w-1/6">Mode</th>
                        <th className="p-2.5">Attempt Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800 font-semibold bg-white">
                      {attempts && attempts.length > 0 ? (
                        attempts.map((att: any, idx: number) => {
                          const attOutcome = att.result || att.status || "In Progress";
                          return (
                            <tr key={idx} className="hover:bg-slate-50/30">
                              <td className="p-2.5 border-r border-slate-200 font-mono text-[10px] bg-slate-50/30">{att.date}</td>
                              <td className="p-2.5 border-r border-slate-200">
                                <span className={`inline-block font-bold px-1.5 py-0.5 rounded text-[8px] uppercase border ${
                                  attOutcome === "Verified" || attOutcome === "Completed"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : attOutcome === "In Progress" || attOutcome === "Processing"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                  {attOutcome}
                                </span>
                              </td>
                              <td className="p-2.5 border-r border-slate-200 font-medium text-slate-700 capitalize">{att.verificationMode || "Manual"}</td>
                              <td className="p-2.5 text-[10px] text-slate-665 font-medium leading-normal">
                                {att.comment && <div className="font-bold text-slate-800">Comment: {att.comment}</div>}
                                {att.verifierNote && <div className="text-slate-500 italic mt-0.5">Note: {att.verifierNote}</div>}
                                {att.respondentName && <div className="mt-1">Respondent: {att.respondentName} {att.respondentEmail ? `(${att.respondentEmail})` : ""}</div>}
                                {att.respondentComment && <div className="italic text-slate-500">Respondent Comment: "{att.respondentComment}"</div>}
                                <div className="text-[9px] text-slate-400 mt-1">Logged by: {att.loggedBy || "indiaops@ozclu.com"}</div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400">No attempts logged in timeline.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Double Sign-off Section */}
        <div className="flex justify-between items-center my-10 px-4 text-xs font-bold text-slate-700 print-avoid-break">
          <div className="text-center">
            <div className="border-b border-slate-300 w-40 sm:w-44 pb-1 mb-1 font-semibold italic text-slate-900 min-h-[24px] flex items-center justify-center">
              {attempts.length > 0 ? (attempts[attempts.length - 1].loggedBy || generatedBy) : generatedBy}
            </div>
            <div>Verifier Signature</div>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-300 w-40 sm:w-44 pb-1 mb-1 font-semibold italic text-[#00450e] min-h-[24px] flex items-center justify-center">
              {isVerified ? "VERIFIED" : "UNDER VERIFICATION"}
            </div>
            <div>Verification Status</div>
          </div>
        </div>

        {/* Disclaimer / End of Report Box */}
        <div className="border border-slate-300 rounded-lg p-5 text-[10px] text-slate-600 bg-white font-medium leading-relaxed print-avoid-break">
          <div className="text-center font-bold text-slate-900 mb-2">--END OF REPORT--</div>
          <div className="font-bold text-slate-950 mb-1 uppercase tracking-wider text-[9px]">Important Notice &amp; Disclaimer</div>
          <p className="mb-2">
            This report is provided by OZCLU PRIVATE LIMITED on a strictly confidential basis, solely for the exclusive use of the recipient for legitimate corporate and business purposes. It may not be reproduced, redistributed, or disclosed, in whole or in part, in any manner whatsoever without prior written consent.
          </p>
          <p className="mb-2">
            OZCLU PRIVATE LIMITED endeavors to ensure the highest level of accuracy and diligence in procuring, collecting, and compiling this data. Consequently, OZCLU PRIVATE LIMITED shall not be held liable for any direct, indirect, or consequential loss, damage, or injury resulting from any errors, omissions, or negligence in the procurement or communication of this information. Reliance upon this report is strictly at the user's sole risk.
          </p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <img src="/ozclu-logo-long-default.svg" alt="Ozclu" className="h-5 object-contain" />
              <span className="text-[9px] font-bold text-slate-400">Powered by Ozclu Verify</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono">Generated: {generatedAtDate}</span>
          </div>
        </div>

        {/* Appendix: Verification Evidence */}
        {(() => {
          const attemptsWithScreenshots = attempts.filter((att: any) => att.screenshot);
          if (attemptsWithScreenshots.length === 0) return null;
          return (
            <div className="mt-8 border-t border-slate-200 pt-6 print-break-before">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-[#00450e] mb-4">Appendix: Verification Evidence</h3>
              <div className="space-y-6">
                {attemptsWithScreenshots.map((att: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 print-avoid-break">
                    <span className="text-[10px] font-bold text-[#00450e] uppercase block mb-2 tracking-wider">
                      Attachment #{idx + 1} — logged on {att.date} (Mode: {att.verificationMode}, Result: {att.result})
                    </span>
                    {att.comment && (
                      <p className="text-[10.5px] text-slate-600 font-semibold mb-3">
                        Comment: {att.comment}
                      </p>
                    )}
                    <div className="flex justify-center bg-white border border-slate-200 rounded-lg p-2 max-h-[500px] overflow-hidden">
                      <img src={att.screenshot} alt={`Evidence #${idx + 1}`} className="object-contain max-h-[480px]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function EmploymentReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-6">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 text-sm font-semibold text-slate-600 animate-pulse">Loading...</span>
        </div>
      }
    >
      <EmploymentReportContent />
    </Suspense>
  );
}
