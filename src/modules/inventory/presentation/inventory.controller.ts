import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { UserRole, ProductCategory } from '@prisma/client';

import { CreateProductDto } from '../dto/create-product.dto';
import { CreateStockMovementDto } from '../dto/create-stock-movement.dto';
import { CreateShelfDto, AssignProductCellDto } from '../dto/create-shelf.dto';
import { GetStockItemsUseCase } from '../application/use-cases/get-stock-items.use-case';
import { CreateStockItemUseCase } from '../application/use-cases/create-stock-item.use-case';
import { AddStockMovementUseCase } from '../application/use-cases/add-stock-movement.use-case';
import { ManageShelvesUseCase } from '../application/use-cases/manage-shelves.use-case';

@ApiTags('Inventory (Yedek Parça & Stok)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly getStockItemsUseCase: GetStockItemsUseCase,
    private readonly createStockItemUseCase: CreateStockItemUseCase,
    private readonly addStockMovementUseCase: AddStockMovementUseCase,
    private readonly manageShelvesUseCase: ManageShelvesUseCase,
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

  // -------------------------------------------------------------
  // WAREHOUSE SHELVES (WMS RAF YÖNETİMİ)
  // -------------------------------------------------------------

  @Get('shelves')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Tüm depo raflarını ve doluluk oranlarını listeler' })
  getShelves(@CurrentTenant() tenantId: string) {
    return this.manageShelvesUseCase.getShelves(tenantId);
  }

  @Post('shelves')
  @Roles(UserRole.OWNER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Yeni raf ünitesi tanımlar ve hücreleri otomatik oluşturur' })
  createShelf(@CurrentTenant() tenantId: string, @Body() dto: CreateShelfDto) {
    return this.manageShelvesUseCase.createShelf(tenantId, dto);
  }

  @Get('shelves/:shelfId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Seçili rafın hücre matrisini ve içindeki parçaları döner' })
  getShelfMatrix(@CurrentTenant() tenantId: string, @Param('shelfId') shelfId: string) {
    return this.manageShelvesUseCase.getShelfWithMatrix(tenantId, shelfId);
  }

  @Post('shelves/assign-cell')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Bir parçayı raf hücresine atar veya atamasını kaldırır' })
  assignProductToCell(
    @CurrentTenant() tenantId: string,
    @Body() dto: AssignProductCellDto,
  ) {
    return this.manageShelvesUseCase.assignProductToCell(tenantId, dto.productId, dto.shelfCellId);
  }

  @Delete('shelves/:shelfId')
  @Roles(UserRole.OWNER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Raf ünitesini siler (İçinde parça yoksa)' })
  deleteShelf(@CurrentTenant() tenantId: string, @Param('shelfId') shelfId: string) {
    return this.manageShelvesUseCase.deleteShelf(tenantId, shelfId);
  }

  // -------------------------------------------------------------
  // PRODUCT DETAIL & MOVEMENTS
  // -------------------------------------------------------------

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.WAREHOUSE_KEEPER)
  @ApiOperation({ summary: 'Parça detayını ve stok hareket geçmişini döner' })
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
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
    @Param('id', new ParseUUIDPipe()) id: string,
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
  getMovements(
    @CurrentTenant() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.getStockItemsUseCase.getMovements(tenantId, id);
  }
}
