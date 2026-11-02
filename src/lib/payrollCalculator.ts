/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PayrollCalculationBreakdown, PayrollInputFields, PayrollRuleConfig } from '../types';

/**
 * Standard rounding to 2 decimal places (paise precision)
 * Round half up: Math.round((n + Number.EPSILON) * 100) / 100
 */
export function roundToPaise(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Default rule parameters as prescribed in specification
 */
export const DEFAULT_PAYROLL_RULES: PayrollRuleConfig = {
  id: 'rules-v1.0',
  versionNumber: '1.0',
  clAllowedPerMonth: 2,
  elAllowedWithinCL: 1,
  excessELMultiplier: 1.5,
  lateAllowedGrace: 2,
  latePenaltyDaysPerPair: 0.5,
  extraBreakRatePerHour: 50,
  earlyLeaveRatePerHour: 50,
  extraHoursRatePerHour: 100,
  holidayWorkingDayMultiplier: 1.5,
  outdoorWorkRatePerDay: 500,
  holidayHourlyRate: 150,
  status: 'Active',
  effectiveFrom: '2026-04-01',
  updatedBy: 'ceo@topclues.in',
  updatedAt: new Date().toISOString(),
};

/**
 * Deterministic payroll calculation service
 */
export function calculatePayroll(
  inputs: PayrollInputFields,
  payrollDays: number,
  rules: PayrollRuleConfig = DEFAULT_PAYROLL_RULES
): PayrollCalculationBreakdown {
  const monthlySalary = Math.max(0, inputs.monthlySalary || 0);
  const safePayrollDays = Math.max(1, payrollDays || 30);

  // Per day salary
  const perDaySalary = roundToPaise(monthlySalary / safePayrollDays);

  // LWP deduction
  const lwpDays = Math.max(0, inputs.lwpDays || 0);
  const lwpDeduction = roundToPaise(perDaySalary * lwpDays);

  // CL and EL calculation
  const clDays = Math.max(0, inputs.clDays || 0);
  const elCount = Math.max(0, inputs.elCount || 0);

  // EL is an allowed category within the 2 allowed CL permissions, up to elAllowedWithinCL (1)
  const allowedELWithinCL = Math.min(elCount, rules.elAllowedWithinCL);
  const excessCLDays = Math.max(0, clDays + allowedELWithinCL - rules.clAllowedPerMonth);
  const excessCLDeduction = roundToPaise(perDaySalary * excessCLDays);

  // Extra EL beyond 1 deducts 1.5 days of per-day salary each
  const extraELCount = Math.max(0, elCount - rules.elAllowedWithinCL);
  const extraELDeduction = roundToPaise(perDaySalary * extraELCount * rules.excessELMultiplier);

  // Late calculation: 2 late arrivals allowed. Every complete pair beyond 2 deducts 0.5 day
  const lateCount = Math.max(0, inputs.lateCount || 0);
  const chargeableLateDays = Math.floor(Math.max(0, lateCount - rules.lateAllowedGrace) / 2) * rules.latePenaltyDaysPerPair;
  const lateDeduction = roundToPaise(perDaySalary * chargeableLateDays);

  // Extra break & Early leave
  const extraBreakHours = Math.max(0, inputs.extraBreakHours || 0);
  const extraBreakDeduction = roundToPaise(extraBreakHours * rules.extraBreakRatePerHour);

  const earlyLeaveHours = Math.max(0, inputs.earlyLeaveHours || 0);
  const earlyLeaveDeduction = roundToPaise(earlyLeaveHours * rules.earlyLeaveRatePerHour);

  // Additions
  const extraPayment = Math.max(0, inputs.extraPayment || 0);
  const extraHours = Math.max(0, inputs.extraHours || 0);
  const extraHoursPayment = roundToPaise(extraHours * rules.extraHoursRatePerHour);

  const holidayWorkingDays = Math.max(0, inputs.holidayWorkingDays || 0);
  const holidayDayPayment = roundToPaise(holidayWorkingDays * perDaySalary * rules.holidayWorkingDayMultiplier);

  const outdoorWorkingDays = Math.max(0, inputs.outdoorWorkingDays || 0);
  const outdoorPayment = roundToPaise(outdoorWorkingDays * rules.outdoorWorkRatePerDay);

  const holidayWorkingHours = Math.max(0, inputs.holidayWorkingHours || 0);
  const holidayHourlyPayment = roundToPaise(holidayWorkingHours * rules.holidayHourlyRate);

  const grossAdditions = roundToPaise(
    extraPayment +
    extraHoursPayment +
    holidayDayPayment +
    outdoorPayment +
    holidayHourlyPayment
  );

  const grossEarnings = roundToPaise(monthlySalary + grossAdditions);

  const totalDeductions = roundToPaise(
    lwpDeduction +
    excessCLDeduction +
    extraELDeduction +
    lateDeduction +
    extraBreakDeduction +
    earlyLeaveDeduction
  );

  const netSalary = Math.max(0, roundToPaise(grossEarnings - totalDeductions));

  return {
    payrollDays: safePayrollDays,
    perDaySalary,
    lwpDeduction,
    allowedELWithinCL,
    excessCLDays,
    excessCLDeduction,
    extraELCount,
    extraELDeduction,
    chargeableLateDays,
    lateDeduction,
    extraBreakDeduction,
    earlyLeaveDeduction,
    extraHoursPayment,
    holidayDayPayment,
    outdoorPayment,
    holidayHourlyPayment,
    grossAdditions,
    grossEarnings,
    totalDeductions,
    netSalary,
  };
}

/**
 * Format Indian currency with ₹ symbol: e.g. ₹1,25,000.00
 */
export function formatIndianCurrency(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return '₹0.00';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixed = absAmount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  // Indian grouping: last 3 digits, then groups of 2 digits
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  let formatted = '';

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
    formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  } else {
    formatted = lastThree;
  }

  return `${isNegative ? '-' : ''}₹${formatted}.${decPart}`;
}

/**
 * Number to Indian Words Converter for Salary Slips (Rupees ... Only)
 */
export function amountToIndianWords(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Rupees Zero Only';

  const singleDigits = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return singleDigits[n];
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return tens[ten] + (unit !== 0 ? '-' + singleDigits[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let str = '';
    if (hundred > 0) {
      str += singleDigits[hundred] + ' Hundred';
      if (remainder > 0) str += ' and ';
    }
    if (remainder > 0) {
      str += convertTwoDigits(remainder);
    }
    return str;
  }

  let num = rounded;
  let words = '';

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) {
    words += convertTwoDigits(crores) + ' Crore ';
  }

  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) {
    words += convertTwoDigits(lakhs) + ' Lakh ';
  }

  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) {
    words += convertTwoDigits(thousands) + ' Thousand ';
  }

  if (num > 0) {
    words += convertThreeDigits(num) + ' ';
  }

  return `Rupees ${words.trim()} Only`;
}

/**
 * Get number of days in a given YYYY-MM period
 */
export function getDaysInPeriod(periodId: string): number {
  const [yearStr, monthStr] = periodId.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed (e.g. 7 for July)
  if (isNaN(year) || isNaN(month)) return 30;
  return new Date(year, month, 0).getDate();
}

/**
 * Format Date to DD/MM/YYYY in Asia/Kolkata timezone
 */
export function formatKolkataDate(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/**
 * Format DateTime to DD/MM/YYYY, hh:mm A in Asia/Kolkata timezone
 */
export function formatKolkataDateTime(dateInput: string | Date | number): string {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(d);
}
