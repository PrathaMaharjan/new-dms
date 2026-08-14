import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  name: z.string().min(1, "Category name is required"),
});

export const createExpenseSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  categoryId: z.string().uuid("Missing or invalid category"),
  amountCents: z.number().int().positive("Amount must be greater than 0"),
  description: z.string().optional(),
   expenseNote: z.string().optional(),
  expenseDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: "Please enter a valid date" }),
});

export const updateExpenseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amountCents: z.number().int().positive().optional(),
  description: z.string().optional(),
   expenseNote: z.string().optional(),
  expenseDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: "Please enter a valid date" }).optional(),
});