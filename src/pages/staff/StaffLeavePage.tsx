/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalendarDays, CheckCircle, Clock, Plus, XCircle } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { LeaveRequest, LeaveType, PayrollRuleConfig } from '../../types';
import { applyLeave, cancelLeave, getPayrollRules, listLeaveRequests } from '../../lib/api';
import { useAuth } from '../../lib/authContext';
import { DEFAULT_PAYROLL_RULES, formatKolkataDate } from '../../lib/payrollCalculator';
import {
  countInclusiveDays,
  monthOf,
  summarizeLeaveBalance,
  validateLeaveDraft,
} from '../../lib/leaveRules';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const StaffLeavePage: React.FC = () => {
  const { staffProfile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [rules, setRules] = useState<PayrollRuleConfig>(DEFAULT_PAYROLL_RULES);
  const [month, setMonth] = useState<string>(currentMonth());
  const [loading, setLoading] = useState<boolean>(true);
  const [isApplyOpen, setIsApplyOpen] = useState<boolean>(false);
  const [form, setForm] = useState<{
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }>({ leaveType: 'CL', startDate: today(), endDate: today(), reason: '' });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (staffProfile) loadLeave();
  }, [staffProfile]);

  async function loadLeave() {
    if (!staffProfile) return;
    setLoading(true);
    try {
      const [loadedRequests, loadedRules] = await Promise.all([
        listLeaveRequests(staffProfile.id),
        getPayrollRules(DEFAULT_PAYROLL_RULES.id),
      ]);
      setRequests(loadedRequests);
      if (loadedRules) setRules(loadedRules);
    } catch (err) {
      console.warn('Error loading leave:', err);
    } finally {
      setLoading(false);
    }
  }

  const balance = useMemo(
    () => summarizeLeaveBalance(requests, rules, month),
    [requests, rules, month]
  );
  const monthOptions = useMemo(() => {
    const values = new Set<string>([currentMonth(), month]);
    requests.forEach((request) => values.add(request.leaveMonth));
    return Array.from(values).sort().reverse();
  }, [requests, month]);

  const previewDays = countInclusiveDays(form.startDate, form.endDate);

  function openApply() {
    setForm({ leaveType: 'CL', startDate: today(), endDate: today(), reason: '' });
    setFormErrors([]);
    setIsApplyOpen(true);
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateLeaveDraft(form, rules, requests);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    setFormErrors([]);
    try {
      await applyLeave({
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
      });
      setIsApplyOpen(false);
      setMonth(monthOf(form.startDate));
      await loadLeave();
    } catch (err) {
      setFormErrors([err instanceof Error ? err.message : 'Failed to submit leave request.']);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(request: LeaveRequest) {
    if (!window.confirm('Cancel this pending leave request?')) return;
    setCancellingId(request.id);
    try {
      await cancelLeave(request.id);
      await loadLeave();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to cancel leave request.');
    } finally {
      setCancellingId(null);
    }
  }

  if (!staffProfile) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
        No active staff profile is linked to this account.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Apply for Leave
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Apply for CL, EL, or LWP. Pending and approved days count toward your monthly allowance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            {monthOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            onClick={openApply}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Apply Leave</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-indigo-500" /> CL remaining
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{balance.clRemaining}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {balance.clDays} CL + {balance.elWithinCl} EL used of {balance.clAllowed}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> EL remaining
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{balance.elRemaining}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {balance.elDays} EL used of {balance.elAllowed}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> LWP used
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{balance.lwpDays}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Unpaid leave, no monthly cap</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Dates</th>
                <th className="py-3 px-4 font-semibold text-right">Days</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Reviewer Note</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!loading && requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No leave requests yet. Use Apply Leave to submit one.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold">{request.leaveType}</td>
                    <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-400">
                      {formatKolkataDate(request.startDate)} → {formatKolkataDate(request.endDate)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{request.days}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusStyles[request.status] || statusStyles.PENDING}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 max-w-[220px] whitespace-normal">
                      {request.reviewNote || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {request.status === 'PENDING' ? (
                        <button
                          onClick={() => handleCancel(request)}
                          disabled={cancellingId === request.id}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors disabled:opacity-50 ml-auto"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isApplyOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Apply for Leave</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Requests must start and end within one calendar month. Future dates only.
              </p>
            </div>

            {formErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1">
                {formErrors.map((error) => (
                  <div key={error}>• {error}</div>
                ))}
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Leave Type *</label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value as LeaveType })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="CL">CL — Casual Leave (within CL allowance)</option>
                  <option value="EL">EL — Permission Leave (within CL allowance)</option>
                  <option value="LWP">LWP — Leave Without Pay</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    min={today()}
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    min={form.startDate || today()}
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Requested days: <span className="font-semibold text-slate-700 dark:text-slate-300">{previewDays}</span>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApplyOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
