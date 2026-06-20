"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useAuth } from "src/context/AuthContext";

export default function MfaSetupPage() {
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const [secretBase32, setSecretBase32] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    // If MFA is already enabled, redirect to roster
    if (profile && profile.mfaEnabled) {
      router.push("/admin/roster");
      return;
    }

    startEnrollment();
  }, [profile, router]);

  const startEnrollment = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      
      const res = await fetch("/api/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to start enrollment");
      }

      setSecretBase32(data.secretBase32);
      
      // Generate QR Code data URL
      const qrDataUrl = await QRCode.toDataURL(data.otpauthUri, {
        width: 250,
        margin: 2,
        color: {
          dark: "#0f172a", // slate-900
          light: "#ffffff",
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred starting MFA setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit code.");
      return;
    }

    setVerifying(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/mfa/confirm-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Confirmation failed");
      }

      setRecoveryCodes(data.recoveryCodes);
      setSuccessMsg("MFA has been successfully enabled on your account!");
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid verification code. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyCodes = () => {
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleDownloadCodes = () => {
    const text = `Cluso Infolink Admin MFA Recovery Codes\nGenerated: ${new Date().toLocaleString()}\n\n${recoveryCodes.join("\n")}\n\nKeep these codes safe. They are single-use alternatives to your authenticator app.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cluso-mfa-recovery-codes.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#42C2FF] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-body-sm text-[#5e7285] animate-pulse">Initializing security module...</span>
        </div>
      </div>
    );
  }

  // If enrollment is successful and we have recovery codes to display
  if (recoveryCodes.length > 0) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="bg-white border border-emerald-500/10 rounded-3xl p-8 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl">verified_user</span>
            </div>
            <h2 className="font-display-lg text-slate-900 mb-2">MFA Enrollment Completed</h2>
            <p className="font-body-md text-emerald-600 font-semibold">{successMsg}</p>
          </div>

          <div className="bg-amber-50 border border-amber-500/15 rounded-2xl p-5 flex gap-4">
            <span className="material-symbols-outlined text-amber-600 text-2xl">warning</span>
            <div className="flex flex-col gap-1.5 font-body-sm text-amber-800">
              <span className="font-bold">Save your recovery codes!</span>
              <p>These codes allow you to access your account if you lose your authenticator app. They will only be displayed once.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl p-6 font-mono text-center text-slate-800 font-bold tracking-wider text-lg">
            {recoveryCodes.map((code) => (
              <div key={code} className="bg-white border border-slate-200/50 py-2.5 rounded-xl shadow-xs">
                {code}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={handleCopyCodes}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 font-button-text text-sm rounded-xl cursor-pointer flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">
                {copiedCodes ? "check" : "content_copy"}
              </span>
              <span>{copiedCodes ? "Copied!" : "Copy to Clipboard"}</span>
            </button>
            <button
              onClick={handleDownloadCodes}
              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 font-button-text text-sm rounded-xl cursor-pointer flex justify-center items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Download TXT</span>
            </button>
            <button
              onClick={() => router.push("/admin/roster")}
              className="flex-1 py-3 bg-[#42C2FF] hover:bg-[#0099ff] text-white font-button-text text-sm rounded-xl cursor-pointer flex justify-center items-center gap-2"
            >
              <span>Done</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col gap-6">
        <div>
          <h2 className="font-display-lg text-slate-900 mb-1">Set Up Multi-Factor Authentication</h2>
          <p className="font-body-md text-[#5e7285]">Secure your administrator workspace with a time-based verification code (TOTP).</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/5 border border-red-500/10 text-red-600 rounded-xl p-4 font-body-sm flex gap-3">
            <span className="material-symbols-outlined text-lg">error_outline</span>
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8 items-center border-y border-slate-100 py-8">
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#B8FFF9] text-[#0284c7] font-bold text-xs flex items-center justify-center shrink-0">1</div>
              <p className="font-body-sm text-slate-700">Scan the QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Duo, or similar).</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-[#B8FFF9] text-[#0284c7] font-bold text-xs flex items-center justify-center shrink-0">2</div>
              <div className="font-body-sm text-slate-700">
                <p>If you cannot scan the QR code, manually enter this base32 secret in your app:</p>
                <div className="mt-2.5 bg-slate-50 border border-slate-200/50 p-2.5 rounded-lg font-mono text-center text-xs text-slate-800 font-bold select-all tracking-wider">
                  {secretBase32}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-center">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Scan QR Code" className="w-[180px] h-[180px] rounded-lg mix-blend-multiply" />
            ) : (
              <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-300">
                <span className="material-symbols-outlined text-5xl">qr_code_2</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold" htmlFor="verificationCode">
              Verification Code (6 Digits)
            </label>
            <input
              id="verificationCode"
              type="text"
              required
              maxLength={6}
              pattern="\d{6}"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-slate-200/80 rounded-xl p-3.5 font-mono text-center text-2xl tracking-[0.5em] text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white placeholder-slate-300"
              placeholder="000000"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => router.push("/admin/roster")}
              className="flex-1 py-3.5 border border-slate-200 hover:bg-slate-50 font-button-text text-sm rounded-xl cursor-pointer text-center text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="flex-2 py-3.5 bg-[#42C2FF] hover:bg-[#0099ff] text-white font-button-text text-sm rounded-xl cursor-pointer flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {verifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Confirming setup...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">shield</span>
                  <span>Enable MFA</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
