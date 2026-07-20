"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "src/context/AuthContext";
import { usePortal } from "src/context/PortalContext";
import OzcluLogo from "../components/OzcluLogo";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, profile, user } = useAuth();
  const { verifications } = usePortal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);

  // Pending verifications for notifications
  const pendingVerifications = verifications.filter(
    (v) => (v.courtRecordAdminReview === true && v.courtRecordStatus === "admin_review") ||
           (v.type === "court_record" && v.courtRecordStatus === "needs_admin_retry")
  );
  const visibleNotifications = pendingVerifications.filter(v => !dismissedNotifs.has(v.id));
  const pendingReviewCount = visibleNotifications.length;

  // Close notification dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const handleNotifClick = useCallback((vId: string) => {
    setNotifOpen(false);
    // Store highlight target in sessionStorage so roster page can pick it up
    sessionStorage.setItem("highlight_verification", vId);
    if (pathname === "/admin/roster") {
      window.dispatchEvent(new Event("highlight-verification"));
    } else {
      router.push("/admin/roster");
    }
  }, [pathname, router]);

  const dismissNotif = useCallback((vId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedNotifs(prev => new Set(prev).add(vId));
  }, []);

  // Route protection
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push("/");
      } else if (profile?.mfaPending) {
        router.push("/mfa-verify");
      }
    }
  }, [isAuthenticated, isLoading, profile, router]);

  const navItems = [
    { name: "Verification Roster", path: "/admin/roster", icon: "assignment" },
    { name: "Candidate Database", path: "/admin/candidates", icon: "folder_shared" },
    { name: "Manage Invoices", path: "/admin/invoices", icon: "account_balance_wallet" },
    { name: "Admin Profile", path: "/admin/profile", icon: "settings" },
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6fbf0]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#016e1c] border-t-transparent rounded-full animate-spin"></div>
          <span className="font-body-sm text-[#5e7285] animate-pulse">Syncing console data...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const displayName = profile?.full_name || user?.email || "Admin";

  if (pathname.includes("/admin/report") || pathname.includes("/admin/court-record-report") || pathname.includes("/admin/employment-report") || pathname.includes("/admin/education-report")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#f6fbf0] text-slate-800 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="w-[280px] h-screen fixed left-0 top-0 glass-sidebar flex flex-col py-8 z-30 hidden md:flex">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <OzcluLogo size="md" />
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1.5 px-3 mt-4 font-body-sm">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-[#eaf0e4]/50 to-[#f6fbf0]/50 border border-[#bfcab9]/30 text-[#00450e] font-semibold shadow-[0_2px_10px_rgba(1, 110, 28,0.05)]"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-950 border border-transparent"
                }`}
              >
                <span 
                  className={`material-symbols-outlined text-xl transition-colors duration-200 ${
                    isActive ? "text-[#016e1c]" : "text-slate-400 group-hover:text-slate-600"
                  }`} 
                  style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}` }}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.name}</span>
                {item.path === "/admin/roster" && pendingReviewCount > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse shadow-sm">
                    {pendingReviewCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info + Footer logout */}
        <div className="mx-3 px-4 py-4 bg-white/50 border border-white/60 rounded-2xl flex flex-col gap-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#f6fbf0] via-[#eaf0e4] to-[#bfcab9] rounded-full flex items-center justify-center text-[#016e1c] text-sm font-black border border-[#bfcab9]/30 shadow-inner">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-body-sm font-bold text-slate-800 truncate leading-tight">{displayName}</span>
              <span className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email}</span>
            </div>
          </div>
          {profile?.mfaEnabled !== true ? (
            <Link
              href="/admin/mfa-setup"
              className="flex items-center justify-center gap-2 py-2 border border-[#016e1c]/20 hover:border-[#016e1c]/40 bg-[#eaf0e4]/20 hover:bg-[#bfcab9]/20 text-[#016e1c] rounded-xl transition-all duration-200 w-full text-center font-bold text-[10px] uppercase tracking-wider cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">security</span>
              <span>Setup MFA</span>
            </Link>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 rounded-xl w-full text-center font-bold text-[10px] uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm font-bold">verified_user</span>
              <span>MFA Secured</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 py-2 border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-600 rounded-xl transition-all duration-200 w-full text-center font-button-text text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Sidebar - Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-xs z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="w-72 h-full bg-[#f6fbf0] border-r border-[#016e1c]/15 flex flex-col py-8 animate-slide-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 mb-8 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <OzcluLogo size="sm" />
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 p-1.5 rounded-full hover:bg-slate-200/50 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-1.5 px-3 font-body-sm">
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-[#eaf0e4]/50 to-[#f6fbf0]/50 border border-[#bfcab9]/30 text-[#00450e] font-semibold shadow-[0_2px_10px_rgba(1, 110, 28,0.05)]"
                        : "text-slate-500 hover:bg-white/60 hover:text-slate-950 border border-transparent"
                    }`}
                  >
                    <span 
                      className={`material-symbols-outlined text-xl transition-colors duration-200 ${
                        isActive ? "text-[#016e1c]" : "text-slate-400 group-hover:text-slate-600"
                      }`} 
                      style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}` }}
                    >
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.path === "/admin/roster" && pendingReviewCount > 0 && (
                      <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full animate-pulse shadow-sm">
                        {pendingReviewCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mx-3 px-4 py-4 bg-white/50 border border-white/60 rounded-2xl flex flex-col gap-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-[#f6fbf0] via-[#eaf0e4] to-[#bfcab9] rounded-full flex items-center justify-center text-[#016e1c] text-sm font-black border border-[#bfcab9]/30">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-body-sm font-bold text-slate-800 truncate leading-tight">{displayName}</span>
                  <span className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email}</span>
                </div>
              </div>
              {profile?.mfaEnabled !== true ? (
                <Link
                  href="/admin/mfa-setup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2 border border-[#016e1c]/20 hover:border-[#016e1c]/40 bg-[#eaf0e4]/20 hover:bg-[#bfcab9]/20 text-[#016e1c] rounded-xl transition-all duration-200 w-full text-center font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">security</span>
                  <span>Setup MFA</span>
                </Link>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 bg-emerald-500/5 border border-emerald-500/10 text-emerald-600 rounded-xl w-full text-center font-bold text-[10px] uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm font-bold">verified_user</span>
                  <span>MFA Secured</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 py-2 border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-600 rounded-xl transition-all duration-200 w-full text-center font-button-text text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Page Canvas Container */}
      <div className="flex-1 min-w-0 md:ml-[280px] flex flex-col min-h-screen">
        {/* Top AppBar */}
        <header className="h-16 fixed top-0 right-0 w-full md:w-[calc(100%-280px)] glass-header z-20 flex justify-between items-center px-8 transition-all duration-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-200/40 rounded-xl md:hidden cursor-pointer"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="font-headline-md font-extrabold text-slate-900 flex items-center gap-3">
              <span className="tracking-tight text-slate-900">Verify Console</span>
              <span className="text-[10px] bg-[#eaf0e4]/40 border border-[#bfcab9]/30 text-[#00450e] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-label-caps">
                Online
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell + Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                aria-label="notifications"
                onClick={() => setNotifOpen(prev => !prev)}
                className={`relative text-slate-500 hover:text-slate-800 hover:bg-slate-200/30 p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer ${notifOpen ? "bg-slate-200/30 text-slate-800" : ""}`}
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                {pendingReviewCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black rounded-full shadow-sm animate-pulse">
                    {pendingReviewCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] w-[320px] sm:w-[380px] bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden notif-dropdown-enter"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-slate-500">notifications_active</span>
                      <span className="text-xs font-bold text-slate-700">Notifications</span>
                      {pendingReviewCount > 0 && (
                        <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold">{pendingReviewCount}</span>
                      )}
                    </div>
                    {pendingReviewCount > 0 && (
                      <button
                        onClick={() => setDismissedNotifs(new Set(pendingVerifications.map(v => v.id)))}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-[360px] overflow-y-auto">
                    {visibleNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <span className="material-symbols-outlined text-3xl text-slate-300">notifications_off</span>
                        <span className="text-xs text-slate-400 font-medium">No pending notifications</span>
                      </div>
                    ) : (
                      visibleNotifications.map((v, i) => (
                        <div
                          key={v.id}
                          onClick={() => handleNotifClick(v.id)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-150 border-b border-slate-50 last:border-0 group notif-item-enter"
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            v.courtRecordStatus === "needs_admin_retry"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-rose-100 text-rose-600"
                          }`}>
                            <span className="material-symbols-outlined text-base">
                              {v.courtRecordStatus === "needs_admin_retry" ? "refresh" : "rate_review"}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-800 truncate">{v.name}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                                v.courtRecordStatus === "needs_admin_retry"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}>
                                {v.courtRecordStatus === "needs_admin_retry" ? "Retry" : "Review"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                              {v.courtRecordStatus === "needs_admin_retry"
                                ? `Auto-retry failed after ${v.courtRecordRetryAttempts || 3} attempts. Manual retry needed.`
                                : "Court record search requires admin review before completion."}
                            </p>
                            <span className="text-[9px] text-slate-400 font-mono mt-1 block">{v.id}</span>
                          </div>

                          <button
                            onClick={(e) => dismissNotif(v.id, e)}
                            className="mt-0.5 p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                            title="Dismiss"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {pendingReviewCount > 0 && (
                    <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/50">
                      <button
                        onClick={() => { setNotifOpen(false); router.push("/admin/roster"); }}
                        className="w-full text-center text-[10px] font-bold text-[#016e1c] hover:text-[#00450e] transition-colors cursor-pointer"
                      >
                        View all in Roster →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* User info badge */}
            <div className="hidden sm:flex flex-col text-right mr-1">
              <span className="font-body-sm font-bold text-slate-800 leading-tight">{displayName}</span>
              <span className="text-[9px] text-[#0ea5e9] font-bold tracking-wider mt-0.5 uppercase">SYSTEM ANALYST</span>
            </div>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="text-slate-500 hover:text-red-500 hover:bg-red-500/5 p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-xl">power_settings_new</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className={`flex-1 min-w-0 mt-16 p-margin-mobile md:p-8 w-full ${pathname === "/admin/roster" ? "max-w-none" : "max-w-container-max mx-auto"}`}>
          {children}
        </main>
      </div>

      {/* Notification dropdown animations */}
      <style jsx>{`
        .notif-dropdown-enter {
          animation: notifSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .notif-item-enter {
          animation: notifItemIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes notifSlideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes notifItemIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
