import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}

  async getProfile(adminId: string) {
    const admin = await this.prisma.superAdmin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Profile fetched successfully',
      data: admin,
    };
  }

  async getDashboardStats() {
    const [totalCompanies, activeCompanies, totalModules] = await Promise.all([
      this.prisma.company.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.company.count({ where: { status: 'ACTIVE' } }),
      this.prisma.module.count({ where: { isActive: true } }),
    ]);

    return {
      success: true,
      message: 'Stats fetched successfully',
      data: {
        totalCompanies,
        activeCompanies,
        totalModules,
        activePlans: activeCompanies,
      },
    };
  }

  // ── MODULES ───────────────────────────────────────────

  async getModules() {
    const modules = await this.prisma.module.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return { success: true, data: modules };
  }

  async createModule(body: any) {
    body.key = String(body.key || '').trim().toLowerCase();
    body.name = String(body.name || '').trim();
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(body.key)) {
      throw new BadRequestException('Key: lowercase letters, numbers and _ only, starting with a letter');
    }
    if (!body.name) throw new BadRequestException('Enter a module name');
    const existing = await this.prisma.module.findUnique({
      where: { key: body.key },
    });

    if (existing) throw new BadRequestException('A module with this key already exists');

    const module = await this.prisma.module.create({
      data: {
        key: body.key,
        name: body.name,
        description: body.description || null,
        sortOrder: parseInt(body.sortOrder) || 99,
        isActive: true,
      },
    });

    return { success: true, message: 'Module created', data: module };
  }

  async updateModule(id: string, body: any) {
    const found = await this.prisma.module.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Module not found');
    const data: any = {};
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.name !== undefined && String(body.name).trim()) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = String(body.description || '').trim() || null;
    if (body.sortOrder !== undefined && !isNaN(parseInt(body.sortOrder))) data.sortOrder = parseInt(body.sortOrder);
    const module = await this.prisma.module.update({ where: { id }, data });
    return { success: true, message: 'Module updated', data: module };
  }

  // ── ADMIN USERS ───────────────────────────────────────

  async getAdmins() {
    const admins = await this.prisma.superAdmin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
    return {
      success: true,
      data: admins.map((a) => ({
        ...a,
        role: 'SUPER_ADMIN',
        status: a.isActive ? 'ACTIVE' : 'INACTIVE',
      })),
    };
  }

  async createAdmin(body: any) {
    body.name = String(body.name || '').trim();
    body.email = String(body.email || '').trim().toLowerCase();
    if (!body.name) throw new BadRequestException('Enter a name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new BadRequestException('Enter a valid email address');
    if (String(body.password || '').length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const existing = await this.prisma.superAdmin.findUnique({
      where: { email: body.email },
    });

    if (existing) throw new BadRequestException('An admin with this email already exists');

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const admin = await this.prisma.superAdmin.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        isActive: true,
      },
    });

    return {
      success: true,
      message: 'Admin created successfully',
      data: { id: admin.id, name: admin.name, email: admin.email },
    };
  }

  async updateAdmin(id: string, body: any, currentAdminId?: string) {
    const isActive = body.status === 'ACTIVE';
    if (!isActive) {
      if (id === currentAdminId) throw new BadRequestException('You cannot block your own account');
      const others = await this.prisma.superAdmin.count({ where: { isActive: true, id: { not: id } } });
      if (others === 0) throw new BadRequestException('At least one admin must stay active');
    }
    const admin = await this.prisma.superAdmin.update({
      where: { id },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });
    return { success: true, message: 'Admin updated', data: admin };
  }
}