export type VehicleFuelType =
  'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
export type VehicleTransmissionType = 'MANUAL' | 'AUTOMATIC' | 'SEMI_AUTOMATIC';

export interface VehicleProps {
  id?: string;
  tenantId: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  vin?: string;
  engineNo?: string;
  color?: string;
  fuelType?: VehicleFuelType;
  transmission?: VehicleTransmissionType;
  currentKm?: number;
  inspectionValidUntil?: Date;
  insuranceValidUntil?: Date;
  kaskoValidUntil?: Date;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  customer?: any;
  appointments?: any[];
  workOrders?: any[];
}

export class VehicleEntity {
  public readonly id?: string;
  public readonly tenantId: string;
  public customerId: string;
  public plate: string;
  public brand: string;
  public model: string;
  public year: number;
  public vin?: string;
  public engineNo?: string;
  public color?: string;
  public fuelType: VehicleFuelType;
  public transmission: VehicleTransmissionType;
  public currentKm: number;
  public inspectionValidUntil?: Date;
  public insuranceValidUntil?: Date;
  public kaskoValidUntil?: Date;
  public deletedAt?: Date | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public customer?: any;
  public appointments?: any[];
  public workOrders?: any[];

  constructor(props: VehicleProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.plate = VehicleEntity.normalizePlate(props.plate);
    this.brand = props.brand;
    this.model = props.model;
    this.year = props.year;
    this.vin = props.vin ? props.vin.trim().toUpperCase() : undefined;
    this.engineNo = props.engineNo
      ? props.engineNo.trim().toUpperCase()
      : undefined;
    this.color = props.color;
    this.fuelType = props.fuelType || 'DIESEL';
    this.transmission = props.transmission || 'MANUAL';
    this.currentKm = props.currentKm !== undefined ? props.currentKm : 0;
    this.inspectionValidUntil = props.inspectionValidUntil;
    this.insuranceValidUntil = props.insuranceValidUntil;
    this.kaskoValidUntil = props.kaskoValidUntil;
    this.deletedAt = props.deletedAt || null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.customer = props.customer;
    this.appointments = props.appointments;
    this.workOrders = props.workOrders;

    this.validateDomainRules();
  }

  public static normalizePlate(plate: string): string {
    if (!plate) return '';
    return plate.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  public validateDomainRules(): void {
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 1;

    if (this.year < 1950 || this.year > maxYear) {
      throw new Error(
        `Araç model yılı 1950 ile ${maxYear} arasında olmalıdır.`,
      );
    }

    if (this.currentKm < 0) {
      throw new Error('Araç kilometresi negatif olamaz.');
    }

    if (this.vin && this.vin.length !== 17) {
      throw new Error('Şasi numarası (VIN) 17 karakter olmalıdır.');
    }
  }

  public updateKilometer(newKm: number): void {
    if (newKm < 0) {
      throw new Error('Araç kilometresi negatif olamaz.');
    }
    this.currentKm = newKm;
  }

  public updateDetails(props: Partial<VehicleProps>): void {
    if (props.plate) this.plate = VehicleEntity.normalizePlate(props.plate);
    if (props.brand) this.brand = props.brand;
    if (props.model) this.model = props.model;
    if (props.year !== undefined) this.year = props.year;
    if (props.vin !== undefined)
      this.vin = props.vin ? props.vin.trim().toUpperCase() : undefined;
    if (props.engineNo !== undefined)
      this.engineNo = props.engineNo
        ? props.engineNo.trim().toUpperCase()
        : undefined;
    if (props.color !== undefined) this.color = props.color;
    if (props.fuelType) this.fuelType = props.fuelType;
    if (props.transmission) this.transmission = props.transmission;
    if (props.currentKm !== undefined) this.updateKilometer(props.currentKm);
    if (props.inspectionValidUntil !== undefined)
      this.inspectionValidUntil = props.inspectionValidUntil;
    if (props.insuranceValidUntil !== undefined)
      this.insuranceValidUntil = props.insuranceValidUntil;
    if (props.kaskoValidUntil !== undefined)
      this.kaskoValidUntil = props.kaskoValidUntil;

    this.validateDomainRules();
  }

  public markDeleted(): void {
    this.deletedAt = new Date();
  }
}
