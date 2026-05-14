import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { User } from '../../auth/entities/user.entity';

export class UserRegisterDto extends PickType(User, [] as const) {
  @ApiProperty({ description: 'User email', example: 'user@test.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'User password', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}

export class UserResendOtpDto extends PickType(User, [] as const) {
  @ApiProperty({ description: 'User email', example: 'user@test.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class UserVerifyOtpDto extends PickType(User, [] as const) {
  @ApiProperty({ description: 'User email', example: 'user@test.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
