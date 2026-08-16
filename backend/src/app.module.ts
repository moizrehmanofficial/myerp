import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { MulterModule } from '@nestjs/platform-express';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { TenantModule } from './modules/tenants/tenant.module';
import { TenantAuthModule } from './modules/tenant-auth/tenant-auth.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { BackupModule } from './modules/backups/backup.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 10 },
        { name: 'long', ttl: 60000, limit: 100 },
      ],
    }),
    MulterModule.register({ limits: { fileSize: 2 * 1024 * 1024 } }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    TenantModule,
    AuthModule,
    SuperAdminModule,
    CompaniesModule,
    TenantAuthModule,
    BackupModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(TenantMiddleware)
    .forRoutes(
      { path: 'tenant-auth/login', method: RequestMethod.POST },
      { path: 'tenant-auth/logout', method: RequestMethod.POST },
      { path: 'tenant-auth/me', method: RequestMethod.GET },
      { path: 'tenant-auth/company-info', method: RequestMethod.GET },
      { path: 'erp/dashboard/stats', method: RequestMethod.GET },
      { path: 'erp/customers', method: RequestMethod.ALL },
      { path: 'erp/customers/:id', method: RequestMethod.ALL },
      { path: 'erp/products', method: RequestMethod.ALL },
      { path: 'erp/products/:id', method: RequestMethod.ALL },
      { path: 'erp/products/categories', method: RequestMethod.GET },
      { path: 'erp/products/brands', method: RequestMethod.GET },
      { path: 'erp/products/categories', method: RequestMethod.POST },
      { path: 'erp/products/categories/:id', method: RequestMethod.DELETE },
      { path: 'erp/products/brands', method: RequestMethod.POST },
      { path: 'erp/products/brands/:id', method: RequestMethod.DELETE },
      { path: 'erp/sales/customers', method: RequestMethod.GET },
      { path: 'erp/sales/products', method: RequestMethod.GET },
      { path: 'erp/sales/orders', method: RequestMethod.ALL },
      { path: 'erp/sales/orders/:id', method: RequestMethod.ALL },
      { path: 'erp/sales/orders/:id/status', method: RequestMethod.ALL },
      { path: 'erp/users/roles', method: RequestMethod.ALL },
      { path: 'erp/users/roles/:id', method: RequestMethod.ALL },
      { path: 'erp/users/list', method: RequestMethod.ALL },
      { path: 'erp/users/list/:id', method: RequestMethod.ALL },
      { path: 'erp/hr/employees', method: RequestMethod.ALL },
      { path: 'erp/hr/employees/:id', method: RequestMethod.ALL },
      { path: 'erp/hr/attendance', method: RequestMethod.ALL },
      { path: 'erp/hr/attendance/bulk', method: RequestMethod.POST },
      { path: 'erp/hr/payroll', method: RequestMethod.GET },
      { path: 'erp/hr/payroll/:id/generate-slip', method: RequestMethod.POST },
      { path: 'erp/hr/payroll/:id/slip-url', method: RequestMethod.GET },
      { path: 'erp/hr/payroll/bulk-slips', method: RequestMethod.POST },
      { path: 'erp/hr/leave/types', method: RequestMethod.ALL },
      { path: 'erp/hr/leave/types/:id', method: RequestMethod.ALL },
      { path: 'erp/hr/leave/requests', method: RequestMethod.ALL },
      { path: 'erp/hr/leave/requests/:id/approve', method: RequestMethod.PATCH },
      { path: 'erp/hr/leave/requests/:id/reject', method: RequestMethod.PATCH },
      { path: 'erp/hr/leave/balance/:employeeId', method: RequestMethod.GET },
      { path: 'erp/hr/leave/employees', method: RequestMethod.GET },
      { path: 'erp/hr/payroll/:id', method: RequestMethod.PUT },
      { path: 'erp/finance/accounts', method: RequestMethod.ALL },
      { path: 'erp/finance/accounts/:id/ledger', method: RequestMethod.GET },
      { path: 'erp/finance/journals', method: RequestMethod.ALL },
      { path: 'erp/finance/journals/:id', method: RequestMethod.GET },
      { path: 'erp/finance/payments', method: RequestMethod.ALL },
      { path: 'erp/finance/receipts', method: RequestMethod.ALL },
      { path: 'erp/finance/trial-balance', method: RequestMethod.GET },
      { path: 'erp/reports/sales', method: RequestMethod.GET },
      { path: 'erp/reports/purchase', method: RequestMethod.GET },
      { path: 'erp/reports/stock', method: RequestMethod.GET },
      { path: 'erp/reports/profit-loss', method: RequestMethod.GET },
      { path: 'erp/reports/balance-sheet', method: RequestMethod.GET },
      { path: 'erp/reports/ar', method: RequestMethod.GET },
      { path: 'erp/reports/ap', method: RequestMethod.GET },
      { path: 'erp/reports/customer-ledger', method: RequestMethod.GET },
      { path: 'erp/reports/supplier-ledger', method: RequestMethod.GET },
      { path: 'erp/reports/stock-movement', method: RequestMethod.GET },
      { path: 'erp/reports/invoices', method: RequestMethod.GET },
      { path: 'erp/reports/attendance', method: RequestMethod.GET },
      { path: 'erp/reports/payroll-report', method: RequestMethod.GET },
      { path: 'erp/reports/customers-list', method: RequestMethod.GET },
      { path: 'erp/reports/suppliers-list', method: RequestMethod.GET },
      { path: 'erp/inventory/transactions', method: RequestMethod.GET },
      { path: 'erp/inventory/adjust', method: RequestMethod.POST },
      { path: 'erp/purchase/products', method: RequestMethod.GET },
      { path: 'erp/purchase/orders', method: RequestMethod.ALL },
      { path: 'erp/purchase/orders/:id', method: RequestMethod.ALL },
      { path: 'erp/purchase/orders/:id/status', method: RequestMethod.ALL },
      { path: 'erp/invoices', method: RequestMethod.ALL },
      { path: 'erp/invoices/customers', method: RequestMethod.GET },
      { path: 'erp/invoices/products', method: RequestMethod.GET },
      { path: 'erp/invoices/:id', method: RequestMethod.ALL },
      { path: 'erp/invoices/:id/payment', method: RequestMethod.ALL },
      { path: 'erp/audit-logs', method: RequestMethod.GET },
      { path: 'erp/manufacturing/orders', method: RequestMethod.ALL },
      { path: 'erp/manufacturing/products', method: RequestMethod.GET },
      { path: 'erp/manufacturing/orders/:id', method: RequestMethod.ALL },
      { path: 'erp/manufacturing/orders/:id/status', method: RequestMethod.ALL },
      { path: 'erp/returns/purchase', method: RequestMethod.ALL },
      { path: 'erp/returns/sale', method: RequestMethod.ALL },
      { path: 'erp/returns/suppliers', method: RequestMethod.GET },
      { path: 'erp/returns/customers', method: RequestMethod.GET },
      { path: 'erp/returns/products', method: RequestMethod.GET },
      { path: 'erp/settings', method: RequestMethod.ALL },
    );
}
}