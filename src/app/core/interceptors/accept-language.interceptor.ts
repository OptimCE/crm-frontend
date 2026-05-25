import { HttpInterceptorFn } from '@angular/common/http';

const DEFAULT_LANGUAGE = 'fr';
const LANGUAGE_STORAGE_KEY = 'language';

export const acceptLanguageInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/')) {
    return next(req);
  }

  const lang =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LANGUAGE_STORAGE_KEY)) ||
    DEFAULT_LANGUAGE;

  const clonedRequest = req.clone({
    setHeaders: {
      'Accept-Language': lang,
    },
  });

  return next(clonedRequest);
};
