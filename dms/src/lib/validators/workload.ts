import z from "zod";

export const updateWorkloadThresholdsSchema = z
  .object({
    workloadHealthyMax: z.number().int().positive(),
    workloadBusyMax: z.number().int().positive(),
  })
  .refine((data) => data.workloadBusyMax > data.workloadHealthyMax, {
    message: "Busy threshold must be greater than the healthy threshold",
    path: ["workloadBusyMax"],
  });