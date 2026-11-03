/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { CompanySettings, PayrollRecord, TermsVersion } from '../types';
import {
  amountToIndianWords,
  formatIndianCurrency,
  formatKolkataDate,
  formatKolkataDateTime
} from './payrollCalculator';

export interface SalarySlipPDFData {
  record: PayrollRecord;
  monthName: string;
  year: number;
  company: CompanySettings;
  terms?: TermsVersion;
  slipNumber: string;
  version: number;
}

/**
 * Generate sanitized filename: `[Employee Full Name] - Salary Slip - [MMMM YYYY].pdf`
 */
export function getSalarySlipFileName(fullName: string, monthName: string, year: number): string {
  const sanitizedName = fullName.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${sanitizedName} - Salary Slip - ${monthName} ${year}.pdf`;
}

/**
 * Deterministically generates an A4 PDF Salary Slip
 */
export function generateSalarySlipPDF(data: SalarySlipPDFData): jsPDF {
  const { record, monthName, year, company, terms, slipNumber, version } = data;

  // Create A4 portrait document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Outer border
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  let y = margin + 8;

  // Header Zone: Company Name & Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(company.companyName || 'Topclues Solutions', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const addressLine = company.registeredAddress || 'Registered Office: Topclues Solutions, India';
  doc.text(addressLine, pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.text(`Email: ${company.companyEmail || 'hr@topclues.in'}  |  Phone: ${company.companyPhone || '+91 98765 43210'}`, pageWidth / 2, y, { align: 'center' });

  y += 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, y, margin + contentWidth - 4, y);

  // Title Box
  y += 6;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 4, y - 4, contentWidth - 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`PAYSLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${year}`, pageWidth / 2, y + 1.5, { align: 'center' });

  // Slip Metadata Strip (Slip No, Version, Gen Date)
  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Slip No: ${slipNumber}`, margin + 6, y);
  doc.text(`Version: v${version}`, pageWidth / 2, y, { align: 'center' });
  doc.text(`Generated: ${formatKolkataDateTime(new Date())}`, margin + contentWidth - 6, y, { align: 'right' });

  y += 4;
  doc.line(margin + 4, y, margin + contentWidth - 4, y);

  // Employee Information Grid (Two columns)
  y += 5;
  const col1Left = margin + 6;
  const col1Val = margin + 48;
  const col2Left = margin + 98;
  const col2Val = margin + 140;

  const infoRow = (label1: string, val1: string, label2: string, val2: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8.5);
    doc.text(label1, col1Left, y);
    doc.text(label2, col2Left, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val1, col1Val, y);
    doc.text(val2, col2Val, y);
    y += 5;
  };

  infoRow('Employee Code:', record.employeeCode || '-', 'Date of Joining:', formatKolkataDate(record.dateOfJoining));
  infoRow('Employee Name:', record.fullName || '-', 'Department:', record.department || '-');
  infoRow('Designation:', record.designation || '-', 'Bank Name:', record.bankName || 'HDFC Bank');
  infoRow('Bank Account:', record.accountNumberMasked || 'XXXXXX1234', 'IFSC Code:', record.ifsc || 'HDFC0001234');
  infoRow('Payroll Days:', String(record.payrollDays), 'Monthly Salary:', formatIndianCurrency(record.monthlySalary));

  y += 2;
  doc.line(margin + 4, y, margin + contentWidth - 4, y);

  // Table Headers: Earnings vs Deductions
  y += 5;
  const tableW = contentWidth - 8;
  const halfW = tableW / 2;

  // Earnings Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 4, y - 4, halfW - 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('EARNINGS / ADDITIONS', margin + 6, y + 0.5);
  doc.text('AMOUNT (INR)', margin + halfW - 4, y + 0.5, { align: 'right' });

  // Deductions Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 4 + halfW + 2, y - 4, halfW - 2, 7, 'F');
  doc.text('DEDUCTIONS', margin + halfW + 8, y + 0.5);
  doc.text('AMOUNT (INR)', margin + tableW + 2, y + 0.5, { align: 'right' });

  y += 6;

  // Table Data Rows
  const earningsList: [string, number][] = [
    ['Basic Monthly Salary', record.monthlySalary],
    ['Extra Working Hours (' + (record.extraHours || 0) + ' hrs @ ₹100/hr)', record.extraHoursPayment],
    ['Full Holiday Working (' + (record.holidayWorkingDays || 0) + ' days @ 1.5x)', record.holidayDayPayment],
    ['Outdoor Duty (' + (record.outdoorWorkingDays || 0) + ' days @ ₹500/day)', record.outdoorPayment],
    ['Holiday Hourly Duty (' + (record.holidayWorkingHours || 0) + ' hrs @ ₹150/hr)', record.holidayHourlyPayment],
    ['Extra Payment / Allowance', record.extraPayment],
  ];

  const deductionsList: [string, number][] = [
    ['LWP Days (' + (record.lwpDays || 0) + ' days)', record.lwpDeduction],
    ['Excess CL (' + (record.excessCLDays || 0) + ' days beyond quota)', record.excessCLDeduction],
    ['Excess EL (' + (record.extraELCount || 0) + ' count @ 1.5x)', record.extraELDeduction],
    ['Late Arrivals (' + (record.lateCount || 0) + ' count, ' + (record.chargeableLateDays || 0) + ' days chg)', record.lateDeduction],
    ['Extra Break (' + (record.extraBreakHours || 0) + ' hrs @ ₹50/hr)', record.extraBreakDeduction],
    ['Early Leave (' + (record.earlyLeaveHours || 0) + ' hrs @ ₹50/hr)', record.earlyLeaveDeduction],
  ];

  const maxRows = Math.max(earningsList.length, deductionsList.length);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (let i = 0; i < maxRows; i++) {
    const e = earningsList[i];
    const d = deductionsList[i];

    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin + 4, y - 3.5, halfW - 2, 5, 'F');
      doc.rect(margin + 4 + halfW + 2, y - 3.5, halfW - 2, 5, 'F');
    }

    doc.setTextColor(51, 65, 85);

    if (e) {
      doc.text(e[0], margin + 6, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatIndianCurrency(e[1]), margin + halfW - 4, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    if (d) {
      doc.text(d[0], margin + halfW + 8, y);
      doc.setFont('helvetica', 'bold');
      doc.text(formatIndianCurrency(d[1]), margin + tableW + 2, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    y += 5;
  }

  // Totals Sub-strip
  y += 2;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 4, y - 4, halfW - 2, 6.5, 'F');
  doc.rect(margin + 4 + halfW + 2, y - 4, halfW - 2, 6.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  doc.text('Gross Earnings:', margin + 6, y);
  doc.text(formatIndianCurrency(record.grossEarnings), margin + halfW - 4, y, { align: 'right' });

  doc.text('Total Deductions:', margin + halfW + 8, y);
  doc.text(formatIndianCurrency(record.totalDeductions), margin + tableW + 2, y, { align: 'right' });

  y += 8;

  // NET PAY HIGHLIGHT BOX
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.rect(margin + 4, y - 3, contentWidth - 8, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 27, 75); // indigo-950
  doc.text('NET SALARY PAYABLE:', margin + 8, y + 4);

  doc.setFontSize(13);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(formatIndianCurrency(record.netSalary), margin + contentWidth - 8, y + 4, { align: 'right' });

  y += 15;

  // Amount in words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Amount in Words:', margin + 6, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const words = amountToIndianWords(record.netSalary);
  doc.text(words, margin + 36, y);

  // Attendance and Remarks section
  y += 7;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 4, y - 3, contentWidth - 8, 15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Attendance & Permissions Summary:', margin + 6, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `CL: ${record.clDays || 0}  |  EL: ${record.elCount || 0}  |  LWP: ${record.lwpDays || 0}  |  Late Count: ${record.lateCount || 0}  |  Extra Breaks: ${record.extraBreakHours || 0}h  |  Early Leave: ${record.earlyLeaveHours || 0}h`,
    margin + 6,
    y + 5.5
  );
  if (record.remarks) {
    doc.text(`Remarks: ${record.remarks}`, margin + 6, y + 10);
  }

  // Terms and conditions reference
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const termsText = terms
    ? `Governed by Topclues Solutions Terms & Conditions v${terms.versionNumber} (Effective: ${terms.effectiveDate}).`
    : 'Governed by Topclues Solutions Employee & Payroll Policies.';
  doc.text(termsText, margin + 6, y);

  y += 4;
  doc.setFont('helvetica', 'italic');
  doc.text('Note: This is a computer-generated salary slip and requires no physical signature under company policy.', margin + 6, y);

  // Signatory & Stamp Section
  y += 18;
  const signatoryName = company.authorizedSignatoryName || 'Authorized Signatory';
  const signatoryDesig = company.authorizedSignatoryDesignation || 'Director / HR Manager';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('For Topclues Solutions', margin + contentWidth - 45, y - 16, { align: 'center' });

  // Uploaded signature image sits directly above the signature line.
  const signatureImage = company.authorizedSignatorySignatureUrl;
  if (signatureImage) {
    try {
      const props = doc.getImageProperties(signatureImage);
      if (props.width > 0 && props.height > 0) {
        const scale = Math.min(44 / props.width, 12 / props.height);
        const imgW = props.width * scale;
        const imgH = props.height * scale;
        doc.addImage(
          signatureImage,
          'PNG',
          margin + contentWidth - 42.5 - imgW / 2,
          y - 2 - imgH,
          imgW,
          imgH
        );
      }
    } catch {
      // Unreadable image data: fall back to the signature line only.
    }
  }

  // Signature line
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + contentWidth - 70, y, margin + contentWidth - 15, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(signatoryName, margin + contentWidth - 42.5, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(signatoryDesig, margin + contentWidth - 42.5, y + 8, { align: 'center' });

  // Footer text
  const footerY = pageHeight - margin - 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const footerNote = company.salarySlipFooter || 'Confidential – Strictly for employee reference only. Topclues Solutions.';
  doc.text(footerNote, pageWidth / 2, footerY, { align: 'center' });

  return doc;
}
