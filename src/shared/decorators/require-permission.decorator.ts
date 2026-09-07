import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to enforce granular capability permissions on routes.
 * Handled by the hybrid RolesGuard with automatic role-to-permission derivation.
 *
 * @example
 * @RequirePermission(Permission.WORK_ORDER_COMPLETE)
 * @Patch(':id/complete')
 * completeWorkOrder(...)
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
