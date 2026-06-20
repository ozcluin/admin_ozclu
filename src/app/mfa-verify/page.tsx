"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "src/context/AuthContext";

export default function MfaVerifyPage() {
  const router = useRouter();
  const { profile, verifyMfa, verifyRecoveryCode, logout } = useAuth();

  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // If user is not authenticated at all, redirect to home/login
    if (!profile) {
      router.push("/");
      return;
    }

    // If user has MFA enabled but is already verified, redirect to roster
    if (profile.mfaEnabled && profile.mfaVerified) {
      router.push("/admin/roster");
    }
  }, [profile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (isRecoveryMode) {
        if (!recoveryCode.trim()) {
          throw new Error("Please enter your recovery code.");
        }
        await verifyRecoveryCode(recoveryCode.toUpperCase().trim());
      } else {
        if (code.length !== 6) {
          throw new Error("Please enter a valid 6-digit verification code.");
        }
        await verifyMfa(code);
      }
      router.push("/admin/roster");
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-[#EFFFFD] via-[#f4f9fc] to-[#B8FFF9] text-on-background relative overflow-hidden font-sans justify-center items-center px-4">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#85F4FF]/20 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-[#42C2FF]/15 to-transparent blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/75 backdrop-blur-xl border border-white/60 rounded-3xl p-10 shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_50px_rgba(66,194,255,0.08)] transition-all duration-500 animate-fade-in animate-duration-300">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 bg-gradient-to-br from-[#EFFFFD] via-[#B8FFF9] to-[#85F4FF] border border-[#85F4FF]/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm shadow-[#42C2FF]/10 text-[#0284c7]">
            <span className="material-symbols-outlined text-3xl font-light">
              {isRecoveryMode ? "key" : "security"}
            </span>
          </div>
          <h2 className="font-display-lg text-slate-900 mb-2">Two-Factor Authentication</h2>
          <p className="font-body-lg text-[#5e7285]">
            {isRecoveryMode 
              ? "Enter one of your emergency recovery codes." 
              : "Enter the verification code from your authenticator app."}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/5 text-red-600 border border-red-500/10 rounded-xl p-4 font-body-sm flex items-center gap-3 animate-fade-in">
            <span className="material-symbols-outlined text-lg">error_outline</span>
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isRecoveryMode ? (
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold" htmlFor="recoveryCode">
                Recovery Code
              </label>
              <input
                id="recoveryCode"
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="w-full border border-slate-200/80 rounded-xl p-3.5 font-mono text-center text-lg uppercase tracking-wider text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white placeholder-slate-400"
                placeholder="A1B2C3D4E5"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold" htmlFor="code">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full border border-slate-200/80 rounded-xl p-3.5 font-mono text-center text-2xl tracking-[0.5em] text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white placeholder-slate-300"
                placeholder="000000"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3.5 bg-[#42C2FF] hover:bg-[#0099ff] text-white rounded-xl font-button-text hover:brightness-105 transition-all duration-200 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm font-bold shadow-md shadow-sky-500/10"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Verifying...</span>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">lock_open</span>
                <span>Verify & Unlock</span>
              </>
            )}
          </button>

          <div className="flex flex-col gap-3 mt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRecoveryMode(!isRecoveryMode);
                setErrorMsg("");
              }}
              className="text-xs text-[#0284c7] hover:underline font-semibold cursor-pointer"
            >
              {isRecoveryMode ? "Use authenticator app code instead" : "Lost app? Use a recovery code"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              Cancel and Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
