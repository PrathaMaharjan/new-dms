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


  if (role !== "manager") {
    const ownFolder =
      role === "owner" ? "organization" : role === "clinical" ? "doctor" : role === "front_office" ? "frontdesk" : "";
    redirect(ownFolder ? `/t/${tenantSlug}/${ownFolder}` : "/login");
  }

  const orgResult = await resolveOrgBySlug(tenantSlug);
  const inventoryEnabled = orgResult.success ? orgResult.org.inventoryEnabled : false;
  const logoUrl = orgResult.success ? orgResult.org.photoUrl : null;
  const tenantName = orgResult.success ? orgResult.org.name : undefined;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar inventoryEnabled={inventoryEnabled} logoUrl={logoUrl} tenantName={tenantName} />
      <main className="flex-1 min-w-0 bg-slate-50">{children}</main>
    </div>
  );
}