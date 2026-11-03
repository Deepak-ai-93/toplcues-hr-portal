/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AuditLogEntry,
  BankChangeRequest,
  CompanySettings,
  EmailJob,
  LeaveRequest,
  LeaveType,
  PayrollPeriod,
  PayrollRecord,
  PayrollRuleConfig,
  ResignationRequest,
  SalaryHistoryEntry,
  StaffProfile,
  TermsVersion,
  UserProfile
} from '../types';
import { supabase } from './supabase';

interface SupabaseError {
  message: string;
}

function toSnakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function mapKeys(value: unknown, mapper: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => mapKeys(item, mapper));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[mapper(key)] = mapKeys(val, mapper);
    }
    return out;
  }
  return value;
}

function snakeize(value: unknown): unknown {
  return mapKeys(value, toSnakeCase);
}

function camelize<T>(value: unknown): T {
  return mapKeys(value, toCamelCase) as T;
}

function ensure(data: unknown, error: SupabaseError | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return camelize<T>(data);
}

async function fetchAll<T>(table: string, orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
  let query = supabase.from(table).select('*');
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
  const { data, error } = await query;
  ensure(data, error, `load ${table}`);
  return (data ?? []).map((row) => camelize<T>(row));
}

async function fetchWhere<T>(table: string, column: string, value: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq(column, value);
  ensure(data, error, `load ${table}`);
  return (data ?? []).map((row) => camelize<T>(row));
}

async function fetchById<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  ensure(data, error, `load ${table}/${id}`);
  return data ? camelize<T>(data) : null;
}

async function upsertRow(table: string, row: unknown, onConflict?: string): Promise<void> {
  const options = onConflict ? { onConflict } : undefined;
  const { error } = await supabase.from(table).upsert(snakeize(row) as never, options);
  ensure(null, error, `save ${table}`);
}

async function updateRowById(table: string, id: string, patch: unknown): Promise<void> {
  const { error } = await supabase.from(table).update(snakeize(patch) as never).eq('id', id);
  ensure(null, error, `update ${table}`);
}

async function updateRows(table: string, patch: unknown, filters: Record<string, string>): Promise<void> {
  let query = supabase.from(table).update(snakeize(patch) as never);
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { error } = await query;
  ensure(null, error, `update ${table}`);
}

// ---------------------------------------------------------------------------
// Company settings & rules
// ---------------------------------------------------------------------------

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const row = await fetchById<CompanySettings>('company_settings', 'main');
  return row;
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  await upsertRow('company_settings', { ...settings, id: 'main' }, 'id');
}

export async function getPayrollRules(id: string): Promise<PayrollRuleConfig | null> {
  return fetchById<PayrollRuleConfig>('payroll_rule_versions', id);
}

export async function savePayrollRules(rules: PayrollRuleConfig): Promise<void> {
  await upsertRow('payroll_rule_versions', rules, 'id');
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function listStaff(): Promise<StaffProfile[]> {
  return fetchAll<StaffProfile>('staff', { column: 'employee_code' });
}

export async function getStaffById(id: string): Promise<StaffProfile | null> {
  return fetchById<StaffProfile>('staff', id);
}

export async function getStaffByEmail(email: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .ilike('google_email', email)
    .maybeSingle();
  ensure(data, error, 'load staff by email');
  return data ? camelize<StaffProfile>(data) : null;
}

export async function saveStaff(staff: StaffProfile): Promise<void> {
  await upsertRow('staff', staff, 'id');
}

export async function updateStaff(id: string, patch: Partial<StaffProfile>): Promise<void> {
  await updateRowById('staff', id, patch);
}

export async function listSalaryHistory(staffId: string): Promise<SalaryHistoryEntry[]> {
  return fetchWhere<SalaryHistoryEntry>('salary_history', 'staff_id', staffId);
}

export async function addSalaryHistory(entry: SalaryHistoryEntry): Promise<void> {
  await upsertRow('salary_history', entry, 'id');
}

// ---------------------------------------------------------------------------
// Payroll periods & records
// ---------------------------------------------------------------------------

export async function listPayrollPeriods(): Promise<PayrollPeriod[]> {
  return fetchAll<PayrollPeriod>('payroll_periods', { column: 'id', ascending: false });
}

export async function getPayrollPeriod(id: string): Promise<PayrollPeriod | null> {
  return fetchById<PayrollPeriod>('payroll_periods', id);
}

export async function savePayrollPeriod(period: PayrollPeriod): Promise<void> {
  await upsertRow('payroll_periods', period, 'id');
}

export async function updatePayrollPeriod(id: string, patch: Partial<PayrollPeriod> | Record<string, unknown>): Promise<void> {
  await updateRowById('payroll_periods', id, patch);
}

export async function listPayrollRecords(periodId: string): Promise<PayrollRecord[]> {
  return fetchWhere<PayrollRecord>('payroll_records', 'period_id', periodId);
}

export async function getPayrollRecord(periodId: string, staffId: string): Promise<PayrollRecord | null> {
  const { data, error } = await supabase
    .from('payroll_records')
    .select('*')
    .eq('period_id', periodId)
    .eq('staff_id', staffId)
    .maybeSingle();
  ensure(data, error, `load payroll record ${periodId}/${staffId}`);
  return data ? camelize<PayrollRecord>(data) : null;
}

export async function savePayrollRecords(records: PayrollRecord[]): Promise<void> {
  if (records.length === 0) return;
  const { error } = await supabase
    .from('payroll_records')
    .upsert(records.map((record) => snakeize(record)) as never, { onConflict: 'period_id,staff_id' });
  ensure(null, error, 'save payroll records');
}

export async function updatePayrollRecord(
  periodId: string,
  staffId: string,
  patch: Partial<PayrollRecord>
): Promise<void> {
  await updateRows('payroll_records', patch, { period_id: periodId, staff_id: staffId });
}

export async function saveSalarySlip(slip: {
  slipNumber: string;
  periodId: string;
  staffId: string;
  employeeCode: string;
  fullName: string;
  version: number;
  netSalary: number;
  termsVersionId: string;
  generatedAt: string;
  isSuperseded: boolean;
}): Promise<void> {
  await upsertRow(
    'salary_slips',
    {
      id: slip.slipNumber,
      slipNumber: slip.slipNumber,
      periodId: slip.periodId,
      staffId: slip.staffId,
      employeeCode: slip.employeeCode,
      fullName: slip.fullName,
      version: slip.version,
      netSalary: slip.netSalary,
      termsVersionId: slip.termsVersionId,
      generatedAt: slip.generatedAt,
      isSuperseded: slip.isSuperseded,
    },
    'id'
  );
}

// ---------------------------------------------------------------------------
// Email jobs
// ---------------------------------------------------------------------------

export async function listEmailJobs(): Promise<EmailJob[]> {
  return fetchAll<EmailJob>('email_jobs', { column: 'created_at', ascending: false });
}

export async function getEmailJob(id: string): Promise<EmailJob | null> {
  return fetchById<EmailJob>('email_jobs', id);
}

export async function findEmailJobByIdempotencyKey(key: string): Promise<EmailJob | null> {
  const { data, error } = await supabase
    .from('email_jobs')
    .select('*')
    .eq('idempotency_key', key)
    .maybeSingle();
  ensure(data, error, 'load email job');
  return data ? camelize<EmailJob>(data) : null;
}

export async function saveEmailJob(job: EmailJob): Promise<void> {
  await upsertRow('email_jobs', job, 'id');
}

export async function updateEmailJob(id: string, patch: Partial<EmailJob>): Promise<void> {
  await updateRowById('email_jobs', id, patch);
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  return fetchAll<AuditLogEntry>('audit_logs', { column: 'timestamp', ascending: false });
}

export async function insertAuditLog(entry: Omit<AuditLogEntry, 'id'> & { id?: string }): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert(snakeize(entry) as never);
  ensure(null, error, 'insert audit log');
}

// ---------------------------------------------------------------------------
// Terms versions
// ---------------------------------------------------------------------------

export async function listTerms(): Promise<TermsVersion[]> {
  return fetchAll<TermsVersion>('terms_versions', { column: 'version_number', ascending: false });
}

export async function getTerm(id: string): Promise<TermsVersion | null> {
  return fetchById<TermsVersion>('terms_versions', id);
}

export async function saveTerm(term: TermsVersion): Promise<void> {
  await upsertRow('terms_versions', term, 'id');
}

export async function updateTerm(id: string, patch: Partial<TermsVersion>): Promise<void> {
  await updateRowById('terms_versions', id, patch);
}

// ---------------------------------------------------------------------------
// Bank change requests
// ---------------------------------------------------------------------------

export async function listBankChangeRequests(staffId?: string): Promise<BankChangeRequest[]> {
  if (staffId) return fetchWhere<BankChangeRequest>('bank_change_requests', 'staff_id', staffId);
  return fetchAll<BankChangeRequest>('bank_change_requests', { column: 'submitted_at', ascending: false });
}

export async function saveBankChangeRequest(request: BankChangeRequest): Promise<void> {
  await upsertRow('bank_change_requests', request, 'id');
}

export async function updateBankChangeRequest(id: string, patch: Partial<BankChangeRequest>): Promise<void> {
  await updateRowById('bank_change_requests', id, patch);
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

export async function listLeaveRequests(staffId?: string): Promise<LeaveRequest[]> {
  const rows = staffId
    ? await fetchWhere<LeaveRequest>('leave_requests', 'staff_id', staffId)
    : await fetchAll<LeaveRequest>('leave_requests', { column: 'created_at', ascending: false });
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function applyLeave(input: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  staffId?: string;
}): Promise<LeaveRequest> {
  return callRpc<LeaveRequest>('apply_leave', {
    p_leave_type: input.leaveType,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason,
    p_staff_id: input.staffId ?? null,
  });
}

export async function reviewLeave(
  id: string,
  decision: 'APPROVE' | 'REJECT',
  note?: string
): Promise<LeaveRequest> {
  return callRpc<LeaveRequest>('review_leave', {
    p_request_id: id,
    p_decision: decision,
    p_note: note ?? null,
  });
}

export async function cancelLeave(id: string): Promise<LeaveRequest> {
  return callRpc<LeaveRequest>('cancel_leave', { p_request_id: id });
}

// ---------------------------------------------------------------------------
// Resignation requests
// ---------------------------------------------------------------------------

export async function listResignationRequests(staffId?: string): Promise<ResignationRequest[]> {
  const rows = staffId
    ? await fetchWhere<ResignationRequest>('resignation_requests', 'staff_id', staffId)
    : await fetchAll<ResignationRequest>('resignation_requests', { column: 'submitted_at', ascending: false });
  return rows.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
}

export async function submitResignation(input: {
  lastWorkingDate: string;
  reason: string;
  staffId?: string;
}): Promise<ResignationRequest> {
  return callRpc<ResignationRequest>('submit_resignation', {
    p_last_working_date: input.lastWorkingDate,
    p_reason: input.reason,
    p_staff_id: input.staffId ?? null,
  });
}

export async function reviewResignation(
  id: string,
  decision: 'APPROVE' | 'REJECT',
  note?: string
): Promise<ResignationRequest> {
  return callRpc<ResignationRequest>('review_resignation', {
    p_request_id: id,
    p_decision: decision,
    p_note: note ?? null,
  });
}

export async function withdrawResignation(id: string): Promise<ResignationRequest> {
  return callRpc<ResignationRequest>('withdraw_resignation', { p_request_id: id });
}

export async function reactivateStaff(
  staffId: string,
  rejoinedDate: string,
  note?: string
): Promise<StaffProfile> {
  return callRpc<StaffProfile>('reactivate_staff', {
    p_staff_id: staffId,
    p_rejoined_date: rejoinedDate,
    p_note: note ?? null,
  });
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function getMyRole(): Promise<UserProfile['role'] | null> {
  const { data, error } = await supabase.rpc('my_role');
  if (error) throw error;
  return (data as UserProfile['role'] | null) ?? null;
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const row = await fetchById<Record<string, unknown>>('profiles', uid);
  if (!row) return null;
  return {
    uid: String(row.id ?? uid),
    email: String(row.email ?? ''),
    displayName: String(row.displayName ?? ''),
    role: (row.role as UserProfile['role']) ?? 'STAFF',
    staffId: (row.staffId as string | undefined) ?? undefined,
    isActive: Boolean(row.isActive ?? true),
    createdAt: String(row.createdAt ?? ''),
    lastLoginAt: String(row.lastLoginAt ?? ''),
  };
}

export async function upsertProfile(profile: UserProfile): Promise<void> {
  await upsertRow(
    'profiles',
    {
      id: profile.uid,
      email: profile.email,
      display_name: profile.displayName,
      photo_url: profile.photoURL ?? null,
      role: profile.role,
      staff_id: profile.staffId ?? null,
      is_active: profile.isActive,
      last_login_at: profile.lastLoginAt,
    },
    'id'
  );
}
