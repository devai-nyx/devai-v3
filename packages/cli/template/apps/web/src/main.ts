import { bootstrapApplication } from '@angular/platform-browser';
import { __PREFIX__AppComponent } from './app/app.component.js';
import { appConfig } from './app/app.config.js';

bootstrapApplication(__PREFIX__AppComponent, appConfig).catch((error: unknown) => {
  console.error(error);
});
