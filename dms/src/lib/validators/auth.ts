import { treatmentCategoryEnum } from "@/db/schema";
import { z } from "zod";
// import {enum} from ""
const emailSchema = z.string().email();

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or phone is required")
    .refine(
      (value) =>
        value.includes("@") ? emailSchema.safeParse(value).success : true,
      { message: "Please enter a valid email address" },
    ),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const patientSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dob: z.string().optional(),
  phone: z.string(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
});

export type PatientInput = z.infer<typeof patientSchema>;

export const bookAppointmentSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  locationId: z.string().uuid("Missing location"),
  appointmentTypeId: z.string().uuid("Please select a service"),
  providerId: z.string().uuid("Please select a dentist"),
  preferredDate: z.string().min(1, "Please pick a date"),
  preferredTime: z.string().min(1, "Please pick a time"),
  notes: z.string().optional(),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

