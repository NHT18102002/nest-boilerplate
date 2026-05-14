/**
 * Enum representing user roles in the system.
 */
export enum Role {
  /** Administrator - has full permissions in the system. */
  ADMIN = 'admin',
  /** Regular authenticated user. */
  USER = 'user',
}

export const ALL_ROLES = [Role.USER, Role.ADMIN];

/**
 * Enum representing user account statuses.
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}
