/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanySettings, PayrollPeriod, PayrollRecord, StaffProfile, TermsVersion } from '../types';
import {
  getCompanySettings,
  saveCompanySettings,
  savePayrollPeriod,
  savePayrollRecords,
  savePayrollRules,
  saveStaff,
  saveTerm
} from './api';
import { calculatePayroll, DEFAULT_PAYROLL_RULES } from './payrollCalculator';

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Topclues Solutions',
  registeredAddress: 'Level 4, Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103, India',
  companyEmail: 'ceo@topclues.in',
  companyPhone: '+91 80 4567 8900',
  companyLogoUrl: '',
  salarySlipFooter: 'Strictly Confidential – Topclues Solutions Proprietary. For official employee record only.',
  authorizedSignatoryName: 'Arunav Kumar',
  authorizedSignatoryDesignation: 'Founder & Managing Director',
  payrollEmailSenderName: 'Topclues Solutions Payroll Operations',
  payrollEmailSenderAddress: 'payroll@topclues.in',
  defaultEmailTemplate: 'Dear {fullName},\n\nYour salary slip for {monthName} {year} has been published. Please log in to your employee portal to view your statement.\n\nWarm regards,\nTopclues Solutions HR',
  updatedBy: 'ceo@topclues.in',
  updatedAt: new Date().toISOString(),
};

export const INITIAL_TERMS_V1: TermsVersion = {
  id: 'terms-v1.0',
  versionNumber: '1.0',
  title: 'Topclues Solutions Master Employment & Salary Payout Policy',
  content: `TOPCLUES SOLUTIONS – PAYROLL AND REMUNERATION POLICY (v1.0)

1. REMUNERATION CYCLE & FINANCIAL CALENDAR
1.1 The standard remuneration computation period runs from the 1st of every calendar month to the last calendar day of the same month.
1.2 The official financial year of Topclues Solutions commences on 1st April and concludes on 31st March of the subsequent year.
1.3 All salary disbursements and compensations are denominated in Indian National Rupees (INR / ₹) with statutory Indian banking guidelines.

2. LEAVE, CASUAL PERMISSIONS & EMERGENCY LEAVE (CL / EL)
2.1 Full-time staff members are entitled to up to two (2) approved Casual Leave (CL) permissions per calendar month.
2.2 Emergency Leave (EL) constitutes a special category within the CL quota. Maximum one (1) EL is permitted per month without penalty.
2.3 Any Emergency Leave (EL) taken beyond the single permitted allowance will incur a deduction equivalent to 1.5 days of per-day salary for each additional EL.
2.4 Any Casual Leave (CL) taken in excess of the approved quota will incur a full per-day salary deduction.

3. ATTENDANCE, PUNCTUALITY & LATE OCCURRENCES
3.1 Topclues Solutions observes professional punctuality. Two (2) late arrivals within 15 minutes of scheduled shift commencement are permissible as monthly grace.
3.2 For every complete two (2) late counts recorded beyond the grace allowance, a deduction of 0.5 day's per-day salary will be levied.

4. BREAK DEDUCTIONS AND EARLY DEPARTURES
4.1 Unapproved break durations beyond standard meal allocations are deducted at the rate of ₹50 per hour.
4.2 Early departures from scheduled working hours without prior written manager concurrence are deducted at the rate of ₹50 per hour.

5. OVERTIME AND HOLIDAY CONTRIBUTIONS
5.1 Approved extra working hours on working days are compensated at ₹100 per hour.
5.2 Full-day contributions performed on designated company holidays or weekly offs are compensated at 1.5 times the per-day salary.
5.3 Approved outdoor client assignments are remunerated with an out-of-station allowance of ₹500 per full working day.
5.4 Partial hourly holiday duty is compensated at ₹150 per hour.

6. BANKING PRIVACY & COMPLIANCE
6.1 Employee bank account credentials are encrypted and stored in secure, restricted vaults. Slips will display masked account digits only.
6.2 Discrepancies must be submitted to Topclues Solutions HR within seven (7) days of salary slip publication.`,
  effectiveDate: '2026-04-01',
  status: 'Published',
  createdBy: 'ceo@topclues.in',
  createdAt: new Date().toISOString(),
  publishedBy: 'ceo@topclues.in',
  publishedAt: new Date().toISOString(),
  contentHash: 'hash_v1_topclues_2026',
};

export const INITIAL_SEED_STAFF: Omit<StaffProfile, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'staff_emp001',
    employeeCode: 'TCS-101',
    fullName: 'Rahul Sharma',
    googleEmail: 'rahul.sharma@topclues.in',
    personalEmail: 'rahul.personal@gmail.com',
    mobile: '+91 98201 11223',
    department: 'Engineering',
    designation: 'Senior Frontend Engineer',
    reportingManager: 'Arunav Kumar',
    dateOfJoining: '2024-06-15',
    employmentType: 'Full-Time',
    workLocation: 'Bengaluru HQ',
    monthlySalary: 62000,
    salaryEffectiveDate: '2026-04-01',
    status: 'Active',
    bankName: 'HDFC Bank',
    accountHolderName: 'Rahul Sharma',
    accountNumberMasked: 'XXXXXX4892',
    ifsc: 'HDFC0001234',
    branchName: 'Koramangala Branch',
    accountType: 'Savings',
    bankVerificationStatus: 'Verified',
    verifiedBy: 'unicorn@topclues.in',
    verifiedAt: '2026-04-02T10:00:00Z',
  },
  {
    id: 'staff_emp002',
    employeeCode: 'TCS-102',
    fullName: 'Ananya Sen',
    googleEmail: 'ananya.sen@topclues.in',
    personalEmail: 'ananya.sen98@gmail.com',
    mobile: '+91 97110 55667',
    department: 'Product',
    designation: 'Product Operations Lead',
    reportingManager: 'Arunav Kumar',
    dateOfJoining: '2024-09-01',
    employmentType: 'Full-Time',
    workLocation: 'Bengaluru HQ',
    monthlySalary: 55000,
    salaryEffectiveDate: '2026-04-01',
    status: 'Active',
    bankName: 'ICICI Bank',
    accountHolderName: 'Ananya Sen',
    accountNumberMasked: 'XXXXXX8120',
    ifsc: 'ICIC0000456',
    branchName: 'Indiranagar Branch',
    accountType: 'Savings',
    bankVerificationStatus: 'Verified',
    verifiedBy: 'marketing@topclues.in',
    verifiedAt: '2026-04-02T10:30:00Z',
  },
  {
    id: 'staff_emp003',
    employeeCode: 'TCS-103',
    fullName: 'Vikram Patel',
    googleEmail: 'vikram.patel@topclues.in',
    personalEmail: 'vikram.patel@gmail.com',
    mobile: '+91 98450 99887',
    department: 'Quality Assurance',
    designation: 'QA Automation Engineer',
    reportingManager: 'Rahul Sharma',
    dateOfJoining: '2025-01-10',
    employmentType: 'Full-Time',
    workLocation: 'Bengaluru HQ',
    monthlySalary: 42000,
    salaryEffectiveDate: '2026-04-01',
    status: 'Active',
    bankName: 'State Bank of India',
    accountHolderName: 'Vikram Patel',
    accountNumberMasked: 'XXXXXX3341',
    ifsc: 'SBIN0004567',
    branchName: 'HSR Layout Branch',
    accountType: 'Savings',
    bankVerificationStatus: 'Verified',
    verifiedBy: 'unicorn@topclues.in',
    verifiedAt: '2026-04-02T11:00:00Z',
  },
  {
    id: 'staff_ceo',
    employeeCode: 'TCS-001',
    fullName: 'Arunav Kumar (CEO)',
    googleEmail: 'ceo@topclues.in',
    department: 'Executive Leadership',
    designation: 'Chief Executive Officer',
    dateOfJoining: '2024-01-01',
    employmentType: 'Full-Time',
    workLocation: 'Bengaluru HQ',
    monthlySalary: 125000,
    salaryEffectiveDate: '2026-04-01',
    status: 'Active',
    bankName: 'Axis Bank',
    accountHolderName: 'Arunav Kumar',
    accountNumberMasked: 'XXXXXX9012',
    ifsc: 'UTIB0000123',
    branchName: 'MG Road Branch',
    accountType: 'Current',
    bankVerificationStatus: 'Verified',
    verifiedBy: 'ceo@topclues.in',
    verifiedAt: '2026-04-01T09:00:00Z',
  },
];

/**
 * Initializes the database with default company settings, rules, terms, staff and a July 2026 period.
 * Must run after a SUPER_ADMIN has signed in — RLS blocks anonymous writes.
 */
export async function seedInitialDatabaseIfNeeded(): Promise<void> {
  try {
    const existing = await getCompanySettings();
    if (existing) return;

    await saveCompanySettings(DEFAULT_COMPANY_SETTINGS);
    await savePayrollRules(DEFAULT_PAYROLL_RULES);
    await saveTerm(INITIAL_TERMS_V1);

    const now = new Date().toISOString();
    for (const staff of INITIAL_SEED_STAFF) {
      await saveStaff({ ...staff, createdAt: now, updatedAt: now });
    }

    const julyPeriodId = '2026-07';
    const records: PayrollRecord[] = [];

    let sumBase = 0;
    let sumAdd = 0;
    let sumDed = 0;
    let sumNet = 0;

    for (const staff of INITIAL_SEED_STAFF) {
      const isRahul = staff.employeeCode === 'TCS-101';
      const isAnanya = staff.employeeCode === 'TCS-102';

      const inputs = {
        monthlySalary: staff.monthlySalary,
        lwpDays: 0,
        clDays: isRahul ? 1 : 2,
        elCount: isRahul ? 1 : 0,
        lateCount: isRahul ? 3 : 1,
        extraBreakHours: isAnanya ? 1.5 : 0,
        earlyLeaveHours: 0,
        extraPayment: isRahul ? 1000 : 0,
        extraHours: isRahul ? 4 : 0,
        holidayWorkingDays: 0,
        outdoorWorkingDays: isAnanya ? 1 : 0,
        holidayWorkingHours: 0,
        remarks: 'July 2026 Regular Operations',
      };

      const calc = calculatePayroll(inputs, 31, DEFAULT_PAYROLL_RULES);

      sumBase += inputs.monthlySalary;
      sumAdd += calc.grossAdditions;
      sumDed += calc.totalDeductions;
      sumNet += calc.netSalary;

      records.push({
        id: staff.id,
        periodId: julyPeriodId,
        staffId: staff.id,
        employeeCode: staff.employeeCode,
        fullName: staff.fullName,
        department: staff.department,
        designation: staff.designation,
        dateOfJoining: staff.dateOfJoining,
        bankName: staff.bankName,
        accountNumberMasked: staff.accountNumberMasked,
        ifsc: staff.ifsc,
        ...inputs,
        ...calc,
        slipVersion: 1,
        slipStatus: 'Generated',
        emailStatus: 'NotSent',
        termsVersionId: INITIAL_TERMS_V1.id,
        ruleVersionId: DEFAULT_PAYROLL_RULES.id,
        updatedAt: now,
      });
    }

    const periodData: PayrollPeriod = {
      id: julyPeriodId,
      month: 'July',
      year: 2026,
      daysInMonth: 31,
      status: 'Calculated',
      ruleVersionId: DEFAULT_PAYROLL_RULES.id,
      termsVersionId: INITIAL_TERMS_V1.id,
      totalEmployees: INITIAL_SEED_STAFF.length,
      totalBaseSalary: sumBase,
      totalAdditions: sumAdd,
      totalDeductions: sumDed,
      totalNetPayout: sumNet,
      createdBy: 'ceo@topclues.in',
      createdAt: now,
    };

    // Period row must exist before its records (foreign key on period_id)
    await savePayrollPeriod(periodData);
    await savePayrollRecords(records);
  } catch (error) {
    console.warn('Database seed check completed with note:', error);
  }
}
