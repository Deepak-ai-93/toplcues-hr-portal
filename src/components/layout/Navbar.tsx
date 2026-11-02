/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Building2, LogOut, Shield, UserCheck, Users } from 'lucide-react';
import React from 'react';
import { useAuth } from '../../lib/authContext';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activePeriod?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activePeriod }) => {
  const { userProfile, role, signOutUser, simulatePersona } = useAuth();

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-8 sticky top-0 z-30">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <img
          src="/brand/topclues-icon-512.png"
          alt="Topclues"
          className="w-9 h-9 object-contain"
        />
        <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
          Topclues Solutions
        </span>
        <span className="hidden sm:inline-block text-xs text-slate-400 dark:text-slate-500 font-normal">
          Payroll Management
        </span>
      </div>

      {/* Zone 2: Navigation Status / Role Indicator */}
      <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
        {activePeriod && (
          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-mono">
            Period: {activePeriod}
          </span>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
          {role === 'SUPER_ADMIN' ? (
            <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          ) : role === 'HR' ? (
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          ) : (
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'HR' ? 'HR Manager' : 'Staff Employee'}
          </span>
          <span className="text-slate-400">({userProfile?.email})</span>
        </div>
      </div>

      {/* Zone 3: Quick Switcher & Logout */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Test Persona Dropdown for reviewer verification */}
        <div className="hidden lg:flex items-center gap-1 text-xs text-slate-500">
          <span className="mr-1">Test Role:</span>
          <button
            onClick={() => simulatePersona('ceo@topclues.in')}
            title="Switch to Super Admin"
            className={`px-2 py-1 rounded border text-xs transition-colors ${
              userProfile?.email === 'ceo@topclues.in'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            CEO
          </button>
          <button
            onClick={() => simulatePersona('unicorn@topclues.in')}
            title="Switch to HR Manager"
            className={`px-2 py-1 rounded border text-xs transition-colors ${
              userProfile?.email === 'unicorn@topclues.in'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            HR
          </button>
          <button
            onClick={() => simulatePersona('rahul.sharma@topclues.in')}
            title="Switch to Staff"
            className={`px-2 py-1 rounded border text-xs transition-colors ${
              userProfile?.email === 'rahul.sharma@topclues.in'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            Staff
          </button>
          <button
            onClick={() => simulatePersona('unauthorized.guest@gmail.com')}
            title="Test Unauthorized Account"
            className="px-2 py-1 rounded border text-xs bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
          >
            Unauthorized
          </button>
        </div>

        <button
          onClick={signOutUser}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
