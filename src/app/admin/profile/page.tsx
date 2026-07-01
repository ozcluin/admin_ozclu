"use client";

import React, { useState, useEffect } from "react";
import { usePortal } from "src/context/PortalContext";

export default function AdminProfilePage() {
  const { settings, updateSettings } = usePortal();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [cin, setCin] = useState("");
  const [sac, setSac] = useState("");
  const [lut, setLut] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [billingSameAsCompany, setBillingSameAsCompany] = useState(true);
  const [billingAddress, setBillingAddress] = useState("");

  // Sync form states with settings from context
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "Cluso Infolink Private Limited");
      setContactEmail(settings.contactEmail || "indiaops@cluso.in");
      setGstin(settings.gstin || "29AADCC1935C1ZZ");
      setCin(settings.cin || "U74140KA2007PTC042369");
      setSac(settings.sac || "U72900GJ2018PTC654321");
      setLut(settings.lut || "LUT12345");
      setAddress(settings.address || "Evoma #14, Old Madras Road, Near Garden City College, Bhattarahalli, Binna Mangala, Krishnarajapuram, Bengaluru, Karnataka, 560049");
      setCity(settings.city || "Bengaluru");
      setPostalCode(settings.postalCode || "560049");
      setInvoiceEmail(settings.invoiceEmail || "indiaops@cluso.in");
      setBillingSameAsCompany(settings.billingSameAsCompany !== undefined ? settings.billingSameAsCompany : true);
      setBillingAddress(settings.billingAddress || "Evoma #14, Old Madras Road, Near Garden City College, Bhattarahalli, Binna Mangala, Krishnarajapuram, Bengaluru, Karnataka, 560049");
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setSaving(true);

    try {
      await updateSettings({
        ...settings,
        companyName,
        contactEmail,
        gstin,
        cin,
        sac,
        lut,
        address,
        city,
        postalCode,
        invoiceEmail,
        billingSameAsCompany,
        billingAddress,
      });
      setSuccess("Cluso Infolink details updated successfully!");
      setTimeout(() => setSuccess(""), 4500);
    } catch (err: any) {
      setError(err.message || "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-600 font-bold text-3xl">settings</span>
          <span>Admin Profile Settings</span>
        </h1>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
          Configure Cluso Infolink organizational details used on billable summaries and invoices.
        </p>
      </div>

      {success && (
        <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/15 rounded-2xl p-4 font-body-sm flex items-center gap-3.5 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          <span className="font-bold">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/5 text-rose-600 border border-rose-500/15 rounded-2xl p-4 font-body-sm flex items-center gap-3.5 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-xl">error</span>
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Main Settings Panel */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#42C2FF]/12 rounded-3xl p-6 md:p-8 flex flex-col gap-8 shadow-[0_4px_25px_rgba(66,194,255,0.03)]">
        
        {/* Section 1: Organisation Identity */}
        <div className="flex flex-col gap-5">
          <h3 className="font-headline-md text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2 mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">domain</span>
            <span>Organisation Identity</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Company Display Name</label>
              <input 
                type="text" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Cluso Infolink Private Limited" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Operations Contact Email</label>
              <input 
                type="email" 
                value={contactEmail} 
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. indiaops@cluso.in" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Statutory & Tax Registrations */}
        <div className="flex flex-col gap-5">
          <h3 className="font-headline-md text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2 mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">gavel</span>
            <span>Statutory & Tax Registrations</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">GSTIN</label>
              <input 
                type="text" 
                value={gstin} 
                onChange={(e) => setGstin(e.target.value)}
                placeholder="e.g. 29AADCC1935C1ZZ" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">CIN / Registration</label>
              <input 
                type="text" 
                value={cin} 
                onChange={(e) => setCin(e.target.value)}
                placeholder="e.g. U74140KA2007PTC042369" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">SAC Code</label>
              <input 
                type="text" 
                value={sac} 
                onChange={(e) => setSac(e.target.value)}
                placeholder="e.g. U72900GJ2018PTC654321" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">LUT Code</label>
              <input 
                type="text" 
                value={lut} 
                onChange={(e) => setLut(e.target.value)}
                placeholder="e.g. LUT12345" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Registered Address */}
        <div className="flex flex-col gap-5">
          <h3 className="font-headline-md text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2 mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">location_on</span>
            <span>Registered Address</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Street Address</label>
              <input 
                type="text" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Evoma #14, Old Madras Road" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">City</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bengaluru" 
                  className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Postal Code</label>
                <input 
                  type="text" 
                  value={postalCode} 
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="560049" 
                  className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Billing Configuration */}
        <div className="flex flex-col gap-5">
          <h3 className="font-headline-md text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2 mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-400 text-[18px]">payments</span>
            <span>Billing & Invoice Details</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Billing/Invoice Email</label>
              <input 
                type="email" 
                value={invoiceEmail} 
                onChange={(e) => setInvoiceEmail(e.target.value)}
                placeholder="e.g. accounts@cluso.in" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-4 mt-6">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={billingSameAsCompany} 
                  onChange={(e) => setBillingSameAsCompany(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500/20 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700">Billing address is same as registered address</span>
              </label>
            </div>
          </div>

          {!billingSameAsCompany && (
            <div className="flex flex-col gap-2 animate-slide-down">
              <label className="font-label-caps text-slate-500 uppercase tracking-wider text-[10px] font-bold">Billing Address</label>
              <textarea 
                rows={3}
                value={billingAddress} 
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Enter complete billing address" 
                className="w-full border border-slate-200/80 rounded-xl p-3 font-body-sm text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-[#42C2FF]/10 focus:border-[#42C2FF] transition-all"
              />
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end pt-4 border-t border-slate-100 shrink-0">
          <button 
            type="submit" 
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#134074] hover:brightness-110 text-white font-button-text rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 h-11 w-full sm:w-auto border-none disabled:opacity-40 disabled:cursor-not-allowed font-bold"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[16px]">save</span>
            )}
            <span>Save Profile Settings</span>
          </button>
        </div>

      </form>
    </div>
  );
}
