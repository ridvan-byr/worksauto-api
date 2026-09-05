import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';

@ApiTags('Notifications (Canlı Bildirimler & Uyarılar)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcı ve kiracı bildirimlerini sayfalamalı olarak listeler' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: any,
    @Query('unreadOnly') unreadOnly?: boolean,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.findAll({
      tenantId: user?.tenantId,
      userId: user?.id,
      role: user?.role,
      category,
      unreadOnly: String(unreadOnly) === 'true',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Okunmamış bildirim rozet sayısını döner' })
  getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user?.tenantId, user?.id, user?.role);
  }

  @Post('test')
  @ApiOperation({ summary: 'Canlı test bildirimi oluşturur ve WebSocket ile iletir' })
  createTestNotification(@CurrentUser() user: any) {
    const roleMap: Record<string, string> = {
      OWNER: 'Servis Yöneticisi',
      TECHNICIAN: 'Teknisyen',
      WAREHOUSE_KEEPER: 'Depo Sorumlusu',
      OFFICE_STAFF: 'Ofis Personeli',
      SUPER_ADMIN: 'Sistem Yöneticisi',
    };
    const roleLabel = roleMap[user?.role] || user?.role || 'Kullanıcı';
    const recipientName = user?.name ? `${user.name}` : 'Personel';

    return this.notificationsService.createNotification({
      tenantId: user?.tenantId,
      userId: user?.id,
      type: NotificationType.SUCCESS,
      category: 'WORK_ORDER',
      title: `🔔 Kişisel Test Bildirimi (${recipientName})`,
      message: `Harika! Bu bildirim yalnızca sizin (${recipientName} - ${roleLabel}) oturumunuza özeldir ve diğer personellerin bildirim kutusuna gitmez.`,
      link: '/work-orders',
      metadata: { isTest: true, recipientId: user?.id, recipientRole: user?.role },
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Tekil bildirimi okundu olarak işaretler' })
  markAsRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.notificationsService.markAsRead(id, user?.tenantId, user?.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Kullanıcının tüm bildirimlerini okundu olarak işaretler' })
  markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user?.tenantId, user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bildirimi listeden siler' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.notificationsService.remove(id, user?.tenantId, user?.id);
  }
}
