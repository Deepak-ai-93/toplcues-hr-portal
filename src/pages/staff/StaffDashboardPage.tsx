/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Banknote,
  Calendar,
  CheckCircle,
  Download,
  FileCheck,
  FileText,
  Mail,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CompanySettings, PayrollRecord, PayrollRuleConfig, TermsVersion } from '../../types';
import { getCompanySettings, getPayrollRecord, getPayrollRules, getTerm } from '../../lib/api';
import { generateSalarySlipPDF, getSalarySlipFileName } from '../../lib/pdfGenerator';
import { DEFAULT_PAYROLL_RULES, formatIndianCurrency, formatKolkataDate, formatKolkataDateTime } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const StaffDashboardPage: React.FC = () => {
  const { staffProfile, userProfile } = useAuth();
  const [latestRecord, setLatestRecord] = useState<PayrollRecord | null>(null);
  const [company, setCompanySettings] = useState<CompanySettings | null>(null);
  const [terms, setTerms] = useState<TermsVersion | null>(null);
  const [rules, setRules] = useState<PayrollRuleConfig>(DEFAULT_PAYROLL_RULES);
  const [loading, setLoading] = useState<boolean>(true);

  const activePeriodId = '2026-07';

  useEffect(() => {
    loadStaffPortalData();
  }, [staffProfile]);

  async function loadStaffPortalData() {
    setLoading(true);
    try {
      const company = await getCompanySettings();
      if (company) setCompanySettings(company);

      const termsVersion = await getTerm('terms-v1.0');
      if (termsVersion) setTerms(termsVersion);

      const loadedRules = (await getPayrollRules(DEFAULT_PAYROLL_RULES.id)) ?? DEFAULT_PAYROLL_RULES;
      setRules(loadedRules);

      if (staffProfile) {
        // Read the caller's own payroll record (enforced by RLS)
        const record = await getPayrollRecord(activePeriodId, staffProfile.id);
        if (record) setLatestRecord(record);
      }
    } catch (err) {
      console.warn('Error loading staff portal data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadMySlip() {
    if (!latestRecord || !company) return;

    const doc = generateSalarySlipPDF({
      record: latestRecord,
      monthName: 'July',
      year: 2026,
      company,
      terms: terms || undefined,
      slipNumber: `TCS-${activePeriodId}-${latestRecord.employeeCode}-v${latestRecord.slipVersion || 1}`,
      version: latestRecord.slipVersion || 1,
      rules,
    });

    const fileName = getSalarySlipFileName(latestRecord.fullName, 'July', 2026);
    doc.save(fileName);
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Welcome, {staffProfile?.fullName || userProfile?.displayName}
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Active Staff
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {staffProfile?.employeeCode} · {staffProfile?.department} · {staffProfile?.designation} · Joined {formatKolkataDate(staffProfile?.dateOfJoining || '')}
          </div>
        </div>

        {latestRecord && (
          <button
            onClick={handleDownloadMySlip}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 shadow-sm transition-colors whitespace-nowrap self-start sm:self-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download July 2026 Salary Slip</span>
          </button>
        )}
      </div>

      {/* Latest Salary Overview Cards */}
      {latestRecord ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Salary Payable */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs">
              <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                <span>Net Salary Payable</span>
                <Banknote className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-950 dark:text-indigo-100 tabular-nums">
                {formatIndianCurrency(latestRecord.netSalary)}
              </div>
              <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                July 2026 (31 Days)
              </div>
            </div>

            {/* Base Monthly Salary */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
                <span>Monthly Base Salary</span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {formatIndianCurrency(latestRecord.monthlySalary)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Per-day basis: {formatIndianCurrency(latestRecord.perDaySalary)}
              </div>
            </div>

            {/* Gross Additions */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
                <span>Gross Additions</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{formatIndianCurrency(latestRecord.grossAdditions)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Overtime, holidays, outdoor
              </div>
            </div>

            {/* Total Deductions */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs font-medium text-slate-500 flex items-center justify-between">
                <span>Total Deductions</span>
                <TrendingDown className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
                -{formatIndianCurrency(latestRecord.totalDeductions)}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                LWP, excess leaves, late
              </div>
            </div>
          </div>

          {/* Detailed Statement Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings & Deductions Breakdown Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Salary Component Breakdown (July 2026)
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Monthly Basic</span>
                  <span className="font-semibold tabular-nums">{formatIndianCurrency(latestRecord.monthlySalary)}</span>
                </div>
                {latestRecord.extraHoursPayment > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-emerald-600">
                    <span>Overtime ({latestRecord.extraHours} hrs @ ₹100/hr)</span>
                    <span className="font-semibold tabular-nums">+{formatIndianCurrency(latestRecord.extraHoursPayment)}</span>
                  </div>
                )}
                {latestRecord.holidayDayPayment > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-emerald-600">
                    <span>Full Holiday Work ({latestRecord.holidayWorkingDays} days @ 1.5x)</span>
                    <span className="font-semibold tabular-nums">+{formatIndianCurrency(latestRecord.holidayDayPayment)}</span>
                  </div>
                )}
                {latestRecord.outdoorPayment > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-emerald-600">
                    <span>Outdoor Duty Allowance</span>
                    <span className="font-semibold tabular-nums">+{formatIndianCurrency(latestRecord.outdoorPayment)}</span>
                  </div>
                )}
                {latestRecord.lwpDeduction > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                    <span>Leave Without Pay (LWP: {latestRecord.lwpDays} days)</span>
                    <span className="font-semibold tabular-nums">-{formatIndianCurrency(latestRecord.lwpDeduction)}</span>
                  </div>
                )}
                {latestRecord.excessCLDeduction > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                    <span>Excess Casual Leave</span>
                    <span className="font-semibold tabular-nums">-{formatIndianCurrency(latestRecord.excessCLDeduction)}</span>
                  </div>
                )}
                {latestRecord.extraELDeduction > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                    <span>Excess Emergency Leave (1.5x)</span>
                    <span className="font-semibold tabular-nums">-{formatIndianCurrency(latestRecord.extraELDeduction)}</span>
                  </div>
                )}
                {latestRecord.lateDeduction > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                    <span>Late Arrivals Penalty</span>
                    <span className="font-semibold tabular-nums">-{formatIndianCurrency(latestRecord.lateDeduction)}</span>
                  </div>
                )}
                {latestRecord.extraBreakDeduction > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                    <span>Extra Break Duration</span>
                    <span className="font-semibold tabular-nums">-{formatIndianCurrency(latestRecord.extraBreakDeduction)}</span>
                  </div>
                )}
                {latestRecord.earlyLeaveDeduction > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                    <span>Early Departure</span>
                    <span className="font-semibold tabular-nums">-{formatIndianCurrency(latestRecord.earlyLeaveDeduction)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance & Compliance Summary */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Attendance & Permissions Log
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Casual Leave (CL)</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {latestRecord.clDays || 0} / 2 Allowed
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Emergency Leave (EL)</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {latestRecord.elCount || 0} / 1 Allowed
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Late Count (Within 15m)</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {latestRecord.lateCount || 0} (2 Grace)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="text-slate-400">Bank Disbursement</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                    {staffProfile?.accountNumberMasked || 'XXXXXX1234'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                Salary slips are governed by Topclues Solutions Remuneration Policy v1.0. If you have questions regarding your calculation, please submit an inquiry in the Contact HR tab.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 text-xs">
          No published salary record found for the current active cycle.
        </div>
      )}
    </div>
  );
};
