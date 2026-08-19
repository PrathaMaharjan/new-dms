import { redirect } from "next/navigation";
import { resolveOrgBySlug } from "@/lib/public/resolve-org";
import OrgSidebar from "./components/OrgSidebar";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const orgResult = await resolveOrgBySlug(tenantSlug);
  if (!orgResult.success) redirect("/login");

  const inventoryEnabled = orgResult.org.inventoryEnabled;
  const logoUrl = orgResult.org.photoUrl;
  const tenantName = orgResult.org.name;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <OrgSidebar inventoryEnabled={inventoryEnabled} logoUrl={logoUrl} tenantName={tenantName} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}