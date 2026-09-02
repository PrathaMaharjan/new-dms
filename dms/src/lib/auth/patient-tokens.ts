// src/lib/auth/patient-tokens.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";

const PATIENT_ACCESS_TOKEN_SECRET = process.env.PATIENT_ACCESS_TOKEN_SECRET!;
// export const PATIENT_ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
export const PATIENT_ACCESS_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; 

export type PatientAccessTokenPayload = {
  patientId: string;
  orgId: string;
};

export function signPatientAccessToken(payload: PatientAccessTokenPayload): string {
  return jwt.sign(payload, PATIENT_ACCESS_TOKEN_SECRET, { expiresIn: PATIENT_ACCESS_TOKEN_MAX_AGE_SECONDS });
}

export function verifyPatientAccessToken(token: string): PatientAccessTokenPayload {
  return jwt.verify(token, PATIENT_ACCESS_TOKEN_SECRET) as PatientAccessTokenPayload;
}

export function generatePatientRefreshToken() {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = crypto.createHmac("sha256", process.env.PATIENT_REFRESH_TOKEN_SECRET!).update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return { token, tokenHash, expiresAt };
}

export function hashVerificationCode(code: string): string {
  return crypto.createHmac("sha256", process.env.PATIENT_REFRESH_TOKEN_SECRET!).update(code).digest("hex");
}