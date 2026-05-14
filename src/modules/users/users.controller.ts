import {
  Controller,
  ParseFilePipe,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
  FileTypeValidator,
  Post,
  HttpCode,
  HttpStatus,
  Body,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '../auth/entities/user.entity';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ALL_ROLES } from '@/commons/enums/app.enum';
import { Doc } from '@/commons/docs/doc.decorator';
import {
  UserRegisterDto,
  UserResendOtpDto,
  UserVerifyOtpDto,
} from './dtos/create-user.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { DefaultMessageResponseDto } from '@/commons/dtos/default-message-response.dto';
import { RateLimit } from '@/commons/decorators/rate-limit.decorator';
import { CurrentUser } from '@/commons/decorators/current-user.decorator';
import { Public } from '@/commons/decorators/public.decorator';
import { Roles } from '@/commons/decorators/roles.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @Roles(ALL_ROLES)
  @Doc({
    summary: 'Role: All - Update current user profile',
    description:
      'Update the profile information of the currently logged in user.',
    response: {
      serialization: User,
    },
  })
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Public()
  @RateLimit({ limit: 1, ttl: 60 })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Role: None - Register a new user',
    description:
      'Create a pending user registration. User data is stored in Redis until email verification is completed.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  async register(
    @Body() dto: UserRegisterDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.register(dto);
  }

  @Public()
  @RateLimit({ limit: 5, ttl: 60 })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Role: None - Verify OTP and complete registration',
    description:
      'Verify the OTP sent to email and create the user account in database.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  async verifyOtp(
    @Body() dto: UserVerifyOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.verifyRegistration(dto);
  }

  @Public()
  @RateLimit({ limit: 1, ttl: 60 })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Doc({
    auth: false,
    summary: 'Role: None - Resend OTP for pending registration',
    description:
      'Resend the verification OTP to the email for pending registration.',
    response: {
      serialization: DefaultMessageResponseDto,
    },
  })
  async resendOtp(
    @Body() dto: UserResendOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.resendRegistrationOtp(dto);
  }

  @Doc({
    summary: 'Role: All - Update current user avatar',
    description: 'Update the avatar of the currently logged in user.',
    response: {
      serialization: User,
    },
  })
  @Post('avatar')
  @Roles(ALL_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.updateAvatar(user.id, file);
  }
}
