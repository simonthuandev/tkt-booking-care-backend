export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_COOKIE: 'access_token',
  REFRESH_TOKEN_COOKIE: 'refresh_token',

  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN: '7d',

  ACCESS_TOKEN_COOKIE_MAX_AGE: 15 * 60 * 1000,          // 15 minutes in ms
  REFRESH_TOKEN_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms

  BCRYPT_SALT_ROUNDS: 12,
  REFRESH_TOKEN_PATH: '/api/v1/auth/refresh',
} as const;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE_MAX_AGE,
};

export const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_OPTIONS,
  maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE_MAX_AGE,
  path: AUTH_CONSTANTS.REFRESH_TOKEN_PATH,
};