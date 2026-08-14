import z from "zod";

export const saveClinicalEntrySchema = z.object({
  appointmentId: z.string().uuid("Please select a service/procedure"),
  noteText: z.string().optional(),
  prescription: z.string().optional(),
  allergy: z.string().optional(),
  medicalHistory: z.string().optional(),
});
