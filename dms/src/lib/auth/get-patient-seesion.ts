import { cookies } from "next/headers";
import { PatientAccessTokenPayload, verifyPatientAccessToken } from "./patient-tokens";

export class PatientSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatientSessionError";
  }
}

export async function requirePatientSession(): Promise<PatientAccessTokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("patient_access_token")?.value;

  if (!token) {
    throw new PatientSessionError("You must be logged in to access this.");
  }

  try {
    return verifyPatientAccessToken(token);
  } catch {
    throw new PatientSessionError("Your session has expired. Please log in again.");
  }
}