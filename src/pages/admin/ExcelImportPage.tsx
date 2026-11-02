/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  XCircle
} from 'lucide-react';
import React, { useState } from 'react';
import { PayrollRecord, StaffProfile } from '../../types';
import {
  getPayrollPeriod,
  savePayrollPeriod,
  savePayrollRecords,
  saveStaff
} from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import {
  ImportValidationResult,
  parseSpreadsheetFile,
  validateAndProcessImportRows
} from '../../lib/excelImporter';
import {
  calculatePayroll,
  DEFAULT_PAYROLL_RULES,
  formatIndianCurrency,
  getDaysInPeriod
} from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const ExcelImportPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [periodId, setPeriodId] = useState<string>('2026-07');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<{ imported: number; message: string } | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setImportReport(null);

    try {
      const rawRows = await parseSpreadsheetFile(file);
      const processed = validateAndProcessImportRows(rawRows, 31);
      setValidationResult(processed);
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Failed to parse spreadsheet. Please ensure it is a valid CSV or XLSX/XLSM file.');
    } finally {
      setIsParsing(false);
    }
  }

  function toggleRowExclusion(index: number) {
    if (!validationResult) return;
    const updated = [...validationResult.rows];
    updated[index].isExcluded = !updated[index].isExcluded;

    const validCount = updated.filter((r) => r.isValid && !r.isExcluded).length;
    setValidationResult({
      ...validationResult,
      rows: updated,
      validRowsCount: validCount,
    });
  }

  // Execute batch import into Supabase
  async function handleExecuteImport() {
    if (!validationResult || validationResult.validRowsCount === 0) return;

    setIsImporting(true);
    try {
      const eligibleRows = validationResult.rows.filter((r) => r.isValid && !r.isExcluded);
      const now = new Date().toISOString();
      const days = getDaysInPeriod(periodId);

      const existingPeriod = await getPayrollPeriod(periodId);
      if (!existingPeriod) {
        const [yearStr, monthStr] = periodId.split('-');
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        await savePayrollPeriod({
          id: periodId,
          month: monthNames[parseInt(monthStr, 10) - 1] || 'Current',
          year: parseInt(yearStr, 10),
          daysInMonth: days,
          status: 'Draft',
          ruleVersionId: DEFAULT_PAYROLL_RULES.id,
          termsVersionId: 'terms-v1.0',
          totalEmployees: eligibleRows.length,
          totalBaseSalary: 0,
          totalAdditions: 0,
          totalDeductions: 0,
          totalNetPayout: 0,
          createdBy: userProfile?.email || 'hr@topclues.in',
          createdAt: now,
        });
      }

      const records: PayrollRecord[] = [];

      for (const row of eligibleRows) {
        const staffId = `staff_imp_${row.employeeCode.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // 1. Staff Profile
        const staffProfile: StaffProfile = {
          id: staffId,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          googleEmail: row.googleEmail,
          department: row.department || 'General',
          designation: row.designation || 'Staff',
          monthlySalary: row.inputs.monthlySalary,
          dateOfJoining: '2026-04-01',
          employmentType: 'Full-Time',
          workLocation: 'Bengaluru HQ',
          salaryEffectiveDate: '2026-04-01',
          status: 'Active',
          bankVerificationStatus: 'Pending',
          createdAt: now,
          updatedAt: now,
        };
        await saveStaff(staffProfile);

        // 2. Payroll Record for specified period
        const calc = calculatePayroll(row.inputs, days, DEFAULT_PAYROLL_RULES);
        records.push({
          id: staffId,
          periodId,
          staffId,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          department: row.department,
          designation: row.designation,
          dateOfJoining: '2026-04-01',
          ...row.inputs,
          ...calc,
          slipVersion: 1,
          slipStatus: 'NotGenerated',
          emailStatus: 'NotSent',
          termsVersionId: 'terms-v1.0',
          ruleVersionId: DEFAULT_PAYROLL_RULES.id,
          updatedAt: now,
        });
      }

      await savePayrollRecords(records);

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'MIGRATE_EXCEL_SALARY_WORKBOOK',
        entityType: 'PAYROLL',
        entityId: periodId,
        details: {
          periodId,
          fileName: selectedFile?.name,
          importedRows: eligibleRows.length,
          recalculated: true,
        },
      });

      setImportReport({
        imported: eligibleRows.length,
        message: `Successfully migrated ${eligibleRows.length} employee records to ${periodId} with verified deterministic calculations.`,
      });
    } catch (err) {
      console.error('Import error:', err);
      alert('An error occurred during database migration.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Salary Workbook Migration Wizard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Migrate existing payroll spreadsheets into the secure database. Macro scripts are dropped; all totals are strictly recalculated deterministically.
          </p>
        </div>

        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
        >
          <option value="2026-07">Target Period: July 2026</option>
          <option value="2026-08">Target Period: August 2026</option>
        </select>
      </div>

      {/* File Upload Drop Zone */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Upload Salary Workbook (CSV, XLSX, or XLSM)
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            VBA macros and external scripts will be discarded safely prior to parsing.
          </div>
        </div>

        <input
          type="file"
          id="fileUpload"
          accept=".csv,.xlsx,.xlsm"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div>
          <label
            htmlFor="fileUpload"
            className="inline-block px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer shadow-sm transition-colors"
          >
            {isParsing ? 'Parsing Workbook...' : 'Select Spreadsheet File'}
          </label>
        </div>

        {selectedFile && (
          <div className="text-xs font-mono text-slate-500">
            Selected: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedFile.name}</span> (
            {(selectedFile.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </div>

      {/* Import Report Banner */}
      {importReport && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <span className="font-bold">Migration Complete: </span>
              {importReport.message}
            </div>
          </div>
        </div>
      )}

      {/* Validation & Preview Screen */}
      {validationResult && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400">Total Rows:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {validationResult.totalRows}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Ready to Import:</span>{' '}
                <span className="font-bold text-emerald-600 tabular-nums">
                  {validationResult.validRowsCount}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Errors Detected:</span>{' '}
                <span className="font-bold text-red-600 tabular-nums">
                  {validationResult.errorRowsCount}
                </span>
              </div>
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={isImporting || validationResult.validRowsCount === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isImporting ? 'Migrating...' : `Commit ${validationResult.validRowsCount} Rows to Database`}
            </button>
          </div>

          {/* Table Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-center">Include</th>
                    <th className="py-2.5 px-3 font-semibold">Row</th>
                    <th className="py-2.5 px-3 font-semibold">Employee</th>
                    <th className="py-2.5 px-3 font-semibold">Google Email</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Base Salary</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Recalculated Net</th>
                    <th className="py-2.5 px-3 font-semibold">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {validationResult.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.isExcluded
                          ? 'opacity-40 bg-slate-50 dark:bg-slate-900'
                          : !row.isValid
                          ? 'bg-red-50/40 dark:bg-red-950/20'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={!row.isExcluded}
                          onChange={() => toggleRowExclusion(idx)}
                          className="rounded text-indigo-600"
                        />
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        #{row.rowIndex}
                      </td>

                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {row.employeeCode} · {row.department}
                        </div>
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {row.googleEmail}
                      </td>

                      <td className="py-2 px-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                        {formatIndianCurrency(row.inputs.monthlySalary)}
                      </td>

                      <td className="py-2 px-3 text-right tabular-nums font-bold text-indigo-700 dark:text-indigo-300">
                        {formatIndianCurrency(row.calculatedNet)}
                      </td>

                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Valid</span>
                          </span>
                        ) : (
                          <div className="text-[11px] text-red-600 font-medium">
                            {row.errors.map((e, i) => (
                              <div key={i}>• {e}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
