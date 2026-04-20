import type { Context } from "hono";
import {
  toUserPublicView
} from "../repositories/platform.repository";
import {
  type Env
} from "../types/platform";
import { ensurePlatformBootstrap, requireAuthUser } from "../services/platform.service";
import {
  authenticatePlatformUser,
  isPlatformAuthServiceError,
  issuePlatformTokenResult,
  registerPlatformUser,
  updatePlatformUserProfile
} from "../services/platform/platform-auth.service";
import {
  apiError,
  readClientIp,
  readJson,
  readString,
} from "../utils/platform.utils";

export async function registerHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = readString(body, "email");
  const password = readString(body, "password");
  try {
    const user = await registerPlatformUser({
      env: c.env,
      email,
      password
    });
    const result = await issuePlatformTokenResult({
      env: c.env,
      user
    });
    return c.json({
      ok: true,
      data: result
    }, 201);
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}

export async function loginHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = readString(body, "email");
  const password = readString(body, "password");
  const clientIp = readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
  try {
    const user = await authenticatePlatformUser({
      env: c.env,
      email,
      password,
      clientIp
    });
    const result = await issuePlatformTokenResult({
      env: c.env,
      user
    });
    return c.json({
      ok: true,
      data: result
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}

export async function meHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  return c.json({
    ok: true,
    data: {
      user: toUserPublicView(auth.user)
    }
  });
}

export async function patchProfileHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const username = readString(body, "username");
  try {
    const user = await updatePlatformUserProfile({
      env: c.env,
      userId: auth.user.id,
      username
    });
    const result = await issuePlatformTokenResult({
      env: c.env,
      user
    });
    return c.json({
      ok: true,
      data: result
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}
