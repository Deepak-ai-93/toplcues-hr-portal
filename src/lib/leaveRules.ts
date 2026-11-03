import { LeaveBalance, LeaveRequest, LeaveType, PayrollRuleConfig } from '../types';

export const DEFAULT_CL_ALLOWANCE = 7;
export const DEFAULT_EL_ALLOWANCE = 1;

export interface LeaveAllowance {
  clAllowed: number;
  elAllowed: number;
}

export interface LeaveDraft {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export function getLeaveAllowance(rules: PayrollRuleConfig): LeaveAllowance {
  return {
    clAllowed: Number.isFinite(rules.clAllowedPerMonth) ? rules.clAllowedPerMonth : DEFAULT_CL_ALLOWANCE,
    elAllowed: Number.isFinite(rules.elAllowedWithinCL) ? rules.elAllowedWithinCL : DEFAULT_EL_ALLOWANCE,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function countInclusiveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / DAY_MS) + 1;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

function countedRequests(requests: LeaveRequest[], month: string): LeaveRequest[] {
  return requests.filter(
    (request) =>
      request.leaveMonth === month && (request.status === 'PENDING' || request.status === 'APPROVED')
  );
}

export function summarizeLeaveBalance(
  requests: LeaveRequest[],
  rules: PayrollRuleConfig,
  month: string
): LeaveBalance {
  const inMonth = countedRequests(requests, month);
  const sum = (type: LeaveType) =>
    inMonth.filter((request) => request.leaveType === type).reduce((total, request) => total + request.days, 0);

  const { clAllowed, elAllowed } = getLeaveAllowance(rules);
  const clDays = sum('CL');
  const elDays = sum('EL');
  const elWithinCl = Math.min(elDays, elAllowed);

  return {
    month,
    clAllowed,
    elAllowed,
    clDays,
    elDays,
    elWithinCl,
    lwpDays: sum('LWP'),
    clRemaining: Math.max(0, clAllowed - clDays - elWithinCl),
    elRemaining: Math.max(0, elAllowed - elDays),
  };
}

export function validateLeaveDraft(
  draft: LeaveDraft,
  rules: PayrollRuleConfig,
  requests: LeaveRequest[]
): string[] {
  const errors: string[] = [];

  if (!draft.startDate || !draft.endDate) {
    errors.push('Start and end dates are required.');
    return errors;
  }
  if (draft.endDate < draft.startDate) {
    errors.push('End date must be on or after the start date.');
  }
  if (monthOf(draft.startDate) !== monthOf(draft.endDate)) {
    errors.push('Leave must start and end within the same calendar month.');
  }
  if (!draft.reason.trim()) {
    errors.push('A reason is required.');
  }
  if (errors.length > 0) return errors;

  const days = countInclusiveDays(draft.startDate, draft.endDate);
  if (days <= 0) return ['Invalid date range.'];

  const month = monthOf(draft.startDate);
  const existing = countedRequests(requests, month);
  const existingCl = existing
    .filter((request) => request.leaveType === 'CL')
    .reduce((total, request) => total + request.days, 0);
  const existingEl = existing
    .filter((request) => request.leaveType === 'EL')
    .reduce((total, request) => total + request.days, 0);

  const clDays = existingCl + (draft.leaveType === 'CL' ? days : 0);
  const elDays = existingEl + (draft.leaveType === 'EL' ? days : 0);
  const { clAllowed, elAllowed } = getLeaveAllowance(rules);

  if (elDays > elAllowed) {
    errors.push(`EL limit exceeded: ${elDays} of ${elAllowed} day(s) for ${month}.`);
  }
  if (clDays + Math.min(elDays, elAllowed) > clAllowed) {
    errors.push(
      `CL limit exceeded: ${clDays} CL + ${Math.min(elDays, elAllowed)} EL (within CL allowance) exceeds ${clAllowed} days for ${month}.`
    );
  }

  return errors;
}
