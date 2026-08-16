import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class TenantSalarySlipService {
  private s3: S3Client;

  constructor(
    private tenantService: TenantService,
    private configService: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.get('CLOUDFLARE_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get('CLOUDFLARE_R2_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async generateSalarySlip(slug: string, payrollId: string) {
    const client = await this.tenantService.getTenantClient(slug);

    // Fetch payroll + employee data
    const payrolls = await client.$queryRawUnsafe(
      `SELECT p.*, e."name" as "employeeName", e."employeeCode",
              e."designation", e."department", e."cnic",
              e."joiningDate", e."phone", e."email"
       FROM "payroll" p
       JOIN "employees" e ON p."employeeId" = e."id"
       WHERE p."id" = $1::uuid LIMIT 1`,
      payrollId,
    ) as any[];

    if (!payrolls.length) throw new NotFoundException('Payroll record not found');
    const payroll = payrolls[0];

    // Fetch company settings
    const settings = await client.$queryRawUnsafe(
      `SELECT "key", "value" FROM "settings"`,
    ) as any[];

    const settingsMap: Record<string, string> = {};
    settings.forEach((s: any) => { settingsMap[s.key] = s.value; });

    const monthName = new Date(payroll.year, payroll.month - 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    // Generate HTML for the slip
    const html = this.buildSalarySlipHTML(payroll, settingsMap, monthName, slug);

    // Generate PDF using puppeteer
    const pdfBuffer = await this.htmlToPdf(html);

    // Upload to R2
    const key = `salary-slips/${slug}/${payroll.year}/${payroll.month}/${payroll.employeeCode}.pdf`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.configService.get('CLOUDFLARE_R2_BUCKET_NAME'),
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        slug,
        employeeCode: payroll.employeeCode,
        month: String(payroll.month),
        year: String(payroll.year),
      },
    }));

    // Get signed download URL (valid 24 hours)
    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.configService.get('CLOUDFLARE_R2_BUCKET_NAME'),
        Key: key,
      }),
      { expiresIn: 86400 }
    );

    // Save slip URL to payroll record
    await client.$queryRawUnsafe(
      `UPDATE "payroll" SET "slipUrl" = $1 WHERE "id" = $2::uuid`,
      key, payrollId,
    );

    return {
      success: true,
      message: 'Salary slip generated successfully',
      data: {
        downloadUrl: signedUrl,
        key,
        employeeName: payroll.employeeName,
        month: monthName,
      },
    };
  }

  async getSlipUrl(slug: string, payrollId: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const payrolls = await client.$queryRawUnsafe(
      `SELECT "slipUrl" FROM "payroll" WHERE "id" = $1::uuid LIMIT 1`,
      payrollId,
    ) as any[];

    if (!payrolls.length || !payrolls[0].slipUrl) {
      throw new NotFoundException('Salary slip not generated yet');
    }

    const signedUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.configService.get('CLOUDFLARE_R2_BUCKET_NAME'),
        Key: payrolls[0].slipUrl,
      }),
      { expiresIn: 86400 }
    );

    return { success: true, data: { downloadUrl: signedUrl } };
  }

  async generateBulkSlips(slug: string, month: number, year: number) {
    const client = await this.tenantService.getTenantClient(slug);

    const payrolls = await client.$queryRawUnsafe(
      `SELECT "id" FROM "payroll" WHERE "month" = $1 AND "year" = $2`,
      month, year,
    ) as any[];

    const results = [];
    for (const p of payrolls) {
      try {
        await this.generateSalarySlip(slug, p.id);
        results.push({ id: p.id, status: 'SUCCESS' });
      } catch (err: any) {
        results.push({ id: p.id, status: 'FAILED', error: err.message });
      }
    }

    const succeeded = results.filter((r) => r.status === 'SUCCESS').length;
    return {
      success: true,
      message: `Generated ${succeeded} of ${payrolls.length} salary slips`,
      data: results,
    };
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private buildSalarySlipHTML(
    payroll: any,
    settings: Record<string, string>,
    monthName: string,
    slug: string,
  ): string {
    const companyName = settings['company_name'] || slug.charAt(0).toUpperCase() + slug.slice(1);
    const companyEmail = settings['company_email'] || '';
    const companyPhone = settings['company_phone'] || '';
    const companyAddress = settings['company_address'] || '';
    const currency = settings['company_currency'] || 'PKR';

    const basicSalary = Number(payroll.basicSalary || 0);
    const allowances = Number(payroll.allowances || 0);
    const deductions = Number(payroll.deductions || 0);
    const tax = Number(payroll.tax || 0);
    const netSalary = Number(payroll.netSalary || 0);
    const grossSalary = basicSalary + allowances;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Salary Slip - ${payroll.employeeName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; }

  .slip { max-width: 794px; margin: 0 auto; padding: 0; }

  /* Header */
  .header { background: linear-gradient(135deg, #1E3A5F 0%, #2E86AB 100%); color: white; padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; }
  .company-name { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px; }
  .company-info { font-size: 11px; opacity: 0.8; line-height: 1.6; }
  .slip-title { text-align: right; }
  .slip-title h2 { font-size: 16px; font-weight: 700; opacity: 0.9; margin-bottom: 6px; }
  .slip-badge { background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 99px; font-size: 13px; font-weight: 700; }

  /* Employee Info */
  .employee-section { padding: 24px 36px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .info-group { }
  .info-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .info-value { font-size: 14px; font-weight: 600; color: #0F172A; }
  .info-value.code { font-family: monospace; color: #7C3AED; background: #FAF5FF; padding: 2px 8px; border-radius: 4px; font-size: 13px; }

  /* Earnings & Deductions */
  .body-section { padding: 24px 36px; }
  .section-title { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }

  .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .table th { background: #F1F5F9; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; }
  .table th:last-child { text-align: right; }
  .table td { padding: 10px 14px; border-bottom: 1px solid #F8FAFC; font-size: 13px; }
  .table td:last-child { text-align: right; font-weight: 600; }
  .table tr:last-child td { border-bottom: none; }
  .table .subtotal td { background: #F8FAFC; font-weight: 700; font-size: 13px; }
  .table .deduction-row td { color: #DC2626; }

  /* Net Salary */
  .net-salary-box { background: linear-gradient(135deg, #1E3A5F, #2E86AB); color: white; padding: 20px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
  .net-label { font-size: 14px; font-weight: 600; opacity: 0.9; }
  .net-amount { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
  .net-month { font-size: 11px; opacity: 0.7; margin-top: 2px; }

  /* Summary Row */
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .summary-card { background: #F8FAFC; border-radius: 8px; padding: 12px 14px; border: 1px solid #E2E8F0; }
  .summary-card .s-label { font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 4px; }
  .summary-card .s-value { font-size: 16px; font-weight: 800; color: #0F172A; }
  .summary-card.earn .s-value { color: #16A34A; }
  .summary-card.ded .s-value { color: #DC2626; }
  .summary-card.net .s-value { color: #1E3A5F; }

  /* Footer */
  .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 16px 36px; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 11px; color: #94A3B8; line-height: 1.6; }
  .footer-right { text-align: right; }
  .stamp { font-size: 11px; color: #94A3B8; margin-bottom: 32px; }
  .signature-line { border-top: 1px solid #CBD5E1; padding-top: 4px; font-size: 10px; color: #94A3B8; }

  /* Status badge */
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; }
  .status-paid { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }
  .status-pending { background: #FFF7ED; color: #EA580C; border: 1px solid #FED7AA; }
</style>
</head>
<body>
<div class="slip">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="company-name">${companyName}</div>
      <div class="company-info">
        ${companyEmail ? `✉ ${companyEmail}<br>` : ''}
        ${companyPhone ? `📞 ${companyPhone}<br>` : ''}
        ${companyAddress ? `📍 ${companyAddress}` : ''}
      </div>
    </div>
    <div class="slip-title">
      <h2>Salary Slip</h2>
      <div class="slip-badge">${monthName}</div>
      <div style="margin-top: 8px;">
        <span class="status-badge ${payroll.status === 'PAID' ? 'status-paid' : 'status-pending'}">
          ${payroll.status}
        </span>
      </div>
    </div>
  </div>

  <!-- Employee Information -->
  <div class="employee-section">
    <div>
      <div class="info-group" style="margin-bottom:12px">
        <div class="info-label">Employee Name</div>
        <div class="info-value" style="font-size:16px">${payroll.employeeName}</div>
      </div>
      <div class="info-group" style="margin-bottom:12px">
        <div class="info-label">Employee Code</div>
        <div class="info-value code">${payroll.employeeCode}</div>
      </div>
      <div class="info-group">
        <div class="info-label">CNIC</div>
        <div class="info-value">${payroll.cnic || '—'}</div>
      </div>
    </div>
    <div>
      <div class="info-group" style="margin-bottom:12px">
        <div class="info-label">Department</div>
        <div class="info-value">${payroll.department || '—'}</div>
      </div>
      <div class="info-group" style="margin-bottom:12px">
        <div class="info-label">Designation</div>
        <div class="info-value">${payroll.designation || '—'}</div>
      </div>
      <div class="info-group">
        <div class="info-label">Pay Period</div>
        <div class="info-value">${monthName}</div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body-section">

    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card earn">
        <div class="s-label">Gross Earnings</div>
        <div class="s-value">${currency} ${grossSalary.toLocaleString()}</div>
      </div>
      <div class="summary-card ded">
        <div class="s-label">Total Deductions</div>
        <div class="s-value">${currency} ${(deductions + tax).toLocaleString()}</div>
      </div>
      <div class="summary-card net">
        <div class="s-label">Net Salary</div>
        <div class="s-value">${currency} ${netSalary.toLocaleString()}</div>
      </div>
    </div>

    <!-- Earnings Table -->
    <div class="section-title">Earnings</div>
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount (${currency})</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic Salary</td>
          <td>${basicSalary.toLocaleString()}</td>
        </tr>
        ${allowances > 0 ? `<tr><td>Allowances</td><td>${allowances.toLocaleString()}</td></tr>` : ''}
        <tr class="subtotal">
          <td>Gross Total</td>
          <td>${grossSalary.toLocaleString()}</td>
        </tr>
      </tbody>
    </table>

    <!-- Deductions Table -->
    <div class="section-title">Deductions</div>
    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount (${currency})</th>
        </tr>
      </thead>
      <tbody>
        ${deductions > 0 ? `<tr class="deduction-row"><td>Deductions (Absences / Other)</td><td>${deductions.toLocaleString()}</td></tr>` : ''}
        ${tax > 0 ? `<tr class="deduction-row"><td>Income Tax</td><td>${tax.toLocaleString()}</td></tr>` : ''}
        ${deductions === 0 && tax === 0 ? `<tr><td colspan="2" style="text-align:center;color:#94A3B8;font-size:12px;padding:16px">No deductions this month</td></tr>` : ''}
        ${(deductions > 0 || tax > 0) ? `<tr class="subtotal"><td>Total Deductions</td><td style="color:#DC2626">${(deductions + tax).toLocaleString()}</td></tr>` : ''}
      </tbody>
    </table>

    <!-- Net Salary -->
    <div class="net-salary-box">
      <div>
        <div class="net-label">Net Salary Payable</div>
        <div class="net-month">${monthName}</div>
      </div>
      <div class="net-amount">${currency} ${netSalary.toLocaleString()}</div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      Generated by MyERP<br>
      Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
      <em>This is a computer-generated document and does not require a signature.</em>
    </div>
    <div class="footer-right">
      <div class="stamp">For ${companyName}</div>
      <div class="signature-line">Authorized Signatory</div>
    </div>
  </div>

</div>
</body>
</html>`;
  }
}