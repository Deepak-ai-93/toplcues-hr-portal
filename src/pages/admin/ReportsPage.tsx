/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertTriangle,
  Banknote,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Printer,
  ShieldAlert
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { PayrollRecord } from '../../types';
import { listPayrollRecords } from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { formatIndianCurrency } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const ReportsPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [periodId, setPeriodId] = useState<string>('2026-07');
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [activeReport, setActiveReport] = useState<string>('SUMMARY');
  const [loading, setLoading] = useState<boolean>(true);

  // Audited Bank Payment Export Modal
  const [isBankExportModalOpen, setIsBankExportModalOpen] = useState<boolean>(false);
  const [bankExportReason, setBankExportReason] = useState<string>('');

  useEffect(() => {
    loadReportData(periodId);
  }, [periodId]);

  async function loadReportData(pId: string) {
    setLoading(true);
    try {
      const list = await listPayrollRecords(pId);
      setRecords(list);
    } catch (err) {
      console.warn('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV(csvContent: string, fileName: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }

  // Export Standard CSV (Masked bank details)
  function handleExportStandardCSV() {
    let header = '';
    let rows: string[] = [];

    if (activeReport === 'SUMMARY' || activeReport === 'LEDGER') {
      header = 'Employee Code,Employee Name,Department,Designation,Monthly Base,LWP Deduct,Excess CL Deduct,Extra EL Deduct,Late Deduct,Break Deduct,Early Leave Deduct,Overtime,Holiday Pymt,Outdoor Pymt,Gross Additions,Total Deductions,Net Salary';
      rows = records.map((r) =>
        `"${r.employeeCode}","${r.fullName}","${r.department}","${r.designation}",${r.monthlySalary},${r.lwpDeduction},${r.excessCLDeduction},${r.extraELDeduction},${r.lateDeduction},${r.extraBreakDeduction},${r.earlyLeaveDeduction},${r.extraHoursPayment},${r.holidayDayPayment},${r.outdoorPayment},${r.grossAdditions},${r.totalDeductions},${r.netSalary}`
      );
    } else if (activeReport === 'ATTENDANCE') {
      header = 'Employee Code,Employee Name,Department,LWP Days,CL Days,EL Count,Late Count,Extra Break Hrs,Early Leave Hrs,OT Hrs,Holiday Days,Outdoor Days';
      rows = records.map((r) =>
        `"${r.employeeCode}","${r.fullName}","${r.department}",${r.lwpDays || 0},${r.clDays || 0},${r.elCount || 0},${r.lateCount || 0},${r.extraBreakHours || 0},${r.earlyLeaveHours || 0},${r.extraHours || 0},${r.holidayWorkingDays || 0},${r.outdoorWorkingDays || 0}`
      );
    } else {
      header = 'Employee Code,Employee Name,Department,Monthly Base,Gross Additions,Total Deductions,Net Salary';
      rows = records.map((r) =>
        `"${r.employeeCode}","${r.fullName}","${r.department}",${r.monthlySalary},${r.grossAdditions},${r.totalDeductions},${r.netSalary}`
      );
    }

    const csvContent = `${header}\n${rows.join('\n')}`;
    downloadCSV(csvContent, `Topclues_${activeReport}_${periodId}.csv`);
  }

  // Audited Bank Payment Export
  async function handleConfirmBankPaymentExport() {
    if (!bankExportReason.trim()) return;

    await logAuditEvent({
      actorUid: userProfile?.uid || 'ADMIN',
      actorEmail: userProfile?.email || 'admin@topclues.in',
      actorRole: role || 'HR',
      action: 'EXPORT_BANK_PAYMENT_FILE',
      entityType: 'BANK',
      entityId: periodId,
      details: {
        periodId,
        recordCount: records.length,
        totalNetPayout: records.reduce((s, r) => s + r.netSalary, 0),
        reason: bankExportReason.trim(),
      },
    });

    // Generate NEFT/Bank batch format with simulated unmasked account numbers
    const header = 'Beneficiary Name,Account Number,IFSC Code,Amount,Payment Mode,Remarks';
    const rows = records.map((r) => {
      // Safely replace mask with bank prefix for payout file
      const unmaskedAcc = (r.accountNumberMasked || 'XXXXXX1234').replace('XXXXXX', '501000');
      return `"${r.fullName}","${unmaskedAcc}","${r.ifsc || 'HDFC0001234'}",${r.netSalary},"NEFT","Salary ${periodId}"`;
    });

    const csvContent = `${header}\n${rows.join('\n')}`;
    downloadCSV(csvContent, `Topclues_Bank_Payout_${periodId}_AUDITED.csv`);
    setIsBankExportModalOpen(false);
    setBankExportReason('');
    alert('Bank payment payout report exported and audit event logged.');
  }

  const totalBase = records.reduce((s, r) => s + (r.monthlySalary || 0), 0);
  const totalAdd = records.reduce((s, r) => s + (r.grossAdditions || 0), 0);
  const totalDed = records.reduce((s, r) => s + (r.totalDeductions || 0), 0);
  const totalNet = records.reduce((s, r) => s + (r.netSalary || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Payroll & Operational Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Export compliant financial registers, attendance records, and controlled banking payment files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
          >
            <option value="2026-07">July 2026</option>
            <option value="2026-08">August 2026</option>
            <option value="2026-09">September 2026</option>
          </select>

          <button
            onClick={handleExportStandardCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[
          { id: 'SUMMARY', label: 'Monthly Payroll Summary' },
          { id: 'LEDGER', label: 'Employee Salary Ledger' },
          { id: 'ATTENDANCE', label: 'Attendance & LWP/CL/EL Register' },
          { id: 'ADDITIONS', label: 'Additions & Overtime Register' },
          { id: 'DEDUCTIONS', label: 'Deductions & Late Register' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
              activeReport === tab.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <button
          onClick={() => {
            setBankExportReason('');
            setIsBankExportModalOpen(true);
          }}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center gap-1.5 hover:bg-amber-100"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Bank Payment File (Audited)</span>
        </button>
      </div>

      {/* Report Table Display */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-4 font-semibold text-right">Base Salary</th>
                <th className="py-3 px-4 font-semibold text-right text-emerald-600">Additions</th>
                <th className="py-3 px-4 font-semibold text-right text-amber-600">Deductions</th>
                <th className="py-3 px-4 font-semibold text-right font-bold">Net Payout</th>
                <th className="py-3 px-4 font-semibold text-center">Bank Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.staffId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{r.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{r.employeeCode}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {r.department}
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums text-slate-900 dark:text-slate-100 font-medium">
                      {formatIndianCurrency(r.monthlySalary)}
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums text-emerald-600 font-medium">
                      +{formatIndianCurrency(r.grossAdditions)}
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums text-amber-600 font-medium">
                      -{formatIndianCurrency(r.totalDeductions)}
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {formatIndianCurrency(r.netSalary)}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500">
                      {r.accountNumberMasked || 'XXXXXX1234'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
              <tr>
                <td className="py-3 px-4" colSpan={2}>
                  Period Grand Totals ({records.length} Staff)
                </td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {formatIndianCurrency(totalBase)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-emerald-600">
                  +{formatIndianCurrency(totalAdd)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-amber-600">
                  -{formatIndianCurrency(totalDed)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-indigo-700 dark:text-indigo-300">
                  {formatIndianCurrency(totalNet)}
                </td>
                <td className="py-3 px-4 text-center text-xs font-normal text-slate-400">
                  Calculated
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* AUDITED BANK PAYMENT EXPORT MODAL */}
      {isBankExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Export Bank Payment Disbursement File
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  This file is strictly for corporate banking batch transfers (NEFT / RTGS). Generating this export requires an audited business justification.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Disbursement Justification *
              </label>
              <textarea
                required
                rows={2}
                placeholder="e.g. Monthly salary batch upload to HDFC Corporate NetBanking"
                value={bankExportReason}
                onChange={(e) => setBankExportReason(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBankExportModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBankPaymentExport}
                disabled={!bankExportReason.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                Authorize & Export Bank File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
