/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Building2, Calendar, Mail, MapPin, Phone, ShieldCheck, UserCheck } from 'lucide-react';
import React from 'react';
import { formatIndianCurrency, formatKolkataDate } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const StaffProfilePage: React.FC = () => {
  const { staffProfile, userProfile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          My Employee Profile
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Verified employment master record maintained by Topclues Solutions Human Resources.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xl flex items-center justify-center">
            {staffProfile?.fullName
              ? staffProfile.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
              : 'TC'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {staffProfile?.fullName || userProfile?.displayName}
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {staffProfile?.status || 'Active'}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Code: {staffProfile?.employeeCode || '-'} · {staffProfile?.designation || 'Staff'}
            </div>
          </div>
        </div>

        {/* Master Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Department</span>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{staffProfile?.department || 'General'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Designation</span>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{staffProfile?.designation || 'Staff'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Official Google Login Email</span>
            <div className="font-mono text-slate-900 dark:text-slate-100">{staffProfile?.googleEmail || userProfile?.email}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Personal Email</span>
            <div className="font-mono text-slate-900 dark:text-slate-100">{staffProfile?.personalEmail || 'Not configured'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Contact Number</span>
            <div className="text-slate-900 dark:text-slate-100">{staffProfile?.mobile || '+91 98201 11223'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Reporting Manager</span>
            <div className="text-slate-900 dark:text-slate-100">{staffProfile?.reportingManager || 'Management'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Date of Joining</span>
            <div className="text-slate-900 dark:text-slate-100">
              {formatKolkataDate(staffProfile?.dateOfJoining || '')}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Employment Type</span>
            <div className="text-slate-900 dark:text-slate-100">{staffProfile?.employmentType || 'Full-Time'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Work Location</span>
            <div className="text-slate-900 dark:text-slate-100">{staffProfile?.workLocation || 'Bengaluru HQ'}</div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-slate-400">Current Monthly Base Compensation</span>
            <div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatIndianCurrency(staffProfile?.monthlySalary || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          Note: In compliance with company governance, employee codes, roles, and salary revisions are locked from direct client modification. Contact Topclues Solutions HR for updates.
        </div>
      </div>
    </div>
  );
};
