# Topclues Solutions – Payroll & Salary Slip Management System

Production-ready enterprise payroll calculation, role-based access management, server-side salary slip PDF generation, and compliance ledger for Topclues Solutions.

---

## 1. System Overview & Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Authentication**: Supabase Auth with strictly Google Sign-In only
- **Database**: Supabase Postgres with Row Level Security (RLS) policies and helper functions
- **Hosting**: Vercel (static Vite build)
- **PDF Generation**: Deterministic A4 vector PDF engine (`jspdf`) with company branding, table breakdowns, masked bank numbers, and Indian rupee words
- **Email Delivery**: Idempotent email job records with retry handling. Actual SMTP/Resend transport is a pending adapter (jobs are recorded, not delivered)
- **Server-only vault**: `staff_private` table has RLS enabled with no client policies; service-role access only

---

## 2. Bootstrapped Management Roles & Access Policy

| Email | Role | Scope of Authority |
|---|---|---|
| `ceo@topclues.in` | `SUPER_ADMIN` | Full control over all staff, payroll cycles, company settings, calculation rules, terms versions, reopenings, and bank reveals. |
| `unicorn@topclues.in` | `HR` | Add/edit staff, enter attendance/payroll inputs, generate slips, dispatch emails, view reports. Cannot modify terms or rules. |
| `marketing@topclues.in` | `HR` | Add/edit staff, enter attendance/payroll inputs, generate slips, dispatch emails, view reports. Cannot modify terms or rules. |
| *Active Staff Profiles* | `STAFF` | Self-service access strictly limited to own profile, masked bank details, published salary slips, and terms. |

> **Security Rule**: Any unknown Google account attempting to sign in is immediately denied access, signed out, and presented with: *"Your account is not authorized. Please contact Topclues Solutions HR."*

---

## 3. Deterministic Payroll Calculation Service

Salaries are calculated purely by deterministic TypeScript logic (no LLM or floating-point rounding errors):

```text
perDaySalary = monthlySalary / payrollDays
lwpDeduction = perDaySalary * lwpDays
allowedELWithinCL = min(elCount, 1)
excessCLDays = max(0, clDays + allowedELWithinCL - 2)
excessCLDeduction = perDaySalary * excessCLDays
extraELCount = max(0, elCount - 1)
extraELDeduction = perDaySalary * extraELCount * 1.5
chargeableLateDays = floor(max(0, lateCount - 2) / 2) * 0.5
lateDeduction = perDaySalary * chargeableLateDays
extraBreakDeduction = extraBreakHours * 50
earlyLeaveDeduction = earlyLeaveHours * 50
extraHoursPayment = extraHours * 100
holidayDayPayment = holidayWorkingDays * perDaySalary * 1.5
outdoorPayment = outdoorWorkingDays * 500
holidayHourlyPayment = holidayWorkingHours * 150

grossAdditions = extraPayment + extraHoursPayment + holidayDayPayment + outdoorPayment + holidayHourlyPayment
grossEarnings = monthlySalary + grossAdditions
totalDeductions = lwpDeduction + excessCLDeduction + extraELDeduction + lateDeduction + extraBreakDeduction + earlyLeaveDeduction
netSalary = max(0, grossEarnings - totalDeductions)
```

Automated unit tests cover:
- Late counts: 0, 2, 3, 4, 5, 6
- CL/EL combinations: CL 2 + EL 0, CL 1 + EL 1, CL 2 + EL 1, CL 2 + EL 2
- Leap year (Feb 2024 / 2028: 29 days) vs non-leap year (Feb 2025: 28 days)
- July 2026: 31 calendar days
- Decimal hour increments and rounding to paise (`₹1,25,000.00`)
- Indian currency words converter (`Rupees Forty-Five Thousand Two Hundred Only`)

Run tests anytime with:
```bash
npm run test
# or: npx tsx --test src/lib/payrollCalculator.test.ts
```

---

## 4. Local Development & Deployment

### Supabase setup (one time)
1. Create/select your Supabase project.
2. Apply the migration:
   ```bash
   npx supabase db push --db-url "<session-pooler-connection-string>"
   ```
   Or paste [`supabase/migrations/20261102162000_init_schema.sql`](supabase/migrations/20261102162000_init_schema.sql) into the **SQL Editor** and run it. This creates every table, helper function, grant, and RLS policy.
   > If `db.<ref>.supabase.co` is IPv6-only on your network, use the **Session pooler** string from the dashboard (IPv4, port 5432).
3. Enable Google sign-in: **Authentication → Providers → Google** → add your Google OAuth **Client ID** and **Client Secret**. In Google Cloud Console, add the authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Set **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (or your production URL)
   - Redirect URLs: `http://localhost:3000/**` and `https://<your-vercel-domain>/**`

### Database migrations
```bash
npx supabase migration new <change_name>
npx supabase db push --db-url "<session-pooler-connection-string>"
npx supabase migration list --db-url "<session-pooler-connection-string>"
```

### Development
```bash
npm install
npm run dev
```

`.env` must contain:
```
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_..."
SUPABASE_DB_URL="postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres"
```

The publishable/anon key is safe in the browser **only because RLS is enabled on every table** (see `supabase/schema.sql`).

### Production Build
```bash
npm run build
```

### Vercel deployment
1. Push this repository to GitHub and import it in Vercel.
2. Framework preset: **Vite** · Build: `npm run build` · Output: `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in Vercel.
4. Add the deployed Vercel domain (and custom domain) to the Supabase redirect URLs.
5. First sign-in as `ceo@topclues.in` seeds default company settings, staff, terms, and the July 2026 period. Staff can also be imported from the Excel/CSV page.
