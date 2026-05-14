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
