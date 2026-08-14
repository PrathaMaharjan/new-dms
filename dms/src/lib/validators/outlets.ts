import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().min(1, "Outlet name is required").optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  timezone: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  // notes: z.string().optional(),
  isActive: z.boolean().optional(),
  managerId: z.string().optional().nullable(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema.partial();

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;