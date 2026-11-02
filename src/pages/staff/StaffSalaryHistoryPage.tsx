/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Calendar, Download, FileText } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CompanySettings, PayrollRecord, TermsVersion } from '../../types';
import { getCompanySettings, getPayrollRecord, getTerm } from '../../lib/api';
import { generateSalarySlipPDF, getSalarySlipFileName } from '../../lib/pdfGenerator';
import { formatIndianCurrency, formatKolkataDate } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const StaffSalaryHistoryPage: React.FC = () => {
  const { staffProfile } = useAuth();
  const [historyRecords, setHistoryRecords] = useState<PayrollRecord[]>([]);
  const [company, setCompanySettings] = useState<CompanySettings | null>(null);
  const [terms, setTerms] = useState<TermsVersion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSalaryHistory();
  }, [staffProfile]);

  async function loadSalaryHistory() {
    if (!staffProfile) return;
    setLoading(true);
    try {
      const company = await getCompanySettings();
      if (company) setCompanySettings(company);

      const termsVersion = await getTerm('terms-v1.0');
      if (termsVersion) setTerms(termsVersion);

      // Scoped only to the authenticated staff member by RLS
      const periodId = '2026-07';
      const record = await getPayrollRecord(periodId, staffProfile.id);
      if (record) setHistoryRecords([record]);
    } catch (err) {
      console.warn('Salary history load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadPDF(record: PayrollRecord) {
    if (!company) return;
    const doc = generateSalarySlipPDF({
      record,
      monthName: 'July',
      year: 2026,
      company,
      terms: terms || undefined,
      slipNumber: `TCS-${record.periodId}-${record.employeeCode}-v${record.slipVersion || 1}`,
      version: record.slipVersion || 1,
    });

    const fileName = getSalarySlipFileName(record.fullName, 'July', 2026);
    doc.save(fileName);
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          My Salary History & Compensation Ledger
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Review historical compensation breakdowns, additions, deductions, and official A4 PDF salary slips.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Period</th>
                <th className="py-3 px-4 font-semibold text-right">Base Salary</th>
                <th className="py-3 px-4 font-semibold text-right text-emerald-600">Additions</th>
                <th className="py-3 px-4 font-semibold text-right text-amber-600">Deductions</th>
                <th className="py-3 px-4 font-semibold text-right font-bold">Net Salary Paid</th>
                <th className="py-3 px-4 font-semibold">Slip Version</th>
                <th className="py-3 px-4 font-semibold text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {historyRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No historical salary records published yet.
                  </td>
                </tr>
              ) : (
                historyRecords.map((r) => (
                  <tr key={r.periodId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      July 2026 (31 Days)
                    </td>

                    <td className="py-3 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
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

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        v{r.slipVersion || 1}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownloadPDF(r)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
