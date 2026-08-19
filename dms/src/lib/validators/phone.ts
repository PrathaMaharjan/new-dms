import { z } from "zod";

/**
 * Regex for a valid 10-digit mobile phone number starting with 9
 */
export const PHONE_REGEX = /^9\d{9}$/;

/**
 * Validates whether a given phone string is a 10-digit number starting with 9.
 * Strips spaces and dashes before checking.
 */
export function isValidPhoneNumber(phone?: string | null): boolean {
  if (!phone || !phone.trim()) return true;
  const cleaned = phone.trim().replace(/[\s-]/g, "");
  return PHONE_REGEX.test(cleaned);
}

/**
 * Zod schema for an optional phone number that, if provided, must be a 10-digit number starting with 9.
 */
export const optionalPhoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || !val.trim() || isValidPhoneNumber(val),
    { message: "Phone number must be a valid 10-digit number starting with 9" }
  );

/**
 * Zod schema for a required phone number that must be a 10-digit number starting with 9.
 */
export const requiredPhoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine(
    (val) => isValidPhoneNumber(val),
    { message: "Phone number must be a valid 10-digit number starting with 9" }
  );
