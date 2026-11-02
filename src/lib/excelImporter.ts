/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PayrollInputFields } from '../types';
import { calculatePayroll } from './payrollCalculator';

export interface ImportedPayrollRow {
  rowIndex: number;
  employeeCode: string;
  fullName: string;
  googleEmail: string;
  department: string;
  designation: string;
  inputs: PayrollInputFields;
  calculatedNet: number;
  errors: string[];
  isValid: boolean;
  isExcluded: boolean;
}

export interface ImportValidationResult {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  rows: ImportedPayrollRow[];
  duplicateCodes: string[];
  duplicateEmails: string[];
}

/**
 * Parses raw file (CSV or XLSX) into structured objects safely without executing macros
 */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          resolve(results.data as Record<string, unknown>[]);
        },
        error: (err) => reject(err),
      });
    });
  }

  // XLSX or XLSM (read binary without VBA execution)
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    bookVBA: false, // Explicitly drop VBA macros
    cellFormula: false, // Drop formula evaluation, only take static values
  });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  return rows;
}

/**
 * Find matching key from common Excel header names
 */
function findValue(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = keys.find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlias);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return row[foundKey];
    }
  }
  return undefined;
}

function parseNum(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : Math.max(0, val);
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : Math.max(0, parsed);
  }
  return fallback;
}

/**
 * Validates, normalizes, detects duplicates, and recalculates totals
 */
export function validateAndProcessImportRows(
  rawRows: Record<string, unknown>[],
  payrollDays: number = 31
): ImportValidationResult {
  const processedRows: ImportedPayrollRow[] = [];
  const codeFrequency: Record<string, number> = {};
  const emailFrequency: Record<string, number> = {};

  rawRows.forEach((row, index) => {
    const rowIndex = index + 1;
    const errors: string[] = [];

    const employeeCode = String(
      findValue(row, ['Employee Code', 'Emp Code', 'Code', 'EmpId', 'ID']) || ''
    ).trim();

    const fullName = String(
      findValue(row, ['Employee Name', 'Name', 'Full Name', 'Emp Name']) || ''
    ).trim();

    const googleEmail = String(
      findValue(row, ['Google Email', 'Email', 'Login Email', 'Email Address', 'Official Email']) || ''
    ).trim().toLowerCase();

    const department = String(
      findValue(row, ['Department', 'Dept']) || 'General'
    ).trim();

    const designation = String(
      findValue(row, ['Designation', 'Role', 'Title', 'Position']) || 'Staff'
    ).trim();

    const monthlySalary = parseNum(findValue(row, ['Monthly Salary', 'Basic Salary', 'Salary', 'Base Salary']), 0);
    const lwpDays = parseNum(findValue(row, ['LWP', 'LWP Days', 'Leave Without Pay']), 0);
    const clDays = parseNum(findValue(row, ['CL', 'CL Days', 'Casual Leave']), 0);
    const elCount = parseNum(findValue(row, ['EL', 'EL Count', 'Emergency Leave']), 0);
    const lateCount = parseNum(findValue(row, ['Late Count', 'Late', 'Late Arrivals']), 0);
    const extraBreakHours = parseNum(findValue(row, ['Extra Break Hours', 'Extra Break', 'Break Hours']), 0);
    const earlyLeaveHours = parseNum(findValue(row, ['Early Leave Hours', 'Early Leave', 'Early Exit']), 0);
    const extraPayment = parseNum(findValue(row, ['Extra Payment', 'Special Allowance', 'Bonus', 'Addition']), 0);
    const extraHours = parseNum(findValue(row, ['Extra Hours', 'OT Hours', 'Overtime Hours']), 0);
    const holidayWorkingDays = parseNum(findValue(row, ['Holiday Working Days', 'Full Holiday Days', 'Holiday Days']), 0);
    const outdoorWorkingDays = parseNum(findValue(row, ['Outdoor Working Days', 'Outdoor Days', 'Field Days']), 0);
    const holidayWorkingHours = parseNum(findValue(row, ['Holiday Working Hours', 'Holiday Hours']), 0);
    const remarks = String(findValue(row, ['Remarks', 'Note', 'Comments']) || '').trim();

    // Required field checks
    if (!employeeCode) errors.push('Employee Code is required.');
    if (!fullName) errors.push('Employee Name is required.');
    if (!googleEmail) {
      errors.push('Google Email is required.');
    } else if (!googleEmail.includes('@') || !googleEmail.includes('.')) {
      errors.push('Invalid email format.');
    }
    if (monthlySalary <= 0) errors.push('Monthly salary must be greater than zero.');

    if (employeeCode) codeFrequency[employeeCode] = (codeFrequency[employeeCode] || 0) + 1;
    if (googleEmail) emailFrequency[googleEmail] = (emailFrequency[googleEmail] || 0) + 1;

    const inputs: PayrollInputFields = {
      monthlySalary,
      lwpDays,
      clDays,
      elCount,
      lateCount,
      extraBreakHours,
      earlyLeaveHours,
      extraPayment,
      extraHours,
      holidayWorkingDays,
      outdoorWorkingDays,
      holidayWorkingHours,
      remarks,
    };

    // Calculate deterministic payroll
    const calc = calculatePayroll(inputs, payrollDays);

    processedRows.push({
      rowIndex,
      employeeCode,
      fullName,
      googleEmail,
      department,
      designation,
      inputs,
      calculatedNet: calc.netSalary,
      errors,
      isValid: errors.length === 0,
      isExcluded: false,
    });
  });

  // Second pass: Mark duplicates
  const duplicateCodes: string[] = [];
  const duplicateEmails: string[] = [];

  for (const [code, count] of Object.entries(codeFrequency)) {
    if (count > 1) duplicateCodes.push(code);
  }
  for (const [email, count] of Object.entries(emailFrequency)) {
    if (count > 1) duplicateEmails.push(email);
  }

  processedRows.forEach((r) => {
    if (duplicateCodes.includes(r.employeeCode)) {
      r.errors.push(`Duplicate Employee Code "${r.employeeCode}" detected in import.`);
      r.isValid = false;
    }
    if (duplicateEmails.includes(r.googleEmail)) {
      r.errors.push(`Duplicate Google Email "${r.googleEmail}" detected in import.`);
      r.isValid = false;
    }
  });

  const validRowsCount = processedRows.filter((r) => r.isValid && !r.isExcluded).length;
  const errorRowsCount = processedRows.filter((r) => !r.isValid).length;

  return {
    totalRows: processedRows.length,
    validRowsCount,
    errorRowsCount,
    rows: processedRows,
    duplicateCodes,
    duplicateEmails,
  };
}
