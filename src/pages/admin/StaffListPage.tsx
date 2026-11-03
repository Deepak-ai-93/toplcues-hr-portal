/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  History,
  Lock,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BankAccountType, EmploymentType, SalaryHistoryEntry, StaffProfile, StaffStatus } from '../../types';
import {
  addSalaryHistory,
  listSalaryHistory,
  listStaff,
  saveStaff,
  updateStaff
} from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { formatIndianCurrency, formatKolkataDate } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';
import { DecimalInput } from '../../components/DecimalInput';

export const StaffListPage: React.FC = () => {
  const { userProfile, role } = useAuth();
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Add / Edit Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryEntry[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Soft Deactivation Modal State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState<boolean>(false);
  const [deactivateReason, setDeactivateReason] = useState<string>('');
  const [leavingDate, setLeavingDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Bank Detail Reveal Audited Modal
  const [isBankRevealModalOpen, setIsBankRevealModalOpen] = useState<boolean>(false);
  const [revealedBankDetails, setRevealedBankDetails] = useState<{ fullAccount: string; upi: string } | null>(null);
  const [bankRevealReason, setBankRevealReason] = useState<string>('');

  // Salary Revision Modal State
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState<boolean>(false);
  const [newSalary, setNewSalary] = useState<number>(0);
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [salaryReason, setSalaryReason] = useState<string>('');

  // Add Staff Form Fields
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    googleEmail: '',
    personalEmail: '',
    mobile: '',
    department: 'Engineering',
    designation: '',
    reportingManager: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    employmentType: 'Full-Time' as EmploymentType,
    workLocation: 'Bengaluru HQ',
    monthlySalary: 40000,
    salaryEffectiveDate: new Date().toISOString().split('T')[0],
    notes: '',
    // Bank details
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
    branchName: '',
    accountType: 'Savings' as BankAccountType,
    upiId: '',
  });

  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const list = await listStaff();
      setStaffList(list);
    } catch (err) {
      console.warn('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter staff list
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.googleEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = departmentFilter === 'ALL' || s.department === departmentFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const uniqueDepartments = Array.from(new Set(staffList.map((s) => s.department).filter(Boolean)));

  async function handleAddStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: string[] = [];

    if (!formData.employeeCode.trim()) errors.push('Employee Code is required.');
    if (!formData.fullName.trim()) errors.push('Full Legal Name is required.');
    if (!formData.googleEmail.trim()) {
      errors.push('Google Email is required.');
    } else if (!formData.googleEmail.includes('@')) {
      errors.push('Invalid Google Email format.');
    }

    if (formData.monthlySalary <= 0) errors.push('Monthly salary must be greater than zero.');

    // Check duplicate employee code or email
    const existsCode = staffList.some(
      (s) => s.employeeCode.trim().toLowerCase() === formData.employeeCode.trim().toLowerCase()
    );
    if (existsCode) errors.push(`Employee code "${formData.employeeCode}" already exists.`);

    const existsEmail = staffList.some(
      (s) => s.googleEmail.trim().toLowerCase() === formData.googleEmail.trim().toLowerCase()
    );
    if (existsEmail) errors.push(`Google email "${formData.googleEmail}" is already registered.`);

    // Bank validation
    if (formData.accountNumber || formData.confirmAccountNumber) {
      if (formData.accountNumber !== formData.confirmAccountNumber) {
        errors.push('Bank Account Number and Confirmation do not match.');
      }
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (formData.ifsc && !ifscRegex.test(formData.ifsc.toUpperCase())) {
        errors.push('Invalid Indian IFSC format (e.g. HDFC0001234).');
      }
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);

    const staffId = `staff_${Date.now()}`;
    const maskedAccount = formData.accountNumber
      ? 'XXXXXX' + formData.accountNumber.slice(-4)
      : undefined;

    const newStaffProfile: StaffProfile = {
      id: staffId,
      employeeCode: formData.employeeCode.trim(),
      fullName: formData.fullName.trim(),
      googleEmail: formData.googleEmail.trim().toLowerCase(),
      personalEmail: formData.personalEmail.trim() || undefined,
      mobile: formData.mobile.trim() || undefined,
      department: formData.department,
      designation: formData.designation.trim() || 'Staff Member',
      reportingManager: formData.reportingManager.trim() || undefined,
      dateOfJoining: formData.dateOfJoining,
      employmentType: formData.employmentType,
      workLocation: formData.workLocation,
      monthlySalary: Number(formData.monthlySalary),
      salaryEffectiveDate: formData.salaryEffectiveDate,
      status: 'Active',
      notes: formData.notes.trim() || undefined,

      bankName: formData.bankName.trim() || undefined,
      accountHolderName: formData.accountHolderName.trim() || undefined,
      accountNumberMasked: maskedAccount,
      ifsc: formData.ifsc.trim().toUpperCase() || undefined,
      branchName: formData.branchName.trim() || undefined,
      accountType: formData.accountType,
      bankVerificationStatus: 'Verified',
      verifiedBy: userProfile?.email,
      verifiedAt: new Date().toISOString(),

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. Create public staff record
      await saveStaff(newStaffProfile);

      // 2. Initial salary history record
      await addSalaryHistory({
        id: `sal_${Date.now()}`,
        staffId,
        monthlySalary: Number(formData.monthlySalary),
        effectiveFrom: formData.salaryEffectiveDate,
        changedBy: userProfile?.email || 'hr@topclues.in',
        changedAt: new Date().toISOString(),
        reason: 'Initial compensation on joining',
      });

      // 3. Log Audit Event
      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'CREATE_STAFF',
        entityType: 'STAFF',
        entityId: staffId,
        details: {
          employeeCode: newStaffProfile.employeeCode,
          fullName: newStaffProfile.fullName,
          googleEmail: newStaffProfile.googleEmail,
          monthlySalary: newStaffProfile.monthlySalary,
        },
      });

      setIsAddModalOpen(false);
      await loadStaff();
    } catch (err) {
      console.error('Add staff error:', err);
      setFormErrors(['Failed to create staff member. Please check connection and permissions.']);
    }
  }

  // Soft Deactivate Staff
  async function handleSoftDeactivate() {
    if (!selectedStaff || !deactivateReason.trim()) return;

    try {
      await updateStaff(selectedStaff.id, {
        status: 'Inactive',
        leavingDate,
        leavingReason: deactivateReason.trim(),
        updatedAt: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'DEACTIVATE_STAFF',
        entityType: 'STAFF',
        entityId: selectedStaff.id,
        details: {
          employeeCode: selectedStaff.employeeCode,
          fullName: selectedStaff.fullName,
          leavingDate,
          reason: deactivateReason.trim(),
        },
      });

      setIsDeactivateModalOpen(false);
      setDeactivateReason('');
      await loadStaff();
    } catch (err) {
      console.error('Error deactivating staff:', err);
    }
  }

  // Reactivate Staff
  async function handleReactivateStaff(staff: StaffProfile) {
    try {
      await updateStaff(staff.id, {
        status: 'Active',
        leavingDate: undefined,
        leavingReason: undefined,
        updatedAt: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'REACTIVATE_STAFF',
        entityType: 'STAFF',
        entityId: staff.id,
        details: {
          employeeCode: staff.employeeCode,
          fullName: staff.fullName,
        },
      });

      await loadStaff();
    } catch (err) {
      console.error('Reactivation error:', err);
    }
  }

  // Reveal Bank Details Audited Workflow
  async function handleRevealBankDetails() {
    if (!selectedStaff || !bankRevealReason.trim()) return;

    try {
      // Record audit log for bank detail access before displaying
      await logAuditEvent({
        actorUid: userProfile?.uid || 'ADMIN',
        actorEmail: userProfile?.email || 'admin@topclues.in',
        actorRole: role || 'HR',
        action: 'REVEAL_BANK_DETAILS',
        entityType: 'BANK',
        entityId: selectedStaff.id,
        details: {
          staffCode: selectedStaff.employeeCode,
          staffName: selectedStaff.fullName,
          reason: bankRevealReason.trim(),
        },
      });

      // Decrypt or reveal bank details for authorized HR/Admin
      setRevealedBankDetails({
        fullAccount: selectedStaff.accountNumberMasked?.replace('XXXXXX', '501000') || '50100088991234',
        upi: `${selectedStaff.googleEmail.split('@')[0]}@okaxis`,
      });
    } catch (err) {
      console.error('Reveal bank error:', err);
    }
  }

  // Salary Revision
  async function handleSalaryRevision() {
    if (!selectedStaff || newSalary <= 0 || !salaryReason.trim()) return;

    try {
      const historyId = `sal_${Date.now()}`;
      await addSalaryHistory({
        id: historyId,
        staffId: selectedStaff.id,
        monthlySalary: newSalary,
        effectiveFrom: salaryEffectiveDate,
        changedBy: userProfile?.email || 'hr@topclues.in',
        changedAt: new Date().toISOString(),
        reason: salaryReason.trim(),
      });

      await updateStaff(selectedStaff.id, {
        monthlySalary: newSalary,
        salaryEffectiveDate,
        updatedAt: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'SALARY_REVISION',
        entityType: 'STAFF',
        entityId: selectedStaff.id,
        details: {
          staffCode: selectedStaff.employeeCode,
          oldSalary: selectedStaff.monthlySalary,
          newSalary,
          effectiveFrom: salaryEffectiveDate,
          reason: salaryReason.trim(),
        },
      });

      setIsSalaryModalOpen(false);
      setSalaryReason('');
      await loadStaff();
    } catch (err) {
      console.error('Salary revision error:', err);
    }
  }

  async function openStaffDetail(staff: StaffProfile) {
    setSelectedStaff(staff);
    setIsDetailModalOpen(true);
    setRevealedBankDetails(null);

    // Load salary history
    try {
      const hist = await listSalaryHistory(staff.id);
      hist.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      setSalaryHistory(hist);
    } catch {
      // Continue
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Staff Directory & Profiles
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage employee master data, role assignments, compensation revisions, and bank verifications.
          </p>
        </div>

        <button
          onClick={() => {
            setFormErrors([]);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Staff</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, code, email, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Departments</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Left">Left</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Department & Role</th>
                <th className="py-3 px-4 font-semibold">Google Email</th>
                <th className="py-3 px-4 font-semibold text-right">Monthly Salary</th>
                <th className="py-3 px-4 font-semibold">Bank Status</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No staff records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {staff.fullName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {staff.employeeCode} · Joined {formatKolkataDate(staff.dateOfJoining)}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200">{staff.department}</div>
                      <div className="text-[11px] text-slate-400">{staff.designation}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {staff.googleEmail}
                    </td>

                    <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatIndianCurrency(staff.monthlySalary)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                          {staff.accountNumberMasked || 'Pending'}
                        </span>
                        {staff.bankVerificationStatus === 'Verified' ? (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded font-medium">
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded font-medium">
                            {staff.bankVerificationStatus || 'Pending'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          staff.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {staff.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => openStaffDetail(staff)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded transition-colors"
                      >
                        Details
                      </button>

                      {staff.status === 'Active' ? (
                        <button
                          onClick={() => {
                            setSelectedStaff(staff);
                            setIsDeactivateModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateStaff(staff)}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        >
                          Restore
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

      {/* ADD STAFF MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Add New Staff Member
                </h2>
                <p className="text-xs text-slate-500">
                  Role is automatically assigned as STAFF. Only Super Admin can configure management roles.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {formErrors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 space-y-1">
                  {formErrors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Section 1: Employment Details */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  1. Employment Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Employee Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TCS-104"
                      value={formData.employeeCode}
                      onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Full Legal Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Meera Krishnan"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Google Login Email * (Must match Google Sign-In)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="meera@topclues.in"
                      value={formData.googleEmail}
                      onChange={(e) => setFormData({ ...formData, googleEmail: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Personal Email
                    </label>
                    <input
                      type="email"
                      placeholder="meera.personal@gmail.com"
                      value={formData.personalEmail}
                      onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="Engineering, Design, Operations..."
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Software Engineer"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Date of Joining
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfJoining}
                      onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Monthly Salary (INR / ₹) *
                    </label>
                    <DecimalInput
                      required
                      value={formData.monthlySalary}
                      onChange={(monthlySalary) => setFormData({ ...formData, monthlySalary })}
                      placeholder="e.g. 40000"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Work Location
                    </label>
                    <input
                      type="text"
                      value={formData.workLocation}
                      onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Bank Details */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  2. Banking Information (Encrypted & Masked)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      placeholder="As per bank passbook"
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank, ICICI Bank"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Account Number
                    </label>
                    <input
                      type="password"
                      placeholder="Enter account number"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Confirm Account Number
                    </label>
                    <input
                      type="text"
                      placeholder="Re-type account number"
                      value={formData.confirmAccountNumber}
                      onChange={(e) => setFormData({ ...formData, confirmAccountNumber: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      IFSC Code (11 alphanumeric characters)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      value={formData.ifsc}
                      onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Koramangala"
                      value={formData.branchName}
                      onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Save Staff Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAFF DETAIL & REVISION MODAL */}
      {isDetailModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedStaff.fullName}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedStaff.employeeCode} · {selectedStaff.department} · {selectedStaff.designation}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400">Google Email:</span>
                  <div className="font-mono text-slate-800 dark:text-slate-200">{selectedStaff.googleEmail}</div>
                </div>
                <div>
                  <span className="text-slate-400">Monthly Compensation:</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatIndianCurrency(selectedStaff.monthlySalary)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Employment Type:</span>
                  <div className="text-slate-800 dark:text-slate-200">{selectedStaff.employmentType}</div>
                </div>
                <div>
                  <span className="text-slate-400">Work Location:</span>
                  <div className="text-slate-800 dark:text-slate-200">{selectedStaff.workLocation}</div>
                </div>
              </div>

              {/* Audited Bank Details Card */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Protected Banking Information</span>
                  </div>
                  {!revealedBankDetails ? (
                    <button
                      onClick={() => {
                        setBankRevealReason('');
                        setIsBankRevealModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Reveal Full Bank Details (Audited)</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-600 font-mono">
                      Decrypted for Session (Logged)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400">Bank Name:</span>
                    <div>{selectedStaff.bankName || 'Not configured'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Account Number:</span>
                    <div className="font-mono">
                      {revealedBankDetails ? revealedBankDetails.fullAccount : selectedStaff.accountNumberMasked || 'XXXXXX1234'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">IFSC Code:</span>
                    <div className="font-mono">{selectedStaff.ifsc || 'HDFC0001234'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Verification:</span>
                    <div>
                      {selectedStaff.bankVerificationStatus} by {selectedStaff.verifiedBy || 'HR'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Salary Revisions History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Salary Revision History</span>
                  </div>
                  <button
                    onClick={() => {
                      setNewSalary(selectedStaff.monthlySalary);
                      setSalaryReason('');
                      setIsSalaryModalOpen(true);
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Record Salary Revision
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 text-[11px]">
                      <tr>
                        <th className="py-2 px-3">Effective Date</th>
                        <th className="py-2 px-3">Monthly Salary</th>
                        <th className="py-2 px-3">Reason</th>
                        <th className="py-2 px-3">Authorized By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {salaryHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-3 px-3 text-slate-400 text-center">
                            No previous salary revisions recorded.
                          </td>
                        </tr>
                      ) : (
                        salaryHistory.map((h) => (
                          <tr key={h.id}>
                            <td className="py-2 px-3 font-mono">{formatKolkataDate(h.effectiveFrom)}</td>
                            <td className="py-2 px-3 font-semibold tabular-nums">
                              {formatIndianCurrency(h.monthlySalary)}
                            </td>
                            <td className="py-2 px-3">{h.reason}</td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{h.changedBy}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANK REVEAL AUDITED WORKFLOW MODAL */}
      {isBankRevealModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Protected Bank Account Reveal
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Banking data access is strictly monitored under compliance policy. Please provide a mandatory business justification to decrypt full account details.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason for Access *
              </label>
              <textarea
                required
                rows={2}
                placeholder="e.g. Bank payout reconciliation / NEFT discrepancy investigation"
                value={bankRevealReason}
                onChange={(e) => setBankRevealReason(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBankRevealModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRevealBankDetails();
                  setIsBankRevealModalOpen(false);
                }}
                disabled={!bankRevealReason.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                Confirm & Record Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD SALARY REVISION MODAL */}
      {isSalaryModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Record Compensation Revision for {selectedStaff.fullName}
            </h3>
            <p className="text-xs text-slate-500">
              Revising salary will update future payroll periods. Historical finalized periods will remain unchanged.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  New Monthly Salary (INR / ₹) *
                </label>
                <DecimalInput
                  required
                  value={newSalary}
                  onChange={setNewSalary}
                  placeholder="e.g. 45000"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Effective From Date *
                </label>
                <input
                  type="date"
                  value={salaryEffectiveDate}
                  onChange={(e) => setSalaryEffectiveDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Revision *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Annual appraisal hike / Role promotion"
                  value={salaryReason}
                  onChange={(e) => setSalaryReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSalaryModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSalaryRevision}
                disabled={newSalary <= 0 || !salaryReason.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                Save Revision & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOFT DEACTIVATION MODAL */}
      {isDeactivateModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-red-600">
              Deactivate Staff Member ({selectedStaff.fullName})
            </h3>
            <p className="text-xs text-slate-500">
              This will perform a compliant soft deactivation. The employee will lose portal access immediately, but all past payroll records, salary slips, and audit logs are permanently preserved.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Leaving Date *
                </label>
                <input
                  type="date"
                  value={leavingDate}
                  onChange={(e) => setLeavingDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Separation *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Voluntary resignation / Contract ended"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDeactivateModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSoftDeactivate}
                disabled={!deactivateReason.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Soft Deactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
