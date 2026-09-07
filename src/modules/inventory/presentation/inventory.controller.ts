import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole, ProductCategory } from '@prisma/client';

import { CreateProductDto } from '../dto/create-product.dto';
import { CreateStockMovementDto } from '../dto/create-stock-movement.dto';
import { GetStockItemsUseCase } from '../application/use-cases/get-stock-items.use-case';
import { CreateStockItemUseCase } from '../application/use-cases/create-stock-item.use-case';
import { AddStockMovementUseCase } from '../application/use-cases/add-stock-movement.use-case';

@ApiTags('Inventory (Yedek Parça & Stok)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly getStockItemsUseCase: GetStockItemsUseCase,
    private readonly createStockItemUseCase: CreateStockItemUseCase,
    private readonly addStockMovementUseCase: AddStockMovementUseCase,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Stok listesini ve kritik seviyeleri döner' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('category') category?: ProductCategory,
  ) {
    return this.getStockItemsUseCase.execute(tenantId, { search, category });
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Parça detayını ve stok hareket geçmişini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getStockItemsUseCase.getById(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Yeni parça / ürün kaydı açar' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.createStockItemUseCase.execute(tenantId, dto, userName || 'Depo Sorumlusu');
  }

  @Post(':id/stock-movement')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Stok hareketi (Mal Kabul / İrsaliye / Sayım Düzeltmesi) kaydeder' })
  addStockMovement(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateStockMovementDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.addStockMovementUseCase.execute(
      tenantId,
      id,
      dto as any,
      userName || 'Depo Sorumlusu',
    );
  }

  @Get(':id/movements')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Bir parçanın geçmiş stok hareket dökümünü getirir' })
  getMovements(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getStockItemsUseCase.getMovements(tenantId, id);
  }
}
