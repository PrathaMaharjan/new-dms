import { db } from "@/db";
import { patients } from "@/db/schema";
import {
  PatientSessionError,
  requirePatientSession,
} from "@/lib/auth/get-patient-seesion";
import { updateProfileSchema } from "@/lib/validators/patent-portal";
import { and, eq } from "drizzle-orm";
import z from "zod";

export type UpdateProfileResult =
  | { success: true }
  | { success: false; error: string };

export async function updateMyProfile(
  input: unknown,
): Promise<UpdateProfileResult> {
  try {
    const session = await requirePatientSession();

    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }
    const data = parsed.data;
    const dataToUpdate = Object.fromEntries(
      Object.entries(parsed.data).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(dataToUpdate).length === 0) {
      return { success: false, error: "No fields to update." };
    }
    if (Object.keys(data).length === 0) {
      return { success: false, error: "No fields to update." };
    }
    await db
      .update(patients)
      .set(dataToUpdate)
      .where(eq(patients.id, session.patientId));
    return { success: true };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating your profile.",
    };
  }
}

export const updateEmailSchema = z.object({
  newEmail: z.string().email("Please enter a valid email address"),
});

export type UpdateEmailResult = { success: true } | { success: false; error: string };

export async function updateMyEmail(input: unknown): Promise<UpdateEmailResult> {
  try {
    const session = await requirePatientSession();

    const parsed = updateEmailSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    const { newEmail } = parsed.data;
    const existing = await db.query.patients.findFirst({
      where: and(eq(patients.email, newEmail), eq(patients.orgId, session.orgId)),
    });
    if (existing && existing.id !== session.patientId) {
      return { success: false, error: "This email is already associated with another patient record." };
    }

    await db.update(patients).set({ email: newEmail }).where(eq(patients.id, session.patientId));
    return { success: true };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating your email." };
  }
}