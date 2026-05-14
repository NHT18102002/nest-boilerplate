import { CurrentUser } from '@/commons/decorators/current-user.decorator';
import { Public } from '@/commons/decorators/public.decorator';
import { RateLimit } from '@/commons/decorators/rate-limit.decorator';
import { Doc } from '@/commons/docs/doc.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  UserRegisterDto,
  UserResendOtpDto,
  UserVerifyOtpDto,
} from '../users/dtos/create-user.dto';
import { AuthTokenResponseDto } from './dtos/auth-response.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { LogoutDto } from './dtos/logout.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { DefaultMessageResponseDto } from '@/commons/dtos/default-message-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ limit: 1, ttl: 60 })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Register a new user',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  register(@Body() dto: UserRegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @RateLimit({ limit: 5, ttl: 60 })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Verify registration OTP',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  verifyOtp(@Body() dto: UserVerifyOtpDto) {
    return this.authService.verifyRegistration(dto);
  }

  @Public()
  @RateLimit({ limit: 1, ttl: 60 })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Resend registration OTP',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  resendOtp(@Body() dto: UserResendOtpDto) {
    return this.authService.resendRegistrationOtp(dto);
  }

  @Public()
  @RateLimit({ limit: 10, ttl: 60 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Login with email and password',
    response: {
      serialization: AuthTokenResponseDto,
    },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @RateLimit({ limit: 20, ttl: 60 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Refresh access token',
    response: {
      serialization: AuthTokenResponseDto,
    },
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @RateLimit({ limit: 3, ttl: 60 })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Request password reset',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @RateLimit({ limit: 5, ttl: 60 })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Reset password using reset token',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Logout and revoke refresh token',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
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
