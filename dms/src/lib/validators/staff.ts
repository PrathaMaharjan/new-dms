import { z } from "zod";

export const createStaffSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  name: z.string().min(1, "Full name is required"),
  role: z.enum(["manager","front_office"]),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  photoKey: z.string().optional(),
  shift: z.enum(["morning", "afternoon", "night"]).optional(),
  joinDate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().min(1, "Full name is required").optional(),
  role: z.enum(["manager", "clinical", "front_office"]).optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z.string().optional(),
  photoKey: z.string().optional(),
  shift: z.enum(["morning", "afternoon", "night"]).optional(),
  joinDate: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;