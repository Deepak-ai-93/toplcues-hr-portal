import { RotateCcw, X } from 'lucide-react';
import React, { useState } from 'react';
import { StaffProfile } from '../../types';
import { reactivateStaff } from '../../lib/api';
import { formatKolkataDate } from '../../lib/payrollCalculator';

interface RejoinStaffModalProps {
  staff: StaffProfile;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const RejoinStaffModal: React.FC<RejoinStaffModalProps> = ({ staff, onClose, onSaved }) => {
  const [rejoinedDate, setRejoinedDate] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejoinedDate) {
      setError('Rejoin date is required.');
      return;
    }
    if (staff.leavingDate && rejoinedDate < staff.leavingDate.slice(0, 10)) {
      setError('Rejoin date cannot be before the leaving date.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await reactivateStaff(staff.id, rejoinedDate, note.trim() || undefined);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rejoin staff member.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Rejoin Staff Member</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {staff.fullName} · {staff.employeeCode}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Current status</span>
            <span className="font-semibold">{staff.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Last leaving date</span>
            <span className="font-mono">{staff.leavingDate ? formatKolkataDate(staff.leavingDate) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Leaving reason</span>
            <span className="text-right">{staff.leavingReason || '—'}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Rejoin Date *</label>
            <input
              type="date"
              required
              value={rejoinedDate}
              onChange={(e) => setRejoinedDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Rehired for the engineering team"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{saving ? 'Reactivating...' : 'Rejoin Staff'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
