import { SuperAdminAccessTokenPayload, verifySuperAdminAccessToken } from "@/controller/superadmin/auth/controller";
import { cookies } from "next/headers";

export class SuperAdminSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuperAdminSessionError";
  }
}

// Deliberately NO database round trip here - JWT verification alone.
// Fast, but means deactivating a superadmin takes effect on their next
// token refresh, not instantly. A real, named tradeoff, not an oversight.
export async function requireSuperAdminSession(): Promise<SuperAdminAccessTokenPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("platform_admin_access_token")?.value;

  if (!token) {
    throw new SuperAdminSessionError("You must be logged in as a superadmin.");
  }

  try {
    return verifySuperAdminAccessToken(token);
  } catch {
    throw new SuperAdminSessionError("Your session has expired. Please log in again.");
  }
}