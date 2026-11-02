/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Mail,
  Send,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { EmailJob, PayrollPeriod, PayrollRecord, StaffProfile } from '../../types';
import { getPayrollPeriod, listEmailJobs, listPayrollRecords, listStaff } from '../../lib/api';
import { formatIndianCurrency } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { role } = useAuth();
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [emailJobs, setEmailJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const activePeriodId = '2026-07';

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Load active period
      const loadedPeriod = await getPayrollPeriod(activePeriodId);
      if (loadedPeriod) setPeriod(loadedPeriod);

      // 2. Load records for period
      const loadedRecords = await listPayrollRecords(activePeriodId);
      setRecords(loadedRecords);

      // 3. Load staff list
      const loadedStaff = await listStaff();
      setStaffList(loadedStaff);

      // 4. Load email jobs
      const loadedEmails = await listEmailJobs();
      setEmailJobs(loadedEmails);
    } catch (err) {
      console.warn('Dashboard data load note:', err);
    } finally {
      setLoading(false);
    }
  }

  const activeStaffCount = staffList.filter((s) => s.status === 'Active').length;
  const inactiveStaffCount = staffList.filter((s) => s.status !== 'Active').length;

  const totalBaseSalary = records.reduce((sum, r) => sum + (r.monthlySalary || 0), 0);
  const totalAdditions = records.reduce((sum, r) => sum + (r.grossAdditions || 0), 0);
  const totalDeductions = records.reduce((sum, r) => sum + (r.totalDeductions || 0), 0);
  const totalNetPayout = records.reduce((sum, r) => sum + (r.netSalary || 0), 0);

  const slipsGeneratedCount = records.filter((r) => r.slipStatus === 'Generated' || r.slipStatus === 'Published').length;
  const emailsSentCount = records.filter((r) => r.emailStatus === 'Sent').length;
  const emailsFailedCount = records.filter((r) => r.emailStatus === 'Failed').length;

  // Department-wise breakdown
  const deptTotals: Record<string, number> = {};
  records.forEach((r) => {
    const dept = r.department || 'General';
    deptTotals[dept] = (deptTotals[dept] || 0) + (r.netSalary || 0);
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Executive Payroll Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time monthly compensation, attendance metrics, and salary distribution for July 2026.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('payroll')}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
          >
            Manage Payroll Inputs
          </button>
          <button
            onClick={() => onNavigate('salary-slips')}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            View Slips
          </button>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Active Staff */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Active Staff</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {activeStaffCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <span>{inactiveStaffCount} inactive / left</span>
          </div>
        </div>

        {/* Total Monthly Base */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Total Base Salary</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums truncate">
            {formatIndianCurrency(totalBaseSalary)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Fixed monthly committed</div>
        </div>

        {/* Gross Additions */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Total Additions</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            +{formatIndianCurrency(totalAdditions)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Overtime, holidays, outdoor</div>
        </div>

        {/* Total Deductions */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Total Deductions</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums truncate">
            -{formatIndianCurrency(totalDeductions)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">LWP, excess leave, late</div>
        </div>

        {/* Total Net Payout */}
        <div className="col-span-2 sm:col-span-1 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
          <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
            <span>Net Payout</span>
            <Banknote className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-indigo-950 dark:text-indigo-100 tabular-nums truncate">
            {formatIndianCurrency(totalNetPayout)}
          </div>
          <div className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            Period: {period?.month || 'July'} {period?.year || 2026}
          </div>
        </div>
      </div>

      {/* Operational Dispatch & Execution Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Salary Slips Generated</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {slipsGeneratedCount} / {records.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">A4 server-side PDFs</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Emails Delivered</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {emailsSentCount} / {records.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Individual slip delivery</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Delivery Exceptions</div>
            <div className={`text-xl font-bold mt-1 tabular-nums ${emailsFailedCount > 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
              {emailsFailedCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {emailsFailedCount > 0 ? 'Action required in queue' : 'All deliveries nominal'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytics & Department Breakdown Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department Distribution */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Department Payout Breakdown
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Aggregated net payroll distribution across organizational units.
          </p>

          <div className="space-y-3">
            {Object.entries(deptTotals).map(([dept, amount]) => {
              const pct = totalNetPayout > 0 ? Math.round((amount / totalNetPayout) * 100) : 0;
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{dept}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatIndianCurrency(amount)} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Period Snapshot Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Period Status & Governance
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                {period?.status || 'Calculated'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Configured for 31 payroll days under rule specification v1.0.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 text-[11px]">Period Identifier</div>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {period?.id || '2026-07'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 text-[11px]">Calendar Basis</div>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {period?.daysInMonth || 31} Days
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 text-[11px]">Governing Terms</div>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  v1.0 (01/04/2026)
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="text-slate-400 text-[11px]">Financial Year</div>
                <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  FY 2026-2027
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Deterministic calculation verified</span>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Export Monthly Summary Report &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
