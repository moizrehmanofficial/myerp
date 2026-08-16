import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;

  // ── Security ──────────────────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────────
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile apps)
      if (!origin) return callback(null, true);
      // Allow any localhost origin including subdomains
      if (origin.includes('localhost')) return callback(null, true);
      // Allow myerp.com subdomains in production
      if (origin.includes('myerp.com')) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug'],
  });

  // ── Cookies ───────────────────────────────────────────
  app.use(cookieParser());

  // ── Global Validation ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Global Prefix ─────────────────────────────────────
  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`🚀 MyERP Backend running on http://localhost:${port}/api`);
}

bootstrap();