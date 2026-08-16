import { Injectable } from '@nestjs/common';
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

  async updateSettings(slug: string, body: Record<string, string>) {
    const client = await this.tenantService.getTenantClient(slug);

    for (const [key, value] of Object.entries(body)) {
      await client.$queryRawUnsafe(
        `INSERT INTO "settings" ("id", "key", "value")
         VALUES (gen_random_uuid(), $1, $2)
         ON CONFLICT ("key") DO UPDATE SET "value" = $2, "updatedAt" = NOW()`,
        key, value,
      );
    }

    return { success: true, message: 'Settings saved successfully' };
  }
}