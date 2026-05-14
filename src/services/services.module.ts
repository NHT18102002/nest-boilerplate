import { Global, Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { StorageModule } from './storage/storage.module';

@Global()
@Module({
  imports: [RedisModule, MailModule, StorageModule],
  exports: [RedisModule, MailModule, StorageModule],
})
export class ServicesModule {}
