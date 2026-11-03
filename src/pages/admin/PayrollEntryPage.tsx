/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  Calculator,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Download,
  Eye,
  FileCheck,
  Lock,
  Mail,
  RefreshCw,
  Save,
  Send,
  Unlock
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CompanySettings, PayrollCalculationBreakdown, PayrollPeriod, PayrollRecord, StaffProfile, TermsVersion } from '../../types';
import {
  getCompanySettings,
  getPayrollPeriod,
  getTerm,
  listPayrollRecords,
  listStaff,
  savePayrollPeriod,
  savePayrollRecords,
  saveSalarySlip,
  updatePayrollPeriod,
  updatePayrollRecord
} from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { queueOrSendSalarySlipEmail } from '../../lib/emailService';
import { generateSalarySlipPDF, getSalarySlipFileName } from '../../lib/pdfGenerator';
import {
  calculatePayroll,
  DEFAULT_PAYROLL_RULES,
  formatIndianCurrency,
  getDaysInPeriod
} from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

interface DecimalInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Text-based numeric input so a decimal point can be typed before a digit
// (type="number" + controlled value drops partial entries like "1.").
function DecimalInput({ value, onChange, disabled }: DecimalInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? String(Number.isFinite(value) ? value : 0);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      disabled={disabled}
      value={display}
      onFocus={(e) => {
        setDraft(display);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setDraft(raw);
        const parsed = Number.parseFloat(raw);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
      onBlur={() => setDraft(null)}
      className="w-14 text-center py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
    />
  );
}

export const PayrollEntryPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [periodId, setPeriodId] = useState<string>('2026-07');
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [terms, setTerms] = useState<TermsVersion | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Breakdown Preview Modal
  const [previewRecord, setPreviewRecord] = useState<PayrollRecord | null>(null);

  // Batch Email Confirmation Modal
  const [isBatchEmailModalOpen, setIsBatchEmailModalOpen] = useState<boolean>(false);
  const [emailProgress, setEmailProgress] = useState<{ sent: number; total: number; isSending: boolean } | null>(null);

  useEffect(() => {
    loadPayrollData(periodId);
  }, [periodId]);

  async function loadPayrollData(pId: string) {
    setLoading(true);
    setSaveStatus(null);
    try {
      // 1. Load Company Settings
      const company = await getCompanySettings();
      if (company) setCompanySettings(company);

      // 2. Load Terms Version
      const termsVersion = await getTerm('terms-v1.0');
      if (termsVersion) setTerms(termsVersion);

      // 3. Load Staff
      const allStaff = await listStaff();
      const activeStaff = allStaff.filter((s) => s.status === 'Active');
      setStaffList(activeStaff);

      // 4. Load Period definition or create if missing
      const existingPeriod = await getPayrollPeriod(pId);
      const days = pId === '2026-07' ? 31 : getDaysInPeriod(pId);

      let currentPeriod: PayrollPeriod;
      if (existingPeriod) {
        currentPeriod = existingPeriod;
      } else {
        const [yearStr, monthStr] = pId.split('-');
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[parseInt(monthStr, 10) - 1] || 'Current';

        currentPeriod = {
          id: pId,
          month: monthName,
          year: parseInt(yearStr, 10),
          daysInMonth: days,
          status: 'Draft',
          ruleVersionId: DEFAULT_PAYROLL_RULES.id,
          termsVersionId: 'terms-v1.0',
          totalEmployees: activeStaff.length,
          totalBaseSalary: 0,
          totalAdditions: 0,
          totalDeductions: 0,
          totalNetPayout: 0,
          createdBy: userProfile?.email || 'admin@topclues.in',
          createdAt: new Date().toISOString(),
        };
        await savePayrollPeriod(currentPeriod);
      }
      setPeriod(currentPeriod);

      // 5. Load Records
      const existingRecords = await listPayrollRecords(pId);
      const recordMap: Record<string, PayrollRecord> = {};
      existingRecords.forEach((record) => {
        recordMap[record.staffId] = record;
      });

      // Synchronize with active staff
      const synchedRecords: PayrollRecord[] = activeStaff.map((staff) => {
        if (recordMap[staff.id]) {
          return recordMap[staff.id];
        }

        // Initialize new record
        const inputs = {
          monthlySalary: staff.monthlySalary,
          lwpDays: 0,
          clDays: 0,
          elCount: 0,
          lateCount: 0,
          extraBreakHours: 0,
          earlyLeaveHours: 0,
          extraPayment: 0,
          extraHours: 0,
          holidayWorkingDays: 0,
          outdoorWorkingDays: 0,
          holidayWorkingHours: 0,
          remarks: '',
        };

        const calc = calculatePayroll(inputs, days, DEFAULT_PAYROLL_RULES);

        return {
          id: staff.id,
          periodId: pId,
          staffId: staff.id,
          employeeCode: staff.employeeCode,
          fullName: staff.fullName,
          department: staff.department,
          designation: staff.designation,
          dateOfJoining: staff.dateOfJoining,
          bankName: staff.bankName,
          accountNumberMasked: staff.accountNumberMasked,
          ifsc: staff.ifsc,
          ...inputs,
          ...calc,
          slipVersion: 1,
          slipStatus: 'NotGenerated',
          emailStatus: 'NotSent',
          termsVersionId: 'terms-v1.0',
          ruleVersionId: DEFAULT_PAYROLL_RULES.id,
          updatedAt: new Date().toISOString(),
        };
      });

      setRecords(synchedRecords);
    } catch (err) {
      console.error('Error loading payroll data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Update input for an employee
  function handleInputChange(staffId: string, field: keyof PayrollRecord, value: any) {
    if (period?.status === 'Finalized' || period?.status === 'Closed') {
      alert('This payroll period is Finalized and locked. Only Super Admin can reopen.');
      return;
    }

    setRecords((prev) =>
      prev.map((r) => {
        if (r.staffId !== staffId) return r;

        const updated = {
          ...r,
          [field]: typeof value === 'number' ? Math.max(0, value) : value,
        };

        // Recompute live calculation deterministically
        const calc = calculatePayroll(
          {
            monthlySalary: updated.monthlySalary,
            lwpDays: updated.lwpDays,
            clDays: updated.clDays,
            elCount: updated.elCount,
            lateCount: updated.lateCount,
            extraBreakHours: updated.extraBreakHours,
            earlyLeaveHours: updated.earlyLeaveHours,
            extraPayment: updated.extraPayment,
            extraHours: updated.extraHours,
            holidayWorkingDays: updated.holidayWorkingDays,
            outdoorWorkingDays: updated.outdoorWorkingDays,
            holidayWorkingHours: updated.holidayWorkingHours,
          },
          period?.daysInMonth || 31,
          DEFAULT_PAYROLL_RULES
        );

        return {
          ...updated,
          ...calc,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }

  // Save draft inputs to the database
  async function handleSaveDraft() {
    if (!period) return;
    setSaving(true);
    setSaveStatus('Saving changes...');

    try {
      let sumBase = 0;
      let sumAdd = 0;
      let sumDed = 0;
      let sumNet = 0;

      records.forEach((r) => {
        sumBase += r.monthlySalary || 0;
        sumAdd += r.grossAdditions || 0;
        sumDed += r.totalDeductions || 0;
        sumNet += r.netSalary || 0;
      });

      await savePayrollRecords(records);
      await updatePayrollPeriod(period.id, {
        totalBaseSalary: sumBase,
        totalAdditions: sumAdd,
        totalDeductions: sumDed,
        totalNetPayout: sumNet,
        status: period.status === 'Draft' ? 'Calculated' : period.status,
      });

      setPeriod((prev) => (prev ? { ...prev, totalBaseSalary: sumBase, totalAdditions: sumAdd, totalDeductions: sumDed, totalNetPayout: sumNet } : null));

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'SAVE_PAYROLL_INPUTS',
        entityType: 'PAYROLL',
        entityId: period.id,
        details: {
          periodId: period.id,
          totalEmployees: records.length,
          totalNetPayout: sumNet,
        },
      });

      setSaveStatus('Draft saved successfully.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Save draft error:', err);
      setSaveStatus('Error saving draft.');
    } finally {
      setSaving(false);
    }
  }

  // Finalize Payroll Period
  async function handleFinalizePayroll() {
    if (!period) return;
    if (period.status === 'Finalized' || period.status === 'Closed') return;

    const confirmed = window.confirm(
      `Are you sure you want to finalize payroll for ${period.month} ${period.year}?\n\nThis will lock attendance inputs and snapshot calculation rules.`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await handleSaveDraft();

      await updatePayrollPeriod(period.id, {
        status: 'Finalized',
        finalizedBy: userProfile?.email,
        finalizedAt: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'FINALIZE_PAYROLL',
        entityType: 'PAYROLL',
        entityId: period.id,
        details: {
          periodId: period.id,
          totalNetPayout: period.totalNetPayout,
        },
      });

      setPeriod((prev) => (prev ? { ...prev, status: 'Finalized' } : null));
      alert('Payroll has been successfully Finalized and locked.');
    } catch (err) {
      console.error('Finalize error:', err);
    } finally {
      setSaving(false);
    }
  }

  // Reopen Finalized Payroll (Super Admin only)
  async function handleReopenPayroll() {
    if (!isSuperAdmin) {
      alert('Only a Super Admin is authorized to reopen finalized payroll.');
      return;
    }

    const reason = prompt('Please enter the mandatory audit reason for reopening finalized payroll:');
    if (!reason || !reason.trim()) return;

    setSaving(true);
    try {
      await updatePayrollPeriod(periodId, {
        status: 'Calculated',
        reopenedBy: userProfile?.email,
        reopenedAt: new Date().toISOString(),
        reopenReason: reason.trim(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'SUPER_ADMIN',
        actorEmail: userProfile?.email || 'ceo@topclues.in',
        actorRole: 'SUPER_ADMIN',
        action: 'REOPEN_PAYROLL',
        entityType: 'PAYROLL',
        entityId: periodId,
        details: {
          periodId,
          reason: reason.trim(),
        },
      });

      setPeriod((prev) => (prev ? { ...prev, status: 'Calculated' } : null));
      alert('Payroll reopened for corrections. Audit event logged.');
    } catch (err) {
      console.error('Reopen error:', err);
    } finally {
      setSaving(false);
    }
  }

  // Batch Generate Salary Slips
  async function handleBatchGenerateSlips() {
    if (!companySettings || records.length === 0) return;

    setSaving(true);
    setSaveStatus('Generating salary slip PDFs...');

    try {
      for (const record of records) {
        const slipNumber = `TCS-${periodId}-${record.employeeCode}-v${record.slipVersion || 1}`;

        // Save slip metadata
        await saveSalarySlip({
          slipNumber,
          periodId,
          staffId: record.staffId,
          employeeCode: record.employeeCode,
          fullName: record.fullName,
          version: record.slipVersion || 1,
          netSalary: record.netSalary,
          termsVersionId: terms?.id || 'terms-v1.0',
          generatedAt: new Date().toISOString(),
          isSuperseded: false,
        });

        // Update record status
        await updatePayrollRecord(periodId, record.staffId, {
          slipStatus: 'Generated',
          updatedAt: new Date().toISOString(),
        });
      }

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'BATCH_GENERATE_SLIPS',
        entityType: 'SALARY_SLIP',
        entityId: periodId,
        details: {
          periodId,
          count: records.length,
        },
      });

      setRecords((prev) => prev.map((r) => ({ ...r, slipStatus: 'Generated' })));
      setSaveStatus('All salary slips generated successfully.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Batch generate error:', err);
      setSaveStatus('Error generating slips.');
    } finally {
      setSaving(false);
    }
  }

  // Batch Email Salary Slips
  async function handleBatchEmailExecution() {
    if (!companySettings || records.length === 0) return;

    setIsBatchEmailModalOpen(false);
    setEmailProgress({ sent: 0, total: records.length, isSending: true });

    let sentCount = 0;
    for (const record of records) {
      await queueOrSendSalarySlipEmail({
        record,
        monthName: period?.month || 'July',
        year: period?.year || 2026,
        company: companySettings,
        senderUid: userProfile?.uid || 'HR',
        senderEmail: userProfile?.email || 'hr@topclues.in',
        senderRole: (role as 'SUPER_ADMIN' | 'HR') || 'HR',
      });
      sentCount++;
      setEmailProgress({ sent: sentCount, total: records.length, isSending: true });
    }

    setEmailProgress(null);
    setRecords((prev) => prev.map((r) => ({ ...r, emailStatus: 'Sent', slipStatus: 'Published' })));

    // Mark period Published
    await updatePayrollPeriod(periodId, {
      status: 'Published',
      publishedBy: userProfile?.email,
      publishedAt: new Date().toISOString(),
    });
    setPeriod((prev) => (prev ? { ...prev, status: 'Published' } : null));

    alert(`Batch email complete: ${sentCount} individual salary slips dispatched to employees.`);
  }

  const isLocked = period?.status === 'Finalized' || period?.status === 'Closed';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Monthly Payroll & Attendance Entry
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                isLocked
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
              }`}
            >
              {period?.status || 'Draft'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enter monthly attendance, casual leaves, overtime, and field days. Intermediate components calculate live.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
          >
            <option value="2026-07">July 2026 (31 Days)</option>
            <option value="2026-08">August 2026 (31 Days)</option>
            <option value="2026-09">September 2026 (30 Days)</option>
            <option value="2026-10">October 2026 (31 Days)</option>
            <option value="2026-11">November 2026 (30 Days)</option>
            <option value="2026-12">December 2026 (31 Days)</option>
          </select>

          {!isLocked ? (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>

              <button
                onClick={handleFinalizePayroll}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Finalize Period</span>
              </button>
            </>
          ) : (
            isSuperAdmin && (
              <button
                onClick={handleReopenPayroll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Reopen Finalized Payroll</span>
              </button>
            )
          )}

          <button
            onClick={handleBatchGenerateSlips}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-lg hover:bg-indigo-100"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Generate Slips</span>
          </button>

          <button
            onClick={() => setIsBatchEmailModalOpen(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish & Email</span>
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3 text-xs rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-between">
          <span>{saveStatus}</span>
        </div>
      )}

      {emailProgress && (
        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200">
          <div className="font-semibold flex items-center justify-between mb-2">
            <span>Dispatching individual salary slip emails...</span>
            <span className="tabular-nums">
              {emailProgress.sent} / {emailProgress.total}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-indigo-200 dark:bg-indigo-900 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-200"
              style={{ width: `${(emailProgress.sent / emailProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Main High-Density Calculation Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-xs">
                  Employee
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">Base Salary</th>
                <th className="py-2.5 px-3 font-semibold text-center">LWP</th>
                <th className="py-2.5 px-3 font-semibold text-center">CL (Max 2)</th>
                <th className="py-2.5 px-3 font-semibold text-center">EL (1.5x)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Late (2 Gr.)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Extra Brk (₹50)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Early Lv (₹50)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Extra Pay (₹)</th>
                <th className="py-2.5 px-3 font-semibold text-center">OT Hrs (₹100)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Hol Days (1.5x)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Outdoor (₹500)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Hol Hrs (₹150)</th>
                <th className="py-2.5 px-3 font-semibold text-right text-emerald-700 dark:text-emerald-400">
                  +Additions
                </th>
                <th className="py-2.5 px-3 font-semibold text-right text-amber-700 dark:text-amber-400">
                  -Deductions
                </th>
                <th className="py-2.5 px-3 font-semibold text-right font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30">
                  Net Payout
                </th>
                <th className="py-2.5 px-3 font-semibold text-center">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={17} className="py-8 text-center text-slate-400">
                    No active staff found for this payroll cycle.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.staffId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    {/* Employee Identity */}
                    <td className="py-2 px-3 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{r.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.employeeCode} · {r.department}
                      </div>
                    </td>

                    {/* Monthly Base */}
                    <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatIndianCurrency(r.monthlySalary)}
                    </td>

                    {/* LWP Days */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.lwpDays || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'lwpDays', value)}
                      />
                    </td>

                    {/* CL Days */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.clDays || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'clDays', value)}
                      />
                    </td>

                    {/* EL Count */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.elCount || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'elCount', value)}
                      />
                    </td>

                    {/* Late Count */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.lateCount || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'lateCount', value)}
                      />
                    </td>

                    {/* Extra Break Hours */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.extraBreakHours || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'extraBreakHours', value)}
                      />
                    </td>

                    {/* Early Leave Hours */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.earlyLeaveHours || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'earlyLeaveHours', value)}
                      />
                    </td>

                    {/* Extra Pay */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.extraPayment || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'extraPayment', value)}
                      />
                    </td>

                    {/* OT Hours */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.extraHours || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'extraHours', value)}
                      />
                    </td>

                    {/* Holiday Working Days */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.holidayWorkingDays || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'holidayWorkingDays', value)}
                      />
                    </td>

                    {/* Outdoor Days */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.outdoorWorkingDays || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'outdoorWorkingDays', value)}
                      />
                    </td>

                    {/* Holiday Working Hours */}
                    <td className="py-2 px-2 text-center">
                      <DecimalInput
                        value={r.holidayWorkingHours || 0}
                        disabled={isLocked}
                        onChange={(value) => handleInputChange(r.staffId, 'holidayWorkingHours', value)}
                      />
                    </td>

                    {/* Calculated Gross Additions */}
                    <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatIndianCurrency(r.grossAdditions)}
                    </td>

                    {/* Calculated Total Deductions */}
                    <td className="py-2 px-3 text-right font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                      -{formatIndianCurrency(r.totalDeductions)}
                    </td>

                    {/* Net Salary Payable */}
                    <td className="py-2 px-3 text-right font-bold text-indigo-950 dark:text-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/30 tabular-nums">
                      {formatIndianCurrency(r.netSalary)}
                    </td>

                    {/* Preview Breakdown Action */}
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => setPreviewRecord(r)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 rounded"
                        title="View Detailed Math Breakdown"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED FORMULA BREAKDOWN MODAL */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Calculation Breakdown: {previewRecord.fullName}
                </h3>
                <div className="text-xs text-slate-500 font-mono">
                  {previewRecord.employeeCode} · {period?.month} {period?.year} ({period?.daysInMonth} Payroll Days)
                </div>
              </div>
              <button
                onClick={() => setPreviewRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between">
                <span>Per-Day Salary Basis (₹{previewRecord.monthlySalary} ÷ {period?.daysInMonth}):</span>
                <span className="font-bold tabular-nums">
                  {formatIndianCurrency(previewRecord.perDaySalary)}
                </span>
              </div>

              {/* Deductions Breakdown Table */}
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Deductions Breakdown
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-2.5 flex justify-between">
                    <span>LWP ({previewRecord.lwpDays} days × Per-Day Salary):</span>
                    <span className="font-mono tabular-nums">-{formatIndianCurrency(previewRecord.lwpDeduction)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Excess CL ({previewRecord.excessCLDays} days beyond quota):</span>
                    <span className="font-mono tabular-nums">-{formatIndianCurrency(previewRecord.excessCLDeduction)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Excess EL ({previewRecord.extraELCount} count × 1.5x Per-Day):</span>
                    <span className="font-mono tabular-nums">-{formatIndianCurrency(previewRecord.extraELDeduction)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Late Arrivals ({previewRecord.lateCount} count, {previewRecord.chargeableLateDays} days chg):</span>
                    <span className="font-mono tabular-nums">-{formatIndianCurrency(previewRecord.lateDeduction)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Extra Breaks ({previewRecord.extraBreakHours} hrs × ₹50):</span>
                    <span className="font-mono tabular-nums">-{formatIndianCurrency(previewRecord.extraBreakDeduction)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Early Leaves ({previewRecord.earlyLeaveHours} hrs × ₹50):</span>
                    <span className="font-mono tabular-nums">-{formatIndianCurrency(previewRecord.earlyLeaveDeduction)}</span>
                  </div>
                </div>
              </div>

              {/* Additions Breakdown Table */}
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Additions Breakdown
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-2.5 flex justify-between">
                    <span>Extra Pay:</span>
                    <span className="font-mono tabular-nums">+{formatIndianCurrency(previewRecord.extraPayment)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Overtime ({previewRecord.extraHours} hrs × ₹100):</span>
                    <span className="font-mono tabular-nums">+{formatIndianCurrency(previewRecord.extraHoursPayment)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Full Holiday ({previewRecord.holidayWorkingDays} days × 1.5x Per-Day):</span>
                    <span className="font-mono tabular-nums">+{formatIndianCurrency(previewRecord.holidayDayPayment)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Outdoor Field Duty ({previewRecord.outdoorWorkingDays} days × ₹500):</span>
                    <span className="font-mono tabular-nums">+{formatIndianCurrency(previewRecord.outdoorPayment)}</span>
                  </div>
                  <div className="p-2.5 flex justify-between">
                    <span>Holiday Hourly ({previewRecord.holidayWorkingHours} hrs × ₹150):</span>
                    <span className="font-mono tabular-nums">+{formatIndianCurrency(previewRecord.holidayHourlyPayment)}</span>
                  </div>
                </div>
              </div>

              {/* Final Summary Highlight */}
              <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex justify-between items-center text-sm font-bold">
                <span className="text-indigo-900 dark:text-indigo-200">Total Net Salary:</span>
                <span className="text-indigo-700 dark:text-indigo-300 text-lg tabular-nums">
                  {formatIndianCurrency(previewRecord.netSalary)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewRecord(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH EMAIL CONFIRMATION MODAL */}
      {isBatchEmailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Confirm Batch Salary Slip Publication & Email
            </h3>
            <p className="text-xs text-slate-500">
              You are about to publish and send separate individual emails to {records.length} active staff members.
              Each email contains their verified salary slip and unique authenticated portal link.
            </p>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Period:</span>
                <span className="font-semibold">{period?.month} {period?.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Net Payout:</span>
                <span className="font-semibold tabular-nums">
                  {formatIndianCurrency(records.reduce((s, r) => s + r.netSalary, 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email Dispatch:</span>
                <span className="font-semibold text-emerald-600">Individual Recipients (No BCC/CC)</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBatchEmailModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchEmailExecution}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Confirm Batch Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
