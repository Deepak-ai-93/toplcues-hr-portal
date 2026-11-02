/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { ActiveTab, Sidebar } from './components/layout/Sidebar';
import { AuthProvider, useAuth } from './lib/authContext';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { CompanySettingsPage } from './pages/admin/CompanySettingsPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { EmailHistoryPage } from './pages/admin/EmailHistoryPage';
import { ExcelImportPage } from './pages/admin/ExcelImportPage';
import { PayrollEntryPage } from './pages/admin/PayrollEntryPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SalarySlipsPage } from './pages/admin/SalarySlipsPage';
import { StaffListPage } from './pages/admin/StaffListPage';
import { TermsPage } from './pages/admin/TermsPage';
import { LoginPage } from './pages/LoginPage';
import { StaffBankDetailsPage } from './pages/staff/StaffBankDetailsPage';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage';
import { StaffHelpPage } from './pages/staff/StaffHelpPage';
import { StaffProfilePage } from './pages/staff/StaffProfilePage';
import { StaffSalaryHistoryPage } from './pages/staff/StaffSalaryHistoryPage';
import { StaffTermsPage } from './pages/staff/StaffTermsPage';

const AppContent: React.FC = () => {
  const { currentUser, role, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 rounded-full animate-spin" />
        <div className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Loading Topclues Solutions Payroll...
        </div>
      </div>
    );
  }

  if (!currentUser || !role) {
    return <LoginPage />;
  }

  const isManagement = role === 'SUPER_ADMIN' || role === 'HR';

  // Role Protection Guard
  const effectiveTab: ActiveTab = !isManagement
    ? currentTab.startsWith('staff-')
      ? currentTab
      : 'staff-dashboard'
    : currentTab.startsWith('staff-')
    ? 'dashboard'
    : currentTab;

  function renderPage() {
    switch (effectiveTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'staff':
        return <StaffListPage />;
      case 'payroll':
        return <PayrollEntryPage />;
      case 'salary-slips':
        return <SalarySlipsPage />;
      case 'email-history':
        return <EmailHistoryPage />;
      case 'reports':
        return <ReportsPage />;
      case 'excel-import':
        return <ExcelImportPage />;
      case 'terms':
        return <TermsPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'settings':
        return <CompanySettingsPage />;

      // Staff Portal
      case 'staff-dashboard':
        return <StaffDashboardPage />;
      case 'staff-salary-history':
        return <StaffSalaryHistoryPage />;
      case 'staff-profile':
        return <StaffProfilePage />;
      case 'staff-bank-details':
        return <StaffBankDetailsPage />;
      case 'staff-terms':
        return <StaffTermsPage />;
      case 'staff-help':
        return <StaffHelpPage />;

      default:
        return <DashboardPage onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar activePeriod="July 2026" />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={effectiveTab} onSelectTab={(tab) => setCurrentTab(tab)} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{renderPage()}</div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
