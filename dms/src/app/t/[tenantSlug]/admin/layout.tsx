import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getPrimaryRoleForUser } from "@/lib/auth/role-redirect";
import { resolveOrgBySlug } from "@/lib/public/resolve-org";
import Sidebar from "./components/Sidebar";

export default async function AdminLayout({
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

  // "manager" is the correct role for this folder now - "owner" has its
  // own separate /organization folder instead of sharing this one.
  if (role !== "manager") {
    const ownFolder =
      role === "owner" ? "organization" : role === "clinical" ? "doctor" : role === "front_office" ? "frontdesk" : "";
    redirect(ownFolder ? `/t/${tenantSlug}/${ownFolder}` : "/login");
  }

  const orgResult = await resolveOrgBySlug(tenantSlug);
  const inventoryEnabled = orgResult.success ? orgResult.org.inventoryEnabled : false;

  return (
    <div className="flex">
      <Sidebar inventoryEnabled={inventoryEnabled} />
      <main className="min-h-screen flex-1 bg-slate-50">{children}</main>
    </div>
  );
}