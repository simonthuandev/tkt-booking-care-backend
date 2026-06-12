import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';
import { UserRole, AuthUser } from '../interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext, // context co the la HTTP, WebSocket, GraphQL,...
  ): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [
        context.getHandler(), // xet method truoc
        context.getClass(), // neu method khong co thi xet class (controller)
      ],
    );

    // Khong dat role nghia la allow all
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Biet chac context la HTTP -> convert sang de lay ra Request
    const request = context.switchToHttp().getRequest();

    // user da duoc JwtAuthGuard xac thuc va dinh vao request
    const user: AuthUser = request.user;

    if (!user) {
      throw new ForbiddenException('Không có thông tin người dùng');
    }

    // So sanh role user gui len voi role duoc quy dinh
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException('Bạn không có quyền truy cập tính năng này');
    }

    return true;
  }
}
