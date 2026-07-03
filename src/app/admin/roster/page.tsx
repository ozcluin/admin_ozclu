"use client";

import React, { useState } from "react";
import { usePortal, Verification } from "src/context/PortalContext";

export default function VerificationRosterPage() {
  const { verifications, updateVerificationStatus, fetchVerificationDetail, refreshData } = usePortal();

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

  // Edit status modal states
  const [statusModalVer, setStatusModalVer] = useState<Verification | null>(null);
  const [editStatus, setEditStatus] = useState<"Completed" | "Processing" | "Needs Attention">("Completed");
  const [editNotes, setEditNotes] = useState("");

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
    return matchesStatus && matchesOrg && matchesSearch;
  });

  const handleOpenStatusModal = (v: Verification) => {
    setStatusModalVer(v);
    setEditStatus(v.status);
    setEditNotes(v.notes || "");
  };

  const handleSaveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (statusModalVer) {
      updateVerificationStatus(statusModalVer.id, editStatus, editNotes);
      setStatusModalVer(null);
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

        <div className="w-full md:w-56 flex flex-col gap-1">
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

        <div className="w-full md:w-48 flex flex-col gap-1">
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
      </section>

      {/* Main Roster Table */}
      <section className="apple-card-static overflow-hidden border border-[#016e1c]/10 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#016e1c]/10 bg-slate-50/50">
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">REQUEST ID</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">CANDIDATE</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">CLIENT ORG</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">DATE</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px]">STATUS</th>
                <th className="py-4 px-6 font-label-caps text-slate-500 font-bold text-[10px] text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVerifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No verifications found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredVerifications.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">{v.id}</td>
                    <td className="py-4 px-6 text-slate-800">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{v.name}</span>
                        <span className="text-xs text-slate-400 mt-0.5">{v.email}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{v.orgName}</td>
                    <td className="py-4 px-6 text-slate-500 font-medium">{v.date}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                          v.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                            : v.status === "Processing"
                            ? "bg-[#016e1c]/10 text-[#00450e] border-[#016e1c]/15"
                            : "bg-red-500/10 text-red-600 border-red-500/15"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          v.status === "Completed" ? "bg-emerald-500" : v.status === "Processing" ? "bg-[#016e1c]" : "bg-red-500"
                        }`}></span>
                        {v.status}
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
                        <button
                          onClick={() => handleOpenStatusModal(v)}
                          className="px-3.5 py-1.5 apple-button-primary rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Status</span>
                          <span className="material-symbols-outlined text-[12px] font-bold">edit</span>
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

      {/* Edit Status Modal */}
      {statusModalVer && (
        <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#016e1c]/12 rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setStatusModalVer(null)}
              className="absolute right-5 top-5 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="font-headline-md text-slate-900 font-extrabold mb-1">Update Verification Flow</h3>
            <p className="font-body-sm text-slate-500 mb-6">
              Subject: <span className="font-bold text-slate-700">{statusModalVer.name}</span> ({statusModalVer.id})
            </p>

            <form onSubmit={handleSaveStatus} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Verification Status</label>
                <div className="flex gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1">
                  {(["Processing", "Completed", "Needs Attention"] as const).map((stat) => (
                    <button
                      key={stat}
                      type="button"
                      onClick={() => setEditStatus(stat)}
                      className={`flex-1 py-2 rounded-lg font-button-text text-xs text-center transition-all cursor-pointer ${
                        editStatus === stat
                          ? "bg-white text-slate-800 shadow-sm border border-slate-200/50 font-bold"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {stat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Internal Flow Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl px-4 py-2.5 font-body-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] focus:bg-white transition-all placeholder-slate-400 resize-none"
                  placeholder="Notes about verification hurdles, checks completed..."
                />
              </div>

              <div className="mt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatusModalVer(null)}
                  className="px-4.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-button-text rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 apple-button-primary rounded-xl font-button-text text-xs hover:brightness-105 transition-all cursor-pointer"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                ) : (
                  /* Non-DigiLocker / Pending state */
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
                    onClick={() => window.open(`/admin/report?id=${displayVerification.id}`, "_blank")}
                    className="flex-1 py-2.5 bg-gradient-to-r from-[#016e1c] to-[#0099ff] hover:opacity-90 text-white font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    Print
                  </button>
                )}
                <button
                  onClick={() => {
                    const ver = selectedVerification;
                    setSelectedVerification(null);
                    handleOpenStatusModal(ver);
                  }}
                  className="flex-1 py-2.5 apple-button-primary rounded-xl font-semibold hover:brightness-105 transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">edit</span>
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
