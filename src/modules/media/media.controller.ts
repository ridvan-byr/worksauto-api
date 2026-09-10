import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MediaService, UploadedMediaFile } from './media.service';
import { CurrentTenant } from '../../shared/decorators/current-tenant.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { WorkOrderPhotoType } from '@prisma/client';

@ApiTags('Media & S3 Storage')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('work-orders/:workOrderId/photos')
  @ApiOperation({ summary: 'İş emrine hasar/onarım fotoğrafı yükle (MinIO S3)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string', example: 'Ön tampon çatlak bölge' },
        photoType: { type: 'string', enum: ['CHECKIN', 'PROGRESS', 'COMPLETED', 'PARTS'], default: 'CHECKIN' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } })) // 15MB limit
  async uploadWorkOrderPhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
    @UploadedFile() file: UploadedMediaFile,
    @Body('caption') caption?: string,
    @Body('photoType') photoType?: WorkOrderPhotoType,
  ) {
    return this.mediaService.uploadWorkOrderPhoto(
      tenantId,
      workOrderId,
      user?.userId || 'SYSTEM',
      file,
      caption,
      photoType,
    );
  }

  @Get('presigned-url/*')
  @ApiOperation({ summary: 'MinIO nesnesi için güvenli geçici indirme linki üret' })
  async getPresignedUrl(
    @CurrentTenant() tenantId: string,
    @Param('0') objectKey: string,
  ) {
    const url = await this.mediaService.getPresignedUrl(tenantId, objectKey);
    return { url };
  }

  @Patch('work-orders/photos/:photoId')
  @ApiOperation({ summary: 'İş emri fotoğrafı açıklamasını ve türünü güncelle' })
  async updateWorkOrderPhoto(
    @CurrentTenant() tenantId: string,
    @Param('photoId') photoId: string,
    @Body('caption') caption?: string,
    @Body('photoType') photoType?: WorkOrderPhotoType,
  ) {
    return this.mediaService.updateWorkOrderPhoto(tenantId, photoId, caption, photoType);
  }

  @Delete('work-orders/photos/:photoId')
  @ApiOperation({ summary: 'İş emri fotoğrafını sil' })
  async deleteWorkOrderPhoto(
    @CurrentTenant() tenantId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.mediaService.deleteWorkOrderPhoto(tenantId, photoId);
  }

  @Public()
  @Get('files/*')
  @ApiOperation({ summary: 'Medya dosyasını doğrudan göster / stream et' })
  async getFile(
    @Param('0') objectKey: string,
    @Res() res: Response,
  ) {
    const file = await this.mediaService.getFileStream('', objectKey);
    res.set({
      'Content-Type': file.contentType,
      ...(file.contentLength && { 'Content-Length': String(file.contentLength) }),
      'Cache-Control': 'public, max-age=86400',
    });
    (file.stream as any).pipe(res);
  }
}
