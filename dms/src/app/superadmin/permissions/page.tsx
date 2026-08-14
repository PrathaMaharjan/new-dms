"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Search, Building2, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";

type OrganizationPermission = {
    id: string;
    orgId: string;
    name: string;
    slug: string;
    hasInventory: boolean;
};

type ApiOrgRow = {
    id: string;
    name?: string;
    slug?: string;
    inventoryEnabled?: boolean;
};

export default function PermissionsPage() {
    const [orgs, setOrgs] = useState<OrganizationPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    async function loadOrganizations() {
        try {
            setLoading(true);
            setErrorMsg(null);
            const res = await axios.get("/api/superadmin/orgnization", {
                params: { limit: 100 },
            }).catch(() => null);

            if (res?.data?.success && Array.isArray(res.data.data?.organizations)) {
                const mapped: OrganizationPermission[] = (res.data.data.organizations as ApiOrgRow[]).map(
                    (o, idx) => ({
                        id: o.id,
                        orgId: `ORG-${String(o.id ?? idx).slice(-6).toUpperCase()}`,
                        name: o.name ?? "Organization",
                        slug: o.slug ?? "-",
                        hasInventory: o.inventoryEnabled ?? true,
                    })
                );
                setOrgs(mapped);
            } else {
                setOrgs([]);
            }
        } catch (err: unknown) {
            console.error("Failed to load organizations for permissions:", err);
            if (axios.isAxiosError(err)) {
                setErrorMsg(err.response?.data?.error ?? "Failed to load organizations.");
            } else {
                setErrorMsg("Failed to load organizations.");
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        queueMicrotask(() => {
            void loadOrganizations();
        });
    }, []);

    async function toggleInventory(id: string, currentStatus: boolean) {
        const nextStatus = !currentStatus;
        setErrorMsg(null);

        // Optimistically update state
        setOrgs((prev) =>
            prev.map((org) =>
                org.id === id ? { ...org, hasInventory: nextStatus } : org
            )
        );

        try {
            const res = await axios.patch(`/api/superadmin/orgnization/${id}`, {
                inventoryEnabled: nextStatus,
            });

            if (!res.data?.success) {
                // Revert on failure
                setOrgs((prev) =>
                    prev.map((org) =>
                        org.id === id ? { ...org, hasInventory: currentStatus } : org
                    )
                );
                setErrorMsg(res.data?.error ?? "Failed to update inventory permission.");
            }
        } catch (err: unknown) {
            console.error("Failed to toggle inventory permission:", err);
            // Revert on error
            setOrgs((prev) =>
                prev.map((org) =>
                    org.id === id ? { ...org, hasInventory: currentStatus } : org
                )
            );

            if (axios.isAxiosError(err)) {
                setErrorMsg(err.response?.data?.error ?? "Failed to update inventory permission.");
            } else {
                setErrorMsg("Failed to update inventory permission.");
            }
        }
    }

    const filteredOrgs = useMemo(() => {
        const q = query.trim().toLowerCase();
        return orgs.filter((org) => !q || org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q));
    }, [orgs, query]);

    const totalPages = Math.max(1, Math.ceil(filteredOrgs.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrgs = filteredOrgs.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                        Permissions
                    </h1>
                    <button
                        onClick={() => void loadOrganizations()}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
                    >
                        <RefreshCw className="h-3.5 w-3.5 text-[#7da3b3]" /> Refresh
                    </button>
                </div>
            </div>

            <div className="relative mx-auto max-w-7xl px-6 pb-10 pt-6 lg:px-10">
                {errorMsg && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    {/* Controls / Search */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                strokeWidth={2}
                            />
                            <input
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search organization..."
                                className="w-64 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                                    <th className="px-6 py-3.5 font-medium">Organization</th>
                                    <th className="px-6 py-3.5 text-right font-medium">
                                        Inventory Module
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/5 bg-white">
                                {loading && (
                                    <tr>
                                        <td colSpan={2} className="bg-white py-12 text-center text-slate-500">
                                            Loading permissions...
                                        </td>
                                    </tr>
                                )}

                                {!loading && paginatedOrgs.map((org) => (
                                    <tr key={org.id} className="transition-colors hover:bg-slate-50/60">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#7da3b3]/15 text-[#345263]">
                                                    <Building2 className="h-4 w-4" strokeWidth={2} />
                                                </div>
                                                <div>
                                                    <p className="text-[0.9rem] font-semibold text-slate-900">
                                                        {org.name}
                                                    </p>
                                                    <p className="text-[0.75rem] text-slate-400">/{org.slug}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() => toggleInventory(org.id, org.hasInventory)}
                                                aria-label={`Toggle inventory for ${org.name}`}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${org.hasInventory ? "bg-[#7da3b3]" : "bg-slate-200"
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${org.hasInventory ? "translate-x-6" : "translate-x-1"
                                                        }`}
                                                />
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {!loading && filteredOrgs.length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="bg-white py-12 text-center text-slate-500">
                                            No organizations found matching "{query}".
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && filteredOrgs.length > 0 && (
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
                            <span className="text-[0.7rem] font-medium text-slate-500">
                                Showing{" "}
                                <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                                <strong className="text-slate-800">
                                    {Math.min(startIndex + itemsPerPage, filteredOrgs.length)}
                                </strong>{" "}
                                of <strong className="text-slate-800">{filteredOrgs.length}</strong> organizations
                            </span>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${currentPage === pageNum
                                            ? "bg-[#7da3b3] text-white shadow-sm"
                                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}