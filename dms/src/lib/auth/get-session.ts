import { cookies } from "next/headers";
import { db } from "@/db";
import { organizations, refreshTokens, users } from "@/db/schema";
import {
  hashRefreshToken,
  verifyAccessToken,
  type AccessTokenPayload,
} from "@/lib/auth/tokens";
import { eq } from "drizzle-orm";

/**
 * Reads and verifies the access token cookie for the current request.
 * Returns the session payload if valid, or null if there's no session at all.
 * This is the ONE place every protected Server Component/Action/Route Handler
 * should call to answer "who is making this request, if anyone."
 */
export async function getSession(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (accessToken) {
    const accessSession = verifyAccessToken(accessToken);
    if (accessSession) return accessSession;
  }

  const refreshToken = cookieStore.get("refresh_token")?.value;
  return getSessionFromRefreshToken(refreshToken);
}

async function getSessionFromRefreshToken(
  rawRefreshToken: string | undefined,
): Promise<AccessTokenPayload | null> {
  if (!rawRefreshToken) return null;

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const existingToken = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });

  if (!existingToken) return null;
  if (existingToken.revokedAt) return null;
  if (existingToken.expiresAt < new Date()) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, existingToken.userId),
  });
  if (!user) return null;
  if (user.deletedAt) return null;
  if (!user.isActive) return null;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.orgId),
  });
  if (!org) return null;
  if (org.status === "suspended" || org.status === "cancelled") return null;

  return { userId: user.id, orgId: user.orgId };
}

export class SessionError extends Error {
  code: "NO_SESSION" | "INVALID_SESSION";

  constructor(code: "NO_SESSION" | "INVALID_SESSION", message: string) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

/**
 * For Server Actions/controllers, not pages - throws a typed SessionError
 * instead of returning null, so the caller can catch it and return a clean
 * { success: false, error } result rather than crashing.
 *
 * Two distinct failure codes, not one generic "UNAUTHORIZED":
 * - NO_SESSION: no cookie was ever sent (never logged in, or already logged out)
 * - INVALID_SESSION: a cookie was sent, but it's expired or fails verification
 */
export async function requireSession(): Promise<AccessTokenPayload> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!accessToken && !refreshToken) {
    throw new SessionError("NO_SESSION", "You must be logged in.");
  }

  if (accessToken) {
    const accessSession = verifyAccessToken(accessToken);
    if (accessSession) return accessSession;
  }

  const refreshSession = await getSessionFromRefreshToken(refreshToken);
  if (refreshSession) return refreshSession;

  throw new SessionError(
    "INVALID_SESSION",
    "Your session has expired. Please log in again.",
  );
}
