import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TenantAuditInterceptor } from '../../common/interceptors/tenant-audit.interceptor';
import { TenantPermissionGuard, userCan } from '../../common/guards/tenant-permission.guard';
import { TENANT_ACCESS_COOKIE } from '../../common/auth-cookies';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantCustomersService } from './tenant-customers.service';
import { TenantProductsService } from './tenant-products.service';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantPurchaseService } from './tenant-purchase.service';
import { TenantInvoicesService } from './tenant-invoices.service';
import { TenantSuppliersService } from './tenant-suppliers.service';
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
import { TenantSalarySlipService } from './tenant-salary-slip.service';
import { TenantLeaveService } from './tenant-leave.service';

@Controller('erp')
@UseGuards(TenantPermissionGuard)
@UseInterceptors(TenantAuditInterceptor)
export class TenantErpController {
  constructor(
    private customersService: TenantCustomersService,
    private productsService: TenantProductsService,
    private dashboardService: TenantDashboardService,
    private invoicesService: TenantInvoicesService,
    private purchaseService: TenantPurchaseService,
    private suppliersService: TenantSuppliersService,
    private salesService: TenantSalesService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private inventoryService: TenantInventoryService,
    private reportsService: TenantReportsService,
    private financeService: TenantFinanceService,
    private hrService: TenantHRService,
    private settingsService: TenantSettingsService,
    private usersService: TenantUsersService,
    private returnsService: TenantReturnsService,
    private manufacturingService: TenantManufacturingService,
    private auditService: TenantAuditService,
    private salarySlipService: TenantSalarySlipService,
    private leaveService: TenantLeaveService,
  ) {}

  // ── Verify JWT and get user payload ───────────────────
  private getPayload(req: any): any {
    const token = req.cookies?.[TENANT_ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Only company (tenant) user tokens are allowed on ERP routes
    if (payload?.type !== 'tenant_user' || !payload?.slug) {
      throw new UnauthorizedException('Invalid token type');
    }
    return payload;
  }

  // ── Get tenant slug (always from JWT, must match request tenant) ──
  private getSlug(req: any, payload?: any): string {
    if (!payload?.slug) throw new UnauthorizedException('Not authenticated');

    // req.tenant is set by TenantMiddleware (company exists + not suspended)
    if (!req.tenant?.slug) throw new UnauthorizedException('No tenant found');

    // A user of company A must never access company B
    if (req.tenant.slug !== payload.slug) {
      throw new ForbiddenException('You do not have access to this company');
    }
    return payload.slug;
  }

  // ── DASHBOARD ─────────────────────────────────────────
  @Get('dashboard/stats')
  async getDashboardStats(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    const result: any = await this.dashboardService.getStats(slug);
    const d = result?.data || {};

    // Hide numbers the user is not allowed to see
    const canMoney = userCan(req, 'invoices') || userCan(req, 'sales') || userCan(req, 'finance');
    const canPurchase = userCan(req, 'purchase');
    const canSales = userCan(req, 'sales');
    const canContacts = userCan(req, 'contacts');
    const canStock = userCan(req, 'products') || userCan(req, 'inventory');
    const canHr = userCan(req, 'hr');

    if (!canMoney) {
      Object.assign(d, {
        totalInvoices: 0, totalRevenue: 0, totalCollected: 0, totalDue: 0,
        unpaidInvoices: 0, partialInvoices: 0, accountsReceivable: 0,
        monthlyRevenue: 0, recentInvoices: [], topProducts: [], monthlyRevenueTrend: [],
      });
    }
    if (!canSales) Object.assign(d, { monthlySalesCount: 0, monthlySalesTotal: 0 });
    if (!canPurchase) Object.assign(d, { monthlyPurchaseCount: 0, monthlyPurchaseTotal: 0, recentPurchases: [] });
    if (!canContacts) Object.assign(d, { totalCustomers: 0, totalSuppliers: 0 });
    if (!canStock) Object.assign(d, { totalProducts: 0, lowStockCount: 0 });
    if (!canHr) Object.assign(d, { activeEmployees: 0 });

    d.visibleSections = {
      money: canMoney, sales: canSales, purchase: canPurchase,
      contacts: canContacts, stock: canStock, hr: canHr,
    };
    return result;
  }

  // ── CUSTOMERS ─────────────────────────────────────────
  @Get('customers')
  async getCustomers(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.customersService.findAll(slug, +page, +limit, search);
  }

  @Get('customers/:id')
  async getCustomer(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.customersService.findOne(slug, id);
  }

  @Post('customers')
  async createCustomer(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.customersService.create(slug, body);
  }

  @Put('customers/:id')
  async updateCustomer(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.customersService.update(slug, id, body);
  }

  @Delete('customers/:id')
  async deleteCustomer(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.customersService.remove(slug, id);
  }

  // ── PRODUCTS ──────────────────────────────────────────
  @Get('products')
  async getProducts(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.findAll(slug, +page, +limit, search);
  }

  @Get('products/categories')
  async getCategories(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.getCategories(slug);
  }

  @Get('products/brands')
  async getBrands(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.getBrands(slug);
  }

  @Post('products/categories')
  async createCategory(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.createCategory(slug, body);
  }

  @Delete('products/categories/:id')
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.deleteCategory(slug, id);
  }

  @Post('products/brands')
  async createBrand(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.createBrand(slug, body);
  }

  @Delete('products/brands/:id')
  async deleteBrand(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.deleteBrand(slug, id);
  }

  @Get('products/:id')
  async getProduct(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.findOne(slug, id);
  }

  @Post('products')
  async createProduct(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.create(slug, body);
  }

  @Put('products/:id')
  async updateProduct(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.update(slug, id, body);
  }

  @Delete('products/:id')
  async deleteProduct(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.productsService.remove(slug, id);
  }

  // ── USERS & ROLES ─────────────────────────────────────
  @Get('users/roles')
  async getRoles(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.getRoles(slug);
  }

  @Post('users/roles')
  async createRole(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.createRole(slug, body);
  }

  @Put('users/roles/:id')
  async updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.updateRole(slug, id, body);
  }

  @Delete('users/roles/:id')
  async deleteRole(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.deleteRole(slug, id);
  }

  @Get('users/list')
  async getUsers(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.getUsers(slug);
  }

  @Post('users/list')
  async createUser(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.createUser(slug, body);
  }

  @Put('users/list/:id')
  async updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.updateUser(slug, id, body);
  }

  @Delete('users/list/:id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.usersService.deleteUser(slug, id);
  }


  // ── AUDIT LOGS ────────────────────────────────────────
  @Get('audit-logs')
  async getAuditLogs(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('module') module = '',
    @Query('action') action = '',
    @Query('from') from = '',
    @Query('to') to = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.auditService.getLogs(slug, +page, +limit, {
      module: module || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to || undefined,
    });
  }



  // ── MANUFACTURING ─────────────────────────────────────
  @Get('manufacturing/orders')
  async getManufacturingOrders(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.manufacturingService.findAll(slug, +page, +limit);
  }

  @Get('manufacturing/products')
  async getManufacturingProducts(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.manufacturingService.getProducts(slug);
  }

  @Get('manufacturing/orders/:id')
  async getManufacturingOrder(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.manufacturingService.findOne(slug, id);
  }

  @Post('manufacturing/orders')
  async createManufacturingOrder(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.manufacturingService.create(slug, body);
  }

  @Patch('manufacturing/orders/:id/status')
  async updateManufacturingStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.manufacturingService.updateStatus(slug, id, body);
  }

  @Delete('manufacturing/orders/:id')
  async deleteManufacturingOrder(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.manufacturingService.remove(slug, id);
  }



  // ── RETURNS ───────────────────────────────────────────
  @Get('returns/purchase')
  async getPurchaseReturns(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.getPurchaseReturns(slug, +page, +limit);
  }

  @Post('returns/purchase')
  async createPurchaseReturn(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.createPurchaseReturn(slug, body);
  }

  @Get('returns/sale')
  async getSaleReturns(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.getSaleReturns(slug, +page, +limit);
  }

  @Post('returns/sale')
  async createSaleReturn(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.createSaleReturn(slug, body);
  }

  @Get('returns/suppliers')
  async getReturnSuppliers(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.getSuppliers(slug);
  }

  @Get('returns/customers')
  async getReturnCustomers(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.getCustomers(slug);
  }

  @Get('returns/products')
  async getReturnProducts(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.returnsService.getProducts(slug);
  }



  // ── LEAVE MANAGEMENT ──────────────────────────────────
  @Get('hr/leave/types')
  async getLeaveTypes(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.getLeaveTypes(slug);
  }

  @Post('hr/leave/types')
  async createLeaveType(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.createLeaveType(slug, body);
  }

  @Put('hr/leave/types/:id')
  async updateLeaveType(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.updateLeaveType(slug, id, body);
  }

  @Delete('hr/leave/types/:id')
  async deleteLeaveType(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.deleteLeaveType(slug, id);
  }

  @Get('hr/leave/requests')
  async getLeaveRequests(
    @Req() req: any,
    @Query('status') status = '',
    @Query('employeeId') employeeId = '',
    @Query('month') month = '',
    @Query('year') year = '',
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.getLeaveRequests(slug, {
      status: status || undefined,
      employeeId: employeeId || undefined,
      month: month ? +month : undefined,
      year: year ? +year : undefined,
      page: +page,
      limit: +limit,
    });
  }

  @Post('hr/leave/requests')
  async createLeaveRequest(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.createLeaveRequest(slug, body);
  }

  @Patch('hr/leave/requests/:id/approve')
  async approveLeave(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    const userId = payload.sub || payload.id;
    return this.leaveService.approveLeave(slug, id, userId);
  }

  @Patch('hr/leave/requests/:id/reject')
  async rejectLeave(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.rejectLeave(slug, id, body);
  }

  @Get('hr/leave/balance/:employeeId')
  async getLeaveBalance(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Query('year') year = new Date().getFullYear() + '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.getLeaveBalance(slug, employeeId, +year);
  }

  @Get('hr/leave/employees')
  async getLeaveEmployees(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.leaveService.getEmployees(slug);
  }



  

  // ── SALARY SLIPS ──────────────────────────────────────
  @Post('hr/payroll/:id/generate-slip')
  async generateSalarySlip(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salarySlipService.generateSalarySlip(slug, id);
  }

  @Get('hr/payroll/:id/slip-url')
  async getSlipUrl(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salarySlipService.getSlipUrl(slug, id);
  }

  @Post('hr/payroll/bulk-slips')
  async generateBulkSlips(
    @Req() req: any,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salarySlipService.generateBulkSlips(slug, +body.month, +body.year);
  }




  // ── SETTINGS ──────────────────────────────────────────
  @Get('settings')
  async getSettings(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.settingsService.getSettings(slug);
  }

  @Post('settings')
  async updateSettings(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.settingsService.updateSettings(slug, body);
  }


  // ── HR & PAYROLL ──────────────────────────────────────
  @Get('hr/employees')
  async getEmployees(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.getEmployees(slug, +page, +limit, search);
  }

  @Get('hr/employees/:id')
  async getEmployee(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.getEmployee(slug, id);
  }

  @Post('hr/employees')
  async createEmployee(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.createEmployee(slug, body);
  }

  @Put('hr/employees/:id')
  async updateEmployee(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.updateEmployee(slug, id, body);
  }

  @Delete('hr/employees/:id')
  async deleteEmployee(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.deleteEmployee(slug, id);
  }

  @Get('hr/attendance')
  async getAttendance(
    @Req() req: any,
    @Query('month') month = new Date().getMonth() + 1 + '',
    @Query('year') year = new Date().getFullYear() + '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.getAttendance(slug, +month, +year);
  }

  @Post('hr/attendance')
  async markAttendance(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.markAttendance(slug, body);
  }

  @Post('hr/attendance/bulk')
  async markBulkAttendance(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.markBulkAttendance(slug, body);
  }

  @Get('hr/payroll')
  async getPayroll(
    @Req() req: any,
    @Query('month') month = new Date().getMonth() + 1 + '',
    @Query('year') year = new Date().getFullYear() + '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.getPayroll(slug, +month, +year);
  }

  @Post('hr/payroll/generate')
  async generatePayroll(
    @Req() req: any,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.generatePayroll(slug, +body.month, +body.year);
  }

  @Put('hr/payroll/:id')
  async updatePayrollRecord(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.hrService.updatePayrollRecord(slug, id, body);
  }

  // ── FINANCE ───────────────────────────────────────────
  @Get('finance/accounts')
  async getAccounts(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getAccounts(slug);
  }

  @Post('finance/accounts')
  async createAccount(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.createAccount(slug, body);
  }

  @Get('finance/accounts/:id/ledger')
  async getLedger(
    @Req() req: any,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getLedger(slug, id, from, to);
  }

  @Get('finance/journals')
  async getJournals(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getJournals(slug, +page, +limit);
  }

  @Post('finance/journals')
  async createJournal(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.createJournal(slug, body);
  }

  @Get('finance/journals/:id')
  async getJournal(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getJournalOne(slug, id);
  }

  @Get('finance/payments')
  async getPayments(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getPayments(slug, +page, +limit);
  }

  @Post('finance/payments')
  async createPayment(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.createPayment(slug, body);
  }

  @Get('finance/receipts')
  async getReceipts(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getReceipts(slug, +page, +limit);
  }

  @Post('finance/receipts')
  async createReceipt(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.createReceipt(slug, body);
  }

  @Get('finance/trial-balance')
  async getTrialBalance(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.getTrialBalance(slug);
  }

  // One-time: post invoices / purchases created before auto-accounting
  @Post('finance/post-old-records')
  async postOldRecords(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.financeService.postOldRecords(slug);
  }


  // ── REPORTS ───────────────────────────────────────────
  @Get('reports/sales')
  async getSalesReport(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getSalesReport(slug, from, to);
  }

  @Get('reports/purchase')
  async getPurchaseReport(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getPurchaseReport(slug, from, to);
  }

  @Get('reports/stock')
  async getStockReport(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getStockReport(slug);
  }

  @Get('reports/profit-loss')
  async getProfitLoss(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getProfitLoss(slug, from, to);
  }

  @Get('reports/balance-sheet')
  async getBalanceSheet(
    @Req() req: any,
    @Query('asOf') asOf: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    const date = asOf || new Date().toISOString();
    return this.reportsService.getBalanceSheet(slug, date);
  }

  @Get('reports/ar')
  async getARReport(
    @Req() req: any,
    @Query('asOf') asOf: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    const date = asOf || new Date().toISOString();
    return this.reportsService.getARReport(slug, date);
  }

  @Get('reports/ap')
  async getAPReport(
    @Req() req: any,
    @Query('asOf') asOf: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    const date = asOf || new Date().toISOString();
    return this.reportsService.getAPReport(slug, date);
  }

  @Get('reports/customer-ledger')
  async getCustomerLedger(
    @Req() req: any,
    @Query('customerId') customerId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getCustomerLedger(slug, customerId, from, to);
  }

  @Get('reports/supplier-ledger')
  async getSupplierLedger(
    @Req() req: any,
    @Query('supplierId') supplierId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getSupplierLedger(slug, supplierId, from, to);
  }

  @Get('reports/stock-movement')
  async getStockMovement(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('productId') productId?: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getStockMovementReport(slug, from, to, productId);
  }

  @Get('reports/invoices')
  async getInvoiceReport(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('status') status?: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getInvoiceReport(slug, from, to, status);
  }

  @Get('reports/attendance')
  async getAttendanceReport(
    @Req() req: any,
    @Query('month') month = new Date().getMonth() + 1 + '',
    @Query('year') year = new Date().getFullYear() + '',
    @Query('department') department?: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getAttendanceReport(slug, +month, +year, department);
  }

  @Get('reports/payroll-report')
  async getPayrollReport(
    @Req() req: any,
    @Query('month') month = new Date().getMonth() + 1 + '',
    @Query('year') year = new Date().getFullYear() + '',
    @Query('department') department?: string,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getPayrollReport(slug, +month, +year, department);
  }

  @Get('reports/customers-list')
  async getCustomersForReport(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getCustomersForReport(slug);
  }

  @Get('reports/suppliers-list')
  async getSuppliersForReport(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.reportsService.getSuppliersForReport(slug);
  }


  // ── INVENTORY ─────────────────────────────────────────
  @Get('inventory/overview')
  async getInventoryOverview(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.inventoryService.getStockOverview(slug);
  }

  @Get('inventory/transactions')
  async getInventoryTransactions(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('productId') productId = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.inventoryService.getTransactions(slug, +page, +limit, productId);
  }

  @Post('inventory/adjust')
  async adjustStock(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.inventoryService.adjustStock(slug, body);
  }


  // ── PURCHASE ORDERS ───────────────────────────────────
  @Get('purchase/suppliers')
  async getPurchaseSuppliers(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.getSuppliers(slug);
  }

  @Get('purchase/products')
  async getPurchaseProducts(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.getProducts(slug);
  }

  @Get('purchase/orders')
  async getPurchaseOrders(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.findAll(slug, +page, +limit, search);
  }

  @Get('purchase/orders/:id')
  async getPurchaseOrder(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.findOne(slug, id);
  }

  @Post('purchase/orders')
  async createPurchaseOrder(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.create(slug, body);
  }

  @Patch('purchase/orders/:id/status')
  async updatePurchaseStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.updateStatus(slug, id, body);
  }

  @Delete('purchase/orders/:id')
  async deletePurchaseOrder(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.purchaseService.remove(slug, id);
  }


  // ── SALES ORDERS ──────────────────────────────────────
  @Get('sales/customers')
  async getSalesCustomers(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.getCustomers(slug);
  }

  @Get('sales/products')
  async getSalesProducts(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.getProducts(slug);
  }

  @Get('sales/orders')
  async getSalesOrders(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.findAll(slug, +page, +limit, search);
  }

  @Get('sales/orders/:id')
  async getSalesOrder(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.findOne(slug, id);
  }

  @Post('sales/orders')
  async createSalesOrder(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.create(slug, body);
  }

  @Patch('sales/orders/:id/status')
  async updateSalesOrderStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.updateStatus(slug, id, body);
  }

  @Delete('sales/orders/:id')
  async deleteSalesOrder(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.salesService.remove(slug, id);
  }


  // ── SUPPLIERS ─────────────────────────────────────────
  @Get('suppliers')
  async getSuppliers(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.suppliersService.findAll(slug, +page, +limit, search);
  }

  @Get('suppliers/:id')
  async getSupplier(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.suppliersService.findOne(slug, id);
  }

  @Post('suppliers')
  async createSupplier(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.suppliersService.create(slug, body);
  }

  @Put('suppliers/:id')
  async updateSupplier(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.suppliersService.update(slug, id, body);
  }

  @Delete('suppliers/:id')
  async deleteSupplier(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.suppliersService.remove(slug, id);
  }


  // ── INVOICES ──────────────────────────────────────────
  @Get('invoices')
  async getInvoices(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search = '',
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.findAll(slug, +page, +limit, search);
  }

  @Get('invoices/customers')
  async getInvoiceCustomers(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.getCustomers(slug);
  }

  @Get('invoices/products')
  async getInvoiceProducts(@Req() req: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.getProducts(slug);
  }

  @Post('invoices')
  async createInvoice(@Req() req: any, @Body() body: any) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.create(slug, body);
  }

  @Get('invoices/:id')
  async getInvoice(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.findOne(slug, id);
  }

  @Put('invoices/:id')
  async updateInvoice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.update(slug, id, body);
  }

  @Patch('invoices/:id/payment')
  async updatePayment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.updatePayment(slug, id, body);
  }

  @Delete('invoices/:id')
  async deleteInvoice(@Req() req: any, @Param('id') id: string) {
    const payload = this.getPayload(req);
    const slug = this.getSlug(req, payload);
    return this.invoicesService.remove(slug, id);
  }
}