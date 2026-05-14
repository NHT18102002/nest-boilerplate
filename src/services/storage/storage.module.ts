import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { StorageService } from './storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
