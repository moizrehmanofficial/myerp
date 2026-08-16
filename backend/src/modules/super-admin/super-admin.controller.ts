import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminService } from './super-admin.service';

@Controller('super-admin')
@UseGuards(AuthGuard('jwt'))
export class SuperAdminController {
  constructor(private superAdminService: SuperAdminService) {}

  @Get('me')
  async getProfile(@Req() req: any) {
    return this.superAdminService.getProfile(req.user.id);
  }

  @Get('stats')
  async getStats() {
    return this.superAdminService.getDashboardStats();
  }

  // ── MODULES ───────────────────────────────────────────
  @Get('modules')
  async getModules() {
    return this.superAdminService.getModules();
  }

  @Post('modules')
  async createModule(@Body() body: any) {
    return this.superAdminService.createModule(body);
  }

  @Patch('modules/:id')
  async updateModule(@Param('id') id: string, @Body() body: any) {
    return this.superAdminService.updateModule(id, body);
  }

  // ── ADMIN USERS ───────────────────────────────────────
  @Get('admins')
  async getAdmins() {
    return this.superAdminService.getAdmins();
  }

  @Post('admins')
  async createAdmin(@Body() body: any) {
    return this.superAdminService.createAdmin(body);
  }

  @Patch('admins/:id')
  async updateAdmin(@Param('id') id: string, @Body() body: any) {
    return this.superAdminService.updateAdmin(id, body);
  }
}