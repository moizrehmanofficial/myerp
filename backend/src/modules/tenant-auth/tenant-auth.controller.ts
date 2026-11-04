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

  @Post('login')
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
      req.cookies?.refresh_token,
      res,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const tenant = req.tenant;
    const token = req.cookies?.access_token;

    if (token && tenant) {
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        return this.tenantAuthService.logout(tenant.slug, payload.sub, res);
      } catch {}
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true, message: 'Logged out' };
  }

  @Get('me')
  async getProfile(@Req() req: any) {
    const tenant = req.tenant;
    const token = req.cookies?.access_token;

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

  @Get('company-info')
  async getCompanyInfo(@Req() req: any) {
    const slug = req.tenant?.slug || req.headers['x-tenant-slug'];
    return this.tenantAuthService.getCompanyInfo(slug);
  }
}