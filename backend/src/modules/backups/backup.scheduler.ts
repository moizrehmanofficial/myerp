import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupService } from './backup.service';

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(private backupService: BackupService) {}

  // Daily at 2:00 AM
  @Cron('0 2 * * *')
  async handleDailyBackup() {
    this.logger.log('⏰ Daily backup started');
    await this.backupService.backupAllCompanies('DAILY');
  }

  // Weekly — Sunday at 3:00 AM
  @Cron('0 3 * * 0')
  async handleWeeklyBackup() {
    this.logger.log('⏰ Weekly backup started');
    await this.backupService.backupAllCompanies('WEEKLY');
  }

  // Monthly — 1st of month at 4:00 AM
  @Cron('0 4 1 * *')
  async handleMonthlyBackup() {
    this.logger.log('⏰ Monthly backup started');
    await this.backupService.backupAllCompanies('MONTHLY');
  }
}