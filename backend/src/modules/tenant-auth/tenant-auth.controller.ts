import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantAuthService } from './tenant-auth.service';
import { Throttle } from '@nestjs/throttler';
import { TENANT_ACCESS_COOKIE, TENANT_REFRESH_COOKIE } from '../../common/auth-cookies';

class TenantLoginDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

@Controller('tenant-auth')
export class TenantAuthController {
  constructor(
    private tenantAuthService: TenantAuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Max 5 tries per 10 seconds and 20 per minute from one IP (stops password guessing)
  @Post('login')
  @Throttle({ short: { ttl: 10000, limit: 5 }, long: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: TenantLoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new UnauthorizedException('No tenant found');
    }
    return this.tenantAuthService.login(
      tenant.slug,
      dto.email,
      dto.password,
      res,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new UnauthorizedException('No tenant found');
    }
    return this.tenantAuthService.refresh(
      tenant.slug,
      req.cookies?.[TENANT_REFRESH_COOKIE],
      res,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const tenant = req.tenant;
    const token = req.cookies?.[TENANT_ACCESS_COOKIE];

    if (token && tenant) {
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        return this.tenantAuthService.logout(tenant.slug, payload.sub, res);
      } catch {}
    }

    this.tenantAuthService.clearAuthCookies(res);
    return { success: true, message: 'Logged out' };
  }

  @Get('me')
  async getProfile(@Req() req: any) {
    const tenant = req.tenant;
    const token = req.cookies?.[TENANT_ACCESS_COOKIE];

    if (!token || !tenant) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      return this.tenantAuthService.getProfile(tenant.slug, payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Signed-in user changes their password
  @Post('change-password')
  @Throttle({ short: { ttl: 10000, limit: 5 }, long: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(@Req() req: any, @Body() body: any) {
    const tenant = req.tenant;
    const token = req.cookies?.[TENANT_ACCESS_COOKIE];
    if (!token || !tenant) throw new UnauthorizedException('Not authenticated');
    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: this.configService.get<string>('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.type !== 'tenant_user' || payload.slug !== tenant.slug) throw new UnauthorizedException('Not allowed');
    return this.tenantAuthService.changePassword(tenant.slug, payload.sub, body?.currentPassword, body?.newPassword);
  }

  // Emails a reset link (same answer whether or not the email exists)
  @Post('forgot-password')
  @Throttle({ short: { ttl: 10000, limit: 3 }, long: { ttl: 600000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Req() req: any, @Body() body: any) {
    if (!req.tenant) throw new UnauthorizedException('No tenant found');
    return this.tenantAuthService.forgotPassword(req.tenant.slug, body?.email);
  }

  @Post('reset-password')
  @Throttle({ short: { ttl: 10000, limit: 5 }, long: { ttl: 600000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Req() req: any, @Body() body: any) {
    if (!req.tenant) throw new UnauthorizedException('No tenant found');
    return this.tenantAuthService.resetPassword(req.tenant.slug, body?.token, body?.password);
  }

  @Get('company-info')
  async getCompanyInfo(@Req() req: any) {
    const slug = req.tenant?.slug || req.headers['x-tenant-slug'];
    return this.tenantAuthService.getCompanyInfo(slug);
  }
}