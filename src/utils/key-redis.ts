/**
 * Utilities for generating Redis keys.
 */

export const getRegistrationUserKey = (email: string): string => {
  return `registration_user:${email.trim().toLowerCase()}`;
};

export const getOtpAttemptsKey = (email: string): string => {
  return `registration_user_otp_attempts:${email.trim().toLowerCase()}`;
};

export const getRegistrationRateLimitKey = (email: string): string => {
  return `registration_rate_limit:${email.trim().toLowerCase()}`;
};

export const getRefreshSessionKey = (
  userId: string,
  sessionId: string,
): string => {
  return `auth_refresh_session:${userId}:${sessionId}`;
};

export const getRefreshSessionPattern = (userId: string): string => {
  return `auth_refresh_session:${userId}:*`;
};

export const getPasswordResetKey = (userId: string, nonce: string): string => {
  return `auth_password_reset:${userId}:${nonce}`;
};

export const getPasswordResetPattern = (userId: string): string => {
  return `auth_password_reset:${userId}:*`;
};
