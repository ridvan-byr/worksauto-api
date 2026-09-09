import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { VehiclesController } from './vehicles.controller';
import { VEHICLE_REPOSITORY } from './domain/vehicle.repository.interface';
import { PrismaVehicleRepository } from './infrastructure/prisma-vehicle.repository';
import { GetVehiclesUseCase } from './application/use-cases/get-vehicles.use-case';
import { GetVehicleByIdUseCase } from './application/use-cases/get-vehicle-by-id.use-case';
import { CreateVehicleUseCase } from './application/use-cases/create-vehicle.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';
import { DeleteVehicleUseCase } from './application/use-cases/delete-vehicle.use-case';

@Module({
  controllers: [VehiclesController],
  providers: [
    PrismaService,
    {
      provide: VEHICLE_REPOSITORY,
      useClass: PrismaVehicleRepository,
    },
    GetVehiclesUseCase,
    GetVehicleByIdUseCase,
    CreateVehicleUseCase,
    UpdateVehicleUseCase,
    DeleteVehicleUseCase,
  ],
  exports: [
    VEHICLE_REPOSITORY,
    GetVehiclesUseCase,
    GetVehicleByIdUseCase,
    CreateVehicleUseCase,
    UpdateVehicleUseCase,
    DeleteVehicleUseCase,
  ],
})
export class VehiclesModule {}
