import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(AuthGuard('jwt'))
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  // GET /api/companies
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.companiesService.findAll(+page, +limit);
  }

  // GET /api/companies/modules
  @Get('modules')
  async getModules() {
    return this.companiesService.getModules();
  }

  // GET /api/companies/:id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  // POST /api/companies
  @Post()
  async create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  // PATCH /api/companies/:id
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  // PATCH /api/companies/:id/suspend
  @Patch(':id/suspend')
  async suspend(@Param('id') id: string) {
    return this.companiesService.suspend(id);
  }

  // PATCH /api/companies/:id/activate
  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    return this.companiesService.activate(id);
  }

  // DELETE /api/companies/:id
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }

  // POST /api/companies/:id/logo
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.companiesService.uploadLogo(id, file);
  }
}