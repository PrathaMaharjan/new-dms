import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { getSession } from "@/lib/auth/get-session";
import { getRedirectPathForUser } from "@/lib/auth/role-redirect";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, session.orgId),
  });

  if (!org || org.slug !== tenantSlug) {
    const correctPath = org ? await getRedirectPathForUser(session.userId, org.slug) : null;
    redirect(correctPath ?? "/login");
  }

  return <>{children}</>;
}