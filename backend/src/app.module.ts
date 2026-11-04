import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { MulterModule } from '@nestjs/platform-express';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { TenantModule } from './modules/tenants/tenant.module';
import { TenantAuthModule } from './modules/tenant-auth/tenant-auth.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { BackupModule } from './modules/backups/backup.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 10 },
        { name: 'long', ttl: 60000, limit: 100 },
      ],
    }),
    MulterModule.register({ limits: { fileSize: 2 * 1024 * 1024 } }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    TenantModule,
    AuthModule,
    SuperAdminModule,
    CompaniesModule,
    TenantAuthModule,
    BackupModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(TenantMiddleware)
    .forRoutes(
      { path: 'tenant-auth/*path', method: RequestMethod.ALL },
      { path: 'erp/*path', method: RequestMethod.ALL },
    );
}
}