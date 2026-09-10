import { WorkOrderStatusEnum } from '../value-objects/work-order-status.vo';

export interface CreateWorkOrderData {
  tenantId: string;
  workOrderNumber: string;
  appointmentId?: string;
  customerId: string;
  vehicleId: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  initialKm: number;
  fuelLevel?: string;
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
  status: WorkOrderStatusEnum;
  author?: string;
  items?: Array<{
    itemType: 'PART' | 'SERVICE';
    itemId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    kdvRate?: number;
    totalPrice: number;
  }>;
}

export interface IWorkOrderRepository {
  findAll(tenantId: string, status?: string): Promise<any[]>;
  findById(tenantId: string, id: string): Promise<any | null>;
  getNextWorkOrderNumber(tenantId: string): Promise<string>;
  create(data: CreateWorkOrderData): Promise<any>;
  updateStatus(tenantId: string, id: string, status: string, completedAt?: Date | null): Promise<any>;
  rollbackStatus(tenantId: string, id: string, prevStatus: string): Promise<any>;
  addItem(
    tenantId: string,
    workOrderId: string,
    item: {
      itemType: 'PART' | 'SERVICE';
      itemId?: string | null;
      name: string;
      quantity: number;
      unitPrice: number;
      kdvRate: number;
      totalPrice: number;
    },
    author: string,
  ): Promise<any>;
  updateItemQuantity(tenantId: string, workOrderId: string, itemId: string, quantity: number, author: string): Promise<any>;
  updateItem(
    tenantId: string,
    workOrderId: string,
    itemId: string,
    data: { name?: string; unitPrice?: number; quantity?: number },
    author: string,
  ): Promise<any>;
  removeItem(tenantId: string, workOrderId: string, itemId: string, author: string): Promise<any>;
  addPhoto(tenantId: string, id: string, url: string, caption: string, photoType: string, uploadedBy: string): Promise<any>;
  addNote(
    tenantId: string,
    workOrderId: string,
    authorId: string | null,
    authorName: string,
    text: string,
    isInternal?: boolean,
  ): Promise<any>;
  updateNote(tenantId: string, workOrderId: string, noteId: string, text: string): Promise<any>;
  deleteNote(tenantId: string, workOrderId: string, noteId: string): Promise<any>;
  findNoteById(tenantId: string, noteId: string): Promise<any | null>;
  restoreCancelledStock(tenantId: string, workOrderId: string, userId?: string): Promise<void>;
  getTenantAutoInvoiceConfig(tenantId: string): Promise<boolean>;
  findInvoiceByWorkOrder(tenantId: string, workOrderId: string): Promise<any | null>;
}
