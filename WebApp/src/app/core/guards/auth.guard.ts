import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) return true;

    return authService.checkSession().pipe(
        map(() => true),
        catchError(() => {
            router.navigate(['/dashboard/login']);
            return of(false);
        })
    );
};
