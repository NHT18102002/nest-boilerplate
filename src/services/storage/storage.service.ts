import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media, MediaStatus } from './entities/media.entity';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StoragePath } from './storage.enums';
import { parseBooleanFlag } from '@/utils/env.util';

type StorageDriver = 'local' | 's3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private readonly localStorageRoot: string;
  private readonly localPublicUrlBase: string;
  private s3Client: S3Client | null = null;
  private readonly bucket: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly configService: ConfigService,
  ) {
    /**
     * Initialize S3 bucket name from environment or default to 'medias'
     */
    this.bucket = this.configService.get<string>('S3_BUCKET', 'medias')!;
    this.driver =
      this.configService.get<string>('STORAGE_DRIVER', 's3')?.toLowerCase() ===
      'local'
        ? 'local'
        : 's3';
    this.localStorageRoot = path.join(process.cwd(), 'uploads');
    this.localPublicUrlBase = (
      this.configService.get<string>('LOCAL_STORAGE_PUBLIC_URL') ??
      `http://localhost:${this.configService.get<string>('APP_PORT', '3100')}/uploads`
    ).replace(/\/+$/g, '');

    if (this.driver === 's3') {
      /**
       * Configure S3 Client.
       * Use S3_ENDPOINT for custom providers (SeaweedFS, Minio).
       * Leave S3_ENDPOINT empty for standard AWS S3.
       */
      const endpoint = this.configService.get<string>('S3_ENDPOINT');
      this.s3Client = new S3Client({
        endpoint: endpoint || undefined,
        region: this.configService.get<string>('S3_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get<string>('S3_ACCESS_KEY', ''),
          secretAccessKey: this.configService.get<string>('S3_SECRET_KEY', ''),
        },
        forcePathStyle: parseBooleanFlag(
          this.configService.get<string | boolean>('S3_FORCE_PATH_STYLE'),
          true,
        ),
      });
    } else {
      this.logger.log(
        `STORAGE_DRIVER=local. Files will be written to ${this.localStorageRoot}.`,
      );
    }
  }

  /**
   * Uploads an image file and persists its metadata.
   *
   * @param file The file object containing buffer, name, and mime type.
   * @param folder Optional folder path in the bucket to organize files.
   * @returns The media record from the database.
   */
  async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    folder: string | StoragePath = StoragePath.UPLOADS,
  ) {
    // 0. Clean the folder path (remove leading/trailing slashes)
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    // 1. Validate file type (Currently restricted to images)
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    /**
     * OPTIMIZATION: Process image with Sharp
     * 1. Resize: Limit maximum dimensions to 2000px (width or height) to avoid oversized images.
     * 2. Convert to WebP: Significant size reduction with good quality.
     */
    const processedBuffer = await sharp(file.buffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    // 2. Prepare file names and paths (Always use .webp extension)
    const originalNameWithoutExt = path.parse(file.originalname).name;
    const filename = `${Date.now()}-${originalNameWithoutExt}.webp`;
    const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    const mimeType = 'image/webp';
    const publicUrl = this.buildPublicUrl(key);

    // 3. Create a PENDING record in the database
    const media = this.mediaRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: mimeType,
      size: processedBuffer.length, // Store the optimized size
      status: MediaStatus.PENDING,
      s3Key: key,
      url: publicUrl,
    });

    const savedMedia = await this.mediaRepository.save(media);

    return this.completeUpload(savedMedia, processedBuffer, mimeType);
  }

  /**
   * Deletes a file from both the S3 storage and the database record.
   *
   * @param mediaId The UUID of the media record to delete.
   */
  async deleteFile(mediaId: string) {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });

    if (!media) {
      return;
    }

    // Remove the object from S3 storage if the key exists
    if (media.s3Key) {
      try {
        await this.deleteStoredObject(media.s3Key);
      } catch (error) {
        this.logger.error(
          `Failed to delete stored object for mediaId: ${mediaId}`,
          error,
        );
      }
    }

    // Permanently remove the metadata record from the database
    await this.mediaRepository.remove(media);
  }

  private async completeUpload(
    media: Media,
    buffer: Buffer,
    mimeType: string,
  ): Promise<Media> {
    try {
      await this.writeStoredObject(media.s3Key, buffer, mimeType);
      await this.mediaRepository.update(media.id, {
        status: MediaStatus.COMPLETED,
      });

      media.status = MediaStatus.COMPLETED;
      return media;
    } catch (error) {
      this.logger.error(`Synchronous upload failed for ${media.filename}`, error);
      await this.mediaRepository.update(media.id, {
        status: MediaStatus.FAILED,
      });
      throw error;
    }
  }

  private async writeStoredObject(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    if (this.driver === 'local') {
      const filePath = this.resolveLocalFilePath(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);
      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  }

  private async deleteStoredObject(key: string): Promise<void> {
    if (this.driver === 'local') {
      const filePath = this.resolveLocalFilePath(key);

      try {
        await fs.unlink(filePath);
      } catch (error: unknown) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') {
          throw error;
        }
      }

      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  private resolveLocalFilePath(key: string): string {
    return path.join(this.localStorageRoot, ...key.split('/'));
  }

  private buildPublicUrl(key: string): string {
    if (this.driver === 'local') {
      return `${this.localPublicUrlBase}/${key}`;
    }

    const publicUrlBase = this.configService.get<string>(
      'S3_PUBLIC_URL',
      `http://localhost:8888/buckets/${this.bucket}`,
    );
    return `${publicUrlBase}/${key}`;
  }
}
