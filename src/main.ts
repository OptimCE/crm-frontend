import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { getAppConfig, loadRuntimeConfig } from './app/app.config';

async function bootstrap() {
  await loadRuntimeConfig();
  await bootstrapApplication(App, getAppConfig());
}

bootstrap().catch((err) => console.error(err));
