import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

const collectionMethods = [
  PaymentMethod.CASH,
  PaymentMethod.POS,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.ONLINE,
];

export class CreatePaymentDto {
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01)
  amount: number;
  @IsOptional() @IsIn(collectionMethods) paymentMethod?: PaymentMethod;
  @IsOptional() @IsIn(collectionMethods) method?: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(200) posSlipNo?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
