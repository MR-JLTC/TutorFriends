export type AuthRoleKey = 'admin' | 'tutor' | 'tutee';
type StoredUser = Record<string, any>;

const ROLE_TOKEN_PREFIX = 'token:';
const ROLE_USER_PREFIX = 'user:';
const ACTIVE_ROLE_STORAGE_KEY = 'activeRole';
const hasWindow = typeof window !== 'undefined';

const ROLE_ALIASES: Record<string, AuthRoleKey> = {
  admin: 'admin',
  tutor: 'tutor',
  tutee: 'tutee',
  student: 'tutee'
};

export const mapRoleToStorageKey = (role?: string | null): AuthRoleKey | null => {
  if (!role) return null;
  return ROLE_ALIASES[role.toLowerCase()] ?? null;
};

export const resolveRoleFromPath = (path: string): AuthRoleKey | null => {
  if (!path) return null;
  const normalizedPath = path.toLowerCase();
  if (normalizedPath.startsWith('/admin')) return 'admin';
  if (normalizedPath.startsWith('/tutor-dashboard') || normalizedPath.startsWith('/tutor')) return 'tutor';
  if (normalizedPath.startsWith('/tutee-dashboard') || normalizedPath.startsWith('/tutee')) return 'tutee';
  return null;
};

export const setActiveRole = (role: AuthRoleKey | null) => {
  if (!hasWindow) return;
  if (!role) {
    sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
  localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
};

export const getStoredActiveRole = (): AuthRoleKey | null => {
  if (!hasWindow) return null;
  const fromSession = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
  if (fromSession) {
    const normalized = fromSession.toLowerCase();
    if (ROLE_ALIASES[normalized]) {
      return ROLE_ALIASES[normalized];
    }
  }
  const fromLocal = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
  if (fromLocal) {
    const normalized = fromLocal.toLowerCase();
    if (ROLE_ALIASES[normalized]) {
      return ROLE_ALIASES[normalized];
    }
  }
  return null;
};

export const getRoleForContext = (path?: string): AuthRoleKey | null => {
  const resolved = resolveRoleFromPath(path ?? (hasWindow ? window.location.pathname : ''));
  if (resolved) return resolved;
  return getStoredActiveRole();
};

const tokenKey = (role: AuthRoleKey) => `${ROLE_TOKEN_PREFIX}${role}`;
const userKey = (role: AuthRoleKey) => `${ROLE_USER_PREFIX}${role}`;

export const getRoleToken = (role: AuthRoleKey): string | null => {
  return localStorage.getItem(tokenKey(role));
};

export const getRoleUser = (role: AuthRoleKey): StoredUser | null => {
  const raw = localStorage.getItem(userKey(role));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

export const setRoleAuth = (role: AuthRoleKey, user: StoredUser, token: string) => {
  localStorage.setItem(tokenKey(role), token);
  localStorage.setItem(userKey(role), JSON.stringify(user));
  setActiveRole(role);
};

export const clearRoleAuth = (role: AuthRoleKey) => {
  localStorage.removeItem(tokenKey(role));
  localStorage.removeItem(userKey(role));
};

export const updateRoleUser = (user: StoredUser) => {
  const role = mapRoleToStorageKey(user.role) ?? mapRoleToStorageKey(user.user_type);
  if (!role) return;
  localStorage.setItem(userKey(role), JSON.stringify(user));
};

export const getActiveToken = (path?: string): string | null => {
  const role = getRoleForContext(path);
  if (role) {
    const token = getRoleToken(role);
    if (token) return token;
  }
  return localStorage.getItem('token');
};

export const getActiveUser = (path?: string): StoredUser | null => {
  const role = getRoleForContext(path);
  if (role) {
    const user = getRoleUser(role);
    if (user) return user;
  }
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
};

