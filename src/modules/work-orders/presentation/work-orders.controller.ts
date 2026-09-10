import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentTenant } from '../../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { RequirePermission } from '../../../shared/decorators/require-permission.decorator';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { IdempotencyInterceptor } from '../../../shared/interceptors/idempotency.interceptor';
import { Permission } from '../../../shared/constants/permissions.enum';
import { UserRole, WorkOrderStatus, WorkOrderPhotoType } from '@prisma/client';
import { AddWorkOrderItemDto } from '../dto/add-item.dto';
import { UpdateWorkOrderItemQuantityDto } from '../dto/update-item-quantity.dto';
import { UpdateWorkOrderItemDto } from '../dto/update-item.dto';
import { CreateWorkOrderNoteDto } from '../dto/create-note.dto';
import { UpdateWorkOrderNoteDto } from '../dto/update-note.dto';
import { CreateWorkOrderDto } from '../dto/create-work-order.dto';
import { GetWorkOrdersUseCase } from '../application/use-cases/get-work-orders.use-case';
import { CreateWorkOrderUseCase } from '../application/use-cases/create-work-order.use-case';
import { UpdateWorkOrderStatusUseCase } from '../application/use-cases/update-work-order-status.use-case';
import { RollbackWorkOrderUseCase } from '../application/use-cases/rollback-work-order.use-case';
import { AddWorkOrderItemUseCase } from '../application/use-cases/add-work-order-item.use-case';
import { UpdateWorkOrderItemQuantityUseCase } from '../application/use-cases/update-work-order-item-quantity.use-case';
import { RemoveWorkOrderItemUseCase } from '../application/use-cases/remove-work-order-item.use-case';
import { AddWorkOrderPhotoUseCase } from '../application/use-cases/add-work-order-photo.use-case';
import { AddWorkOrderNoteUseCase } from '../application/use-cases/add-work-order-note.use-case';
import { UpdateWorkOrderNoteUseCase } from '../application/use-cases/update-work-order-note.use-case';
import { DeleteWorkOrderNoteUseCase } from '../application/use-cases/delete-work-order-note.use-case';

@ApiTags('Work Orders (Atölye İş Emirleri)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@UseInterceptors(IdempotencyInterceptor)
@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly getWorkOrdersUseCase: GetWorkOrdersUseCase,
    private readonly createWorkOrderUseCase: CreateWorkOrderUseCase,
    private readonly updateWorkOrderStatusUseCase: UpdateWorkOrderStatusUseCase,
    private readonly rollbackWorkOrderUseCase: RollbackWorkOrderUseCase,
    private readonly addWorkOrderItemUseCase: AddWorkOrderItemUseCase,
    private readonly updateWorkOrderItemQuantityUseCase: UpdateWorkOrderItemQuantityUseCase,
    private readonly removeWorkOrderItemUseCase: RemoveWorkOrderItemUseCase,
    private readonly addWorkOrderPhotoUseCase: AddWorkOrderPhotoUseCase,
    private readonly addWorkOrderNoteUseCase: AddWorkOrderNoteUseCase,
    private readonly updateWorkOrderNoteUseCase: UpdateWorkOrderNoteUseCase,
    private readonly deleteWorkOrderNoteUseCase: DeleteWorkOrderNoteUseCase,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @RequirePermission(Permission.WORK_ORDER_VIEW)
  @ApiOperation({ summary: 'İş emirlerini durumuna göre listeler' })
  findAll(@CurrentTenant() tenantId: string, @Query('status') status?: WorkOrderStatus) {
    return this.getWorkOrdersUseCase.findAll(tenantId, status);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN, UserRole.CASHIER)
  @RequirePermission(Permission.WORK_ORDER_VIEW)
  @ApiOperation({ summary: 'İş emri detayını, kalemlerini ve fotoğraflarını döner' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.getWorkOrdersUseCase.findOne(tenantId, id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @RequirePermission(Permission.WORK_ORDER_CREATE)
  @ApiOperation({ summary: 'Yeni iş emri açar ve parçaları atomik olarak stoktan düşer' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: false, description: 'Tekrarlanan istek koruması için benzersiz anahtar' })
  create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.createWorkOrderUseCase.execute(tenantId, dto, user?.name || 'Servis Danışmanı', user?.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @RequirePermission(Permission.WORK_ORDER_UPDATE)
  @ApiOperation({ summary: 'İş emri aşamasını ilerletir (QUEUE -> IN_PROGRESS -> COMPLETED)' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: false, description: 'Tekrarlanan istek koruması için benzersiz anahtar' })
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('status') status: WorkOrderStatus,
  ) {
    return this.updateWorkOrderStatusUseCase.execute(tenantId, id, status, user?.id);
  }

  @Post(':id/rollback')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @RequirePermission(Permission.WORK_ORDER_ROLLBACK)
  @ApiOperation({ summary: 'İş emrini güvenle bir önceki aşamaya geri alır' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: false, description: 'Tekrarlanan istek koruması için benzersiz anahtar' })
  rollback(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.rollbackWorkOrderUseCase.execute(tenantId, id);
  }

  @Post(':id/photos')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'İş emrine fotoğraf ekler' })
  addPhoto(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('url') url: string,
    @Body('caption') caption: string,
    @Body('photoType') photoType: WorkOrderPhotoType,
    @CurrentUser('name') userName: string,
  ) {
    return this.addWorkOrderPhotoUseCase.execute(
      tenantId,
      id,
      url,
      caption,
      photoType || WorkOrderPhotoType.CHECKIN,
      userName || 'Personel',
    );
  }

  @Post(':id/items')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Açık iş emrine yeni parça veya işçilik kalemi ekler (Stoktan atomik düşer)' })
  addItem(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddWorkOrderItemDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.addWorkOrderItemUseCase.execute(tenantId, id, dto, userName || 'Teknisyen');
  }

  @Patch(':id/items/:itemId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'İş emrindeki kalemi günceller (İşçilik adı/fiyatı veya parça miktarı/stok farkı)' })
  updateItemQuantity(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateWorkOrderItemDto,
    @CurrentUser('name') userName: string,
  ) {
    return this.updateWorkOrderItemQuantityUseCase.execute(tenantId, id, itemId, dto, userName || 'Teknisyen');
  }

  @Delete(':id/items/:itemId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'İş emrinden kalem çıkarır (Parça stoğunu depoya iade eder)' })
  removeItem(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser('name') userName: string,
  ) {
    return this.removeWorkOrderItemUseCase.execute(tenantId, id, itemId, userName || 'Teknisyen');
  }

  @Post(':id/notes')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'İş emrine dahili usta/atölye notu ekler' })
  addNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateWorkOrderNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.addWorkOrderNoteUseCase.execute(tenantId, id, dto, {
      id: user?.id || user?.userId,
      name: user?.name || 'Usta',
      surname: user?.surname || '',
    });
  }

  @Patch(':id/notes/:noteId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Dahili notu günceller (Yalnızca notu yazan kişi düzenleyebilir)' })
  updateNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateWorkOrderNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.updateWorkOrderNoteUseCase.execute(tenantId, id, noteId, dto, {
      id: user?.id || user?.userId,
      name: user?.name || '',
      surname: user?.surname || '',
    });
  }

  @Delete(':id/notes/:noteId')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Dahili notu siler (Not sahibi veya Yönetici silebilir)' })
  deleteNote(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: any,
  ) {
    return this.deleteWorkOrderNoteUseCase.execute(tenantId, id, noteId, {
      id: user?.id || user?.userId,
      name: user?.name || '',
      surname: user?.surname || '',
      role: user?.role,
    });
  }
}
