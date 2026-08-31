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