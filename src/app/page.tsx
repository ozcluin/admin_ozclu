"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "src/context/AuthContext";
import OzcluLogo from "./components/OzcluLogo";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, profile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && profile) {
      if (profile.mfaPending) {
        router.push("/mfa-verify");
      } else {
        router.push("/admin/roster");
      }
    }
  }, [isAuthenticated, authLoading, profile, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      await login(email, password);
      // Wait for session update to happen before routing
      // The useEffect will handle redirecting correctly
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid credentials or insufficient permissions.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f6fbf0] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#016e1c] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-body-sm text-[#5e7285] animate-pulse">Loading secure session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-[#f6fbf0] via-[#f6fbf0] to-[#eaf0e4] text-on-background relative overflow-hidden font-sans">
      {/* Decorative gradient glowing spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#bfcab9]/20 to-transparent blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-[#016e1c]/15 to-transparent blur-3xl pointer-events-none"></div>

      {/* Top Header */}
      <header className="h-16 bg-white/40 backdrop-blur-md border-b border-[#016e1c]/15 flex justify-between items-center px-8 z-10">
        <div className="flex items-center gap-3">
          <OzcluLogo size="md" />
        </div>
        <div>
          <span className="font-label-caps text-[#00450e] bg-[#eaf0e4]/40 border border-[#bfcab9]/30 px-3 py-1 rounded-full text-xs font-semibold">
            Admin Console
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative z-10">
        <div className="w-full max-w-md bg-white/75 backdrop-blur-xl border border-white/60 rounded-3xl p-10 shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_50px_rgba(1, 110, 28,0.08)] transition-all duration-500 animate-fade-in">
          <div className="text-center mb-8 flex flex-col items-center">
            {/* Visual Icon */}
            <div className="w-14 h-14 bg-gradient-to-br from-[#f6fbf0] via-[#eaf0e4] to-[#bfcab9] border border-[#bfcab9]/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm shadow-[#016e1c]/10 text-[#016e1c]">
              <span className="material-symbols-outlined text-3xl font-light">admin_panel_settings</span>
            </div>
            <h2 className="font-display-lg text-slate-900 mb-2">Welcome Back</h2>
            <p className="font-body-lg text-[#5e7285]">Sign in to access your administrative workspace.</p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-6 bg-red-500/5 text-red-600 border border-red-500/10 rounded-xl p-4 font-body-sm flex items-center gap-3 animate-fade-in">
              <span className="material-symbols-outlined text-lg">error_outline</span>
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold" htmlFor="email">
                Admin Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200/80 rounded-xl p-3.5 font-body-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] transition-all bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white placeholder-slate-400"
                placeholder="indiaops@ozclu.com"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold" htmlFor="password">
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-200/80 rounded-xl p-3.5 pr-12 font-body-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#016e1c]/10 focus:border-[#016e1c] transition-all bg-slate-50/50 hover:bg-slate-50/80 focus:bg-white placeholder-slate-400"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center p-1 cursor-pointer focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-xl select-none">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 py-3.5 apple-button-primary rounded-xl font-button-text hover:brightness-105 transition-all duration-200 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating console...</span>
                </div>
              ) : (
                <>
                  <span>Unlock Console</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Admin Notice */}
          <div className="mt-8 text-center border-t border-slate-100 pt-5">
            <div className="flex items-center justify-center gap-2 text-xs text-[#5e7285]">
              <span className="material-symbols-outlined text-base text-[#016e1c]">shield</span>
              <span className="font-body-sm">Protected environment for verified specialists only.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-14 bg-white/20 backdrop-blur-sm border-t border-[#016e1c]/10 flex justify-center items-center font-body-sm text-[#5e7285] text-xs font-medium">
        <span>&copy; {new Date().getFullYear()} Ozclu. All Rights Reserved.</span>
      </footer>
    </div>
  );
}
