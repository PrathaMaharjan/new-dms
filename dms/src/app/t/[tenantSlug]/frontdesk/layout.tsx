import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getPrimaryRoleForUser } from "@/lib/auth/role-redirect";

export default async function FrontdeskLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const role = await getPrimaryRoleForUser(session.userId);
  if (role !== "front_office") {
    const ownFolder = role === "owner" ? "admin" : role === "clinical" ? "doctor" : "";
    redirect(ownFolder ? `/t/${tenantSlug}/${ownFolder}` : "/login");
  }

  return <>{children}</>;
}