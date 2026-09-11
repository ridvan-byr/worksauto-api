import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { Permission } from '../constants/permissions.enum';
import { getPermissionsForRole } from '../constants/role-permissions.map';

/**
 * Hybrid Guard: Supports both legacy @Roles() and fine-grained @RequirePermission().
 * Automatically derives granular permissions from user's UserRole with zero regression.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If neither roles nor permissions are specified, allow access
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException(
        'Kullanıcı kimliği veya rolü doğrulanamadı.',
      );
    }

    // 1. Role-based Access Control Check
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Bu işlemi gerçekleştirmek için yetkiniz yok. Gerekli roller: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // 2. Granular Permissions Check
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Derive granted permissions from role + any explicit user permissions
      const rolePermissions = getPermissionsForRole(user.role);
      const explicitPermissions: Permission[] = Array.isArray(user.permissions)
        ? user.permissions
        : [];
      const grantedPermissions = new Set<Permission>([
        ...rolePermissions,
        ...explicitPermissions,
      ]);

      const missingPermissions = requiredPermissions.filter(
        (perm) => !grantedPermissions.has(perm),
      );
      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `Bu işlem için gerekli granular yetkiye sahip değilsiniz. Eksik yetkiler: ${missingPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}
