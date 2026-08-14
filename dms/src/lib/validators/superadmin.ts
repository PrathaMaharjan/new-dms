import { z } from "zod";

export const platformAdminLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createOrganizationWithOwnerSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1).optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  photoKey: z.string().optional(),
  password:z.string().min(8,"password must large"),
  status: z.enum(["active", "suspended", "cancelled"]).optional(),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerEmail: z.string().email("Please enter a valid owner email"),
  ownerPhone: z.string().optional(),
});

export const updateOrganizationStatusSchema = z.object({
  status: z.enum(["active", "suspended", "cancelled"]),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  photoKey: z.string().optional(),
  status: z.enum(["active", "suspended", "cancelled"]).optional(),
  inventoryEnabled: z.boolean().optional(),
  ownerName: z.string().min(1).optional(),
  ownerEmail: z.string().email("Please enter a valid owner email").optional(),
  ownerPhone: z.string().optional(),
});

export const updateSuperAdminDetailsSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z.string().optional(),
});

export const superAdminChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });