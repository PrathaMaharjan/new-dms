"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Search,
    Plus,
    X,
    Check,
    Trash2,
    SquarePen,
    ChevronLeft,
    ChevronRight,
    Stethoscope,
    Syringe,
    HeartPulse,
    Cross,
    Pill,
    Activity,
    ClipboardList,
    Boxes,
    Tag,
    AlertTriangle,
    BookOpen,
    Filter,
    MapPin,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

interface Service {
    id: string;
    name: string;
    price: number;
    categoryName?: string;
}

interface Material {
    id: string;
    name: string;
    unit: "g" | "kg" | "ml" | "L" | "pieces" | "boxes";
}

interface RecipeItem {
    materialId: string;
    quantity: number;
}

interface Recipe {
    serviceId: string;
    items: RecipeItem[];
}

interface RecipeItemDraft {
    materialId: string;
    quantity: string;
}

const RECIPES_STORAGE_KEY = "dms_service_recipes_v1";
const SOFT_DELETED_INVENTORY_KEY = "dms_soft_deleted_inventory_item_ids_v1";

function getSoftDeletedInventoryIds(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = localStorage.getItem(SOFT_DELETED_INVENTORY_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function getStoredRecipes(): Record<string, Recipe | null> {
    if (typeof window === "undefined") return {};
    try {
        const item = localStorage.getItem(RECIPES_STORAGE_KEY);
        return item ? JSON.parse(item) : {};
    } catch {
        return {};
    }
}

function setStoredRecipes(recipes: Record<string, Recipe | null>) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
    } catch { }
}

export default function ServiceRecipePage() {
    const [services, setServices] = useState<Service[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [recipesMap, setRecipesMap] = useState<Record<string, Recipe | null>>({});

    const [outletFilter, setOutletFilter] = useState("all");
    const [outletsList, setOutletsList] = useState<{ id: string; name: string }[]>([
        { id: "all", name: "All outlets" },
    ]);

    const activeLocationId = useMemo(() => {
        if (outletFilter !== "all" && outletFilter) return outletFilter;
        const firstLoc = outletsList.find((o) => o.id !== "all");
        return firstLoc ? firstLoc.id : undefined;
    }, [outletFilter, outletsList]);

    useEffect(() => {
        async function fetchOutlets() {
            try {
                const res = await axios.get("/api/outlets");
                if (res.data?.success && res.data.data?.locations) {
                    const seen = new Set<string>();
                    const mapped: { id: string; name: string }[] = [];
                    res.data.data.locations.forEach((l: any) => {
                        if (l.id && !seen.has(l.id)) {
                            seen.add(l.id);
                            mapped.push({ id: l.id, name: l.name });
                        }
                    });
                    setOutletsList([{ id: "all", name: "All outlets" }, ...mapped]);
                }
            } catch (err) { }
        }
        fetchOutlets();
    }, []);

    useEffect(() => {
        async function fetchRecipesData() {
            try {
                const treatParam = outletFilter !== "all" && outletFilter ? `?locationId=${outletFilter}` : "";
                const itemParam = activeLocationId ? `?locationId=${activeLocationId}` : "";

                const [treatRes, itemRes] = await Promise.all([
                    axios.get(`/api/treatment${treatParam}`).catch(() => null),
                    itemParam ? axios.get(`/api/inventory/item${itemParam}`).catch(() => null) : null,
                ]);

                const localSaved = getStoredRecipes();
                const mergedRecipes: Record<string, Recipe | null> = { ...localSaved };

                if (treatRes?.data?.success && Array.isArray(treatRes.data.data?.treatments)) {
                    const fetchedServices: Service[] = treatRes.data.data.treatments.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        price: Math.round((t.priceCents ?? 0) / 100),
                        categoryName: t.category,
                    }));
                    setServices(fetchedServices);

                    treatRes.data.data.treatments.forEach((t: any) => {
                        if (!(t.id in localSaved)) {
                            if (t.supplies && Array.isArray(t.supplies) && t.supplies.length > 0) {
                                mergedRecipes[t.id] = {
                                    serviceId: t.id,
                                    items: t.supplies.map((s: any) => ({
                                        materialId: s.itemId,
                                        quantity: s.quantityRequired,
                                    })),
                                };
                            } else {
                                mergedRecipes[t.id] = null;
                            }
                        }
                    });
                }
                setRecipesMap(mergedRecipes);

                if (itemRes?.data?.success && Array.isArray(itemRes.data.data?.items)) {
                    const deletedIds = getSoftDeletedInventoryIds();
                    const fetchedMaterials: Material[] = itemRes.data.data.items
                        .filter((it: any) => !deletedIds.has(it.id))
                        .map((it: any) => ({
                            id: it.id,
                            name: it.name,
                            unit: it.unit || "pieces",
                        }));
                    setMaterials(fetchedMaterials);
                }
            } catch (err) {
                console.error("Failed to load service recipes data:", err);
            }
        }
        fetchRecipesData();
    }, [outletFilter, activeLocationId]);

    const [query, setQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "configured" | "not_configured">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [formItems, setFormItems] = useState<RecipeItemDraft[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

    const hasExistingRecipe = useMemo(() => {
        if (!selectedServiceId) return false;
        const rec = recipesMap[selectedServiceId];
        return Boolean(rec && rec.items && rec.items.length > 0);
    }, [recipesMap, selectedServiceId]);

    const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

    function getMaterial(id: string) {
        return materials.find((m) => m.id === id);
    }

    function getAvailableMaterials(currentIndex: number) {
        const chosen = formItems
            .map((item, idx) => (idx !== currentIndex ? item.materialId : ""))
            .filter(Boolean);
        return materials.filter((m) => !chosen.includes(m.id));
    }

    function openPanel(service: Service) {
        setSelectedServiceId(service.id);
        const existing = recipesMap[service.id];
        if (existing && existing.items && existing.items.length > 0) {
            setFormItems(existing.items.map((i) => ({ materialId: i.materialId, quantity: String(i.quantity) })));
        } else {
            setFormItems([{ materialId: "", quantity: "" }]);
        }
        setSaveError(null);
        setPanelOpen(true);
    }

    function closePanel() {
        setPanelOpen(false);
        setSelectedServiceId(null);
        setFormItems([]);
        setSaveError(null);
    }

    function handleAddRow() {
        setFormItems([...formItems, { materialId: "", quantity: "" }]);
    }

    function handleRemoveRow(index: number) {
        const updated = [...formItems];
        updated.splice(index, 1);
        setFormItems(updated);
    }

    function handleRowChange(index: number, field: keyof RecipeItemDraft, value: string) {
        const updated = [...formItems];
        updated[index] = { ...updated[index], [field]: value };
        setFormItems(updated);
        setSaveError(null);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedServiceId) return;

        const cleaned = formItems.filter((i) => i.materialId && i.quantity);
        if (cleaned.length === 0) {
            setSaveError("Recipe must have at least one material configured.");
            return;
        }
        const invalid = cleaned.some(
            (i) => !i.materialId || isNaN(Number(i.quantity)) || Number(i.quantity) <= 0
        );
        if (invalid) {
            setSaveError("Ensure every material is selected and has a valid quantity greater than 0.");
            return;
        }

        const recipe: Recipe = {
            serviceId: selectedServiceId,
            items: cleaned.map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity) })),
        };

        setRecipesMap((prev) => {
            const updated = { ...prev, [selectedServiceId]: recipe };
            setStoredRecipes(updated);
            return updated;
        });

        try {
            const suppliesPayload = cleaned.map((i) => ({
                itemId: i.materialId,
                quantityRequired: Math.max(1, Math.round(Number(i.quantity))),
            }));
            await axios.patch(`/api/treatment/${selectedServiceId}`, {
                supplies: suppliesPayload,
                hasNoSupplies: false,
            });
        } catch (err) {
            console.warn("Backend treatment patch warning:", err);
        }

        closePanel();
    }

    function triggerDeleteFromPanel() {
        if (!selectedService) return;
        const svc = selectedService;
        closePanel();
        setDeleteTarget(svc);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;

        setRecipesMap((prev) => {
            const copy = { ...prev };
            copy[deleteTarget.id] = null;
            setStoredRecipes(copy);
            return copy;
        });

        try {
            await axios.patch(`/api/treatment/${deleteTarget.id}`, {
                supplies: [],
                hasNoSupplies: true,
            });
        } catch (err) {
            console.warn("Backend treatment patch wipe warning:", err);
        }

        setDeleteTarget(null);
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return services.filter((s) => {
            const matchesQuery = !q || s.name.toLowerCase().includes(q);
            const rec = recipesMap[s.id];
            const hasRecipe = Boolean(rec && rec.items && rec.items.length > 0);
            if (filterType === "configured" && !hasRecipe) return false;
            if (filterType === "not_configured" && hasRecipe) return false;
            return matchesQuery;
        });
    }, [services, query, filterType, recipesMap]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

    const stats = useMemo(() => {
        const configured = services.filter((s) => {
            const rec = recipesMap[s.id];
            return Boolean(rec && rec.items && rec.items.length > 0);
        }).length;
        return [
            { icon: BookOpen, label: "Total Services", value: String(services.length) },
            { icon: Check, label: "Configured", value: String(configured) },
            { icon: AlertTriangle, label: "Needs Recipe", value: String(services.length - configured) },
        ];
    }, [services, recipesMap]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50">


            <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                        Service Recipes
                    </h1>
                </div>
            </div>

            <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
                {/* Stats */}
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                    {stats.map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                            <div className="flex items-start justify-between">
                                <p className="text-[0.85rem] font-medium text-slate-500">{stat.label}</p>
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                    <stat.icon className="h-4 w-4" strokeWidth={2} />
                                </div>
                            </div>
                            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</p>
                        </div>
                    ))}
                </div>


                <div className="mt-10 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                            <input
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search services..."
                                className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                            />
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Filter className="h-4 w-4 text-slate-400" strokeWidth={2} />
                            {(
                                [
                                    { id: "all", label: "All Services" },
                                    { id: "configured", label: "Configured" },
                                    { id: "not_configured", label: "Needs Recipe" },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setFilterType(tab.id);
                                        setCurrentPage(1);
                                    }}
                                    className={`rounded-full px-3.5 py-2 text-[0.8rem] font-semibold transition-colors ${filterType === tab.id
                                        ? "bg-[#7da3b3] text-white"
                                        : "border border-slate-900/10 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
                        <table className="w-full min-w-[760px] border-collapse text-left">
                            <thead>
                                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3 font-medium">Service</th>
                                    <th className="px-5 py-3 font-medium">Price</th>
                                    <th className="px-5 py-3 font-medium">Materials Mapped</th>
                                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/5 bg-white">
                                {paginated.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="bg-white py-16 text-center text-slate-500">
                                            {services.length === 0
                                                ? "No services recorded yet."
                                                : "No services match your filters."}
                                        </td>
                                    </tr>
                                ) : (
                                    paginated.map((service) => {
                                        const recipe = recipesMap[service.id];
                                        const hasRecipe = recipe !== undefined && recipe !== null;

                                        return (
                                            <tr
                                                key={service.id}
                                                onClick={() => openPanel(service)}
                                                className="cursor-pointer transition-colors hover:bg-[#7da3b3]/[0.06]"
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="text-[0.9rem] font-semibold text-slate-900">{service.name}</p>
                                                    {service.categoryName && (
                                                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-medium text-slate-500">
                                                            <Tag className="h-3 w-3" strokeWidth={2} />
                                                            {service.categoryName}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-[0.85rem] font-medium text-slate-700">
                                                    Rs. {service.price.toLocaleString()}
                                                </td>
                                                <td className="px-5 py-4 text-[0.85rem] text-slate-500">
                                                    {hasRecipe
                                                        ? `${recipe.items.length} material${recipe.items.length !== 1 ? "s" : ""}`
                                                        : "None"}
                                                </td>
                                                <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openPanel(service)}
                                                            aria-label="Configure recipe"
                                                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                                        >
                                                            <SquarePen className="h-4 w-4" strokeWidth={2} />
                                                        </button>
                                                        {hasRecipe && (
                                                            <button
                                                                onClick={() => setDeleteTarget(service)}
                                                                aria-label="Delete recipe"
                                                                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
                                                            >
                                                                <Trash2 className="h-4 w-4" strokeWidth={2} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {filtered.length > 0 && (
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
                            <span className="text-[0.7rem] font-medium text-slate-500">
                                Showing <strong className="text-slate-800">{startIndex + 1}</strong> to{" "}
                                <strong className="text-slate-800">{Math.min(startIndex + itemsPerPage, filtered.length)}</strong>{" "}
                                of <strong className="text-slate-800">{filtered.length}</strong> services
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors ${currentPage === pageNum
                                            ? "bg-[#7da3b3] text-white shadow-sm"
                                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
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

            {/* Recipe configuration side panel */}
            {panelOpen && selectedService && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
                    <div onClick={closePanel} className="absolute inset-0" aria-hidden />
                    <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
                            <button
                                onClick={closePanel}
                                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
                            >
                                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                                Back
                            </button>
                            <h2 className="text-[0.95rem] font-semibold text-slate-900">Configure Recipe</h2>
                        </div>

                        <div className="px-6 py-6">
                            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-900/5 bg-white p-4 shadow-sm">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                    <BookOpen className="h-4.5 w-4.5" strokeWidth={2} />
                                </div>
                                <div>
                                    <p className="text-[0.95rem] font-semibold text-slate-900">{selectedService.name}</p>
                                    <p className="text-[0.8rem] text-slate-500">Rs. {selectedService.price.toLocaleString()}</p>
                                </div>
                            </div>

                            <form onSubmit={handleSave} className="space-y-5">
                                {saveError && (
                                    <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[0.78rem] text-rose-700">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2} />
                                        <span>{saveError}</span>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="grid grid-cols-12 gap-3 px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
                                        <div className="col-span-7">Material Used</div>
                                        <div className="col-span-4">Qty Required</div>
                                        <div className="col-span-1" />
                                    </div>

                                    {formItems.map((item, index) => {
                                        const selectedMaterial = getMaterial(item.materialId);
                                        const unit = selectedMaterial?.unit ?? "";
                                        const available = getAvailableMaterials(index);

                                        return (
                                            <div key={index} className="grid grid-cols-12 items-center gap-3">
                                                <div className="col-span-7">
                                                    <select
                                                        required
                                                        value={item.materialId}
                                                        onChange={(e) => handleRowChange(index, "materialId", e.target.value)}
                                                        className="w-full rounded-xl border border-slate-900/10 bg-white px-3 py-2.5 text-[0.85rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                                                    >
                                                        <option value="" disabled>
                                                            Select material...
                                                        </option>
                                                        {available.map((m) => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.name} ({m.unit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="relative col-span-4 flex items-center">
                                                    <input
                                                        type="number"
                                                        required
                                                        step="any"
                                                        min="0.0001"
                                                        placeholder="0.00"
                                                        value={item.quantity}
                                                        onChange={(e) => handleRowChange(index, "quantity", e.target.value)}
                                                        className="w-full rounded-xl border border-slate-900/10 bg-white py-2.5 pl-3 pr-10 text-[0.85rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                                                    />
                                                    {unit && (
                                                        <span className="pointer-events-none absolute right-3 select-none text-[0.7rem] font-semibold text-slate-400">
                                                            {unit}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="col-span-1 flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRow(index)}
                                                        className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                                                        title="Remove row"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    disabled={formItems.length >= materials.length}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.8rem] font-semibold text-[#3f6274] transition hover:bg-[#7da3b3]/10 disabled:opacity-50"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add Material Row
                                </button>

                                <div className="flex items-center justify-between gap-3 border-t border-slate-900/10 pt-5">
                                    {hasExistingRecipe ? (
                                        <button
                                            type="button"
                                            onClick={triggerDeleteFromPanel}
                                            className="rounded-full border border-rose-200 px-4 py-2.5 text-[0.85rem] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                                        >
                                            Wipe Recipe
                                        </button>
                                    ) : (
                                        <span />
                                    )}
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={closePanel}
                                            className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                                        >
                                            Save Material
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
                    <div onClick={() => setDeleteTarget(null)} className="absolute inset-0" aria-hidden />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                            <Trash2 className="h-5 w-5" strokeWidth={2} />
                        </div>
                        <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">
                            Wipe recipe for {deleteTarget.name}?
                        </h3>
                        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-slate-500">
                            This removes all material mappings for this service. You can reconfigure it anytime.
                        </p>
                        <div className="mt-6 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={confirmDelete}
                                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600"
                            >
                                Wipe Recipe
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 rounded-full border border-slate-900/10 px-4 py-2.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}