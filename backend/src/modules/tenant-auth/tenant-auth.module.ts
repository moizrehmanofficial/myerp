import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthService } from './tenant-auth.service';

@Module({
  imports: [JwtModule.register({}), DatabaseModule],
  controllers: [TenantAuthController],
  providers: [TenantAuthService],
})
export class TenantAuthModule {}