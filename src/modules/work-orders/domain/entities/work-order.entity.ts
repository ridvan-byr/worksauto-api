import {
  WorkOrderStatusEnum,
  WorkOrderStatusVO,
} from '../value-objects/work-order-status.vo';
import {
  WorkOrderClosedError,
  InvalidStatusTransitionError,
} from '../errors/work-order.errors';

export interface WorkOrderItemProps {
  id?: string;
  itemType: 'PART' | 'SERVICE';
  itemId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  kdvRate: number;
  totalPrice: number;
}

export interface WorkOrderProps {
  id: string;
  tenantId: string;
  workOrderNumber: string;
  appointmentId?: string | null;
  customerId: string;
  vehicleId: string;
  assignedMechanicId?: string | null;
  assignedLift?: string | null;
  initialKm: number;
  fuelLevel?: string | null;
  subtotal: number;
  kdvAmount: number;
  grandTotal: number;
  status: WorkOrderStatusEnum;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: WorkOrderItemProps[];
}

export class WorkOrderEntity {
  private props: WorkOrderProps;

  constructor(props: WorkOrderProps) {
    this.props = {
      ...props,
      items: props.items ? [...props.items] : [],
    };
  }

  public get id(): string {
    return this.props.id;
  }
  public get tenantId(): string {
    return this.props.tenantId;
  }
  public get workOrderNumber(): string {
    return this.props.workOrderNumber;
  }
  public get customerId(): string {
    return this.props.customerId;
  }
  public get vehicleId(): string {
    return this.props.vehicleId;
  }
  public get initialKm(): number {
    return this.props.initialKm;
  }
  public get subtotal(): number {
    return this.props.subtotal;
  }
  public get kdvAmount(): number {
    return this.props.kdvAmount;
  }
  public get grandTotal(): number {
    return this.props.grandTotal;
  }
  public get status(): WorkOrderStatusEnum {
    return this.props.status;
  }
  public get completedAt(): Date | null | undefined {
    return this.props.completedAt;
  }
  public get items(): WorkOrderItemProps[] {
    return [...(this.props.items || [])];
  }

  public getStatusVO(): WorkOrderStatusVO {
    return new WorkOrderStatusVO(this.props.status);
  }

  public canModifyItems(): boolean {
    const statusVO = this.getStatusVO();
    return !statusVO.isCompleted() && !statusVO.isCancelled();
  }

  public assertCanModifyItems(action: string = 'kalem işlemi'): void {
    if (!this.canModifyItems()) {
      throw new WorkOrderClosedError(action);
    }
  }

  public transitionStatus(nextStatus: WorkOrderStatusEnum): void {
    const statusVO = this.getStatusVO();
    if (!statusVO.canTransitionTo(nextStatus)) {
      throw new InvalidStatusTransitionError(this.props.status, nextStatus);
    }
    this.props.status = nextStatus;
    if (nextStatus === WorkOrderStatusEnum.COMPLETED) {
      this.props.completedAt = new Date();
    } else {
      this.props.completedAt = null;
    }
  }

  public rollbackStatus(): WorkOrderStatusEnum {
    const statusVO = this.getStatusVO();
    const prevStatus = statusVO.getPreviousStatus();
    this.props.status = prevStatus;
    this.props.completedAt = null;
    return prevStatus;
  }

  public recalculateTotals(): {
    subtotal: number;
    kdvAmount: number;
    grandTotal: number;
  } {
    let subtotal = 0;
    let kdvAmount = 0;

    for (const item of this.props.items || []) {
      const lineBase = item.unitPrice * item.quantity;
      const lineKdv = (lineBase * (item.kdvRate || 20)) / 100;
      subtotal += lineBase;
      kdvAmount += lineKdv;
    }

    this.props.subtotal = Math.round(subtotal * 100) / 100;
    this.props.kdvAmount = Math.round(kdvAmount * 100) / 100;
    this.props.grandTotal = Math.round((subtotal + kdvAmount) * 100) / 100;

    return {
      subtotal: this.props.subtotal,
      kdvAmount: this.props.kdvAmount,
      grandTotal: this.props.grandTotal,
    };
  }

  public toJSON(): WorkOrderProps {
    return {
      ...this.props,
      items: this.items,
    };
  }
}
