import { Injectable } from '@nestjs/common';
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
    const existing = await this.prisma.module.findUnique({
      where: { key: body.key },
    });

    if (existing) {
      return {
        success: false,
        message: 'Module key already exists',
      };
    }

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
    const module = await this.prisma.module.update({
      where: { id },
      data: { isActive: body.isActive },
    });
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
    const existing = await this.prisma.superAdmin.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return { success: false, message: 'Email already exists' };
    }

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

  async updateAdmin(id: string, body: any) {
    const admin = await this.prisma.superAdmin.update({
      where: { id },
      data: { isActive: body.status === 'ACTIVE' },
    });
    return { success: true, message: 'Admin updated', data: admin };
  }
}