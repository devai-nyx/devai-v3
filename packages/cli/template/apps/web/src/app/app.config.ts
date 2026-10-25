// Web shell (09 §1.1): zoneless, standalone, the STYNX request-id interceptor (S-70) and the static
// routes a generate packet extends.
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { type ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { requestIdInterceptor } from '@stynx-nyx/angular';
import { routes } from './app.routes.js';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([requestIdInterceptor])),
  ],
};
