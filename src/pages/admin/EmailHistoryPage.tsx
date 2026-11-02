/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { EmailJob } from '../../types';
import { getCompanySettings, getPayrollRecord, listEmailJobs } from '../../lib/api';
import { queueOrSendSalarySlipEmail } from '../../lib/emailService';
import { formatKolkataDateTime } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const EmailHistoryPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const [emailJobs, setEmailJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    loadEmailHistory();
  }, []);

  async function loadEmailHistory() {
    setLoading(true);
    try {
      const list = await listEmailJobs();
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setEmailJobs(list);
    } catch (err) {
      console.warn('Error loading email jobs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(job: EmailJob) {
    setRetryingJobId(job.id);
    try {
      // 1. Fetch Payroll Record
      const record = await getPayrollRecord(job.periodId, job.staffId);
      const company = await getCompanySettings();

      if (!record || !company) {
        alert('Could not locate linked payroll record or company settings.');
        return;
      }

      const [yearStr, monthStr] = job.periodId.split('-');
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
        isRetry: true,
      });

      if (res.success) {
        alert('Email re-sent successfully.');
        await loadEmailHistory();
      } else {
        alert(`Retry failed: ${res.message}`);
      }
    } catch (err) {
      console.error('Retry error:', err);
    } finally {
      setRetryingJobId(null);
    }
  }

  const filteredJobs = emailJobs.filter((j) => {
    if (filterStatus === 'ALL') return true;
    return j.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Salary Slip Email Queue & Delivery History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Idempotent transactional email delivery monitor with retry controls and tamper-proof attempt logs.
          </p>
        </div>

        <button
          onClick={loadEmailHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`px-3 py-1 rounded-md transition-colors ${
            filterStatus === 'ALL'
              ? 'bg-slate-900 text-white font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({emailJobs.length})
        </button>
        <button
          onClick={() => setFilterStatus('Sent')}
          className={`px-3 py-1 rounded-md transition-colors ${
            filterStatus === 'Sent'
              ? 'bg-emerald-600 text-white font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Delivered ({emailJobs.filter((j) => j.status === 'Sent').length})
        </button>
        <button
          onClick={() => setFilterStatus('Failed')}
          className={`px-3 py-1 rounded-md transition-colors ${
            filterStatus === 'Failed'
              ? 'bg-red-600 text-white font-semibold'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Failed ({emailJobs.filter((j) => j.status === 'Failed').length})
        </button>
      </div>

      {/* Jobs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Idempotency Key</th>
                <th className="py-3 px-4 font-semibold">Recipient</th>
                <th className="py-3 px-4 font-semibold">Subject</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Attempts</th>
                <th className="py-3 px-4 font-semibold">Last Attempt</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No email jobs found. Dispatch salary slips from the Payroll tab to populate queue.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {job.idempotencyKey}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {job.recipientName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Individual Recipient (Secure)
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {job.subject}
                    </td>

                    <td className="py-3 px-4">
                      {job.status === 'Sent' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-medium">
                          <CheckCircle className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-red-700 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded font-medium">
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 tabular-nums">
                      {job.attempts || 1}
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {job.lastAttemptAt ? formatKolkataDateTime(job.lastAttemptAt) : '-'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {job.status === 'Failed' && (
                        <button
                          onClick={() => handleRetry(job)}
                          disabled={retryingJobId === job.id}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                        >
                          {retryingJobId === job.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
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
