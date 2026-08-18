import { z } from "zod";

export const createTierSchema = z.object({
  name: z.string().min(1, "Tier name is required"),
  minYears: z.number().int().nonnegative(),
  maxYears: z.number().int().positive().optional(), // omitted = open-ended
}).refine(
  (data) => data.maxYears === undefined || data.maxYears >= data.minYears,
  { message: "Max years must be greater than or equal to min years", path: ["maxYears"] }
);

export const updateTierSchema = z.object({
  name: z.string().min(1).optional(),
  minYears: z.number().int().nonnegative().optional(),
  maxYears: z.number().int().positive().optional(),
});

export const setRateSchema = z.object({
  treatmentId: z.string().uuid("Missing treatment"),
  tierId: z.string().uuid("Missing tier"),
  commissionPercent: z.number().int().min(0).max(100, "Commission cannot exceed 100%"),
});