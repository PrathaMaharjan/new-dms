import { z } from "zod";

export const createCategorySchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  name: z.string().min(1, "Category name is required"),
});

export const createInventoryItemSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  name: z.string().min(1, "Item name is required"),
  unit: z.string().min(1, "Unit is required"),
  priceCents: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().optional(),
  reorderThreshold: z.number().int().nonnegative().optional(),
});
export const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  reorderThreshold: z.number().int().nonnegative().optional(),
});

export const addMovementSchema = z.object({
  itemId: z.string().uuid("Missing item"),
  quantity: z.number().int().refine((v) => v !== 0, "Quantity cannot be zero"),
  type: z.enum(["received", "used", "wasted", "adjusted"]),
  note: z.string().optional(),
});
