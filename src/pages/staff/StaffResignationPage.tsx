/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowRight, CheckCircle, Clock, FileWarning, LogOut, RefreshCw, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ResignationRequest, ResignationStatus } from '../../types';
import {
  listResignationRequests,
  submitResignation,
  withdrawResignation,
} from '../../lib/api';
import { useAuth } from '../../lib/authContext';
import { formatKolkataDate } from '../../lib/payrollCalculator';

const today = () => new Date().toISOString().slice(0, 10);

const statusLabels: Record<ResignationStatus, string> = {
  PENDING_HR: 'Pending HR Review',
  PENDING_CEO: 'Pending CEO Approval',
  APPROVED: 'Approved',
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

function stepState(
  request: ResignationRequest,
  step: 'SUBMIT' | 'HR' | 'CEO'
): 'done' | 'active' | 'pending' | 'rejected' {
  if (request.status === 'REJECTED') {
    if (step === 'SUBMIT') return 'done';
    if (step === request.rejectionStage) return 'rejected';
    if (step === 'HR' && request.rejectionStage === 'HR') return 'rejected';
    if (step === 'CEO' && request.rejectionStage === 'CEO') return 'rejected';
    return 'pending';
  }
  if (request.status === 'WITHDRAWN') return 'pending';
  if (request.status === 'APPROVED') return 'done';
  if (step === 'SUBMIT') return 'done';
  if (request.status === 'PENDING_HR') return step === 'HR' ? 'active' : 'pending';
  if (request.status === 'PENDING_CEO') return step === 'CEO' ? 'active' : 'done';
  return 'pending';
}

export const StaffResignationPage: React.FC = () => {
  const { staffProfile, signOutUser, refreshStaffProfile } = useAuth();
  const [requests, setRequests] = useState<ResignationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState<boolean>(false);
  const [lastWorkingDate, setLastWorkingDate] = useState<string>(today());
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    if (staffProfile) void loadResignations();
  }, [staffProfile?.id]);

  async function loadResignations() {
    if (!staffProfile) return;
    setLoading(true);
    try {
      const loaded = await listResignationRequests(staffProfile.id);
      setRequests(loaded);
    } catch (err) {
      console.warn('Error loading resignations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    await refreshStaffProfile();
    await loadResignations();
  }

  const pendingRequest = requests.find(
    (request) => request.status === 'PENDING_HR' || request.status === 'PENDING_CEO'
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await submitResignation({ lastWorkingDate, reason: reason.trim() });
      setIsSubmitOpen(false);
      setReason('');
      await loadResignations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit resignation.');
    } finally {
      setSaving(false);
    }
  }

  async function handleWithdraw(request: ResignationRequest) {
    if (!window.confirm('Withdraw this resignation request?')) return;
    setWithdrawingId(request.id);
    try {
      await withdrawResignation(request.id);
      await loadResignations();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to withdraw resignation.');
    } finally {
      setWithdrawingId(null);
    }
  }

  if (!staffProfile) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
        No active staff profile is linked to this account.
      </div>
    );
  }

  if (staffProfile.status !== 'Active') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
        <FileWarning className="w-8 h-8 text-amber-500 mx-auto" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Portal access has ended</h1>
        <p className="text-sm text-slate-500">
          Your employment status is now {staffProfile.status}
          {staffProfile.leavingDate ? ` as of ${formatKolkataDate(staffProfile.leavingDate)}` : ''}.
          Please contact Topclues Solutions HR for any questions.
        </p>
        <button
          onClick={signOutUser}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Resignation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Resignations require HR review followed by CEO final approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refreshStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>
          <button
            onClick={() => {
              setError(null);
              setLastWorkingDate(today());
              setReason('');
              setIsSubmitOpen(true);
            }}
            disabled={!!pendingRequest}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
          >
            <FileWarning className="w-3.5 h-3.5" />
            <span>Submit Resignation</span>
          </button>
        </div>
      </div>

      {pendingRequest ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Current Request</div>
              <div className="text-xs text-slate-500">
                Last working date: {formatKolkataDate(pendingRequest.lastWorkingDate)} · Submitted{' '}
                {formatKolkataDate(pendingRequest.submittedAt)}
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusStyles[pendingRequest.status]}`}>
              {statusLabels[pendingRequest.status]}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {([
              { key: 'SUBMIT', title: 'Submitted', detail: pendingRequest.requestedByEmail },
              {
                key: 'HR',
                title: 'HR Review',
                detail: pendingRequest.hrReviewedBy
                  ? `${pendingRequest.hrReviewedBy}${pendingRequest.hrNote ? ` · ${pendingRequest.hrNote}` : ''}`
                  : 'Awaiting HR',
              },
              {
                key: 'CEO',
                title: 'CEO Approval',
                detail: pendingRequest.ceoReviewedBy
                  ? `${pendingRequest.ceoReviewedBy}${pendingRequest.ceoNote ? ` · ${pendingRequest.ceoNote}` : ''}`
                  : 'Awaiting CEO',
              },
            ] as const).map((step) => {
              const state = stepState(pendingRequest, step.key);
              const styles =
                state === 'done'
                  ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30'
                  : state === 'active'
                  ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/30'
                  : state === 'rejected'
                  ? 'border-red-200 bg-red-50 dark:bg-red-950/30'
                  : 'border-slate-200 bg-slate-50 dark:bg-slate-800/40';
              return (
                <div key={step.key} className={`p-3 rounded-lg border ${styles}`}>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                    {state === 'done' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : state === 'rejected' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span>{step.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 break-words">{step.detail}</div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="text-slate-500">Reason</div>
            <div className="text-slate-800 dark:text-slate-200">{pendingRequest.reason}</div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleWithdraw(pendingRequest)}
              disabled={withdrawingId === pendingRequest.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{withdrawingId === pendingRequest.id ? 'Withdrawing...' : 'Withdraw Request'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
          No pending resignation. Use Submit Resignation when you are ready.
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Resignation History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Submitted</th>
                <th className="py-3 px-4 font-semibold">Last Working Date</th>
                <th className="py-3 px-4 font-semibold">Reason</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!loading && requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No resignation history.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-[11px] font-mono">{formatKolkataDate(request.submittedAt)}</td>
                    <td className="py-3 px-4 text-[11px] font-mono">{formatKolkataDate(request.lastWorkingDate)}</td>
                    <td className="py-3 px-4 max-w-[240px] whitespace-normal text-slate-600 dark:text-slate-400">
                      {request.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusStyles[request.status]}`}>
                        {statusLabels[request.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {request.rejectionNote
                        ? `${request.rejectionStage}: ${request.rejectionNote}`
                        : request.ceoReviewedBy || request.hrReviewedBy || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSubmitOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Submit Resignation</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                This starts the HR → CEO approval chain. Portal access ends when the CEO gives final approval.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Last Working Date *</label>
                <input
                  type="date"
                  required
                  min={today()}
                  value={lastWorkingDate}
                  onChange={(e) => setLastWorkingDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for resignation"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !reason.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>{saving ? 'Submitting...' : 'Submit for HR Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
