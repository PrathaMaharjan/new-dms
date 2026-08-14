import { z } from "zod";

export const patientSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  age: z.number().optional(),
  dob: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  gender: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  assignedDoctorId: z.string().uuid("Please select a valid doctor").optional(),
  // These three don't map to columns on `patients` - the controller routes
  // them into patient_medical_records instead, one row per line/item.
  allergies: z.array(z.string()).optional(),
  medicalHistory: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
});

export type PatientInput = z.infer<typeof patientSchema>;

export const updatePatientSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  age: z.number().optional(),
  dob: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  gender: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  treatmentCompleted: z.boolean().optional(),
  assignedDoctorId: z.string().uuid("Please select a valid doctor").optional(),
  allergies: z.array(z.string()).optional(),
  medicalHistory: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;