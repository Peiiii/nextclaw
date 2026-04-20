import {
  appendAuditLog,
  appendLoginAttempt,
  countRecentFailedLoginsByIp,
  ensureUserSecurityRow,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  registerUserLoginFailure,
  resetUserLoginSecurity,
  toUserPublicView
} from "@/repositories/platform.repository";
import {
  ACCOUNT_LOCK_MINUTES,
  IP_FAILED_ATTEMPT_WINDOW_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS_PER_IP_WINDOW,
  MAX_FAILED_LOGIN_ATTEMPTS_PER_USER,
  type Env,
  type UserRow
} from "@/types/platform";
import {
  getDefaultUserFreeLimit,
  hashPassword,
  isStrongPassword,
  isValidEmail,
  issueSessionToken,
  normalizeEmail,
  parseIsoDate,
  verifyPassword
} from "@/utils/platform.utils";
import { normalizePlatformUsername, validatePlatformUsername } from "@/utils/platform-username";

export class PlatformAuthServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "PlatformAuthServiceError";
  }
}

export function isPlatformAuthServiceError(error: unknown): error is PlatformAuthServiceError {
  return error instanceof PlatformAuthServiceError;
}

async function ensureIpLoginRateLimit(params: {
  env: Env;
  clientIp: string | null;
  now: Date;
}): Promise<void> {
  const { env, clientIp, now } = params;
  if (!clientIp) {
    return;
  }

  const failedCountByIp = await countRecentFailedLoginsByIp(
    env.NEXTCLAW_PLATFORM_DB,
    clientIp,
    new Date(now.getTime() - IP_FAILED_ATTEMPT_WINDOW_MINUTES * 60_000).toISOString(),
  );
  if (failedCountByIp < MAX_FAILED_LOGIN_ATTEMPTS_PER_IP_WINDOW) {
    return;
  }

  throw new PlatformAuthServiceError(
    429,
    "TOO_MANY_ATTEMPTS",
    "Too many failed login attempts from this IP. Please retry later.",
  );
}

async function ensureUserLoginUnlocked(params: {
  env: Env;
  user: UserRow | null;
  email: string;
  clientIp: string | null;
  now: Date;
  nowIso: string;
}): Promise<void> {
  const { env, user, email, clientIp, now, nowIso } = params;
  if (!user) {
    return;
  }

  const security = await ensureUserSecurityRow(env.NEXTCLAW_PLATFORM_DB, user.id, nowIso);
  const lockedUntil = parseIsoDate(security.login_locked_until);
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    await appendLoginAttempt(env.NEXTCLAW_PLATFORM_DB, {
      email,
      ip: clientIp,
      success: false,
      reason: "locked",
      createdAt: nowIso,
    });
    throw new PlatformAuthServiceError(
      423,
      "ACCOUNT_LOCKED",
      `Account is temporarily locked until ${lockedUntil.toISOString()}.`,
    );
  }
  if (lockedUntil) {
    await resetUserLoginSecurity(env.NEXTCLAW_PLATFORM_DB, user.id, nowIso);
  }
}

async function handleInvalidCredentials(params: {
  env: Env;
  user: UserRow | null;
  email: string;
  clientIp: string | null;
  nowIso: string;
}): Promise<never> {
  const { env, user, email, clientIp, nowIso } = params;
  await appendLoginAttempt(env.NEXTCLAW_PLATFORM_DB, {
    email,
    ip: clientIp,
    success: false,
    reason: "invalid_credentials",
    createdAt: nowIso,
  });

  if (!user) {
    throw new PlatformAuthServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const lockState = await registerUserLoginFailure(
    env.NEXTCLAW_PLATFORM_DB,
    user.id,
    nowIso,
    MAX_FAILED_LOGIN_ATTEMPTS_PER_USER,
    ACCOUNT_LOCK_MINUTES,
  );
  if (lockState.lockedUntil) {
    await appendAuditLog(env.NEXTCLAW_PLATFORM_DB, {
      actorUserId: user.id,
      action: "auth.login.locked",
      targetType: "user",
      targetId: user.id,
      beforeJson: null,
      afterJson: JSON.stringify({ lockedUntil: lockState.lockedUntil }),
      metadataJson: JSON.stringify({ email, ip: clientIp }),
    });
    throw new PlatformAuthServiceError(
      423,
      "ACCOUNT_LOCKED",
      `Account is temporarily locked until ${lockState.lockedUntil}.`,
    );
  }

  throw new PlatformAuthServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
}

export async function registerPlatformUser(params: {
  env: Env;
  email: string;
  password: string;
}): Promise<UserRow> {
  const { env } = params;
  const email = normalizeEmail(params.email);
  const { password } = params;
  if (!email || !isValidEmail(email)) {
    throw new PlatformAuthServiceError(400, "INVALID_EMAIL", "A valid email is required.");
  }
  if (!isStrongPassword(password)) {
    throw new PlatformAuthServiceError(400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
  }

  const existing = await getUserByEmail(env.NEXTCLAW_PLATFORM_DB, email);
  if (existing) {
    throw new PlatformAuthServiceError(409, "EMAIL_EXISTS", "This email is already registered.");
  }

  const now = new Date().toISOString();
  const digest = await hashPassword(password);
  const userId = crypto.randomUUID();
  const inserted = await env.NEXTCLAW_PLATFORM_DB.prepare(
    `INSERT INTO users (
      id, email, password_hash, password_salt, role,
      free_limit_usd, free_used_usd, paid_balance_usd,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'user', ?, 0, 0, ?, ?)`
  )
    .bind(
      userId,
      email,
      digest.hash,
      digest.salt,
      getDefaultUserFreeLimit(env),
      now,
      now
    )
    .run();
  if (!inserted.success || (inserted.meta.changes ?? 0) !== 1) {
    throw new PlatformAuthServiceError(500, "REGISTER_FAILED", "Failed to create user.");
  }

  const user = await getUserById(env.NEXTCLAW_PLATFORM_DB, userId);
  if (!user) {
    throw new PlatformAuthServiceError(500, "REGISTER_FAILED", "User created but cannot be loaded.");
  }
  await ensureUserSecurityRow(env.NEXTCLAW_PLATFORM_DB, user.id, now);
  return user;
}

export async function updatePlatformUserPassword(params: {
  env: Env;
  email: string;
  password: string;
}): Promise<UserRow> {
  const { env } = params;
  const email = normalizeEmail(params.email);
  const { password } = params;
  if (!email || !isValidEmail(email)) {
    throw new PlatformAuthServiceError(400, "INVALID_EMAIL", "A valid email is required.");
  }
  if (!isStrongPassword(password)) {
    throw new PlatformAuthServiceError(400, "WEAK_PASSWORD", "Password must be at least 8 characters.");
  }

  const now = new Date().toISOString();
  const existing = await getUserByEmail(env.NEXTCLAW_PLATFORM_DB, email);
  if (!existing) {
    throw new PlatformAuthServiceError(404, "EMAIL_NOT_FOUND", "This email is not registered.");
  }

  const digest = await hashPassword(password);
  const updated = await env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE users
        SET password_hash = ?,
            password_salt = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(digest.hash, digest.salt, now, existing.id)
    .run();
  if (!updated.success || (updated.meta.changes ?? 0) !== 1) {
    throw new PlatformAuthServiceError(500, "PASSWORD_UPDATE_FAILED", "Failed to update password.");
  }

  await resetUserLoginSecurity(env.NEXTCLAW_PLATFORM_DB, existing.id, now);
  const user = await getUserById(env.NEXTCLAW_PLATFORM_DB, existing.id);
  if (!user) {
    throw new PlatformAuthServiceError(500, "PASSWORD_UPDATE_FAILED", "Password updated but user cannot be loaded.");
  }
  return user;
}

export async function updatePlatformUserProfile(params: {
  env: Env;
  userId: string;
  username: string;
}): Promise<UserRow> {
  const { env, userId } = params;
  const username = normalizePlatformUsername(params.username);
  const validationError = validatePlatformUsername(username);
  if (validationError) {
    throw new PlatformAuthServiceError(400, "INVALID_USERNAME", validationError);
  }

  const existing = await getUserById(env.NEXTCLAW_PLATFORM_DB, userId);
  if (!existing) {
    throw new PlatformAuthServiceError(404, "USER_NOT_FOUND", "User not found.");
  }

  if (existing.username && existing.username !== username) {
    throw new PlatformAuthServiceError(
      409,
      "USERNAME_ALREADY_SET",
      "Username has already been set and cannot be changed in this version.",
    );
  }

  const owner = await getUserByUsername(env.NEXTCLAW_PLATFORM_DB, username);
  if (owner && owner.id !== userId) {
    throw new PlatformAuthServiceError(409, "USERNAME_TAKEN", "This username is already taken.");
  }

  if (existing.username === username) {
    return existing;
  }

  const now = new Date().toISOString();
  const updated = await env.NEXTCLAW_PLATFORM_DB.prepare(
    `UPDATE users
        SET username = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(username, now, existing.id)
    .run();
  if (!updated.success || (updated.meta.changes ?? 0) !== 1) {
    throw new PlatformAuthServiceError(500, "PROFILE_UPDATE_FAILED", "Failed to update profile.");
  }

  const user = await getUserById(env.NEXTCLAW_PLATFORM_DB, existing.id);
  if (!user) {
    throw new PlatformAuthServiceError(500, "PROFILE_UPDATE_FAILED", "Profile updated but user cannot be loaded.");
  }

  await appendAuditLog(env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: user.id,
    action: "auth.profile.username.set",
    targetType: "user",
    targetId: user.id,
    beforeJson: JSON.stringify(toUserPublicView(existing)),
    afterJson: JSON.stringify(toUserPublicView(user)),
    metadataJson: JSON.stringify({ username }),
  });

  return user;
}

export async function authenticatePlatformUser(params: {
  env: Env;
  email: string;
  password: string;
  clientIp: string | null;
  now?: Date;
}): Promise<UserRow> {
  const { env, clientIp } = params;
  const email = normalizeEmail(params.email);
  const { password } = params;
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();

  if (!email || !password) {
    throw new PlatformAuthServiceError(400, "INVALID_CREDENTIALS", "Email and password are required.");
  }

  await ensureIpLoginRateLimit({
    env,
    clientIp,
    now
  });

  const user = await getUserByEmail(env.NEXTCLAW_PLATFORM_DB, email);
  await ensureUserLoginUnlocked({
    env,
    user,
    email,
    clientIp,
    now,
    nowIso
  });

  const valid = user
    ? await verifyPassword(password, user.password_salt, user.password_hash)
    : false;
  if (!valid) {
    return await handleInvalidCredentials({
      env,
      user,
      email,
      clientIp,
      nowIso
    });
  }

  await appendLoginAttempt(env.NEXTCLAW_PLATFORM_DB, {
    email,
    ip: clientIp,
    success: true,
    reason: null,
    createdAt: nowIso
  });

  if (!user) {
    throw new PlatformAuthServiceError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  await resetUserLoginSecurity(env.NEXTCLAW_PLATFORM_DB, user.id, nowIso);
  return user;
}

export async function issuePlatformTokenResult(params: {
  env: Env;
  user: UserRow;
}): Promise<{
  token: string;
  user: ReturnType<typeof toUserPublicView>;
}> {
  return {
    token: await issueSessionToken(params.env, params.user),
    user: toUserPublicView(params.user)
  };
}
