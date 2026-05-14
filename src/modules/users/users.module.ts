import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { StorageModule } from '@/services/storage/storage.module';
import { RedisModule } from '@/services/redis/redis.module';
import { MailModule } from '@/services/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    StorageModule,
    RedisModule,
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
