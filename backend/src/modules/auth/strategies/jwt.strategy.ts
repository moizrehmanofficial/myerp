import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (payload.type !== 'super_admin') {
      throw new UnauthorizedException('Invalid token type');
    }

    const admin = await this.prisma.superAdmin.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      type: 'super_admin',
    };
  }
}