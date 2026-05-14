import { BaseEntity } from '@/commons/entities/base.entity';
import { Role, UserStatus } from '@/commons/enums/app.enum';
import { Media } from '@/services/storage/entities/media.entity';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

@Entity('user')
export class User extends BaseEntity {
  @ApiProperty({ description: 'Name of the user' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Column({ type: 'varchar', length: 200, nullable: true })
  name?: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '0901234567',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phone?: string;

  @ApiProperty({ description: 'Email of the user' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true, select: false })
  passwordHash?: string;

  @Column({ type: 'boolean', default: false })
  @IsBoolean()
  @IsOptional()
  emailVerified: boolean;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  image?: string;

  @Column({ type: 'uuid', nullable: true })
  @IsUUID()
  @IsOptional()
  mediaId?: string;

  @OneToOne(() => Media)
  @JoinColumn({ name: 'mediaId' })
  media?: Media;

  @ApiProperty({ description: 'National ID or identity document number' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  identityNumber?: string;

  @ApiProperty({ description: 'Date of birth of the user' })
  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date;

  @ApiProperty({ description: 'Address of the user' })
  @IsString()
  @IsOptional()
  @Column({ type: 'text', nullable: true })
  address?: string;

  @ApiProperty({ description: 'Is KYC verified' })
  @IsBoolean()
  @IsOptional()
  @Column({ type: 'boolean', nullable: true, default: false })
  isVerifiedKyc?: boolean;

  @ApiProperty({ enum: UserStatus, description: 'Status of the user' })
  @IsEnum(UserStatus)
  @IsOptional()
  @Column({
    type: 'simple-enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  @Column({ type: 'simple-enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'text', default: 'en' })
  @IsString()
  @IsOptional()
  language: string;

  @Column({ nullable: true })
  banExpires?: Date;

  @Column({ type: 'boolean', nullable: true })
  banned?: boolean;

  @Column({ type: 'text', nullable: true })
  banReason?: string;
}
