import { z } from "zod";

export const createDoctorSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor"]).optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

export const updateDoctorSchema = z.object({
  name: z.string().min(1, "Full name is required").optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z.string().optional(),
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
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor"]).optional(),
});

export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

export const updateScheduleSchema = z.object({
  locationId: z.string().uuid("Missing or invalid location"),
  schedule: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      isOnLeave: z.boolean().default(false),
      // Required only when NOT on leave - a day marked as leave doesn't
      // need real hours at all.
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    }).refine(
      (day) => day.isOnLeave || (day.startTime && day.endTime),
      { message: "Start and end time are required for a working day" }
    )
  ),
});
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;







