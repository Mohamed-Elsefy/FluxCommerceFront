import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideAppEnvironment, provideApi } from '@flux/api';
import { provideAccessToken, provideAuthRecovery, provideSessionRestore } from '@flux/auth';
import { provideTheming } from '@flux/theming';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideAppEnvironment(environment),
    provideApi(),
    provideAccessToken(),
    provideAuthRecovery(),
    provideSessionRestore(),
    provideTheming(),
  ],
};
