/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Building2,
  CheckCircle,
  Clock,
  Globe,
  Lock,
  Mail,
  Save,
  Shield,
  Sliders
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CompanySettings, PayrollRuleConfig } from '../../types';
import { getCompanySettings, getPayrollRules, saveCompanySettings, savePayrollRules } from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { DEFAULT_PAYROLL_RULES } from '../../lib/payrollCalculator';
import { DEFAULT_COMPANY_SETTINGS } from '../../lib/seedData';
import { useAuth } from '../../lib/authContext';

export const CompanySettingsPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [rules, setRules] = useState<PayrollRuleConfig>(DEFAULT_PAYROLL_RULES);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const loadedSettings = await getCompanySettings();
      if (loadedSettings) setSettings(loadedSettings);

      const loadedRules = await getPayrollRules(DEFAULT_PAYROLL_RULES.id);
      if (loadedRules) setRules(loadedRules);
    } catch (err) {
      console.warn('Error loading company settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert('Only a Super Admin can update company settings or payroll rules.');
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      const updatedSettings = {
        ...settings,
        updatedBy: userProfile?.email || 'ceo@topclues.in',
        updatedAt: new Date().toISOString(),
      };

      const updatedRules = {
        ...rules,
        updatedBy: userProfile?.email || 'ceo@topclues.in',
        updatedAt: new Date().toISOString(),
      };

      await saveCompanySettings(updatedSettings);
      await savePayrollRules(updatedRules);

      await logAuditEvent({
        actorUid: userProfile?.uid || 'SUPER_ADMIN',
        actorEmail: userProfile?.email || 'ceo@topclues.in',
        actorRole: 'SUPER_ADMIN',
        action: 'UPDATE_COMPANY_SETTINGS_AND_RULES',
        entityType: 'SETTINGS',
        entityId: 'main',
        details: {
          companyName: updatedSettings.companyName,
          authorizedSignatory: updatedSettings.authorizedSignatoryName,
          earlyLeaveRate: updatedRules.earlyLeaveRatePerHour,
          extraBreakRate: updatedRules.extraBreakRatePerHour,
        },
      });

      setStatusMsg('Company settings and calculation rules successfully saved.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setStatusMsg('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Company Configuration & Payroll Rules
            </h1>
            {!isSuperAdmin && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700">
                Super Admin Only
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure enterprise identity, authorized signatories, default email templates, and statutory calculation rates.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings & Rates'}</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="p-3 text-xs rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between">
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Company Master Settings Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Corporate Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Corporate Identity & Address
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Legal Name
              </label>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Registered Address (Appears on Salary Slips)
              </label>
              <textarea
                rows={2}
                disabled={!isSuperAdmin}
                value={settings.registeredAddress}
                onChange={(e) => setSettings({ ...settings, registeredAddress: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Company Official Email
                </label>
                <input
                  type="email"
                  disabled={!isSuperAdmin}
                  value={settings.companyEmail}
                  onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Official Phone
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settings.companyPhone}
                  onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Authorized Signatory Name
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settings.authorizedSignatoryName}
                  onChange={(e) =>
                    setSettings({ ...settings, authorizedSignatoryName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Signatory Designation
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settings.authorizedSignatoryDesignation}
                  onChange={(e) =>
                    setSettings({ ...settings, authorizedSignatoryDesignation: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Salary Slip Footer Notice
              </label>
              <input
                type="text"
                disabled={!isSuperAdmin}
                value={settings.salarySlipFooter}
                onChange={(e) => setSettings({ ...settings, salarySlipFooter: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
              />
            </div>
          </div>
        </div>

        {/* Calculation Rates & Parameters Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Configurable Payroll Calculation Rates
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
              Note: Changes to calculation rates apply to future draft cycles only. Finalized periods retain their immutable snapshot.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Extra Break Deduction (₹/hr)
                </label>
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  value={rules.extraBreakRatePerHour}
                  onChange={(e) =>
                    setRules({ ...rules, extraBreakRatePerHour: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Early Leave Deduction (₹/hr)
                </label>
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  value={rules.earlyLeaveRatePerHour}
                  onChange={(e) =>
                    setRules({ ...rules, earlyLeaveRatePerHour: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Extra Hours Pay (₹/hr)
                </label>
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  value={rules.extraHoursRatePerHour}
                  onChange={(e) =>
                    setRules({ ...rules, extraHoursRatePerHour: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Holiday Hourly Pay (₹/hr)
                </label>
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  value={rules.holidayHourlyRate}
                  onChange={(e) =>
                    setRules({ ...rules, holidayHourlyRate: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Outdoor Work Pay (₹/day)
                </label>
                <input
                  type="number"
                  disabled={!isSuperAdmin}
                  value={rules.outdoorWorkRatePerDay}
                  onChange={(e) =>
                    setRules({ ...rules, outdoorWorkRatePerDay: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Holiday Full-Day Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  disabled={!isSuperAdmin}
                  value={rules.holidayWorkingDayMultiplier}
                  onChange={(e) =>
                    setRules({ ...rules, holidayWorkingDayMultiplier: Number(e.target.value) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payroll Email Sender Name
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={settings.payrollEmailSenderName}
                  onChange={(e) =>
                    setSettings({ ...settings, payrollEmailSenderName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payroll Email Sender Address
                </label>
                <input
                  type="email"
                  disabled={!isSuperAdmin}
                  value={settings.payrollEmailSenderAddress}
                  onChange={(e) =>
                    setSettings({ ...settings, payrollEmailSenderAddress: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
