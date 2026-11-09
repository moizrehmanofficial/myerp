import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantService } from './tenant.service';
import { TenantCustomersService } from './tenant-customers.service';
import { TenantProductsService } from './tenant-products.service';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantInvoicesService } from './tenant-invoices.service';
import { TenantSuppliersService } from './tenant-suppliers.service';
import { TenantPurchaseService } from './tenant-purchase.service';
import { TenantSalesService } from './tenant-sales.service';
import { TenantInventoryService } from './tenant-inventory.service';
import { TenantReportsService } from './tenant-reports.service';
import { TenantFinanceService } from './tenant-finance.service';
import { TenantHRService } from './tenant-hr.service';
import { TenantSettingsService } from './tenant-settings.service';
import { TenantUsersService } from './tenant-users.service';
import { TenantReturnsService } from './tenant-returns.service';
import { TenantManufacturingService } from './tenant-manufacturing.service';
import { TenantAuditService } from './tenant-audit.service';
import { TenantErpController } from './tenant-erp.controller';
import { TenantSalarySlipService } from './tenant-salary-slip.service';
import { TenantLeaveService } from './tenant-leave.service';
import { TenantQuotationsService } from './tenant-quotations.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [TenantErpController],
  providers: [
    TenantService,
    TenantCustomersService,
    TenantProductsService,
    TenantDashboardService,
    TenantInvoicesService,
    TenantSuppliersService,
    TenantPurchaseService,
    TenantSalesService,
    TenantInventoryService,
    TenantReportsService,
    TenantFinanceService,
    TenantHRService,
    TenantSettingsService,
    TenantUsersService,
    TenantReturnsService,
    TenantManufacturingService,
    TenantAuditService,
    TenantSalarySlipService,
    TenantLeaveService,
    TenantQuotationsService,
  ],
  exports: [
    TenantService,
    TenantCustomersService,
    TenantProductsService,
    TenantDashboardService,
    TenantInvoicesService,
    TenantSuppliersService,
    TenantPurchaseService,
    TenantSalesService,
    TenantInventoryService,
    TenantReportsService,
    TenantFinanceService,
    TenantHRService,
    TenantSettingsService,
    TenantUsersService,
    TenantReturnsService,
    TenantManufacturingService,
    TenantAuditService,
  ],
})
export class TenantModule {}