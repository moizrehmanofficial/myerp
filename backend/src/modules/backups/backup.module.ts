import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupService } from './backup.service';
import { BackupScheduler } from './backup.scheduler';
import { BackupController } from './backup.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupScheduler],
  exports: [BackupService],
})
export class BackupModule {}