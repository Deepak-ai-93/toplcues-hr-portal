/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Banknote,
  BookOpen,
  Calculator,
  Calendar,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCheck,
  Users
} from 'lucide-react';
import React from 'react';
import { useAuth } from '../../lib/authContext';

export type ActiveTab =
  | 'dashboard'
  | 'staff'
  | 'payroll'
  | 'salary-slips'
  | 'email-history'
  | 'reports'
  | 'terms'
  | 'audit-logs'
  | 'settings'
  | 'excel-import'
  | 'staff-dashboard'
  | 'staff-salary-history'
  | 'staff-profile'
  | 'staff-bank-details'
  | 'staff-terms'
  | 'staff-help';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { role } = useAuth();
  const isManagement = role === 'SUPER_ADMIN' || role === 'HR';

  const managementNavItems: { tab: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
    { tab: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { tab: 'staff', label: 'Staff Directory', icon: Users },
    { tab: 'payroll', label: 'Payroll & Attendance', icon: Calculator },
    { tab: 'salary-slips', label: 'Salary Slips', icon: FileText },
    { tab: 'email-history', label: 'Email Delivery Queue', icon: Mail },
    { tab: 'reports', label: 'Reports & Exports', icon: Banknote },
    { tab: 'excel-import', label: 'Excel/CSV Migration', icon: FileSpreadsheet },
    { tab: 'terms', label: 'Terms & Conditions', icon: ScrollText },
    { tab: 'audit-logs', label: 'Audit Trail Logs', icon: History, adminOnly: true },
    { tab: 'settings', label: 'Company Settings', icon: Settings, adminOnly: true },
  ];

  const staffNavItems: { tab: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { tab: 'staff-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { tab: 'staff-salary-history', label: 'My Salary History', icon: History },
    { tab: 'staff-profile', label: 'My Profile', icon: UserCheck },
    { tab: 'staff-bank-details', label: 'Bank Account & Request', icon: Banknote },
    { tab: 'staff-terms', label: 'Terms & Policies', icon: BookOpen },
    { tab: 'staff-help', label: 'Help / Contact HR', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between py-4 select-none shrink-0">
      <div className="px-3 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
            {isManagement ? 'Management Console' : 'Employee Self-Service'}
          </div>
          <nav className="space-y-1">
            {isManagement
              ? managementNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => onSelectTab(item.tab)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.adminOnly && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          Admin
                        </span>
                      )}
                    </button>
                  );
                })
              : staffNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => onSelectTab(item.tab)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
          </nav>
        </div>
      </div>

      <div className="px-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-600">
        <div>Topclues Solutions Pvt. Ltd.</div>
        <div className="mt-0.5">Version 1.0 · India (₹ INR)</div>
      </div>
    </aside>
  );
};
