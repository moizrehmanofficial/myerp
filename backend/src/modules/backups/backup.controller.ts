import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BackupService } from './backup.service';

@Controller('backups')
@UseGuards(AuthGuard('jwt'))
export class BackupController {
  constructor(private backupService: BackupService) {}

  // Super Admin — get all backup logs
  @Get()
  async getAllBackups(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.backupService.getBackupLogs(undefined, +page, +limit);
  }

  // Super Admin — trigger manual backup for a company
  @Post('company/:slug')
  async triggerBackup(@Param('slug') slug: string) {
    return this.backupService.createBackup(slug, 'MANUAL');
  }

  // Super Admin — get backups for specific company
  @Get('company/:slug')
  async getCompanyBackups(
    @Param('slug') slug: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.backupService.getBackupLogsBySlug(slug, +page, +limit);
  }

  // Get signed download URL for a backup
  @Get(':id/download')
  async getDownloadUrl(@Param('id') id: string) {
    return this.backupService.getDownloadUrl(id);
  }
}