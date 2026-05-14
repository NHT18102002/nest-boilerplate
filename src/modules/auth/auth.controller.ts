import { CurrentUser } from '@/commons/decorators/current-user.decorator';
import { Public } from '@/commons/decorators/public.decorator';
import { Doc } from '@/commons/docs/doc.decorator';
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Doc({
    summary: 'Login with email and password',
    response: {
      serialization: Object,
    },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @Doc({
    summary: 'Get current authenticated user',
    response: {
      serialization: User,
    },
  })
  me(@CurrentUser() user: User) {
    return user;
  }
}
