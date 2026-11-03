/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Calendar,
  Filter,
  History,
  Lock,
  RefreshCw,
  Search,
  Shield,
  UserCheck
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { AuditLogEntry } from '../../types';
import { listAuditLogs } from '../../lib/api';
import { formatKolkataDateTime } from '../../lib/payrollCalculator';
import { useAuth } from '../../lib/authContext';

export const AuditLogsPage: React.FC = () => {
  const { role } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const list = await listAuditLogs();
      list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setLogs(list);
    } catch (err) {
      console.warn('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.actorEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEntity = entityFilter === 'ALL' || log.entityType === entityFilter;

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Immutable Security & Operational Audit Trail
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Tamper-Proof
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cryptographically sealed and append-only log of every authentication, staff mutation, payroll calculation, bank reveal, and email dispatch.
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by actor, action, entity ID or parameters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Entity Types</option>
          <option value="AUTH">Authentication (AUTH)</option>
          <option value="STAFF">Staff Master (STAFF)</option>
          <option value="PAYROLL">Payroll Cycles (PAYROLL)</option>
          <option value="BANK">Banking Vault (BANK)</option>
          <option value="SALARY_SLIP">Salary Slips (SALARY_SLIP)</option>
          <option value="EMAIL">Email Dispatch (EMAIL)</option>
          <option value="TERMS">Terms Governance (TERMS)</option>
          <option value="SETTINGS">Company Settings (SETTINGS)</option>
          <option value="LEAVE">Leave Requests (LEAVE)</option>
          <option value="RESIGNATION">Resignations (RESIGNATION)</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Timestamp (IST)</th>
                <th className="py-2.5 px-3 font-semibold">Actor / Initiator</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Entity Type & ID</th>
                <th className="py-2.5 px-3 font-semibold">Safe Event Payload / Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatKolkataDateTime(log.timestamp)}
                    </td>

                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.actorEmail}
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-medium ${
                          log.actorRole === 'SUPER_ADMIN'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            : log.actorRole === 'HR'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {log.actorRole}
                      </span>
                    </td>

                    <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {log.action}
                    </td>

                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span className="font-semibold">{log.entityType}</span> · {log.entityId}
                    </td>

                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 max-w-md truncate">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
