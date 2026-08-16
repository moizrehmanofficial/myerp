import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.authService.superAdminLogin(dto, res);
  }

  // POST /api/auth/refresh
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.authService.refreshToken(req, res);
  }

  // POST /api/auth/logout
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.authService.logout(res, req.user.id);
  }
}