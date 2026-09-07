import { UserRole } from '@prisma/client';
import { Permission } from './permissions.enum';

/**
 * WorksAuto MVP - Role to Granular Permissions Mapping
 * Ensures 100% backward compatibility with existing @Roles() decorators
 * while enabling fine-grained capability checks.
 */
export const ROLE_PERMISSIONS_MAP: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),

  [UserRole.OWNER]: [
    // Full tenant administration and operations
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_DELETE,
    Permission.VEHICLE_VIEW,
    Permission.VEHICLE_CREATE,
    Permission.VEHICLE_UPDATE,
    Permission.VEHICLE_DELETE,
    Permission.APPOINTMENT_VIEW,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.APPOINTMENT_APPROVE,
    Permission.WORK_ORDER_VIEW,
    Permission.WORK_ORDER_CREATE,
    Permission.WORK_ORDER_UPDATE,
    Permission.WORK_ORDER_COMPLETE,
    Permission.WORK_ORDER_CANCEL,
    Permission.WORK_ORDER_ROLLBACK,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_CANCEL,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_CREATE,
    Permission.STAFF_VIEW,
    Permission.STAFF_MANAGE,
    Permission.AUDIT_VIEW,
    Permission.TENANT_MANAGE,
  ],

  [UserRole.SERVICE_MANAGER]: [
    // Workshop operations management
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_UPDATE,
    Permission.VEHICLE_VIEW,
    Permission.VEHICLE_CREATE,
    Permission.VEHICLE_UPDATE,
    Permission.APPOINTMENT_VIEW,
    Permission.APPOINTMENT_CREATE,
    Permission.APPOINTMENT_UPDATE,
    Permission.APPOINTMENT_CANCEL,
    Permission.APPOINTMENT_APPROVE,
    Permission.WORK_ORDER_VIEW,
    Permission.WORK_ORDER_CREATE,
    Permission.WORK_ORDER_UPDATE,
    Permission.WORK_ORDER_COMPLETE,
    Permission.WORK_ORDER_CANCEL,
    Permission.WORK_ORDER_ROLLBACK,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_CREATE,
    Permission.STAFF_VIEW,
    Permission.AUDIT_VIEW,
  ],

  [UserRole.TECHNICIAN]: [
    // Technician workflow: view appointments, work on orders, inspect inventory
    Permission.CUSTOMER_VIEW,
    Permission.VEHICLE_VIEW,
    Permission.APPOINTMENT_VIEW,
    Permission.WORK_ORDER_VIEW,
    Permission.WORK_ORDER_UPDATE,
    Permission.WORK_ORDER_COMPLETE,
    Permission.INVENTORY_VIEW,
  ],

  [UserRole.CASHIER]: [
    // Front desk & billing: customers, invoices, payments
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_CREATE,
    Permission.VEHICLE_VIEW,
    Permission.VEHICLE_CREATE,
    Permission.APPOINTMENT_VIEW,
    Permission.WORK_ORDER_VIEW,
    Permission.INVOICE_VIEW,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_CREATE,
  ],

  [UserRole.WAREHOUSE_KEEPER]: [
    // Spare parts warehouse
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_MANAGE,
    Permission.WORK_ORDER_VIEW,
  ],
};

/**
 * Returns all permissions granted to the given role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS_MAP[role] || [];
}
