// src/lib/validators/appointments.ts
import { z } from "zod";

export const bookAppointmentSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  dob: z.string().optional(),
  locationId: z.string().uuid("Missing location"),
  treatmentId: z.string().uuid("Please select a treatment"),
  providerId: z.string().uuid("Please select a dentist").optional(),
  preferredDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
    message: "Please enter a valid date",
  }),
  preferredTime: z.string().min(1, "Please pick a time"),
  notes: z.string().optional(),
  source: z.enum(["staff", "online_booking"]),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export const assignAppointmentSchema = z.object({
  patientId: z.string().uuid("Please select a patient"),
  locationId: z.string().uuid("Missing or invalid location"),
  treatmentId: z.string().uuid("Please select a treatment"),
  providerId: z.string().uuid("Please select a dentist").optional(),
  // preferredDate: z.string().min(1, "Please pick a date"),
  preferredDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
    message: "Please enter a valid date",
  }),
  preferredTime: z.string().min(1, "Please pick a time"),
  notes: z.string().optional(),
});

export type AssignAppointmentInput = z.infer<typeof assignAppointmentSchema>;
