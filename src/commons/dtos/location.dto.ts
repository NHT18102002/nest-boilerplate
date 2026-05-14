import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import type { Location } from '../interfaces/app.interface';

export class LocationDto implements Location {
  @ApiProperty({ example: 106.6297 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 10.8231 })
  @IsNumber()
  latitude: number;
}
