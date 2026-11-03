import assert from 'node:assert/strict';
import test from 'node:test';
import { LeaveRequest, PayrollRuleConfig } from '../types';
import {
  countInclusiveDays,
  monthOf,
  summarizeLeaveBalance,
  validateLeaveDraft,
} from './leaveRules';

const rules: PayrollRuleConfig = {
  id: 'rules-v1.0',
  versionNumber: '1.0',
  clAllowedPerMonth: 7,
  elAllowedWithinCL: 1,
  excessELMultiplier: 1.5,
  lateAllowedGrace: 2,
  latesPerDeductionBlock: 2,
  latePenaltyDaysPerPair: 0.5,
  extraBreakRatePerHour: 50,
  earlyLeaveRatePerHour: 50,
  extraHoursRatePerHour: 100,
  holidayWorkingDayMultiplier: 1.5,
  outdoorWorkRatePerDay: 500,
  holidayHourlyRate: 150,
  status: 'Active',
  effectiveFrom: '2026-04-01',
  updatedBy: 'test',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

function leave(partial: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: partial.id ?? 'leave-1',
    staffId: partial.staffId ?? 'staff-1',
    leaveType: partial.leaveType ?? 'CL',
    startDate: partial.startDate ?? '2026-11-02',
    endDate: partial.endDate ?? '2026-11-02',
    days: partial.days ?? 1,
    leaveMonth: partial.leaveMonth ?? '2026-11',
    reason: partial.reason ?? 'Test',
    status: partial.status ?? 'APPROVED',
    appliedByEmail: 'staff@topclues.in',
    appliedOnBehalf: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

test('counts inclusive days within a month', () => {
  assert.equal(countInclusiveDays('2026-11-03', '2026-11-05'), 3);
  assert.equal(countInclusiveDays('2026-11-05', '2026-11-05'), 1);
  assert.equal(countInclusiveDays('2026-11-05', '2026-11-03'), 0);
});

test('derives the leave month', () => {
  assert.equal(monthOf('2026-11-03'), '2026-11');
});

test('summarizes CL and EL balances', () => {
  const balance = summarizeLeaveBalance(
    [
      leave({ id: '1', leaveType: 'CL', days: 2 }),
      leave({ id: '2', leaveType: 'EL', days: 1, status: 'PENDING' }),
      leave({ id: '3', leaveType: 'LWP', days: 3 }),
      leave({ id: '4', leaveType: 'CL', days: 4, status: 'REJECTED' }),
    ],
    rules,
    '2026-11'
  );

  assert.equal(balance.clDays, 2);
  assert.equal(balance.elDays, 1);
  assert.equal(balance.elWithinCl, 1);
  assert.equal(balance.lwpDays, 3);
  assert.equal(balance.clRemaining, 4);
  assert.equal(balance.elRemaining, 0);
});

test('rejects EL beyond the monthly allowance', () => {
  const errors = validateLeaveDraft(
    { leaveType: 'EL', startDate: '2026-11-10', endDate: '2026-11-11', reason: 'Personal' },
    rules,
    []
  );
  assert.ok(errors.some((error) => error.includes('EL limit exceeded')));
});

test('rejects combined CL + EL beyond the CL allowance', () => {
  const errors = validateLeaveDraft(
    { leaveType: 'EL', startDate: '2026-11-20', endDate: '2026-11-20', reason: 'Personal' },
    rules,
    [leave({ id: 'cl-7', leaveType: 'CL', days: 7 })]
  );
  assert.ok(errors.some((error) => error.includes('CL limit exceeded')));
});

test('allows LWP without a balance cap and rejects cross-month ranges', () => {
  assert.deepEqual(
    validateLeaveDraft(
      { leaveType: 'LWP', startDate: '2026-11-02', endDate: '2026-11-21', reason: 'Medical' },
      rules,
      []
    ),
    []
  );

  const crossMonth = validateLeaveDraft(
    { leaveType: 'CL', startDate: '2026-11-30', endDate: '2026-12-01', reason: 'Travel' },
    rules,
    []
  );
  assert.ok(crossMonth.some((error) => error.includes('same calendar month')));
});
