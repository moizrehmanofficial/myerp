// Company (tenant) users and the Super Admin used the SAME cookie names
// ("access_token"), so logging into one in the same browser logged the
// other out. Company users now have their own cookie names.
export const TENANT_ACCESS_COOKIE = 'erp_access_token';
export const TENANT_REFRESH_COOKIE = 'erp_refresh_token';

export function tenantCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}