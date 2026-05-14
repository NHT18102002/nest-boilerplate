import { Role } from '@/commons/enums/app.enum';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (Role | Role[])[]) =>
  SetMetadata(ROLES_KEY, roles.flat());
