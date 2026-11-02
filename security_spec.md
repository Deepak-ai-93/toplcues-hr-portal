# Security Specification & Threat Model
## Topclues Solutions – Payroll & Salary Slip Management System

### 1. Invariants & Security Pillars
1. **Zero-Trust Identity**: Users cannot self-assign or escalate roles. `ceo@topclues.in` is strictly SUPER_ADMIN. `unicorn@topclues.in` and `marketing@topclues.in` are HR. All others are strictly verified active STAFF or denied.
2. **Verified Accounts Only**: All operations require `request.auth.token.email_verified == true`.
3. **Data Boundary / Anti-Leak**: Regular staff can never query or read other employees' records, payroll summaries, company-wide payroll totals, or unmasked bank credentials.
4. **Isolated PII & Banking Fortress**: `staffPrivate/{staffId}` has zero client read or write privileges (`allow read, write: if false;`). Banking accounts on standard profiles are masked (`XXXXXX1234`).
5. **Immutable Audit Trails**: `auditLogs` cannot be altered or deleted by any user or client SDK.
6. **Authoritative State Transitions**: Finalized and Published payroll records cannot be modified or forged directly from client SDKs.
7. **Default Deny Catch-All**: Global root catch-all denies all access unless explicitly whitelisted.

### 2. The Dirty Dozen Payloads & Test Scenarios
1. **Unauthenticated Read**: Anonymous/unauthenticated client attempts `GET /staff/someStaffId` -> DENIED.
2. **Unverified Email Privilege Escalation**: User with `ceo@topclues.in` but `email_verified: false` attempts to write `companySettings` -> DENIED.
3. **Imposter Super Admin**: Client with email `attacker@evil.com` attempts to update `payrollRuleVersions` or `termsVersions` -> DENIED.
4. **Staff Reading Colleague Record**: Staff employee `emp_01` attempts `GET /payrollPeriods/2026-07/records/emp_02` -> DENIED.
5. **Staff Modifying Own Salary**: Staff employee `emp_01` attempts `UPDATE /staff/emp_01` with `monthlySalary: 500000` -> DENIED.
6. **Direct Banking Vault Access**: Any authenticated client attempts `GET /staffPrivate/emp_01` -> DENIED.
7. **HR Tampering with Terms**: HR account `unicorn@topclues.in` attempts to create or overwrite a `termsVersions` document -> DENIED (Super Admin only).
8. **HR Modifying Calculation Rules**: HR account attempts to modify `payrollRuleVersions` -> DENIED (Super Admin only).
9. **Tampering with Audit Logs**: Any client attempts `DELETE /auditLogs/log_123` or `UPDATE /auditLogs/log_123` -> DENIED.
10. **Arbitrary Email Queue Injection**: Staff employee attempts `CREATE /emailJobs` to send arbitrary email -> DENIED.
11. **Malicious ID Poisoning**: Client attempts document mutation with invalid 1KB path variable -> DENIED by `isValidId`.
12. **Deactivated Employee Access**: Staff employee with status `Inactive` or `Left` attempts to read payroll records -> DENIED.
