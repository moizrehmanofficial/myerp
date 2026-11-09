import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/request-context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';

  // Render / Vercel sit behind a proxy: use the visitor's real IP
  // (needed for rate limiting and audit logs)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Remember the current request (who / IP / browser) for audit logs
  app.use(requestContextMiddleware);

  // ── Security ──────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // ── CORS ──────────────────────────────────────────────
  // Login cookies are sent cross-site (SameSite=None), so ONLY our own
  // frontends may call the API with them. Before, any *.vercel.app or
  // *.onrender.com site was allowed, which let other people's sites use a
  // signed-in visitor's session.
  // FRONTEND_URL can hold several addresses, comma separated.
  const frontends = [configService.get<string>('FRONTEND_URL'), configService.get<string>('ADMIN_FRONTEND_URL')]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => !!u);
  // Optional: a custom domain whose subdomains are company logins, e.g. myerp.com
  const appDomain = (configService.get<string>('APP_DOMAIN') || '').trim().toLowerCase();
  if (!frontends.length) {
    console.warn('[CORS] FRONTEND_URL is not set. Set it on the server (e.g. https://your-app.vercel.app).');
  }

  const isAllowed = (origin: string) => {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      return false;
    }
    const host = o.hostname.toLowerCase();
    if (!isProduction && (host === 'localhost' || host === '127.0.0.1')) return true;
    for (const f of frontends) {
      if (o.origin === f.origin) return true;
      // Vercel preview deployments of the same project: <project>-<hash>.vercel.app
      const project = f.hostname.endsWith('.vercel.app') ? f.hostname.slice(0, -'.vercel.app'.length) : '';
      if (project && host.endsWith('.vercel.app') && host.startsWith(`${project}-`)) return true;
    }
    if (appDomain && (host === appDomain || host.endsWith(`.${appDomain}`))) return true;
    // Not configured yet: keep the old behaviour so the live site does not break
    if (!frontends.length && !appDomain) {
      return host.endsWith('.vercel.app') || host.endsWith('.onrender.com') || host === 'localhost';
    }
    return false;
  };

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowed(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
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
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // ── Global Prefix ─────────────────────────────────────
  app.setGlobalPrefix('api');

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 MyERP Backend running on port ${port} [${nodeEnv}]`);
}

bootstrap();