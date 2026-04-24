import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole, AuthUser } from '../interfaces/auth.interface';

// ─── @Public() ───────────────────────────────────────────────────────────────
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ─── @Roles(...roles) ────────────────────────────────────────────────────────
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// ─── @CurrentUser() ──────────────────────────────────────────────────────────
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | any => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    return data ? user?.[data] : user;
  },
);