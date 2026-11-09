import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Sends email through SMTP (e.g. Brevo). If SMTP is not set up, emails are
// skipped and logged, so nothing else breaks.
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    if (host && user && pass) {
      const port = Number(this.config.get<string>('SMTP_PORT') || 587);
      this.transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    }
  }

  get enabled() {
    return !!this.transporter;
  }

  private get from() {
    return this.config.get<string>('MAIL_FROM') || `MyERP <${this.config.get<string>('SMTP_USER')}>`;
  }

  async send(to: string, subject: string, title: string, paragraphs: string[], button?: { label: string; url: string }) {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured, email to ${to} skipped: ${subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: [title, ...paragraphs, button ? `${button.label}: ${button.url}` : ''].filter(Boolean).join('\n\n'),
        html: layout(title, paragraphs, button),
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Email to ${to} failed: ${err?.message}`);
      return false;
    }
  }
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// Plain, table-based HTML that looks right in Gmail and Outlook
function layout(title: string, paragraphs: string[], button?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#4a5566">${esc(p)}</p>`).join('');
  const cta = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="background:#0f766e;border-radius:8px">
         <a href="${esc(button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#7b8594">If the button does not work, copy this link into your browser:<br><span style="color:#1b2533;word-break:break-all">${esc(button.url)}</span></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e6eb;border-radius:12px">
      <tr><td style="padding:20px 28px;border-bottom:1px solid #e2e6eb;font-size:15px;font-weight:700;color:#16263f">MyERP</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1b2533">${esc(title)}</h1>
        ${body}${cta}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#7b8594">You received this email because of your MyERP account.</p>
  </td></tr></table></body></html>`;
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
