import z from "zod";

export const requestPatientCodeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  organizationName: z.string().min(1, "Please enter your clinic's name"),
});

export const verifyPatientCodeSchema = z.object({
  email: z.string().email(),
  organizationName: z.string().min(1),
  code: z.string().length(6, "Please enter the 6-digit code"),
});


export const updateProfileSchema = z.object({
  firstName: z.string().min(3),
  lastName: z.string().min(1),
  phone: z.string().min(7, "Please enter a valid phone number").optional(),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
});

export const requestEmailChangeSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
});