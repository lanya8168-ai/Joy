// Dev/Special User IDs with full permissions
export const DEV_USER_ID = '1403958587843149937';
export const ADMIN_USERS = [
  '1403958587843149937',  // Dev user
  '996524280869302492'    // Admin user
];

// Users who can use bot during lockdown
export const LOCKDOWN_WHITELIST = ADMIN_USERS;

// Role IDs
export const BOOSTER_ROLE_ID = '1442680565479510077';

// Helper function to check if user is admin (no cooldown)
export const isAdminUser = (userId: string): boolean => ADMIN_USERS.includes(userId);
