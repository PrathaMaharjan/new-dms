import { db } from "@/db";
import { passwordResetOtps, passwordResetTokens, refreshTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/hash";
import { sendPasswordResetOtpEmail } from "@/lib/email/reset-password";
import {
  requestOtpSchema,
  resetPasswordSchema,
} from "@/lib/validators/reset-password";
import { createHash, randomBytes, randomInt } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import z from "zod";

const OTP_EXPIRY_MINUTES = 10;

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export type RequestOtpResult =
  | { success: true }
  | { success: false; error: string };
export async function requestPasswordResetOtp(
  input: unknown,
): Promise<RequestOtpResult> {
  const parsed = requestOtpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const user = await db.query.users.findFirst({
      where: and(eq(users.email, parsed.data.email), isNull(users.deletedAt)),
    });
    if (user && user.isActive) {
      // 6-digit code, zero-padded - randomInt is cryptographically secure,
      const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

      await db
        .insert(passwordResetOtps)
        .values({ userId: user.id, otpHash, expiresAt });

      try {
        await sendPasswordResetOtpEmail(user.email, user.name, otp);
      } catch (emailErr) {
        console.error("Failed to send password reset OTP email:", emailErr);
      }
    }

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: true };
  }
}

export type ResetPasswordResult = { success: true } | { success: false; error: string };

export async function resetPassword(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const tokenHash = hashToken(parsed.data.resetToken);
    const validToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
    });
    if (!validToken) {
      return { success: false, error: "Invalid or expired reset session. Please start over." };
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, validToken.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, validToken.id));
      // Kill every existing session - protects against a compromised
      // account keeping an already-active session alive after reset.
      await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, validToken.userId));
    });

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Something went wrong resetting your password." };
  }
}

// verify password 
export type VerifyOtpResult = { success: true; resetToken: string } | { success: false; error: string };

export async function verifyPasswordResetOtp(input: unknown): Promise<VerifyOtpResult> {
  const parsed = requestOtpSchema.extend({ otp: z.string().length(6) }).safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
    try {
    const user = await db.query.users.findFirst({
      where: and(eq(users.email, parsed.data.email), isNull(users.deletedAt)),
    });
    if (!user) {
      return { success: false, error: "Invalid or expired code." };
    }

    const otpHash = hashOtp(parsed.data.otp);
    const validOtp = await db.query.passwordResetOtps.findFirst({
      where: and(
        eq(passwordResetOtps.userId, user.id),
        eq(passwordResetOtps.otpHash, otpHash),
        isNull(passwordResetOtps.usedAt),
        gt(passwordResetOtps.expiresAt, new Date())
      ),
    });
    if (!validOtp) {
      return { success: false, error: "Invalid or expired code." };
    }
        // OTP is consumed here, immediately - it can never be checked again,
    // even if this exact request somehow ran twice.
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = createHash("sha256").update(resetToken).digest("hex");

    await db.transaction(async (tx) => {
      await tx.update(passwordResetOtps).set({ usedAt: new Date() }).where(eq(passwordResetOtps.id, validOtp.id));
      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: resetTokenHash,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
    });

    return { success: true, resetToken };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Something went wrong verifying the code." };
  }
}