/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'SUPER_ADMIN' | 'HR' | 'STAFF';

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern';
export type StaffStatus = 'Active' | 'Inactive' | 'Left';
export type BankAccountType = 'Savings' | 'Current';
export type BankVerificationStatus = 'Pending' | 'Verified' | 'Rejected';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  staffId?: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface StaffProfile {
  id: string; // Document ID (staffId)
  employeeCode: string;
  fullName: string;
  googleEmail: string;
  personalEmail?: string;
  mobile?: string;
  department: string;
  designation: string;
  reportingManager?: string;
  dateOfJoining: string;
  employmentType: EmploymentType;
  workLocation: string;
  monthlySalary: number;
  salaryEffectiveDate: string;
  status: StaffStatus;
  leavingDate?: string;
  leavingReason?: string;
  notes?: string;
  profilePhotoUrl?: string;

  // Masked bank details stored on public staff document
  bankName?: string;
  accountHolderName?: string;
  accountNumberMasked?: string; // e.g. "XXXXXX1234"
  ifsc?: string;
  branchName?: string;
  accountType?: BankAccountType;
  bankVerificationStatus: BankVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface SalaryHistoryEntry {
  id: string;
  monthlySalary: number;
  effectiveFrom: string;
  effectiveTo?: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export interface BankChangeRequest {
  id: string;
  staffId: string;
  requesterUid: string;
  accountHolderName: string;
  bankName: string;
  accountNumberMasked: string;
  fullAccountNumber?: string; // transient/server-only before encryption
  ifsc: string;
  branchName: string;
  accountType: BankAccountType;
  upiId?: string;
  status: BankVerificationStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export type PayrollPeriodStatus = 'Draft' | 'Calculated' | 'Finalized' | 'Published' | 'Closed';

export interface PayrollPeriod {
  id: string; // e.g. "2026-07"
  month: string; // e.g. "July"
  year: number; // e.g. 2026
  daysInMonth: number; // e.g. 31
  status: PayrollPeriodStatus;
  ruleVersionId: string;
  termsVersionId: string;
  totalEmployees: number;
  totalBaseSalary: number;
  totalAdditions: number;
  totalDeductions: number;
  totalNetPayout: number;
  createdBy: string;
  createdAt: string;
  finalizedBy?: string;
  finalizedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
}

export interface PayrollInputFields {
  monthlySalary: number;
  lwpDays: number;
  clDays: number;
  elCount: number;
  lateCount: number;
  extraBreakHours: number;
  earlyLeaveHours: number;
  extraPayment: number;
  extraHours: number;
  holidayWorkingDays: number;
  outdoorWorkingDays: number;
  holidayWorkingHours: number;
  remarks?: string;
}

export interface PayrollCalculationBreakdown {
  payrollDays: number;
  perDaySalary: number;
  lwpDeduction: number;
  allowedELWithinCL: number;
  excessCLDays: number;
  excessCLDeduction: number;
  extraELCount: number;
  extraELDeduction: number;
  chargeableLateDays: number;
  lateDeduction: number;
  extraBreakDeduction: number;
  earlyLeaveDeduction: number;
  extraHoursPayment: number;
  holidayDayPayment: number;
  outdoorPayment: number;
  holidayHourlyPayment: number;
  grossAdditions: number;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

export type SlipStatus = 'NotGenerated' | 'Generated' | 'Published' | 'Superseded';
export type EmailDeliveryStatus = 'NotSent' | 'Pending' | 'Processing' | 'Sent' | 'Failed';

export interface PayrollRecord extends PayrollInputFields, PayrollCalculationBreakdown {
  id: string; // staffId
  periodId: string;
  staffId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  bankName?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  slipVersion: number;
  slipStatus: SlipStatus;
  emailStatus: EmailDeliveryStatus;
  termsVersionId: string;
  ruleVersionId: string;
  updatedAt: string;
}

export interface SalarySlipMetadata {
  id: string; // e.g. "SLIP-2026-07-EMP001-v1"
  slipNumber: string;
  periodId: string;
  staffId: string;
  employeeCode: string;
  fullName: string;
  version: number;
  storagePath?: string;
  netSalary: number;
  netSalaryWords: string;
  termsVersionId: string;
  generatedAt: string;
  publishedAt?: string;
  isSuperseded: boolean;
}

export interface TermsVersion {
  id: string;
  versionNumber: string; // e.g. "1.0", "1.1"
  title: string;
  content: string;
  effectiveDate: string;
  status: 'Draft' | 'Published' | 'Archived';
  createdBy: string;
  createdAt: string;
  publishedBy?: string;
  publishedAt?: string;
  contentHash: string;
}

export interface CompanySettings {
  companyName: string;
  registeredAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyLogoUrl: string;
  salarySlipFooter: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  authorizedSignatorySignatureUrl: string;
  payrollEmailSenderName: string;
  payrollEmailSenderAddress: string;
  defaultEmailTemplate: string;
  updatedBy: string;
  updatedAt: string;
}

export interface PayrollRuleConfig {
  id: string;
  versionNumber: string;
  clAllowedPerMonth: number; // default: 2
  elAllowedWithinCL: number; // default: 1
  excessELMultiplier: number; // default: 1.5
  lateAllowedGrace: number; // default: 2
  latePenaltyDaysPerPair: number; // default: 0.5
  extraBreakRatePerHour: number; // default: 50
  earlyLeaveRatePerHour: number; // default: 50
  extraHoursRatePerHour: number; // default: 100
  holidayWorkingDayMultiplier: number; // default: 1.5
  outdoorWorkRatePerDay: number; // default: 500
  holidayHourlyRate: number; // default: 150
  status: 'Active' | 'Archived';
  effectiveFrom: string;
  updatedBy: string;
  updatedAt: string;
}

export interface EmailJob {
  id: string;
  idempotencyKey: string;
  periodId: string;
  staffId: string;
  slipVersion: number;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  status: EmailDeliveryStatus;
  attempts: number;
  lastAttemptAt?: string;
  sentAt?: string;
  providerMessageId?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM';
  action: string;
  entityType: 'STAFF' | 'PAYROLL' | 'SALARY_SLIP' | 'EMAIL' | 'TERMS' | 'SETTINGS' | 'BANK' | 'AUTH';
  entityId: string;
  timestamp: string;
  details: string;
  ipAddress?: string;
}
