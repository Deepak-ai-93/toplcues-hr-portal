import { Save, X } from 'lucide-react';
import React, { useState } from 'react';
import { EmploymentType, StaffProfile } from '../../types';
import { updateStaff } from '../../lib/api';
import { logAuditEvent } from '../../lib/auditLogger';
import { useAuth } from '../../lib/authContext';

interface StaffEditModalProps {
  staff: StaffProfile;
  allStaff: StaffProfile[];
  onClose: () => void;
  onSaved: () => void;
}

const inputClass =
  'w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100';

export const StaffEditModal: React.FC<StaffEditModalProps> = ({ staff, allStaff, onClose, onSaved }) => {
  const { userProfile, role } = useAuth();
  const [form, setForm] = useState({
    employeeCode: staff.employeeCode,
    fullName: staff.fullName,
    googleEmail: staff.googleEmail,
    personalEmail: staff.personalEmail || '',
    mobile: staff.mobile || '',
    department: staff.department,
    designation: staff.designation,
    reportingManager: staff.reportingManager || '',
    dateOfJoining: (staff.dateOfJoining || '').slice(0, 10),
    employmentType: staff.employmentType,
    workLocation: staff.workLocation,
    notes: staff.notes || '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: string[] = [];

    if (!form.employeeCode.trim()) nextErrors.push('Employee Code is required.');
    if (!form.fullName.trim()) nextErrors.push('Full Legal Name is required.');
    if (!form.googleEmail.trim() || !form.googleEmail.includes('@')) {
      nextErrors.push('A valid Google Email is required.');
    }
    if (!form.dateOfJoining) nextErrors.push('Date of Joining is required.');
    if (!form.workLocation.trim()) nextErrors.push('Work Location is required.');

    const otherStaff = allStaff.filter((member) => member.id !== staff.id);
    if (
      otherStaff.some(
        (member) =>
          member.employeeCode.trim().toLowerCase() === form.employeeCode.trim().toLowerCase()
      )
    ) {
      nextErrors.push(`Employee code "${form.employeeCode}" already exists.`);
    }
    if (
      otherStaff.some(
        (member) =>
          member.googleEmail.trim().toLowerCase() === form.googleEmail.trim().toLowerCase()
      )
    ) {
      nextErrors.push(`Google email "${form.googleEmail}" is already registered.`);
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors([]);
    setSaving(true);
    try {
      await updateStaff(staff.id, {
        employeeCode: form.employeeCode.trim(),
        fullName: form.fullName.trim(),
        googleEmail: form.googleEmail.trim().toLowerCase(),
        personalEmail: form.personalEmail.trim(),
        mobile: form.mobile.trim(),
        department: form.department,
        designation: form.designation.trim() || 'Staff Member',
        reportingManager: form.reportingManager.trim(),
        dateOfJoining: form.dateOfJoining,
        employmentType: form.employmentType as EmploymentType,
        workLocation: form.workLocation.trim(),
        notes: form.notes.trim(),
        updatedAt: new Date().toISOString(),
      });

      await logAuditEvent({
        actorUid: userProfile?.uid || 'HR',
        actorEmail: userProfile?.email || 'hr@topclues.in',
        actorRole: role || 'HR',
        action: 'EDIT_STAFF',
        entityType: 'STAFF',
        entityId: staff.id,
        details: {
          employeeCode: form.employeeCode.trim(),
          fullName: form.fullName.trim(),
          googleEmail: form.googleEmail.trim().toLowerCase(),
          department: form.department,
          designation: form.designation.trim(),
        },
      });

      onSaved();
      onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to update staff member.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl my-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Staff Member</h2>
            <p className="text-xs text-slate-500">
              {staff.fullName} · {staff.employeeCode}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1">
              {errors.map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Employee Code *</label>
              <input
                type="text"
                required
                value={form.employeeCode}
                onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Google Email *</label>
              <input
                type="email"
                required
                value={form.googleEmail}
                onChange={(e) => setForm({ ...form, googleEmail: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Personal Email</label>
              <input
                type="email"
                value={form.personalEmail}
                onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Mobile</label>
              <input
                type="text"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Department *</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className={inputClass}
              >
                {Array.from(
                  new Set([
                    'Engineering',
                    'Product',
                    'Design',
                    'Quality Assurance',
                    'Executive Leadership',
                    'Human Resources',
                    'Finance',
                    'Operations',
                    form.department,
                  ])
                )
                  .filter(Boolean)
                  .map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Designation *</label>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Reporting Manager</label>
              <input
                type="text"
                value={form.reportingManager}
                onChange={(e) => setForm({ ...form, reportingManager: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Date of Joining *</label>
              <input
                type="date"
                required
                value={form.dateOfJoining}
                onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Employment Type</label>
              <select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })}
                className={inputClass}
              >
                {['Full-Time', 'Part-Time', 'Contract', 'Intern'].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Work Location *</label>
              <input
                type="text"
                required
                value={form.workLocation}
                onChange={(e) => setForm({ ...form, workLocation: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            Salary changes use the audited Salary Revision flow. Bank details use the employee bank-change request flow.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
