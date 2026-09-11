import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { GetFinancialReportQueryDto } from './dto/financial-report.dto';

@ApiTags('Dashboard (Merkezi İstatistikler & Özet)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(
    UserRole.OWNER,
    UserRole.SERVICE_MANAGER,
    UserRole.TECHNICIAN,
    UserRole.CASHIER,
  )
  @ApiOperation({
    summary:
      'Ana sayfa sayaçlarını (Ciro, Atölye, Randevu, Stok, Alacak) tek sorguda döner',
  })
  getSummary(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getSummary(tenantId);
  }

  @Get('reports/financial')
  @Roles(UserRole.OWNER, UserRole.SERVICE_MANAGER)
  @ApiOperation({
    summary:
      'Dönemsel ciro, net kâr, işçilik/parça ve kasa tahsilat raporunu döner',
  })
  getFinancialReport(
    @CurrentTenant() tenantId: string,
    @Query() query: GetFinancialReportQueryDto,
  ) {
    return this.dashboardService.getFinancialReport(tenantId, query);
  }
}
