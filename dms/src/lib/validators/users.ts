import { z } from "zod";
import { optionalPhoneSchema } from "./phone";

export const updateMyDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: optionalPhoneSchema,
  photoKey: z.string().optional(),
});

export type UpdateMyDetailsInput = z.infer<typeof updateMyDetailsSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;


export const updateDoctorSchema = z.object({
  name: z.string().min(1, "Full name is required").optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: optionalPhoneSchema,
  photoKey: z.string().optional(),
  
  specialization: z
    .enum([
      "general_dentistry",
      "orthodontics",
      "endodontics",
      "periodontics",
      "oral_surgery",
      "pediatric_dentistry",
      "prosthodontics",
    ])
    .optional(),
  qualification: z.string().optional(),
  education: z.string().optional(),
  bio: z.string().optional(),
  yearsOfExperience: z.number().int().nonnegative().optional(),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor"]).optional(),
});

export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;


