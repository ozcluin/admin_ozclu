"use client";

import React, { useState } from "react";
import { usePortal } from "src/context/PortalContext";
import type { Verifier } from "src/context/PortalContext";

export default function VerifiersPage() {
  const { verifiers, inviteVerifier, updateVerifierRate, updateVerifierStatus, deleteVerifier } = usePortal();

  // Invite states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("Cluso");
  const [password, setPassword] = useState("");
  const [rate, setRate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Profile drawer state
  const [selectedVerifier, setSelectedVerifier] = useState<Verifier | null>(null);
  const [editingRate, setEditingRate] = useState(false);
  const [editRateValue, setEditRateValue] = useState("");
  const [rateSaving, setRateSaving] = useState(false);

  const handleGeneratePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    setPassword(retVal);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!name.trim()) {
      setErrorMsg("Verifier Name is required");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid verifier email address");
      return;
    }
    if (!org.trim()) {
      setErrorMsg("Organization name is required");
      return;
    }

    const parsedRate = rate ? parseFloat(rate) : 0;
    if (rate && (isNaN(parsedRate) || parsedRate < 0)) {
      setErrorMsg("Rate per verification must be a valid positive number");
      return;
    }

    try {
      await inviteVerifier(name, email, org, password, parsedRate);
      setSuccessMsg(
        `Invitation dispatched successfully to ${name} (${email})!${
          password ? ` Temporary password: ${password}` : ""
        }`
      );
      setName("");
      setEmail("");
      setOrg("Cluso");
      setPassword("");
      setRate("");
      setTimeout(() => setSuccessMsg(""), 10000);
    } catch (err: any) {
      setErrorMsg("Failed to dispatch invitation");
    }
  };

  const openProfile = (v: Verifier) => {
    setSelectedVerifier(v);
    setEditingRate(false);
    setEditRateValue(String(v.ratePerVerification ?? 0));
  };

  const closeProfile = () => {
    setSelectedVerifier(null);
    setEditingRate(false);
  };

  const handleSaveRate = async () => {
    if (!selectedVerifier) return;
    const parsed = parseFloat(editRateValue);
    if (isNaN(parsed) || parsed < 0) return;
    setRateSaving(true);
    await updateVerifierRate(selectedVerifier.id, parsed);
    setSelectedVerifier((prev) => prev ? { ...prev, ratePerVerification: parsed } : null);
    setEditingRate(false);
    setRateSaving(false);
  };

  return (
    <div className="flex flex-col gap-6 pt-4 animate-fade-in pb-12">
      <div className="mb-4">
        <h2 className="font-display-lg text-slate-900 leading-none tracking-tight">Verifier Accounts</h2>
        <p className="font-body-lg text-slate-500 mt-2.5 max-w-3xl">
          Management terminal for Cluso verification specialists. Dispatched invitations allow new verifiers to activate secure access accounts.
        </p>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/15 rounded-xl p-4 font-body-sm flex items-center justify-between gap-3 max-w-5xl animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg">mail</span>
            <span className="font-medium">{successMsg}</span>
          </div>
          {successMsg.includes("Temporary password:") && (
            <button
              onClick={() => {
                const parts = successMsg.split("Temporary password: ");
                if (parts[1]) {
                  navigator.clipboard.writeText(parts[1]);
                }
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-colors cursor-pointer"
            >
              Copy Password
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/5 text-red-600 border border-red-500/15 rounded-xl p-4 font-body-sm flex items-center gap-3 max-w-5xl animate-fade-in">
          <span className="material-symbols-outlined text-lg">error_outline</span>
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-6xl">
        {/* Verifier Directory Table (Spans 2 columns on xl screens) */}
        <section className="xl:col-span-2 bg-white border border-[#42C2FF]/12 rounded-2xl p-6 flex flex-col gap-5 shadow-[0_4px_25px_rgba(66,194,255,0.03)]">
          <h3 className="font-headline-md text-slate-900 font-extrabold pb-3 border-b border-slate-100">Verifier Directory</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#42C2FF]/10 bg-slate-50/50">
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-[9px]">VERIFIER ID</th>
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-[9px]">FULL NAME</th>
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-[9px]">EMAIL ADDRESS</th>
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-[9px]">ORGANIZATION</th>
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-right text-[9px]">RATE ($)</th>
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-right text-[9px]">STATUS</th>
                  <th className="py-3.5 px-4 font-label-caps text-slate-500 font-bold text-right text-[9px]">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verifiers.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => openProfile(v)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4 font-mono text-xs text-slate-400 font-bold">{v.id}</td>
                    <td className="py-4 px-4 font-bold text-slate-900 group-hover:text-[#0ea5e9] transition-colors">
                      <div className="flex items-center gap-2">
                        <span>{v.name}</span>
                        <span className="material-symbols-outlined text-[15px] text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                          open_in_new
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-mono text-xs">{v.email}</td>
                    <td className="py-4 px-4 text-slate-600 font-semibold">{v.org}</td>
                    <td className="py-4 px-4 text-right font-bold text-[#0369a1]">
                      ${(v.ratePerVerification ?? 0).toLocaleString("en-US")}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide uppercase border ${
                          v.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                            : v.status === "Inactive"
                            ? "bg-red-500/10 text-red-600 border-red-500/15"
                            : "bg-slate-100 text-slate-400 border-slate-200/50"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openProfile(v)}
                          title="View Profile"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0369a1] hover:bg-[#42C2FF]/10 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => updateVerifierStatus(v.id, v.status === "Inactive" ? "Active" : "Inactive")}
                          title={v.status === "Inactive" ? "Activate" : "Deactivate"}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            v.status === "Inactive"
                              ? "text-emerald-600 hover:bg-emerald-500/10"
                              : "text-amber-600 hover:bg-amber-500/10"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {v.status === "Inactive" ? "toggle_on" : "toggle_off"}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete verifier "${v.name}"? This action cannot be undone.`)) {
                              deleteVerifier(v.id);
                              if (selectedVerifier?.id === v.id) closeProfile();
                            }
                          }}
                          title="Delete Verifier"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Invite Verifier Form Card */}
        <section className="bg-white border border-[#42C2FF]/12 rounded-2xl p-6 shadow-[0_4px_25px_rgba(66,194,255,0.03)] h-fit">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#0369a1] bg-[#B8FFF9]/40 border border-[#85F4FF]/30 p-2 rounded-xl">
              person_add
            </span>
            <h3 className="font-headline-md text-slate-900 font-extrabold">Invite Verifier</h3>
          </div>

          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. David Miller"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
              />
            </div>

            {/* Email Address */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. david@cluso.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
              />
            </div>

            {/* Organization */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Organization
              </label>
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                autoComplete="off"
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
              />
            </div>

            {/* Rate per Verification */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                Rate per Verification ($)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 15.00"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[10px] text-[#0ea5e9] hover:underline font-bold cursor-pointer animate-fade-in"
                >
                  Generate Password
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Temporary login password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full border border-slate-200/80 rounded-xl p-3 pr-10 font-body-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] focus:bg-white transition-all placeholder-slate-400"
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(password)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center"
                    title="Copy to clipboard"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 w-full apple-button-primary py-3.5 rounded-xl font-button-text text-xs flex justify-center items-center gap-2 cursor-pointer"
            >
              <span>Send Invitation</span>
              <span className="material-symbols-outlined text-base font-bold">mark_email_unread</span>
            </button>
          </form>
        </section>
      </div>

      {/* Verifier Profile Fullscreen Popup */}
      {selectedVerifier && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center animate-fade-in"
          onClick={closeProfile}
        >
          <div
            className="w-full h-full bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="border-b border-slate-100 bg-slate-50/30 shrink-0">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#42C2FF] to-[#0099ff] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm">
                    {selectedVerifier.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline-md text-slate-900 font-extrabold text-base leading-none">{selectedVerifier.name}</h3>
                    <span className="text-[10px] text-slate-400 font-bold font-mono block mt-1.5">{selectedVerifier.id}</span>
                  </div>
                </div>
                <button
                  onClick={closeProfile}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Popup Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
                {/* Avatar + Name Section */}
                <div className="flex flex-col items-center gap-3 py-4 border-b border-slate-100">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#EFFFFD] via-[#B8FFF9] to-[#85F4FF] border border-[#85F4FF]/30 text-[#0284c7] rounded-full flex items-center justify-center font-black text-3xl shadow-inner">
                    {selectedVerifier.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-center">
                    <h4 className="font-headline-md text-slate-900 font-extrabold text-lg leading-tight">{selectedVerifier.name}</h4>
                    <p className="font-body-sm text-slate-500 font-mono text-xs mt-1">{selectedVerifier.email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3.5 py-1 rounded-full text-[9.5px] font-bold tracking-wide uppercase border ${
                      selectedVerifier.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15"
                        : selectedVerifier.status === "Inactive"
                        ? "bg-red-500/10 text-red-600 border-red-500/15"
                        : "bg-slate-100 text-slate-400 border-slate-200/50"
                    }`}
                  >
                    {selectedVerifier.status}
                  </span>
                </div>

                {/* Detail Cards */}
                <div className="flex flex-col gap-3.5">
                  {/* Organization */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400 font-bold">business</span>
                      <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Organization</span>
                    </div>
                    <p className="font-body-sm font-bold text-slate-800">{selectedVerifier.org}</p>
                  </div>

                  {/* Email */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400 font-bold">email</span>
                      <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Email Address</span>
                    </div>
                    <p className="font-body-sm font-bold text-slate-800 font-mono text-xs">{selectedVerifier.email}</p>
                  </div>

                  {/* Rate per Verification (Editable) */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-slate-400 font-bold">payments</span>
                        <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">Rate per Verification</span>
                      </div>
                      {!editingRate && (
                        <button
                          onClick={() => {
                            setEditingRate(true);
                            setEditRateValue(String(selectedVerifier.ratePerVerification ?? 0));
                          }}
                          className="text-[11px] text-[#0ea5e9] hover:underline font-bold cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px] font-bold">edit</span>
                          <span>Edit Rate</span>
                        </button>
                      )}
                    </div>

                    {editingRate ? (
                      <div className="flex items-center gap-2 mt-2 animate-fade-in">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editRateValue}
                            onChange={(e) => setEditRateValue(e.target.value)}
                            autoFocus
                            className="w-full p-2 pl-7 border border-slate-200 rounded-xl font-body-sm text-slate-850 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
                          />
                        </div>
                        <button
                          onClick={handleSaveRate}
                          disabled={rateSaving}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-sm"
                        >
                          {rateSaving ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                          )}
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => setEditingRate(false)}
                          className="px-3.5 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className="font-body-md font-extrabold text-slate-900 text-lg">
                        ${(selectedVerifier.ratePerVerification ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>

                  {/* Verifier ID */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400 font-bold">badge</span>
                      <span className="font-label-caps text-slate-400 text-[9px] uppercase tracking-wider font-bold">System Verifier ID</span>
                    </div>
                    <p className="font-mono text-xs font-bold text-slate-800">{selectedVerifier.id}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Popup Footer */}
            <div className="border-t border-slate-100 bg-slate-50/30 shrink-0">
              <div className="max-w-5xl mx-auto w-full p-6 flex flex-col gap-3">
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!selectedVerifier) return;
                      const newStatus = selectedVerifier.status === "Inactive" ? "Active" : "Inactive";
                      updateVerifierStatus(selectedVerifier.id, newStatus);
                      setSelectedVerifier((prev) => prev ? { ...prev, status: newStatus } : null);
                    }}
                    className={`flex-1 py-2.5 font-button-text rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5 text-xs font-bold border ${
                      selectedVerifier.status === "Inactive"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15 hover:bg-emerald-500/20"
                        : "bg-amber-500/5 text-amber-600 border-amber-500/15 hover:bg-amber-500/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {selectedVerifier.status === "Inactive" ? "toggle_on" : "toggle_off"}
                    </span>
                    <span>{selectedVerifier.status === "Inactive" ? "Activate" : "Deactivate"}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedVerifier) return;
                      if (confirm(`Delete verifier "${selectedVerifier.name}"? This action cannot be undone.`)) {
                        deleteVerifier(selectedVerifier.id);
                        closeProfile();
                      }
                    }}
                    className="flex-1 py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-650 border border-red-500/15 font-button-text rounded-xl transition-colors cursor-pointer flex justify-center items-center gap-1.5 text-xs font-bold"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    <span>Delete Account</span>
                  </button>
                </div>
                <button
                  onClick={closeProfile}
                  className="w-full py-2.5 border border-slate-200 text-slate-700 font-button-text rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-xs font-bold"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
