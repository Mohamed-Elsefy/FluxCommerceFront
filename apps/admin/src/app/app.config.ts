import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAppEnvironment, provideApi } from '@flux/api';
import { provideAccessToken, provideAuthRecovery, provideSessionRestore } from '@flux/auth';
import { provideCulture, provideCulturePropagation } from '@flux/i18n';
import { provideTheming } from '@flux/theming';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppEnvironment(environment),
    provideApi(),
    provideAccessToken(),
    provideAuthRecovery(),
    provideSessionRestore(),
    provideCulture(),
    provideCulturePropagation(),
    provideTheming(),
  ],
};
