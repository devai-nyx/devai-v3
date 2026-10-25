// API shell (09 §1.1): STYNX core (request id, S-70), data with the product roles, auth enforced on every
// route (`StynxAuthGuard` as `APP_GUARD`) with `@RequireRoles` read by STYNX's global authorization guard
// (D-123), i18n, pino with redaction and prom-client metrics (S-71). `imports` stays a static array: a
// generate packet mounts a module by adding its class here (08 F-16).
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { StynxAuthGuard, StynxAuthModule } from '@stynx-nyx/auth';
import { StynxAuthorizationModule } from '@stynx-nyx/backend';
import { StynxCoreModule } from '@stynx-nyx/core';
import { StynxDataModule } from '@stynx-nyx/data';
import { StynxHealthModule } from '@stynx-nyx/health';
import { StynxI18nModule } from '@stynx-nyx/i18n';
import { StynxLoggingModule } from '@stynx-nyx/logging';
import { z } from 'zod';
import { __PREFIX__ErrorContractGuard, __PREFIX__ErrorContractModule } from './validation.filter.js';

const env = (name: string): string => process.env[name] ?? '';

@Module({
  imports: [
    StynxCoreModule.forRoot({ appName: '__PRODUCT__-api', schema: z.object({}) }),
    StynxLoggingModule.forRoot(),
    StynxHealthModule.forRoot(),
    StynxDataModule.forRoot({
      connections: {
        owner: { connectionString: env('DATABASE_URL') },
        app: { connectionString: env('DATABASE_APP_URL') },
        reader: { connectionString: env('DATABASE_READER_URL') },
      },
      appRoleName: '__PRODUCT___app',
    }),
    StynxAuthModule.forRoot({}),
    StynxAuthorizationModule.forRoot({ global: true }),
    StynxI18nModule.forRoot({ defaultLocale: 'en-US', supportedLocales: __LOCALES__ }),
    // Last of the shell's own imports: its error filter must register after STYNX core's (D-129).
    __PREFIX__ErrorContractModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: __PREFIX__ErrorContractGuard },
    { provide: APP_GUARD, useExisting: StynxAuthGuard },
  ],
})
export class AppModule {}
