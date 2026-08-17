import z from "zod";

export const bookPublicAppointmentSchema = z.object({
  tenantSlug: z.string().min(1, "Missing clinic identifier"), // required, no silent fallback
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  locationId: z.string().uuid("Missing location"),
  treatmentId: z.string().uuid("Please select a treatment"),
  preferredDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: "Please enter a valid date" }),
  preferredTime: z.string().min(1, "Please pick a time"),
  notes: z.string().optional(),
});