/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle, Clock, RefreshCw, Search, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { LeaveRequest, PayrollRuleConfig, StaffProfile } from '../../types';
import { getPayrollRules, listLeaveRequests, listStaff, reviewLeave } from '../../lib/api';
import { useAuth } from '../../lib/authContext';
import { DEFAULT_PAYROLL_RULES, formatKolkataDate } from '../../lib/payrollCalculator';
import { summarizeLeaveBalance } from '../../lib/leaveRules';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const LeaveRequestsPage: React.FC = () => {
  const { staffProfile } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [rules, setRules] = useState<PayrollRuleConfig>(DEFAULT_PAYROLL_RULES);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reviewing, setReviewing] = useState<LeaveRequest | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewingSaving, setReviewingSaving] = useState<boolean>(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const [loadedRequests, loadedStaff, loadedRules] = await Promise.all([
        listLeaveRequests(),
        listStaff(),
        getPayrollRules(DEFAULT_PAYROLL_RULES.id),
      ]);
      setRequests(loadedRequests);
      setStaffList(loadedStaff);
      if (loadedRules) setRules(loadedRules);
    } catch (err) {
      console.warn('Error loading leave requests:', err);
    } finally {
      setLoading(false);
    }
  }

  const staffById = new Map(staffList.map((member) => [member.id, member]));
  const months = Array.from(new Set(requests.map((request) => request.leaveMonth))).sort().reverse();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const filtered = requests.filter((request) => {
    const staff = staffById.get(request.staffId);
    const haystack = `${staff?.fullName || ''} ${staff?.employeeCode || ''} ${request.reason}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || request.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || request.leaveType === typeFilter;
    const matchesMonth = monthFilter === 'ALL' || request.leaveMonth === monthFilter;
    return matchesSearch && matchesStatus && matchesType && matchesMonth;
  });

  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;
  const approvedThisMonth = requests.filter(
    (request) => request.status === 'APPROVED' && request.leaveMonth === currentMonth
  ).length;
  const rejectedCount = requests.filter((request) => request.status === 'REJECTED').length;

  function openReview(request: LeaveRequest) {
    setReviewing(request);
    setReviewNote('');
    setReviewError(null);
  }

  async function handleDecision(decision: 'APPROVE' | 'REJECT') {
    if (!reviewing) return;
    if (decision === 'REJECT' && !reviewNote.trim()) {
      setReviewError('A rejection note is required.');
      return;
    }

    setReviewingSaving(true);
    setReviewError(null);
    try {
      await reviewLeave(reviewing.id, decision, reviewNote.trim() || undefined);
      setReviewing(null);
      await loadRequests();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to review leave request.');
    } finally {
      setReviewingSaving(false);
    }
  }

  const reviewBalance = reviewing
    ? summarizeLeaveBalance(
        requests.filter((request) => request.staffId === reviewing.staffId),
        rules,
        reviewing.leaveMonth
      )
    : null;
  const reviewIsSelf = !!reviewing && !!staffProfile && reviewing.staffId === staffProfile.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Leave Requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review CL, EL, and LWP applications. Pending and approved days count toward monthly balances.
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{pendingCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Approved this month
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{approvedThisMonth}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-500" /> Rejected
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{rejectedCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by staff, code, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Types</option>
            <option value="CL">CL</option>
            <option value="EL">EL</option>
            <option value="LWP">LWP</option>
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Months</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Staff</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Dates</th>
                <th className="py-3 px-4 font-semibold text-right">Days</th>
                <th className="py-3 px-4 font-semibold">Month</th>
                <th className="py-3 px-4 font-semibold">Applied</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No leave requests match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((request) => {
                  const staff = staffById.get(request.staffId);
                  return (
                    <tr key={request.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {staff?.fullName || request.staffId}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {staff?.employeeCode || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">{request.leaveType}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-400">
                        {formatKolkataDate(request.startDate)} → {formatKolkataDate(request.endDate)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums">{request.days}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">{request.leaveMonth}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        {request.appliedOnBehalf ? 'On behalf' : 'Self'} · {request.appliedByEmail}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusStyles[request.status] || statusStyles.PENDING}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openReview(request)}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                        >
                          {request.status === 'PENDING' ? 'Review' : 'View'}
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

      {reviewing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {reviewing.status === 'PENDING' ? 'Review Leave Request' : 'Leave Request'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {staffById.get(reviewing.staffId)?.fullName || reviewing.staffId} · {reviewing.leaveType} ·{' '}
                {formatKolkataDate(reviewing.startDate)} → {formatKolkataDate(reviewing.endDate)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Days</span>
                <span className="font-semibold tabular-nums">{reviewing.days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reason</span>
                <span className="text-right">{reviewing.reason}</span>
              </div>
              {reviewBalance && (
                <>
                  <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                    <span className="text-slate-500">CL used / allowed</span>
                    <span className="font-mono">
                      {reviewBalance.clDays} + {reviewBalance.elWithinCl} EL / {reviewBalance.clAllowed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">EL used / allowed</span>
                    <span className="font-mono">
                      {reviewBalance.elDays} / {reviewBalance.elAllowed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">LWP days</span>
                    <span className="font-mono">{reviewBalance.lwpDays}</span>
                  </div>
                </>
              )}
            </div>

            {reviewError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {reviewError}
              </div>
            )}

            {reviewIsSelf ? (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                You cannot review your own leave request. Another HR member or the Super Admin must decide it.
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Review Note {reviewing.status === 'PENDING' ? '' : '(read-only)'}
                </label>
                <textarea
                  rows={2}
                  value={reviewNote}
                  disabled={reviewing.status !== 'PENDING'}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Required when rejecting"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-75"
                />
                {reviewing.reviewNote && reviewing.status !== 'PENDING' && (
                  <div className="text-[11px] text-slate-500">Recorded note: {reviewing.reviewNote}</div>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewing(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              {reviewing.status === 'PENDING' && !reviewIsSelf && (
                <>
                  <button
                    onClick={() => handleDecision('REJECT')}
                    disabled={reviewingSaving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleDecision('APPROVE')}
                    disabled={reviewingSaving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{reviewingSaving ? 'Saving...' : 'Approve'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
