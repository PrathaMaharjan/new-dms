import z from "zod";

export const serviceSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  name: z.string().min(1, "Service name is required"),
  durationMinutes: z
    .number()
    .int("Duration must be a whole number")
    .positive("Duration must be greater than 0")
    .max(480, "Duration seems too long - please double check"),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const updateServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").optional(),
  durationMinutes: z
    .number()
    .int("Duration must be a whole number")
    .positive("Duration must be greater than 0")
    .max(480, "Duration seems too long - please double check")
    .optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
