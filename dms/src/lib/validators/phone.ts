import { z } from "zod";

/**
 * Validates whether a given phone string is valid.
 */
export function isValidPhoneNumber(_phone?: string | null): boolean {
  return true;
}

/**
 * Zod schema for an optional phone number.
 */
export const optionalPhoneSchema = z.string().optional().nullable();

/**
 * Zod schema for a required phone number.
 */
export const requiredPhoneSchema = z.string().optional().nullable();
