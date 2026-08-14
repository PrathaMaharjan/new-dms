import { db } from "@/db";
import { locations, organizations, refreshTokens, users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/hash";
import { getRedirectPathForUser } from "@/lib/auth/role-redirect";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "@/lib/auth/tokens";
import { loginSchema } from "@/lib/validators/auth";
import { eq, or } from "drizzle-orm";
export type LoginResult =
  | {
      success: true;
      accessToken: string;
      refreshToken: string;
      refreshTokenExpiresAt: Date;
      user: { id: string; orgId: string; name: string; email: string };
      org: { slug: string; name: string; locationId: string };
      redirectTo: string | null;
    }
  | { success: false; error: string };

export type RefreshResult =
  | {
      success: true;
      accessToken: string;
      refreshToken: string;
      refreshTokenExpiresAt: Date;
    }
  | { success: false; error: string };

export async function loginController(input: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { success: false, error: firstIssue };
  }
  const { identifier, password } = parsed.data;
  const user = await db.query.users.findFirst({
    where: or(eq(users.email, identifier), eq(users.phone, identifier)),
  });

  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return { success: false, error: "Invalid email or password." };
  }
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.orgId),
  });
  if (!org) {
    return { success: false, error: "Invalid email or password." };
  }
  if (org.status === "suspended" || org.status === "cancelled") {
    return {
      success: false,
      error: "This clinic's account is not active. Contact support.",
    };
  }
  const location = await db.query.locations.findFirst({
    where: eq(locations.orgId, org.id),
  });
  if (!location) {
    return {
      success: false,
      error: "No location configured for this organization.",
    };
  }
  if (user.deletedAt) {
    return { success: false, error: "This account is no longer active." };
  }
  if (!user.isActive) {
    return {
      success: false,
      error: "This account has been deactivated. Contact your administrator.",
    };
  }

  const accessToken = signAccessToken({ userId: user.id, orgId: user.orgId });
  const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken();

  await db
    .insert(refreshTokens)
    .values({ userId: user.id, tokenHash, expiresAt });

  const redirectTo = await getRedirectPathForUser(user.id, org.slug);
  console.log("redirect : ",redirectTo)
  console.log("user : ",user)

  return {
    success: true,
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    user: {
      id: user.id,
      orgId: user.orgId,
      name: user.name,
      email: user.email,
    },
    org: {
      slug: org.slug,
      name: org.name,
      locationId: location?.id,
    },
    redirectTo,
  };
}

export async function logoutController(
  rawRefreshToken: string | undefined,
): Promise<void> {
  if (!rawRefreshToken) return;
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function refreshController(
  rawRefreshToken: string | undefined,
): Promise<RefreshResult> {
  if (!rawRefreshToken) {
    return { success: false, error: "No refresh token provided." };
  }
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const existingToken = await db.query.refreshTokens.findFirst({
    where: eq(refreshTokens.tokenHash, tokenHash),
  });
  if (!existingToken) {
    return { success: false, error: "Invalid session. Please log in again." };
  }
  if (existingToken.revokedAt) {
    return {
      success: false,
      error: "This session has been revoked. Please log in again.",
    };
  }
  if (existingToken.expiresAt < new Date()) {
    return {
      success: false,
      error: "This session has expired. Please log in again.",
    };
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, existingToken.userId),
  });
  if (!user) {
    return { success: false, error: "Invalid session. Please log in again." };
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.orgId),
  });
  if (!org || org.status === "suspended" || org.status === "cancelled") {
    return {
      success: false,
      error: "This clinic's account is not active. Contact support.",
    };
  }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, existingToken.id));
  const accessToken = signAccessToken({ userId: user.id, orgId: user.orgId });
  const {
    token: newRefreshToken,
    tokenHash: newTokenHash,
    expiresAt: newExpiresAt,
  } = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt: newExpiresAt,
  });

  return {
    success: true,
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: newExpiresAt,
  };
}
