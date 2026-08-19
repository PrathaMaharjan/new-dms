import { requireSession, SessionError } from "@/lib/auth/get-session";
import { OrganizationErrorCode, requireOwner } from "../inventory/org/controller";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateWorkloadThresholdsSchema } from "@/lib/validators/workload";

export type WorkloadThresholdsResult =
  | { success: true; workloadHealthyMax: number; workloadBusyMax: number }
  | { success: false; error: string; code: OrganizationErrorCode };

  export async function getWorkloadThresholds(): Promise<WorkloadThresholdsResult> {
  try {
    const session = await requireSession();

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, session.orgId),
      columns: { workloadHealthyMax: true, workloadBusyMax: true },
    });

    if (!org) {
      return { success: false, error: "Organization not found.", code: "NOT_FOUND" };
    }

    return { success: true, workloadHealthyMax: org.workloadHealthyMax, workloadBusyMax: org.workloadBusyMax };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading workload thresholds.", code: "SERVER_ERROR" };
  }
}

export type UpdateWorkloadThresholdsResult =
  | { success: true; workloadHealthyMax: number; workloadBusyMax: number }
  | { success: false; error: string; code: OrganizationErrorCode };

  export async function updateWorkloadThresholds(input: unknown): Promise<UpdateWorkloadThresholdsResult> {
  try {
    const session = await requireSession();

    if (!(await requireOwner(session.userId))) {
      return { success: false, error: "Only the organization owner can change this setting.", code: "FORBIDDEN" };
    }

    const parsed = updateWorkloadThresholdsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "UNAUTHORIZED" };
    }

    const [updated] = await db
      .update(organizations)
      .set({ workloadHealthyMax: parsed.data.workloadHealthyMax, workloadBusyMax: parsed.data.workloadBusyMax })
      .where(eq(organizations.id, session.orgId))
      .returning({ workloadHealthyMax: organizations.workloadHealthyMax, workloadBusyMax: organizations.workloadBusyMax });

    return { success: true, ...updated };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating workload thresholds.", code: "SERVER_ERROR" };
  }
}