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
  Req,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
    const uploaderName = user?.name || (user?.userId ? 'Personel' : 'SYSTEM');
    return this.mediaService.uploadWorkOrderPhoto(
      tenantId,
      workOrderId,
      uploaderName,
      file,
      caption,
      photoType,
    );
  }

  @Get('presigned-url/*')
  @ApiOperation({ summary: 'MinIO nesnesi için güvenli geçici indirme linki üret' })
  async getPresignedUrl(
    @CurrentTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const rawKey = req.url.split('/media/presigned-url/')[1]?.split('?')[0] || '';
    const objectKey = decodeURIComponent(rawKey);
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
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawKey = req.url.split('/media/files/')[1]?.split('?')[0] || '';
    const objectKey = decodeURIComponent(rawKey);
    const file = await this.mediaService.getFileStream('', objectKey);
    res.set({
      'Content-Type': file.contentType,
      ...(file.contentLength && { 'Content-Length': String(file.contentLength) }),
      'Cache-Control': 'public, max-age=86400',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    });
    (file.stream as any).pipe(res);
  }
}
