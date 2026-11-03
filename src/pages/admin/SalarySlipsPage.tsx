/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  Mail,
  Send,
  ShieldAlert
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CompanySettings, PayrollRecord, PayrollRuleConfig, TermsVersion } from '../../types';
import { getCompanySettings, getPayrollRules, getTerm, listPayrollRecords } from '../../lib/api';
import { queueOrSendSalarySlipEmail } from '../../lib/emailService';
import { generateSalarySlipPDF, getSalarySlipFileName } from '../../lib/pdfGenerator';
import { DEFAULT_PAYROLL_RULES, formatIndianCurrency } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const SalarySlipsPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [periodId, setPeriodId] = useState<string>('2026-07');
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [company, setCompanySettings] = useState<CompanySettings | null>(null);
  const [terms, setTerms] = useState<TermsVersion | null>(null);
  const [rules, setRules] = useState<PayrollRuleConfig>(DEFAULT_PAYROLL_RULES);
  const [loading, setLoading] = useState<boolean>(true);
  const [sendingEmailStaffId, setSendingEmailStaffId] = useState<string | null>(null);

  useEffect(() => {
    loadSlips(periodId);
  }, [periodId]);

  async function loadSlips(pId: string) {
    setLoading(true);
    try {
      const company = await getCompanySettings();
      if (company) setCompanySettings(company);

      const termsVersion = await getTerm('terms-v1.0');
      if (termsVersion) setTerms(termsVersion);

      const loadedRules = (await getPayrollRules(DEFAULT_PAYROLL_RULES.id)) ?? DEFAULT_PAYROLL_RULES;
      setRules(loadedRules);

      const list = await listPayrollRecords(pId);
      setRecords(list);
    } catch (err) {
      console.warn('Error loading slips:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadPDF(record: PayrollRecord) {
    if (!company) return;

    const [yearStr, monthStr] = periodId.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[parseInt(monthStr, 10) - 1] || 'Current';
    const year = parseInt(yearStr, 10);
    const slipNumber = `TCS-${periodId}-${record.employeeCode}-v${record.slipVersion || 1}`;

    const doc = generateSalarySlipPDF({
      record,
      monthName,
      year,
      company,
      terms: terms || undefined,
      slipNumber,
      version: record.slipVersion || 1,
      rules,
    });

    const fileName = getSalarySlipFileName(record.fullName, monthName, year);
    doc.save(fileName);
  }

  async function handleSendIndividualEmail(record: PayrollRecord) {
    if (!company) return;
    setSendingEmailStaffId(record.staffId);

    const [yearStr, monthStr] = periodId.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[parseInt(monthStr, 10) - 1] || 'Current';

    const res = await queueOrSendSalarySlipEmail({
      record,
      monthName,
      year: parseInt(yearStr, 10),
      company,
      senderUid: userProfile?.uid || 'HR',
      senderEmail: userProfile?.email || 'hr@topclues.in',
      senderRole: (role as 'SUPER_ADMIN' | 'HR') || 'HR',
    });

    setSendingEmailStaffId(null);
    if (res.success) {
      setRecords((prev) =>
        prev.map((r) => (r.staffId === record.staffId ? { ...r, emailStatus: 'Sent' } : r))
      );
      alert(`Salary slip email sent successfully to ${record.fullName}.`);
    } else {
      alert(`Email delivery failed: ${res.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Generated Salary Slips
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Download professional A4 PDF statements and dispatch individual authenticated email links.
          </p>
        </div>

        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
        >
          <option value="2026-07">July 2026 (31 Days)</option>
          <option value="2026-08">August 2026 (31 Days)</option>
          <option value="2026-09">September 2026 (30 Days)</option>
        </select>
      </div>

      {/* Salary Slips Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Slip Identifier</th>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Department</th>
                <th className="py-3 px-4 font-semibold text-right">Net Payout</th>
                <th className="py-3 px-4 font-semibold">Version</th>
                <th className="py-3 px-4 font-semibold">Email Delivery</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No salary slips generated for this period yet. Click "Generate Slips" in the Payroll tab.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const slipNumber = `TCS-${periodId}-${r.employeeCode}-v${r.slipVersion || 1}`;
                  return (
                    <tr key={r.staffId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {slipNumber}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{r.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{r.employeeCode}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {r.department}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatIndianCurrency(r.netSalary)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          v{r.slipVersion || 1}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {r.emailStatus === 'Sent' ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Delivered</span>
                          </span>
                        ) : r.emailStatus === 'Failed' ? (
                          <span className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Not Sent</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleDownloadPDF(r)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() => handleSendIndividualEmail(r)}
                          disabled={sendingEmailStaffId === r.staffId}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Mail className="w-3 h-3" />
                          <span>{sendingEmailStaffId === r.staffId ? 'Sending...' : 'Email'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
