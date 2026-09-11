import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Audit Trail & Compliance (Denetim İzi)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary: 'Servis içindeki tüm kritik işlem ve denetim loglarını listeler',
  })
  @ApiQuery({
    name: 'entityName',
    required: false,
    description:
      'Filtrelenecek varlık adı (örn: appointment, work_order, invoice)',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    description: 'Filtrelenecek eylem (örn: create, complete, no_show, cancel)',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('entityName') entityName?: string,
    @Query('action') action?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findAll(tenantId, {
      entityName,
      action,
      search,
      page,
      limit,
    });
  }
}
