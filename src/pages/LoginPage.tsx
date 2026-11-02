/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, Building2, CheckCircle2, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import React from 'react';
import { useAuth } from '../lib/authContext';

export const LoginPage: React.FC = () => {
  const { signIn, isLoading, unauthorizedMessage, clearUnauthorizedMessage, simulatePersona } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-lg shadow-sm">
          TC
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Topclues Solutions
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Payroll & Salary Slip Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-sm border border-slate-200 dark:border-slate-800 rounded-xl sm:px-10">
          {unauthorizedMessage && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold">Access Denied</div>
                  <div className="mt-1">{unauthorizedMessage}</div>
                  <button
                    onClick={clearUnauthorizedMessage}
                    className="mt-2 text-xs font-medium text-red-700 dark:text-red-400 underline hover:no-underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Sign in with your verified corporate Google Account.
            </div>

            <button
              onClick={signIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoading ? 'Verifying...' : 'Sign in with Google'}</span>
            </button>
          </div>

          {/* Persona Demo Testing Cards */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              One-Click Persona Testing
            </div>
            <div className="space-y-2">
              <button
                onClick={() => simulatePersona('ceo@topclues.in')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 hover:bg-indigo-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <div className="text-left">
                    <div className="font-semibold">Super Admin</div>
                    <div className="text-indigo-600 dark:text-indigo-400 text-[11px]">ceo@topclues.in</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                  Full Control
                </span>
              </button>

              <button
                onClick={() => simulatePersona('unicorn@topclues.in')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 hover:bg-blue-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <div className="text-left">
                    <div className="font-semibold">HR Manager</div>
                    <div className="text-blue-600 dark:text-blue-400 text-[11px]">unicorn@topclues.in</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  HR Access
                </span>
              </button>

              <button
                onClick={() => simulatePersona('rahul.sharma@topclues.in')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <div className="text-left">
                    <div className="font-semibold">Staff Employee</div>
                    <div className="text-emerald-600 dark:text-emerald-400 text-[11px]">rahul.sharma@topclues.in</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  Self Service
                </span>
              </button>

              <button
                onClick={() => simulatePersona('unauthorized.guest@gmail.com')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 text-red-900 dark:text-red-200 hover:bg-red-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-600" />
                  <div className="text-left">
                    <div className="font-semibold">Unauthorized Account</div>
                    <div className="text-red-600 dark:text-red-400 text-[11px]">unauthorized.guest@gmail.com</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200">
                  Deny Test
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Protected by Supabase Google Authentication & Row Level Security.
        </div>
      </div>
    </div>
  );
};
