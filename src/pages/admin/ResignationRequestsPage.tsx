/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowRight, CheckCircle, FileWarning, RefreshCw, Search, UserPlus, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ResignationRequest, ResignationStatus, StaffProfile } from '../../types';
import {
  listResignationRequests,
  listStaff,
  reviewResignation,
  submitResignation,
} from '../../lib/api';
import { useAuth } from '../../lib/authContext';
import { formatKolkataDate } from '../../lib/payrollCalculator';

const statusLabels: Record<ResignationStatus, string> = {
  PENDING_HR: 'Pending HR',
  PENDING_CEO: 'Pending CEO',
  APPROVED: 'Approved / Left',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const statusStyles: Record<ResignationStatus, string> = {
  PENDING_HR: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  PENDING_CEO: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  WITHDRAWN: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const ResignationRequestsPage: React.FC = () => {
  const { role, staffProfile } = useAuth();
  const [requests, setRequests] = useState<ResignationRequest[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ResignationStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [reviewing, setReviewing] = useState<ResignationRequest | null>(null);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState<boolean>(false);
  const [isOnBehalfOpen, setIsOnBehalfOpen] = useState<boolean>(false);
  const [onBehalfStaffId, setOnBehalfStaffId] = useState<string>('');
  const [onBehalfDate, setOnBehalfDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [onBehalfReason, setOnBehalfReason] = useState<string>('');
  const [onBehalfError, setOnBehalfError] = useState<string | null>(null);
  const [onBehalfSaving, setOnBehalfSaving] = useState<boolean>(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const [loadedRequests, loadedStaff] = await Promise.all([
        listResignationRequests(),
        listStaff(),
      ]);
      setRequests(loadedRequests);
      setStaffList(loadedStaff);
    } catch (err) {
      console.warn('Error loading resignation requests:', err);
    } finally {
      setLoading(false);
    }
  }

  const staffById = new Map(staffList.map((member) => [member.id, member]));
  const activeStaff = staffList.filter((member) => member.status === 'Active');
  const filtered = requests.filter((request) => {
    const staff = staffById.get(request.staffId);
    const haystack = `${staff?.fullName || ''} ${staff?.employeeCode || ''} ${request.reason}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function canAct(request: ResignationRequest): boolean {
    if (staffProfile && request.staffId === staffProfile.id) return false;
    if (request.status === 'PENDING_HR') return role === 'HR';
    if (request.status === 'PENDING_CEO') return role === 'SUPER_ADMIN';
    return false;
  }

  function openReview(request: ResignationRequest) {
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

    if (decision === 'APPROVE' && reviewing.status === 'PENDING_CEO') {
      const confirmed = window.confirm(
        `Final approval will mark ${staffById.get(reviewing.staffId)?.fullName || 'this staff member'} as Left with effect from ${formatKolkataDate(reviewing.lastWorkingDate)} and revoke portal access immediately. Continue?`
      );
      if (!confirmed) return;
    }

    setReviewSaving(true);
    setReviewError(null);
    try {
      await reviewResignation(reviewing.id, decision, reviewNote.trim() || undefined);
      setReviewing(null);
      await loadRequests();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to review resignation.');
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleSubmitOnBehalf(e: React.FormEvent) {
    e.preventDefault();
    if (!onBehalfStaffId) {
      setOnBehalfError('Select a staff member.');
      return;
    }
    if (!onBehalfReason.trim()) {
      setOnBehalfError('A resignation reason is required.');
      return;
    }

    setOnBehalfSaving(true);
    setOnBehalfError(null);
    try {
      await submitResignation({
        staffId: onBehalfStaffId,
        lastWorkingDate: onBehalfDate,
        reason: onBehalfReason.trim(),
      });
      setIsOnBehalfOpen(false);
      setOnBehalfStaffId('');
      setOnBehalfReason('');
      await loadRequests();
    } catch (err) {
      setOnBehalfError(err instanceof Error ? err.message : 'Failed to submit resignation.');
    } finally {
      setOnBehalfSaving(false);
    }
  }

  const counts = {
    ALL: requests.length,
    PENDING_HR: requests.filter((request) => request.status === 'PENDING_HR').length,
    PENDING_CEO: requests.filter((request) => request.status === 'PENDING_CEO').length,
    APPROVED: requests.filter((request) => request.status === 'APPROVED').length,
    REJECTED: requests.filter((request) => request.status === 'REJECTED').length,
    WITHDRAWN: requests.filter((request) => request.status === 'WITHDRAWN').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Resignation Requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Two-step approval: HR review first, then CEO final approval. Final approval moves the employee to Old Staffs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadRequests}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setOnBehalfError(null);
              setIsOnBehalfOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Submit On Behalf</span>
          </button>
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ResignationStatus)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Statuses ({counts.ALL})</option>
          <option value="PENDING_HR">Pending HR ({counts.PENDING_HR})</option>
          <option value="PENDING_CEO">Pending CEO ({counts.PENDING_CEO})</option>
          <option value="APPROVED">Approved ({counts.APPROVED})</option>
          <option value="REJECTED">Rejected ({counts.REJECTED})</option>
          <option value="WITHDRAWN">Withdrawn ({counts.WITHDRAWN})</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Staff</th>
                <th className="py-3 px-4 font-semibold">Last Working Date</th>
                <th className="py-3 px-4 font-semibold">Reason</th>
                <th className="py-3 px-4 font-semibold">Initiated</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No resignation requests match the current filters.
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
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {formatKolkataDate(request.lastWorkingDate)}
                      </td>
                      <td className="py-3 px-4 max-w-[260px] whitespace-normal text-slate-600 dark:text-slate-400">
                        {request.reason}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        {request.initiator === 'SELF' ? 'Self' : 'On behalf'} · {request.requestedByEmail}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusStyles[request.status]}`}>
                          {statusLabels[request.status]}
                        </span>
                        {request.rejectionStage && (
                          <div className="text-[10px] text-slate-400 mt-0.5">Rejected by {request.rejectionStage}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canAct(request) ? (
                          <button
                            onClick={() => openReview(request)}
                            className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                          >
                            {request.status === 'PENDING_HR' ? 'HR Review' : 'Final Approval'}
                          </button>
                        ) : (
                          <button
                            onClick={() => openReview(request)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded transition-colors"
                          >
                            View
                          </button>
                        )}
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
                {canAct(reviewing)
                  ? reviewing.status === 'PENDING_HR'
                    ? 'HR Review'
                    : 'CEO Final Approval'
                  : 'Resignation Details'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {staffById.get(reviewing.staffId)?.fullName || reviewing.staffId} · Last working{' '}
                {formatKolkataDate(reviewing.lastWorkingDate)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Reason</span>
                <span className="text-right">{reviewing.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold">{statusLabels[reviewing.status]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requested by</span>
                <span>{reviewing.requestedByEmail}</span>
              </div>
              {reviewing.hrReviewedBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">HR review</span>
                  <span>
                    {reviewing.hrReviewedBy}
                    {reviewing.hrNote ? ` · ${reviewing.hrNote}` : ''}
                  </span>
                </div>
              )}
              {reviewing.ceoReviewedBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">CEO approval</span>
                  <span>
                    {reviewing.ceoReviewedBy}
                    {reviewing.ceoNote ? ` · ${reviewing.ceoNote}` : ''}
                  </span>
                </div>
              )}
              {reviewing.rejectionNote && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Rejection</span>
                  <span>
                    {reviewing.rejectionStage} · {reviewing.rejectionNote}
                  </span>
                </div>
              )}
            </div>

            {reviewError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {reviewError}
              </div>
            )}

            {canAct(reviewing) && (
              <div className="space-y-2 text-xs">
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Review Note {reviewing.status === 'PENDING_HR' ? '(recommended)' : '(optional, required to reject)'}
                </label>
                <textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewing(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              {canAct(reviewing) && (
                <>
                  <button
                    onClick={() => handleDecision('REJECT')}
                    disabled={reviewSaving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleDecision('APPROVE')}
                    disabled={reviewSaving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {reviewing.status === 'PENDING_HR' ? (
                      <ArrowRight className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {reviewSaving
                        ? 'Saving...'
                        : reviewing.status === 'PENDING_HR'
                        ? 'Approve & Send to CEO'
                        : 'Final Approve & Mark Left'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isOnBehalfOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Submit Resignation On Behalf</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                The request still requires HR review, then CEO final approval.
              </p>
            </div>

            {onBehalfError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {onBehalfError}
              </div>
            )}

            <form onSubmit={handleSubmitOnBehalf} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Staff Member *</label>
                <select
                  value={onBehalfStaffId}
                  onChange={(e) => setOnBehalfStaffId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select active staff...</option>
                  {activeStaff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} ({member.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Last Working Date *</label>
                <input
                  type="date"
                  required
                  value={onBehalfDate}
                  onChange={(e) => setOnBehalfDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={onBehalfReason}
                  onChange={(e) => setOnBehalfReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOnBehalfOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onBehalfSaving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
                >
                  <FileWarning className="w-3.5 h-3.5" />
                  <span>{onBehalfSaving ? 'Submitting...' : 'Submit for HR Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
