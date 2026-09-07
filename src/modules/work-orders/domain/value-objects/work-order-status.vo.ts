export enum WorkOrderStatusEnum {
  QUEUE = 'QUEUE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class WorkOrderStatusVO {
  private readonly value: WorkOrderStatusEnum;

  constructor(status: string | WorkOrderStatusEnum) {
    const normalized = (status as string) === 'PENDING' ? WorkOrderStatusEnum.QUEUE : status;
    if (!Object.values(WorkOrderStatusEnum).includes(normalized as WorkOrderStatusEnum)) {
      throw new Error(`Geçersiz iş emri durumu: ${status}`);
    }
    this.value = normalized as WorkOrderStatusEnum;
  }

  public getValue(): WorkOrderStatusEnum {
    return this.value;
  }

  public isCompleted(): boolean {
    return this.value === WorkOrderStatusEnum.COMPLETED;
  }

  public isCancelled(): boolean {
    return this.value === WorkOrderStatusEnum.CANCELLED;
  }

  public isQueue(): boolean {
    return this.value === WorkOrderStatusEnum.QUEUE;
  }

  public isInProgress(): boolean {
    return this.value === WorkOrderStatusEnum.IN_PROGRESS;
  }

  public canTransitionTo(next: WorkOrderStatusEnum): boolean {
    if (this.value === next) return true;
    if (this.isCompleted() || this.isCancelled()) return false;

    if (this.isQueue()) {
      return next === WorkOrderStatusEnum.IN_PROGRESS || next === WorkOrderStatusEnum.CANCELLED;
    }

    if (this.isInProgress()) {
      return next === WorkOrderStatusEnum.COMPLETED || next === WorkOrderStatusEnum.CANCELLED || next === WorkOrderStatusEnum.QUEUE;
    }

    return false;
  }

  public getPreviousStatus(): WorkOrderStatusEnum {
    if (this.isCompleted()) return WorkOrderStatusEnum.IN_PROGRESS;
    if (this.isInProgress()) return WorkOrderStatusEnum.QUEUE;
    throw new Error('Kuyruktaki bir iş emri daha geri alınamaz.');
  }
}
