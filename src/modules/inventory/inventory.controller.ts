import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InventoryService, CreateProductDto } from './inventory.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, ProductCategory } from '@prisma/client';

@ApiTags('Inventory (Yedek Parça & Stok)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @ApiOperation({ summary: 'Stok listesini ve kritik seviyeleri döner' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('category') category?: ProductCategory,
  ) {
    return this.inventoryService.findAll(tenantId, search, category);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Parça detayını ve stok hareket geçmişini döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.inventoryService.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Yeni parça / ürün kaydı açar' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.inventoryService.create(tenantId, dto, userName || 'Depo Sorumlusu');
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
    return this.inventoryService.addStockMovement(tenantId, id, dto, userName || 'Depo Sorumlusu');
  }

  @Get(':id/movements')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Bir parçanın geçmiş stok hareket dökümünü getirir' })
  getMovements(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.inventoryService.getMovements(tenantId, id);
  }
}