/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, HelpCircle, Mail, MessageSquare, Phone, Send } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';

export const StaffHelpPage: React.FC = () => {
  const { staffProfile } = useAuth();
  const [inquirySubject, setInquirySubject] = useState<string>('');
  const [inquiryMessage, setInquiryMessage] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  function handleSubmitInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiryMessage.trim()) return;
    setSubmitted(true);
    setInquirySubject('');
    setInquiryMessage('');
    setTimeout(() => setSubmitted(false), 5000);
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Payroll Helpdesk & HR Support
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Have an attendance question or need to dispute a salary slip deduction? Reach out to the Topclues HR desk.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Submit a Payroll Discrepancy Inquiry
          </h2>

          {submitted && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs">
              Thank you! Your payroll inquiry has been logged with Topclues HR. A member of the operations team will review within 24 business hours.
            </div>
          )}

          <form onSubmit={handleSubmitInquiry} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subject / Issue Type *
              </label>
              <select
                required
                value={inquirySubject}
                onChange={(e) => setInquirySubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">Select Category...</option>
                <option value="Attendance / Late arrival dispute">Attendance / Late arrival dispute</option>
                <option value="Casual / Emergency leave balance">Casual / Emergency leave balance</option>
                <option value="Overtime / Extra hours correction">Overtime / Extra hours correction</option>
                <option value="Outdoor / Field duty compensation">Outdoor / Field duty compensation</option>
                <option value="Bank disbursement status">Bank disbursement status</option>
                <option value="Other">Other question</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description of Discrepancy *
              </label>
              <textarea
                required
                rows={5}
                placeholder="Please describe the date, hours, or specific calculation discrepancy you observed..."
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 shadow-sm transition-colors"
            >
              Submit Ticket to HR
            </button>
          </form>
        </div>

        {/* HR Desk Contacts */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Direct HR Contacts
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Mail className="w-4 h-4 text-indigo-600" />
                <span>ceo@topclues.in</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>unicorn@topclues.in</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>marketing@topclues.in</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Phone className="w-4 h-4 text-slate-500" />
                <span>+91 80 4567 8900</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/60 p-5 text-xs text-indigo-900 dark:text-indigo-200 space-y-2">
            <div className="font-bold">Payroll Guidelines</div>
            <p className="text-[11px] leading-relaxed text-indigo-800 dark:text-indigo-300">
              Salary slips are finalized on or before the 1st of each month. Employees have seven (7) business days from publication to raise adjustments before account reconciliation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
