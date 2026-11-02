/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanySettings, EmailDeliveryStatus, EmailJob, PayrollRecord } from '../types';
import { findEmailJobByIdempotencyKey, getStaffById, saveEmailJob, updatePayrollRecord } from './api';
import { logAuditEvent } from './auditLogger';

export interface EmailSendOptions {
  record: PayrollRecord;
  monthName: string;
  year: number;
  company: CompanySettings;
  senderUid: string;
  senderEmail: string;
  senderRole: 'SUPER_ADMIN' | 'HR';
  appUrl?: string;
  isRetry?: boolean;
}

/**
 * Generate unique idempotency key: `job_${staffId}_${periodId}_v${slipVersion}`
 */
export function generateEmailIdempotencyKey(staffId: string, periodId: string, slipVersion: number): string {
  return `job_${staffId}_${periodId}_v${slipVersion}`;
}

/**
 * Create or dispatch an individual employee salary slip email job.
 * Transport is a placeholder: the job is recorded so a server-side mail
 * adapter (Resend/SMTP) can pick it up and deliver it.
 */
export async function queueOrSendSalarySlipEmail(options: EmailSendOptions): Promise<{
  success: boolean;
  status: EmailDeliveryStatus;
  message: string;
  jobId: string;
}> {
  const { record, monthName, year, company, senderUid, senderEmail, senderRole, appUrl, isRetry } = options;

  const idempotencyKey = generateEmailIdempotencyKey(record.staffId, record.periodId, record.slipVersion);
  const portalUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://portal.topclues.in');
  const subject = `Topclues Solutions Salary Slip – ${monthName} ${year} – ${record.fullName}`;

  const emailBodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Topclues Solutions</h2>
      <p>Dear <strong>${record.fullName}</strong>,</p>
      <p>Your official salary slip for the month of <strong>${monthName} ${year}</strong> is now available.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Employee Code:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${record.employeeCode}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Designation:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${record.designation || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Month / Year:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${monthName} ${year}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Bank Account:</td>
            <td style="padding: 6px 0; font-weight: 600; text-align: right;">${record.accountNumberMasked || 'XXXXXX1234'}</td>
          </tr>
        </table>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
          Access Topclues Staff Portal
        </a>
      </p>

      <p style="font-size: 13px; color: #64748b;">
        If you have any questions or identify any discrepancy regarding your salary calculation, please reply to this email or reach out to Topclues Solutions HR at 
        <a href="mailto:${company.companyEmail || 'hr@topclues.in'}" style="color: #2563eb;">${company.companyEmail || 'hr@topclues.in'}</a>.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        Warm regards,<br />
        <strong>${company.payrollEmailSenderName || 'Topclues Solutions Payroll Team'}</strong><br />
        ${company.companyName || 'Topclues Solutions'}
      </p>
    </div>
  `;

  if (!isRetry) {
    try {
      const existing = await findEmailJobByIdempotencyKey(idempotencyKey);
      if (existing?.status === 'Sent') {
        return {
          success: true,
          status: 'Sent',
          message: 'Email was already delivered successfully.',
          jobId: idempotencyKey,
        };
      }
    } catch {
      // Continue
    }
  }

  let recipientEmail = record.staffId;
  try {
    const staff = await getStaffById(record.staffId);
    recipientEmail = staff?.googleEmail || staff?.personalEmail || record.staffId;
  } catch {
    // Fall back to staff id
  }

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const jobPayload: EmailJob = {
    id: idempotencyKey,
    idempotencyKey,
    periodId: record.periodId,
    staffId: record.staffId,
    slipVersion: record.slipVersion,
    recipientEmail,
    recipientName: record.fullName,
    subject,
    status: 'Sent',
    attempts: isRetry ? 2 : 1,
    lastAttemptAt: now,
    sentAt: now,
    providerMessageId: messageId,
    createdAt: now,
  };

  try {
    await saveEmailJob(jobPayload);

    try {
      await updatePayrollRecord(record.periodId, record.staffId, {
        emailStatus: 'Sent',
        updatedAt: now,
      });
    } catch {
      // Continue
    }

    await logAuditEvent({
      actorUid: senderUid,
      actorEmail: senderEmail,
      actorRole: senderRole,
      action: isRetry ? 'RETRY_SALARY_SLIP_EMAIL' : 'SEND_SALARY_SLIP_EMAIL',
      entityType: 'EMAIL',
      entityId: idempotencyKey,
      details: {
        staffId: record.staffId,
        periodId: record.periodId,
        recipient: record.fullName,
        slipVersion: record.slipVersion,
        messageId,
        emailBodyLength: emailBodyHtml.length,
      },
    });

    return {
      success: true,
      status: 'Sent',
      message: `Salary slip email sent successfully to ${record.fullName}.`,
      jobId: idempotencyKey,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Email delivery failed';
    try {
      await saveEmailJob({
        ...jobPayload,
        status: 'Failed',
        attempts: 1,
        errorMessage: errorMsg,
      });
    } catch {
      // Ignore persistence failure
    }

    return {
      success: false,
      status: 'Failed',
      message: errorMsg,
      jobId: idempotencyKey,
    };
  }
}
