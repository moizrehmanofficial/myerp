import { BadRequestException, Injectable } from '@nestjs/common';

// Only these can be saved (anything else in the request is ignored)
const ALLOWED = [
  'company_name', 'company_email', 'company_phone', 'company_address', 'company_currency',
  'company_timezone', 'date_format', 'invoice_prefix', 'purchase_prefix', 'sales_prefix',
  'employee_prefix', 'tax_name', 'tax_rate', 'low_stock_alert', 'fiscal_year_start',
];
const PREFIXES = ['invoice_prefix', 'purchase_prefix', 'sales_prefix', 'employee_prefix'];
import { TenantService } from './tenant.service';

@Injectable()
export class TenantSettingsService {
  constructor(private tenantService: TenantService) {}

  async getSettings(slug: string) {
    const client = await this.tenantService.getTenantClient(slug);

    const result = await client.$queryRawUnsafe(
      `SELECT * FROM "settings" ORDER BY "key" ASC`,
    ) as any[];

    const settings: Record<string, string> = {};
    result.forEach((row: any) => {
      settings[row.key] = row.value;
    });

    return { success: true, data: settings };
  }

  async updateSettings(slug: string, body: Record<string, any>) {
    const client = await this.tenantService.getTenantClient(slug);

    const entries: [string, string][] = [];
    for (const key of ALLOWED) {
      if (body?.[key] === undefined || body[key] === null) continue;
      const value = String(body[key]).trim().slice(0, 500);
      if (PREFIXES.includes(key) && !/^[A-Za-z0-9/-]{1,10}$/.test(value)) {
        throw new BadRequestException('Document prefixes can use letters, numbers, - and /, up to 10 characters');
      }
      if (key === 'tax_rate' && !(Number(value) >= 0 && Number(value) <= 100)) {
        throw new BadRequestException('Tax rate must be between 0 and 100');
      }
      if (key === 'low_stock_alert' && !(Number(value) >= 0)) {
        throw new BadRequestException('Low stock level cannot be negative');
      }
      entries.push([key, value]);
    }

    await client.$transaction(async (tx: any) => {
      for (const [key, value] of entries) {
        await tx.$queryRawUnsafe(
          `INSERT INTO "settings" ("id", "key", "value")
           VALUES (gen_random_uuid(), $1, $2)
           ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = NOW()`,
          key, value,
        );
      }
    });

    return { success: true, message: 'Settings saved successfully' };
  }
}