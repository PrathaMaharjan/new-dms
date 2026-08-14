import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformAdmins, platformAdminRefreshTokens } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/hash";
import { signAccessToken, generateRefreshToken } from "@/lib/auth/tokens";
import { platformAdminLoginSchema } from "@/lib/validators/superadmin";

import jwt from "jsonwebtoken";
import crypto from "crypto";

const getAccessTokenSecret = () =>
  process.env.SUPERADMIN_ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || "superadmin_access_token_secret_default";

const getRefreshTokenSecret = () =>
  process.env.SUPERADMIN_REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET || "superadmin_refresh_token_secret_default";

export const SUPERADMIN_ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes, same lifetime as staff tokens

export type SuperAdminAccessTokenPayload = {
  adminId: string;
};

export function signSuperAdminAccessToken(
  payload: SuperAdminAccessTokenPayload,
): string {
  return jwt.sign(payload, getAccessTokenSecret(), {
    expiresIn: SUPERADMIN_ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
}

export function verifySuperAdminAccessToken(
  token: string,
): SuperAdminAccessTokenPayload {
  return jwt.verify(
    token,
    getAccessTokenSecret(),
  ) as SuperAdminAccessTokenPayload;
}

export function generateSuperAdminRefreshToken() {
  // Same opaque, HMAC-hashed pattern as the staff refresh token - a
  // random 48-byte value, never stored raw, only its hash.
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto
    .createHmac("sha256", getRefreshTokenSecret())
    .update(token)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return { token, tokenHash, expiresAt };
}

export function hashSuperAdminRefreshToken(token: string): string {
  return crypto
    .createHmac("sha256", getRefreshTokenSecret())
    .update(token)
    .digest("hex");
}

export type PlatformAdminLoginResult =
  | {
      success: true;
      accessToken: string;
      refreshToken: string;
      refreshTokenExpiresAt: Date;
      admin: { id: string; name: string; email: string };
    }
  | { success: false; error: string };

export async function platformAdminLoginController(input: unknown): Promise<PlatformAdminLoginResult> {
  const parsed = platformAdminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, password } = parsed.data;

  const admin = await db.query.platformAdmins.findFirst({
    where: eq(platformAdmins.email, email),
  });

  if (!admin) {
    return { success: false, error: "Invalid email or password." };
  }

  const passwordValid = await verifyPassword(password, admin.passwordHash);
  if (!passwordValid) {
    return { success: false, error: "Invalid email or password." };
  }

  const accessToken = signSuperAdminAccessToken({ adminId: admin.id });
  const { token: refreshToken, tokenHash, expiresAt } = generateSuperAdminRefreshToken();

  await db.insert(platformAdminRefreshTokens).values({
    platformAdminId: admin.id,
    tokenHash,
    expiresAt,
  });

  return {
    success: true,
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  };
}
