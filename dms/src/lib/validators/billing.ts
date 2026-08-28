import { z } from "zod";

export const addLedgerEntrySchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  treatmentId: z.string().uuid().optional(), // ADDED
  type: z.enum(["charge", "payment", "adjustment"]),
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(["cash", "card", "online"]).optional(),
  note: z.string().optional(),
});

export type AddLedgerEntryInput = z.infer<typeof addLedgerEntrySchema>;