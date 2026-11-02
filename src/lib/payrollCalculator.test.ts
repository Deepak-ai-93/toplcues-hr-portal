/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  amountToIndianWords,
  calculatePayroll,
  formatIndianCurrency,
  getDaysInPeriod,
  roundToPaise
} from './payrollCalculator.ts';

test('July 2026 has exactly 31 calendar days', () => {
  assert.equal(getDaysInPeriod('2026-07'), 31);
});

test('February leap year vs non-leap year days calculation', () => {
  assert.equal(getDaysInPeriod('2024-02'), 29); // 2024 leap year
  assert.equal(getDaysInPeriod('2025-02'), 28); // 2025 non-leap year
  assert.equal(getDaysInPeriod('2028-02'), 29); // 2028 leap year
});

test('Late counts: 0, 2, 3, 4, 5, 6 tests', () => {
  const baseSalary = 31000;
  const payrollDays = 31; // perDaySalary = 1000

  // 0 late arrivals: 0 deduction
  const res0 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 0,
    elCount: 0,
    lateCount: 0,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(res0.chargeableLateDays, 0);
  assert.equal(res0.lateDeduction, 0);

  // 2 late arrivals (grace allowed): 0 deduction
  const res2 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 0,
    elCount: 0,
    lateCount: 2,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(res2.chargeableLateDays, 0);
  assert.equal(res2.lateDeduction, 0);

  // 3 late arrivals: max(0, 3-2) = 1. floor(1/2) = 0. Chargeable = 0
  const res3 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 0,
    elCount: 0,
    lateCount: 3,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(res3.chargeableLateDays, 0);
  assert.equal(res3.lateDeduction, 0);

  // 4 late arrivals: max(0, 4-2) = 2. floor(2/2) = 1. Chargeable = 0.5 day
  const res4 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 0,
    elCount: 0,
    lateCount: 4,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(res4.chargeableLateDays, 0.5);
  assert.equal(res4.lateDeduction, 500);

  // 5 late arrivals: max(0, 5-2) = 3. floor(3/2) = 1. Chargeable = 0.5 day
  const res5 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 0,
    elCount: 0,
    lateCount: 5,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(res5.chargeableLateDays, 0.5);
  assert.equal(res5.lateDeduction, 500);

  // 6 late arrivals: max(0, 6-2) = 4. floor(4/2) = 2. Chargeable = 1.0 day
  const res6 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 0,
    elCount: 0,
    lateCount: 6,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(res6.chargeableLateDays, 1.0);
  assert.equal(res6.lateDeduction, 1000);
});

test('CL and EL Combinations', () => {
  const baseSalary = 31000;
  const payrollDays = 31; // perDaySalary = 1000

  // Combo 1: CL 2 + EL 0
  // allowedELWithinCL = min(0, 1) = 0
  // excessCLDays = max(0, 2 + 0 - 2) = 0
  // extraELCount = max(0, 0 - 1) = 0
  const c1 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 2,
    elCount: 0,
    lateCount: 0,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(c1.excessCLDays, 0);
  assert.equal(c1.excessCLDeduction, 0);
  assert.equal(c1.extraELCount, 0);
  assert.equal(c1.extraELDeduction, 0);

  // Combo 2: CL 1 + EL 1
  // allowedELWithinCL = min(1, 1) = 1
  // excessCLDays = max(0, 1 + 1 - 2) = 0
  // extraELCount = max(0, 1 - 1) = 0
  const c2 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 1,
    elCount: 1,
    lateCount: 0,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(c2.excessCLDays, 0);
  assert.equal(c2.excessCLDeduction, 0);
  assert.equal(c2.extraELCount, 0);
  assert.equal(c2.extraELDeduction, 0);

  // Combo 3: CL 2 + EL 1
  // allowedELWithinCL = min(1, 1) = 1
  // excessCLDays = max(0, 2 + 1 - 2) = 1 (1 day excess CL deduction)
  // extraELCount = max(0, 1 - 1) = 0
  const c3 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 2,
    elCount: 1,
    lateCount: 0,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(c3.excessCLDays, 1);
  assert.equal(c3.excessCLDeduction, 1000);
  assert.equal(c3.extraELCount, 0);
  assert.equal(c3.extraELDeduction, 0);

  // Combo 4: CL 2 + EL 2
  // allowedELWithinCL = min(2, 1) = 1
  // excessCLDays = max(0, 2 + 1 - 2) = 1 day excess CL
  // extraELCount = max(0, 2 - 1) = 1 extra EL (1.5 days per-day salary)
  // total deduction for CL/EL = 1000 + 1500 = 2500
  const c4 = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 0,
    clDays: 2,
    elCount: 2,
    lateCount: 0,
    extraBreakHours: 0,
    earlyLeaveHours: 0,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, payrollDays);
  assert.equal(c4.excessCLDays, 1);
  assert.equal(c4.excessCLDeduction, 1000);
  assert.equal(c4.extraELCount, 1);
  assert.equal(c4.extraELDeduction, 1500);
});

test('Decimal hours & addition calculations', () => {
  const baseSalary = 30000;
  const payrollDays = 30; // perDaySalary = 1000

  const res = calculatePayroll({
    monthlySalary: baseSalary,
    lwpDays: 1, // 1000
    clDays: 0,
    elCount: 0,
    lateCount: 0,
    extraBreakHours: 2.5, // 2.5 * 50 = 125
    earlyLeaveHours: 1.5, // 1.5 * 50 = 75
    extraPayment: 500, // 500
    extraHours: 4.5, // 4.5 * 100 = 450
    holidayWorkingDays: 1, // 1 * 1000 * 1.5 = 1500
    outdoorWorkingDays: 2, // 2 * 500 = 1000
    holidayWorkingHours: 3, // 3 * 150 = 450
  }, payrollDays);

  assert.equal(res.perDaySalary, 1000);
  assert.equal(res.lwpDeduction, 1000);
  assert.equal(res.extraBreakDeduction, 125);
  assert.equal(res.earlyLeaveDeduction, 75);
  assert.equal(res.totalDeductions, 1200);

  // Gross Additions = 500 + 450 + 1500 + 1000 + 450 = 3900
  assert.equal(res.grossAdditions, 3900);
  assert.equal(res.grossEarnings, 33900);
  assert.equal(res.netSalary, 32700);
});

test('Zero salary and edge case handling', () => {
  const res = calculatePayroll({
    monthlySalary: 0,
    lwpDays: 2,
    clDays: 3,
    elCount: 2,
    lateCount: 4,
    extraBreakHours: 10,
    earlyLeaveHours: 5,
    extraPayment: 0,
    extraHours: 0,
    holidayWorkingDays: 0,
    outdoorWorkingDays: 0,
    holidayWorkingHours: 0,
  }, 30);

  assert.equal(res.perDaySalary, 0);
  assert.equal(res.grossEarnings, 0);
  assert.equal(res.netSalary, 0); // Net salary never negative
});

test('Indian currency formatting', () => {
  assert.equal(formatIndianCurrency(125000), '₹1,25,000.00');
  assert.equal(formatIndianCurrency(34500.5), '₹34,500.50');
  assert.equal(formatIndianCurrency(10000000), '₹1,00,00,000.00');
});

test('Number to Indian words converter', () => {
  assert.equal(amountToIndianWords(45200), 'Rupees Forty-Five Thousand Two Hundred Only');
  assert.equal(amountToIndianWords(125000), 'Rupees One Lakh Twenty-Five Thousand Only');
  assert.equal(amountToIndianWords(0), 'Rupees Zero Only');
});
