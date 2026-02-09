import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import {UserContextService} from '../services/authorization/authorization.service';

export const communityContextInterceptor: HttpInterceptorFn = (req, next) => {
  const userContext = inject(UserContextService);
  const activeId = userContext.activeCommunityId();

  // If we have an active community selected, inject it into headers
  if (activeId) {
    const clonedRequest = req.clone({
      setHeaders: {
        'X-Community-ID': activeId
      }
    });
    return next(clonedRequest);
  }

  return next(req);
};
