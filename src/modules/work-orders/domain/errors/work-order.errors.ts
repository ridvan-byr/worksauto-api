export class WorkOrderDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkOrderDomainError';
  }
}

export class WorkOrderNotFoundError extends WorkOrderDomainError {
  constructor(id: string) {
    super(`İş emri bulunamadı (ID: ${id}).`);
    this.name = 'WorkOrderNotFoundError';
  }
}

export class WorkOrderClosedError extends WorkOrderDomainError {
  constructor(action: string) {
    super(`Tamamlanmış veya iptal edilmiş iş emrine ${action} yapılamaz.`);
    this.name = 'WorkOrderClosedError';
  }
}

export class InvalidStatusTransitionError extends WorkOrderDomainError {
  constructor(from: string, to: string) {
    super(`Geçersiz aşama geçişi: "${from}" durumundan "${to}" durumuna geçilemez.`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class InsufficientStockError extends WorkOrderDomainError {
  constructor(productName: string, available: number, requested: number) {
    super(`Yetersiz stok! "${productName}" için mevcut stok: ${available}, talep edilen: ${requested}`);
    this.name = 'InsufficientStockError';
  }
}
