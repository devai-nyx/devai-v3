// API shell (09 §1.1): STYNX core (request id, S-70), data with the product roles, auth, i18n, pino with
// redaction and prom-client metrics (S-71). `imports` stays a static array: a generate packet mounts a
// module by adding its class here (08 F-16).
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StynxAuthModule } from '@stynx-nyx/auth';
import { StynxCoreModule } from '@stynx-nyx/core';
import { StynxDataModule } from '@stynx-nyx/data';
import { StynxHealthModule } from '@stynx-nyx/health';
import { StynxI18nModule } from '@stynx-nyx/i18n';
import { StynxLoggingModule } from '@stynx-nyx/logging';
import { z } from 'zod';
import { __PREFIX__ValidationFilter } from './validation.filter.js';

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
    StynxI18nModule.forRoot({ defaultLocale: 'en-US', supportedLocales: __LOCALES__ }),
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: __PREFIX__ValidationFilter }],
})
export class AppModule {}
