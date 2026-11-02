# Topclues Solutions – Production Security & Compliance Checklist

## 1. Authentication & Role-Based Access Control (RBAC)
- [x] **No Public Registration**: Self-registration and public sign-up routes are completely disabled.
- [x] **Google Sign-In Only**: Only verified Google accounts can authenticate.
- [x] **Hardened Bootstrap Accounts**:
  - `ceo@topclues.in` is strictly `SUPER_ADMIN`.
  - `unicorn@topclues.in` and `marketing@topclues.in` are strictly `HR`.
- [x] **Staff Pre-Provisioning**: Unregistered Google accounts are immediately denied and signed out with: *"Your account is not authorized. Please contact Topclues Solutions HR."*
- [x] **Instant Deactivation**: Staff members set to `Inactive` or `Left` immediately lose all session and portal privileges.
- [x] **Client Claim Immunity**: Roles and privileges are validated server-side; client role requests are never trusted.

## 2. Banking Security & PII Protection
- [x] **Split Collection Architecture**: Sensitive banking account numbers are isolated in server-only `staffPrivate/{staffId}`.
- [x] **Masked Displays**: Public profile documents and salary slips display masked numbers only (`XXXXXX1234`).
- [x] **Audited Reveal Workflow**: Full bank account reveal operations require audited business justification.
- [x] **IFSC & Format Validation**: Indian IFSC code format (`^[A-Z]{4}0[A-Z0-9]{6}$`) and account number confirmation verification enforced.
- [x] **Zero Secret Leaks**: Encryption keys, private keys, and passwords are never checked into git or client bundles.

## 3. Data Integrity & Financial Precision
- [x] **Deterministic Arithmetic**: Pure TypeScript functions with paise rounding (`roundToPaise`).
- [x] **Finalized Snapshot Locking**: Finalized payroll snapshots rules, terms versions, attendance inputs, and totals.
- [x] **Super Admin Reopening**: Only `ceo@topclues.in` can reopen finalized payroll.
- [x] **Audited Salary Revisions**: Staff salary history maintains immutable records of who changed compensation, when, and reason.

## 4. Email Security & Anti-Spam
- [x] **Strictly Individual Dispatch**: No multi-recipient `To`, `CC`, or `BCC` fields. Every employee receives a separate individual email.
- [x] **Idempotency Keys**: Formed from `job_{staffId}_{periodId}_v{version}` to eliminate duplicate emails.
- [x] **No Bank Info in Email**: Emails never contain bank account credentials.
