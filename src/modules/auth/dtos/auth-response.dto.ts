import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

export class AuthTokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: '7d' })
  expiresIn: string;

  @ApiProperty({ example: '30d' })
  refreshExpiresIn: string;

  @ApiProperty({ type: () => User })
  user: User;
}
