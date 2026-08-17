import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async superAdminLogin(dto: LoginDto, res: any) {
    // ── Find Super Admin ───────────────────────────────
    const admin = await this.prisma.superAdmin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Your account has been disabled');
    }

    // ── Verify Password ────────────────────────────────
    const passwordMatch = await bcrypt.compare(dto.password, admin.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // ── Generate Tokens ────────────────────────────────
    const payload = { sub: admin.id, email: admin.email, type: 'super_admin' };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      // configService may return string | undefined; cast to any to satisfy jwt types
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') as any,
    });

    // ── Hash & Save Refresh Token ──────────────────────
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.superAdmin.update({
      where: { id: admin.id },
      data: { refreshToken: hashedRefreshToken },
    });

    // ── Set HttpOnly Cookies ───────────────────────────
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        type: 'super_admin',
      },
    };
  }

  async refreshToken(req: any, res: any) {
    const token = req?.cookies?.refresh_token;

    if (!token) {
      throw new UnauthorizedException('No refresh token found');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });

      const admin = await this.prisma.superAdmin.findUnique({
        where: { id: payload.sub },
      });

      if (!admin || !admin.refreshToken) {
        throw new UnauthorizedException('Access denied');
      }

      const tokenMatch = await bcrypt.compare(token, admin.refreshToken);

      if (!tokenMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // ── Generate New Access Token ──────────────────
      const newPayload = {
        sub: admin.id,
        email: admin.email,
        type: 'super_admin',
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') as any,
      });

      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        path: '/',
      };

      res.cookie('access_token', newAccessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000,
      });

      return {
        success: true,
        message: 'Token refreshed successfully',
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(res: any, adminId: string) {
    // ── Clear Refresh Token from DB ────────────────────
    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data: { refreshToken: null },
    });

    // ── Clear Cookies ──────────────────────────────────
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}