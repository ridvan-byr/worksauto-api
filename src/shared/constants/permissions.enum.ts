/**
 * WorksAuto MVP - Granular Permissions Definition
 * Based on Technical Specification Section 7 (RBAC + Granular Permissions)
 */
export enum Permission {
  // Customers
  CUSTOMER_VIEW = 'customer.view',
  CUSTOMER_CREATE = 'customer.create',
  CUSTOMER_UPDATE = 'customer.update',
  CUSTOMER_DELETE = 'customer.delete',

  // Vehicles
  VEHICLE_VIEW = 'vehicle.view',
  VEHICLE_CREATE = 'vehicle.create',
  VEHICLE_UPDATE = 'vehicle.update',
  VEHICLE_DELETE = 'vehicle.delete',

  // Appointments
  APPOINTMENT_VIEW = 'appointment.view',
  APPOINTMENT_CREATE = 'appointment.create',
  APPOINTMENT_UPDATE = 'appointment.update',
  APPOINTMENT_CANCEL = 'appointment.cancel',
  APPOINTMENT_APPROVE = 'appointment.approve',

  // Work Orders
  WORK_ORDER_VIEW = 'work_order.view',
  WORK_ORDER_CREATE = 'work_order.create',
  WORK_ORDER_UPDATE = 'work_order.update',
  WORK_ORDER_COMPLETE = 'work_order.complete',
  WORK_ORDER_CANCEL = 'work_order.cancel',
  WORK_ORDER_ROLLBACK = 'work_order.rollback',

  // Inventory & Spare Parts
  INVENTORY_VIEW = 'inventory.view',
  INVENTORY_MANAGE = 'inventory.manage',

  // Invoices & E-Invoice
  INVOICE_VIEW = 'invoice.view',
  INVOICE_CREATE = 'invoice.create',
  INVOICE_CANCEL = 'invoice.cancel',

  // Payments & Cashier
  PAYMENT_VIEW = 'payment.view',
  PAYMENT_CREATE = 'payment.create',

  // Staff & Mechanics
  STAFF_VIEW = 'staff.view',
  STAFF_MANAGE = 'staff.manage',

  // Audit Trail & Compliance
  AUDIT_VIEW = 'audit.view',

  // Tenant Administration
  TENANT_MANAGE = 'tenant.manage',
}
