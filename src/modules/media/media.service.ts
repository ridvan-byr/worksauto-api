import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { WorkOrderPhotoType } from '@prisma/client';

export interface UploadedMediaFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size?: number;
  buffer: Buffer;
}

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', 'minioadmin');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', 'minioadmin');
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME', 'worksauto-media');

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Bucket "${this.bucketName}" verified.`);
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        this.logger.warn(`Bucket "${this.bucketName}" not found. Creating it...`);
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          this.logger.log(`Bucket "${this.bucketName}" created successfully.`);
        } catch (createErr) {
          this.logger.error(`Failed to create bucket "${this.bucketName}":`, createErr);
        }
      } else {
        this.logger.warn(`MinIO connection not yet established or bucket check skipped: ${err.message}`);
      }
    }
  }

  /**
   * Upload an image file for a work order
   */
  async uploadWorkOrderPhoto(
    tenantId: string,
    workOrderId: string,
    userId: string,
    file: UploadedMediaFile,
    caption?: string,
    photoType: WorkOrderPhotoType = WorkOrderPhotoType.CHECKIN,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya yüklenmedi.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Geçersiz dosya formatı. Sadece JPG, PNG, WEBP desteklenir.');
    }

    const ext = file.originalname.split('.').pop() || 'jpg';
    const fileId = uuidv4();
    const objectKey = `${tenantId}/work-orders/${workOrderId}/${fileId}.${ext}`;

    // Upload to MinIO S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    // Persist photo record in Prisma
    const photo = await this.prisma.workOrderPhoto.create({
      data: {
        workOrderId,
        url: objectKey,
        caption: caption || file.originalname,
        photoType,
        uploadedBy: userId || 'SYSTEM',
      },
    });

    // Generate presigned URL for display
    const presignedUrl = await this.getPresignedUrl(objectKey);

    return {
      ...photo,
      display_url: presignedUrl,
    };
  }

  /**
   * Generate temporary presigned download URL
   */
  async getPresignedUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (err: any) {
      this.logger.error(`Failed to generate presigned URL for key "${objectKey}":`, err);
      return '';
    }
  }

  /**
   * Delete object from MinIO and DB
   */
  async deleteWorkOrderPhoto(photoId: string) {
    const photo = await this.prisma.workOrderPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      throw new BadRequestException('Fotoğraf bulunamadı.');
    }

    // Delete from MinIO
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: photo.url,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to delete object from S3: ${photo.url}`, err);
    }

    // Delete from DB
    await this.prisma.workOrderPhoto.delete({
      where: { id: photoId },
    });

    return { success: true, message: 'Fotoğraf başarıyla silindi.' };
  }
}
