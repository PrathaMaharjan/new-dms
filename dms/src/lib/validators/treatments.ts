import { z } from "zod";


export const createTreatmentSchema = z
  .object({
    locationId: z.string().uuid("Missing or invalid location"),
    name: z.string().min(1, "Treatment name is required"),
    category: z.enum([
      "preventive",
      "restorative",
      "cosmetic",
      "surgical",
      "orthodontic",
      "periodontic",
      "endodontic",
      "pediatric",
    ]),
    durationMinutes: z.number().int().positive(),
    priceCents: z.number().int().nonnegative(),
    sessions: z.number().int().positive().optional(),
    anesthesia: z.enum(["none", "local", "sedation", "general"]).optional(),
    recoveryTime: z.string().optional(),
    description: z.string().optional(),
    procedureSteps: z.array(z.string()).optional(),
    aftercareInstructions: z.array(z.string()).optional(),
    hasNoSupplies: z.boolean(),
    supplies: z
      .array(
        z.object({
          itemId: z.string().uuid("Invalid item"),
          quantityRequired: z.number().int().positive("Quantity must be at least 1"),
        })
      )
      .optional(),
  })
  .refine((data) => data.hasNoSupplies || (data.supplies && data.supplies.length > 0), {
    message: "Please add at least one supply, or confirm this treatment needs none.",
    path: ["supplies"],
  });

export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;


export const updateTreatmentSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["preventive", "restorative", "cosmetic", "surgical", "orthodontic", "periodontic", "endodontic", "pediatric"]).optional(),

  durationMinutes: z.number().int().positive().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  sessions: z.number().int().positive().optional(),
  anesthesia: z.enum(["none", "local", "sedation", "general"]).optional(),
  recoveryTime: z.string().optional(),
  description: z.string().optional(),
  procedureSteps: z.array(z.string()).optional(),
  aftercareInstructions: z.array(z.string()).optional(),

  // Both optional here, unlike createTreatmentSchema - an update can
  // legitimately touch OTHER fields (price, duration) without saying
  // anything about supplies at all.
  hasNoSupplies: z.boolean().optional(),
  supplies: z
    .array(z.object({ itemId: z.string().uuid(), quantityRequired: z.number().int().positive() }))
    .optional(),
});