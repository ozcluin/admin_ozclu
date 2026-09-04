"use client";

import React, { useState, useMemo } from "react";
import { usePortal, ApiKey, ApiUsageLog, Organisation } from "src/context/PortalContext";

export default function AdminApiUsagePage() {
  const { apiKeys, apiUsageLogs, organisations, generateApiKey, revokeApiKey, refreshData } = usePortal();

  const [activeTab, setActiveTab] = useState<"logs" | "keys">("logs");
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Key Generation Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState("");
  const [customRateLimit, setCustomRateLimit] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return apiUsageLogs.filter((log: ApiUsageLog) => {
      if (selectedOrgFilter !== "all") {
        if (log.orgId !== selectedOrgFilter && log.orgName !== selectedOrgFilter) {
          return false;
        }
      }
      if (selectedTypeFilter !== "all" && log.checkType !== selectedTypeFilter) {
        return false;
      }
      if (selectedStatusFilter === "success" && (log.statusCode < 200 || log.statusCode >= 300)) {
        return false;
      }
      if (selectedStatusFilter === "error" && log.statusCode < 400) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesIp = log.ipAddress?.toLowerCase().includes(query);
        const matchesReq = log.requestId?.toLowerCase().includes(query);
        const matchesOrg = log.orgName?.toLowerCase().includes(query);
        const matchesKey = log.keySuffix?.toLowerCase().includes(query);
        if (!matchesIp && !matchesReq && !matchesOrg && !matchesKey) return false;
      }
      return true;
    });
  }, [apiUsageLogs, selectedOrgFilter, selectedTypeFilter, selectedStatusFilter, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let callsToday = 0;
    let callsThisMonth = 0;
    let totalRevenueThisMonth = 0;
    let errorCount = 0;
    const orgCallCounts: Record<string, number> = {};

    for (const log of apiUsageLogs) {
      const time = log.timestamp ? new Date(log.timestamp).getTime() : 0;
      if (time >= startOfToday) callsToday++;
      if (time >= startOfMonth) {
        callsThisMonth++;
        totalRevenueThisMonth += Number(log.cost) || 0;
      }
      if ((log.statusCode || 200) >= 400) {
        errorCount++;
      }
      const orgKey = log.orgName || log.orgId || "Unknown";
      orgCallCounts[orgKey] = (orgCallCounts[orgKey] || 0) + 1;
    }

    let mostActiveOrg = "—";
    let maxCalls = 0;
    for (const [org, count] of Object.entries(orgCallCounts)) {
      if (count > maxCalls) {
        maxCalls = count;
        mostActiveOrg = org;
      }
    }

    const errorRate = apiUsageLogs.length > 0 ? Math.round((errorCount / apiUsageLogs.length) * 100) : 0;

    return {
      callsToday,
      callsThisMonth,
      totalRevenueThisMonth,
      mostActiveOrg,
      maxCalls,
      errorRate,
      activeKeysCount: apiKeys.filter((k) => k.status === "active").length,
    };
  }, [apiUsageLogs, apiKeys]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetOrgId) {
      alert("Please select an organisation");
      return;
    }
    setIsGenerating(true);
    try {
      const keyData = await generateApiKey(targetOrgId, ["*"], customRateLimit);
      if (keyData?.fullKey) {
        setNewlyCreatedKey(keyData.fullKey);
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate key");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (apiKeyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    setRevokingId(apiKeyId);
    try {
      await revokeApiKey(apiKeyId);
    } catch (err: any) {
      alert(err.message || "Failed to revoke key");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">API Usage & Integration Console</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#016e1c]/10 text-[#016e1c] border border-[#016e1c]/20">
              Live Monitor
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Global monitoring of external API requests, request latency, billable usage, and client API keys.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshData()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
          <button
            onClick={() => {
              setNewlyCreatedKey(null);
              setShowGenerateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#016e1c] text-white hover:bg-[#015816] shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Generate Client API Key
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">API Calls Today</span>
            <span className="material-symbols-outlined text-blue-500 text-lg">today</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{metrics.callsToday}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Total requests logged today</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Calls This Month</span>
            <span className="material-symbols-outlined text-purple-500 text-lg">calendar_month</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{metrics.callsThisMonth}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Monthly billing volume</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">API Revenue (MTD)</span>
            <span className="material-symbols-outlined text-emerald-600 text-lg">payments</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">${metrics.totalRevenueThisMonth.toFixed(2)}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Estimated usage billable</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Most Active Org</span>
            <span className="material-symbols-outlined text-amber-500 text-lg">corporate_fare</span>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-900 truncate block" title={metrics.mostActiveOrg}>
              {metrics.mostActiveOrg}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {metrics.maxCalls > 0 ? `${metrics.maxCalls} calls recorded` : "No activity"}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Keys / Error %</span>
            <span className="material-symbols-outlined text-indigo-500 text-lg">vpn_key</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{metrics.activeKeysCount}</span>
            <span className="text-xs font-medium text-rose-600">({metrics.errorRate}% err)</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{apiKeys.length} total keys issued</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "logs"
              ? "border-[#016e1c] text-[#016e1c]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">receipt_long</span>
          Live Traffic Logs ({filteredLogs.length})
        </button>
        <button
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "keys"
              ? "border-[#016e1c] text-[#016e1c]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-outlined text-base">key</span>
          API Keys Management ({apiKeys.length})
        </button>
      </div>

      {/* Tab 1: Traffic Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3">
            {/* Org Filter */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Organisation</label>
              <select
                value={selectedOrgFilter}
                onChange={(e) => setSelectedOrgFilter(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#016e1c]"
              >
                <option value="all">All Organisations ({organisations.length})</option>
                {organisations.map((org: Organisation) => (
                  <option key={org.id} value={org.name}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Check Type Filter */}
            <div className="w-[180px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Check Type</label>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#016e1c]"
              >
                <option value="all">All Check Types</option>
                <option value="identity">Identity</option>
                <option value="court_record">Court Record</option>
                <option value="interpol">Interpol</option>
                <option value="rednotice_worldwide">Rednotice Worldwide</option>
                <option value="saflii_court">SAFLII Court</option>
                <option value="saps_wanted">SAPS Wanted</option>
                <option value="uk_court">UK Court</option>
                <option value="malaysia_court">Malaysia Court</option>
                <option value="passport">Passport</option>
                <option value="digital_address">Digital Address</option>
                <option value="employment">Employment</option>
                <option value="education">Education</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-[140px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#016e1c]"
              >
                <option value="all">All Statuses</option>
                <option value="success">200 OK Only</option>
                <option value="error">Errors (4xx / 5xx)</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search IP / Request ID</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Filter by IP, requestId, suffix..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#016e1c]"
                />
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">find_in_page</span>
                <p className="text-sm font-semibold text-slate-700">No API calls recorded</p>
                <p className="text-xs text-slate-400 mt-1">API calls from clients will appear here in real time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Organisation</th>
                      <th className="px-4 py-3">Key Suffix</th>
                      <th className="px-4 py-3">Endpoint / Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Latency</th>
                      <th className="px-4 py-3">Client IP</th>
                      <th className="px-4 py-3">Request ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredLogs.map((log: ApiUsageLog) => {
                      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                      const isClientError = log.statusCode >= 400 && log.statusCode < 500;
                      const isServerError = log.statusCode >= 500;

                      return (
                        <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {log.orgName || log.orgId}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            sk_...{log.keySuffix || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 uppercase tracking-wider">
                              {log.checkType || "API"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isSuccess ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {log.statusCode} OK
                              </span>
                            ) : isClientError ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                {log.statusCode}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                {log.statusCode} Error
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                            {log.cost ? `${log.currency === "INR" ? "₹" : log.currency === "EUR" ? "€" : log.currency === "GBP" ? "£" : "$"}${Number(log.cost).toFixed(2)}` : `${log.currency === "INR" ? "₹" : log.currency === "EUR" ? "€" : log.currency === "GBP" ? "£" : "$"}0.00`}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {log.responseTimeMs ? `${log.responseTimeMs}ms` : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {log.ipAddress || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {log.requestId || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: API Keys Management */}
      {activeTab === "keys" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {apiKeys.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">vpn_key_off</span>
              <p className="text-sm font-semibold text-slate-700">No API keys created yet</p>
              <p className="text-xs text-slate-400 mt-1">Generate a key for any client organisation above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Organisation</th>
                    <th className="px-5 py-3">Key Token (Masked)</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Rate Limit</th>
                    <th className="px-5 py-3">Created Date</th>
                    <th className="px-5 py-3">Created By</th>
                    <th className="px-5 py-3">Last Used</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {apiKeys.map((k: ApiKey) => {
                    const isActive = k.status === "active";
                    return (
                      <tr key={k._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {k.orgName}
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          {k.keyPrefix || "sk_live_"}••••••••••••••••••••••••••••{k.keySuffix}
                        </td>
                        <td className="px-5 py-3.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Revoked
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">
                          {k.rateLimit || 100} req/min
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {k.createdAt ? new Date(k.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {k.createdBy || "System"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Never"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isActive ? (
                            <button
                              onClick={() => handleRevokeKey(k._id)}
                              disabled={revokingId === k._id}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {revokingId === k._id ? "Revoking..." : "Revoke"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Revoked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Generate API Key */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
            {!newlyCreatedKey ? (
              <form onSubmit={handleGenerateKey} className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-3">
                  <span className="material-symbols-outlined text-[#016e1c]">vpn_key</span>
                  <h3 className="text-base font-bold">Generate Client API Key</h3>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Target Organisation *</label>
                  <select
                    value={targetOrgId}
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 focus:ring-1 focus:ring-[#016e1c]"
                  >
                    <option value="">Select Organisation...</option>
                    {organisations.map((org: Organisation) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rate Limit (Requests / minute)</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={customRateLimit}
                    onChange={(e) => setCustomRateLimit(parseInt(e.target.value, 10))}
                    className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-1 focus:ring-[#016e1c]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Default is 100 requests per minute per key.</p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-[#016e1c] text-white hover:bg-[#015816] disabled:opacity-50"
                  >
                    {isGenerating ? "Generating..." : "Create Secret Key"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">API Key Created Successfully</h3>
                    <p className="text-xs text-slate-500">Copy this key now. It will never be shown again.</p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <strong>Notice:</strong> Please provide this key securely to the client. We only store a cryptographic SHA-256 hash in the database.
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Secret Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newlyCreatedKey}
                      className="w-full font-mono text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                      className="px-3 py-2 bg-[#016e1c] text-white text-xs font-semibold rounded-xl shrink-0 hover:bg-[#015816]"
                    >
                      {copiedKey ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setShowGenerateModal(false);
                      setNewlyCreatedKey(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
