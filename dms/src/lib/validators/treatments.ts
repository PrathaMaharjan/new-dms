import { z } from "zod";

export const createTreatmentSchema = z
  .object({
    locationId: z.string().uuid("Missing or invalid location"),
    name: z.string().min(1, "Treatment name is required"),
    category: z.string().optional().nullable().transform((val) => val?.trim() || "General"),
    durationMinutes: z.number().int().positive().optional().nullable().transform((val) => val ?? 0),
    priceCents: z.number().int().nonnegative().optional().nullable().transform((val) => val ?? 0),
    sessions: z.number().int().positive().optional().nullable().transform((val) => val ?? 1),
    anesthesia: z.enum(["none", "local", "sedation", "general"]).optional().nullable().transform((val) => val ?? "none"),
    recoveryTime: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    procedureSteps: z.array(z.string()).optional().nullable(),
    aftercareInstructions: z.array(z.string()).optional().nullable(),
    hasNoSupplies: z.boolean().optional().default(true),
    supplies: z
      .array(
        z.object({
          itemId: z.string().uuid("Invalid item"),
          quantityRequired: z.number().int().positive("Quantity must be at least 1"),
        })
      )
      .optional()
      .nullable(),
  })
  .refine((data) => data.hasNoSupplies || (data.supplies && data.supplies.length > 0), {
    message: "Please add at least one supply, or confirm this treatment needs none.",
    path: ["supplies"],
  });

export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;

export const updateTreatmentSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),

  durationMinutes: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  sessions: z.number().int().positive().optional().nullable(),
  anesthesia: z.enum(["none", "local", "sedation", "general"]).optional().nullable(),
  recoveryTime: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  procedureSteps: z.array(z.string()).optional().nullable(),
  aftercareInstructions: z.array(z.string()).optional().nullable(),

  hasNoSupplies: z.boolean().optional().default(true),
  supplies: z
    .array(z.object({ itemId: z.string().uuid(), quantityRequired: z.number().int().positive() }))
    .optional()
    .nullable(),
});