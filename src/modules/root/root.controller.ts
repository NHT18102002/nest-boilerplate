import { Public } from '@/commons/decorators/public.decorator';
import { Doc } from '@/commons/docs/doc.decorator';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RootService } from './root.service';
import { RateLimit } from '@/commons/decorators/rate-limit.decorator';

@ApiTags('Root')
@Controller()
export class RootController {
  constructor(private readonly rootService: RootService) {}

  @Public()
  @Doc({
    summary: 'Role: No - Get system health.',
    description: 'Returns health status of the system.',
    response: {
      serialization: String,
    },
  })
  @Get('health')
  @RateLimit({ limit: 10, ttl: 10000 })
  getHealth(): string {
    return this.rootService.getHealth();
  }
}
