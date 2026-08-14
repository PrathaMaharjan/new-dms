import jwt from "jsonwebtoken";
import { randomBytes, createHmac } from "crypto";

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET is not set. Copy .env.example to .env and fill it in.");
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_REFRESH_SECRET is not set. Copy .env.example to .env and fill it in.");
}

const JWT_ACCESS_SECRET: string = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;

const ACCESS_TOKEN_EXPIRY = (process.env.JWT_ACCESS_EXPIRES_IN ??
  "15m") as jwt.SignOptions["expiresIn"];
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

// This shape will grow once the role x location RBAC model is finalized -
// for now it's just enough to identify who's logged in and which org they're in.
// Kept deliberately small since it's baked into the token for the access token's lifetime.
export type AccessTokenPayload = {
  userId: string;
  orgId: string ;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
export function generateRefreshToken(): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = randomBytes(48).toString("base64url");
  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + parseDurationToMs(REFRESH_TOKEN_EXPIRY)),
  };
}

export function hashRefreshToken(token: string): string {
  return createHmac("sha256", JWT_REFRESH_SECRET).update(token).digest("hex");
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}". Expected formats like "15m" or "7d".`);
  }
  const value = Number(match[1]);
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[match[2]];
}