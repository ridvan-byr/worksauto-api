import { Injectable, Inject } from '@nestjs/common';
import { WorkOrderStatus, WorkOrderPhotoType, WorkOrderItemType } from '@prisma/client';
import { AddWorkOrderItemDto } from './dto/add-item.dto';
import { IWorkOrderRepository } from './domain/repositories/work-order.repository.interface';
import { GetWorkOrdersUseCase } from './application/use-cases/get-work-orders.use-case';
import { CreateWorkOrderUseCase } from './application/use-cases/create-work-order.use-case';
import { UpdateWorkOrderStatusUseCase } from './application/use-cases/update-work-order-status.use-case';
import { RollbackWorkOrderUseCase } from './application/use-cases/rollback-work-order.use-case';
import { AddWorkOrderItemUseCase } from './application/use-cases/add-work-order-item.use-case';
import { RemoveWorkOrderItemUseCase } from './application/use-cases/remove-work-order-item.use-case';
import { AddWorkOrderPhotoUseCase } from './application/use-cases/add-work-order-photo.use-case';

export interface CreateWorkOrderDto {
  appointmentId?: string;
  customerId: string;
  vehicleId: string;
  assignedMechanicId?: string;
  assignedLift?: string;
  initialKm: number;
  fuelLevel?: string;
  items?: Array<{
    itemType: WorkOrderItemType;
    itemId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    kdvRate?: number;
  }>;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    @Inject('IWorkOrderRepository')
    private readonly workOrderRepository: IWorkOrderRepository,
    private readonly getWorkOrdersUseCase: GetWorkOrdersUseCase,
    private readonly createWorkOrderUseCase: CreateWorkOrderUseCase,
    private readonly updateWorkOrderStatusUseCase: UpdateWorkOrderStatusUseCase,
    private readonly rollbackWorkOrderUseCase: RollbackWorkOrderUseCase,
    private readonly addWorkOrderItemUseCase: AddWorkOrderItemUseCase,
    private readonly removeWorkOrderItemUseCase: RemoveWorkOrderItemUseCase,
    private readonly addWorkOrderPhotoUseCase: AddWorkOrderPhotoUseCase,
  ) {}

  async findAll(tenantId: string, status?: WorkOrderStatus) {
    return this.getWorkOrdersUseCase.findAll(tenantId, status);
  }

  async findOne(tenantId: string, id: string) {
    return this.getWorkOrdersUseCase.findOne(tenantId, id);
  }

  async create(tenantId: string, dto: CreateWorkOrderDto, author: string, actorUserId?: string) {
    return this.createWorkOrderUseCase.execute(tenantId, dto, author, actorUserId);
  }

  async updateStatus(tenantId: string, id: string, newStatus: WorkOrderStatus, userId?: string) {
    return this.updateWorkOrderStatusUseCase.execute(tenantId, id, newStatus, userId);
  }

  async rollbackStatus(tenantId: string, id: string) {
    return this.rollbackWorkOrderUseCase.execute(tenantId, id);
  }

  async addPhoto(tenantId: string, id: string, url: string, caption: string, photoType: WorkOrderPhotoType, uploadedBy: string) {
    return this.addWorkOrderPhotoUseCase.execute(tenantId, id, url, caption, photoType, uploadedBy);
  }

  async addItem(tenantId: string, workOrderId: string, dto: AddWorkOrderItemDto, author: string) {
    return this.addWorkOrderItemUseCase.execute(tenantId, workOrderId, dto, author);
  }

  async removeItem(tenantId: string, workOrderId: string, itemId: string, author: string) {
    return this.removeWorkOrderItemUseCase.execute(tenantId, workOrderId, itemId, author);
  }
}