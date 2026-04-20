import type { Context } from "hono";
import { sendPlatformEmailAuthCode, verifyPlatformEmailAuthCode } from "@/services/platform/platform-email-otp.service";
import { ensurePlatformBootstrap } from "@/services/platform.service";
import {
  issuePlatformTokenResult,
  isPlatformAuthServiceError,
  registerPlatformUser,
  updatePlatformUserPassword,
} from "@/services/platform/platform-auth.service";
import type { Env } from "@/types/platform";
import { apiError, readClientIp, readJson, readString } from "@/utils/platform.utils";

export async function sendRegisterCodeHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = readString(body, "email");
  const clientIp = readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
  try {
    const result = await sendPlatformEmailAuthCode({
      env: c.env,
      email,
      clientIp,
      purpose: "register",
    });
    return c.json({
      ok: true,
      data: result,
    }, 202);
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}

export async function completeRegisterHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = readString(body, "email");
  const code = readString(body, "code");
  const password = readString(body, "password");
  try {
    const verified = await verifyPlatformEmailAuthCode({
      env: c.env,
      email,
      code,
      purpose: "register",
    });
    const user = await registerPlatformUser({
      env: c.env,
      email: verified.email,
      password,
    });
    const result = await issuePlatformTokenResult({
      env: c.env,
      user,
    });
    return c.json({
      ok: true,
      data: result,
    }, 201);
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}

export async function sendPasswordResetCodeHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = readString(body, "email");
  const clientIp = readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
  try {
    const result = await sendPlatformEmailAuthCode({
      env: c.env,
      email,
      clientIp,
      purpose: "password_reset",
    });
    return c.json({
      ok: true,
      data: result,
    }, 202);
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}

export async function completePasswordResetHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);

  const body = await readJson(c);
  const email = readString(body, "email");
  const code = readString(body, "code");
  const password = readString(body, "password");
  try {
    const verified = await verifyPlatformEmailAuthCode({
      env: c.env,
      email,
      code,
      purpose: "password_reset",
    });
    const user = await updatePlatformUserPassword({
      env: c.env,
      email: verified.email,
      password,
    });
    const result = await issuePlatformTokenResult({
      env: c.env,
      user,
    });
    return c.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  }
}
