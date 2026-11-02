/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertCircle,
  Building2,
  CheckCircle,
  CreditCard,
  History,
  Lock,
  Plus,
  Send,
  ShieldCheck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BankAccountType, BankChangeRequest } from '../../types';
import { listBankChangeRequests, saveBankChangeRequest } from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { formatKolkataDateTime } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const StaffBankDetailsPage: React.FC = () => {
  const { staffProfile, userProfile, role } = useAuth();
  const [requests, setRequests] = useState<BankChangeRequest[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    accountHolderName: staffProfile?.fullName || '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
    branchName: '',
    accountType: 'Savings' as BankAccountType,
    upiId: '',
  });

  useEffect(() => {
    loadRequests();
  }, [staffProfile]);

  async function loadRequests() {
    if (!staffProfile) return;
    try {
      const list = await listBankChangeRequests(staffProfile.id);
      list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      setRequests(list);
    } catch (err) {
      console.warn('Error loading bank change requests:', err);
    }
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!staffProfile || !userProfile) return;

    const errors: string[] = [];
    if (!formData.bankName.trim()) errors.push('Bank Name is required.');
    if (!formData.accountNumber.trim()) errors.push('Account Number is required.');
    if (formData.accountNumber !== formData.confirmAccountNumber) {
      errors.push('Account numbers do not match.');
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(formData.ifsc.toUpperCase())) {
      errors.push('Invalid Indian IFSC code format (e.g. HDFC0001234).');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
    setSubmitting(true);

    try {
      const reqId = `bcr_${Date.now()}`;
      const masked = 'XXXXXX' + formData.accountNumber.slice(-4);

      const requestPayload: BankChangeRequest = {
        id: reqId,
        staffId: staffProfile.id,
        requesterUid: userProfile.uid,
        accountHolderName: formData.accountHolderName.trim(),
        bankName: formData.bankName.trim(),
        accountNumberMasked: masked,
        ifsc: formData.ifsc.trim().toUpperCase(),
        branchName: formData.branchName.trim() || 'Main Branch',
        accountType: formData.accountType,
        upiId: formData.upiId.trim() || undefined,
        status: 'Pending',
        submittedAt: new Date().toISOString(),
      };

      await saveBankChangeRequest(requestPayload);

      await logAuditEvent({
        actorUid: userProfile.uid,
        actorEmail: userProfile.email,
        actorRole: role || 'STAFF',
        action: 'SUBMIT_BANK_CHANGE_REQUEST',
        entityType: 'BANK',
        entityId: reqId,
        details: {
          staffId: staffProfile.id,
          bankName: requestPayload.bankName,
          accountNumberMasked: masked,
          ifsc: requestPayload.ifsc,
        },
      });

      setIsRequestModalOpen(false);
      await loadRequests();
      alert('Bank detail change request submitted. Your existing verified details will remain in effect until HR reviews and approves this request.');
    } catch (err) {
      console.error('Submit bank request error:', err);
      alert('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Bank Account & Payout Details
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your salary is disbursed via direct NEFT/RTGS to your verified account. Complete numbers are protected.
          </p>
        </div>

        <button
          onClick={() => {
            setFormErrors([]);
            setIsRequestModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Request Bank Detail Update</span>
        </button>
      </div>

      {/* Currently Active Verified Bank Details Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Active Disbursement Account
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {staffProfile?.bankVerificationStatus || 'Verified'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400">Account Holder</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {staffProfile?.accountHolderName || staffProfile?.fullName}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400">Bank Name</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {staffProfile?.bankName || 'HDFC Bank'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400">Account Number (Masked)</span>
            <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {staffProfile?.accountNumberMasked || 'XXXXXX1234'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400">IFSC Code</span>
            <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {staffProfile?.ifsc || 'HDFC0001234'}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Full account numbers are encrypted with KMS and never exposed in browser storage or client scripts.</span>
        </div>
      </div>

      {/* Submitted Requests History */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Bank Update Request History
          </h3>
          <span className="text-xs text-slate-400">
            Preserves current verified payout details until approved by HR.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Request ID</th>
                <th className="py-3 px-4 font-semibold">Proposed Bank</th>
                <th className="py-3 px-4 font-semibold">Proposed Account</th>
                <th className="py-3 px-4 font-semibold">IFSC</th>
                <th className="py-3 px-4 font-semibold">Submitted On</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No pending or past bank update requests.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td className="py-3 px-4 font-mono text-slate-500">{req.id}</td>
                    <td className="py-3 px-4 font-semibold">{req.bankName}</td>
                    <td className="py-3 px-4 font-mono">{req.accountNumberMasked}</td>
                    <td className="py-3 px-4 font-mono">{req.ifsc}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {formatKolkataDateTime(req.submittedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          req.status === 'Verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REQUEST UPDATE MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Submit Bank Detail Change Request
            </h3>
            <p className="text-xs text-slate-500">
              Enter your updated banking details. Topclues HR will verify with your passbook / cancelled cheque before updating your active payroll disbursement.
            </p>

            {formErrors.length > 0 && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg space-y-1">
                {formErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.accountHolderName}
                  onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICICI Bank, State Bank of India"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    New Account Number *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.confirmAccountNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmAccountNumber: e.target.value })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    IFSC Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ICIC0001234"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Account Type
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) =>
                      setFormData({ ...formData, accountType: e.target.value as BankAccountType })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Savings">Savings</option>
                    <option value="Current">Current</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Proposal to HR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
