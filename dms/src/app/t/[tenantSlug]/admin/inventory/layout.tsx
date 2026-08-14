import { redirect } from "next/navigation";
import { resolveOrgBySlug } from "@/lib/public/resolve-org";

export default async function AdminInventoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const orgResult = await resolveOrgBySlug(tenantSlug);

  // If org not found or inventory is disabled, redirect to admin dashboard
  if (!orgResult.success || !orgResult.org.inventoryEnabled) {
    redirect(`/t/${tenantSlug}/admin`);
  }

  return <>{children}</>;
}
