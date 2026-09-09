import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { GetVehiclesUseCase } from './application/use-cases/get-vehicles.use-case';
import { GetVehicleByIdUseCase } from './application/use-cases/get-vehicle-by-id.use-case';
import { CreateVehicleUseCase } from './application/use-cases/create-vehicle.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';
import { DeleteVehicleUseCase } from './application/use-cases/delete-vehicle.use-case';

@ApiTags('Vehicles (Araçlar)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly getVehiclesUseCase: GetVehiclesUseCase,
    private readonly getVehicleByIdUseCase: GetVehicleByIdUseCase,
    private readonly createVehicleUseCase: CreateVehicleUseCase,
    private readonly updateVehicleUseCase: UpdateVehicleUseCase,
    private readonly deleteVehicleUseCase: DeleteVehicleUseCase,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Araçları listeler veya plakaya/müşteriye göre arar' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.getVehiclesUseCase.execute(tenantId, { search, customerId });
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Araç detayını ve servis geçmişini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getVehicleByIdUseCase.execute(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Yeni araç kaydı oluşturur' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateVehicleDto) {
    return this.createVehicleUseCase.execute(tenantId, dto);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({ summary: 'Araç bilgilerini veya kilometresini günceller' })
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.updateVehicleUseCase.execute(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Aracı arşivler (Soft Delete)' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.deleteVehicleUseCase.execute(tenantId, id);
  }
}
