import { z } from "zod";

export const addLedgerEntrySchema = z.object({
  patientId: z.string().uuid("Missing patient"),
  locationId: z.string().uuid("Missing location"),
  type: z.enum(["charge", "payment", "adjustment"]),
  amountCents: z.number().int().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "card", "online"]).optional(),
  appointmentId: z.string().uuid().optional(),
  note: z.string().optional(),
});

export type AddLedgerEntryInput = z.infer<typeof addLedgerEntrySchema>;