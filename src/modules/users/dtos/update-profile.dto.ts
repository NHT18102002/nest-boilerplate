import { PartialType, PickType } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

export class UpdateProfileDto extends PartialType(
  PickType(User, ['name', 'phone', 'address', 'dateOfBirth'] as const),
) {}
