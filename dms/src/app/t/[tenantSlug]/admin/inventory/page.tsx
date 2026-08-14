"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Search,
  Plus,
  Package,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Stethoscope,
  Syringe,
  HeartPulse,
  Cross,
  Pill,
  Activity,
  Filter,
  ChevronLeft,
  ChevronRight,
  SquarePen,
  IdCard,
  Clock,
  Layers,
  Sliders,
  ClipboardList,
  Tag,
  Trash2,
  History,
  Check,
  X,
  Boxes,
} from "lucide-react";

type StockLevel = "in_stock" | "low_stock" | "out_of_stock";

interface StockCategory {
  id: string;
  name: string;
}

interface Movement {
  id: string;
  type: "purchase" | "wastage" | "adjustment";
  quantity: number;
  note?: string;
  createdAt: string;
  createdByName?: string;
}

interface Material {
  id: string;
  itemId?: string;
  name: string;
  currentStock: number;
  unit: string;
  minStockLevel: number;
  createdAt: string;
  categoryId?: string | null;
  categoryName?: string | null;
  movements: Movement[];
}

const UNCATEGORIZED = "Uncategorized";
const ADD_NEW_VALUE = "__add_new__";

const CATEGORY_COLORS: Record<string, string> = {
  Consumables: "bg-sky-100 text-sky-700",
  "PPE & Safety": "bg-emerald-100 text-emerald-700",
  Anesthetics: "bg-rose-100 text-rose-700",
  "Restorative Materials": "bg-violet-100 text-violet-700",
};

const isValidUuid = (str?: string | null) =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

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

function addSoftDeletedInventoryId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getSoftDeletedInventoryIds();
    current.add(id);
    localStorage.setItem(SOFT_DELETED_INVENTORY_KEY, JSON.stringify(Array.from(current)));
  } catch { }
}

const SEED_CATEGORIES: StockCategory[] = [];
const SEED_MATERIALS: Material[] = [];

const EMPTY_FORM = {
  name: "",
  unit: "boxes" as Material["unit"],
  minStockLevel: "" as number | "",
  categoryId: "" as string,
};

type FormState = typeof EMPTY_FORM;

const inputClass =
  "w-full rounded-xl border border-slate-900/10 bg-white px-3.5 py-2.5 text-[0.9rem] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#7da3b3]";

function getStockLevel(m: Material): StockLevel {
  if (m.currentStock <= 0) return "out_of_stock";
  if (m.minStockLevel > 0 && m.currentStock <= m.minStockLevel) return "low_stock";
  return "in_stock";
}

const STOCK_STYLE: Record<StockLevel, { badge: string; label: string }> = {
  in_stock: { badge: "bg-emerald-100 text-emerald-700", label: "In Stock" },
  low_stock: { badge: "bg-amber-100 text-amber-700", label: "Low Stock" },
  out_of_stock: { badge: "bg-rose-100 text-rose-700", label: "Out of Stock" },
};

function materialToForm(m: Material): FormState {
  return {
    name: m.name,
    unit: m.unit,
    minStockLevel: m.minStockLevel,
    categoryId: m.categoryId ?? "",
  };
}

function formatDateLabel(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InventoryPage() {
  const [materials, setMaterials] = useState<Material[]>(SEED_MATERIALS);
  const [categories, setCategories] = useState<StockCategory[]>(SEED_CATEGORIES);

  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOutlets() {
      try {
        const res = await axios.get("/api/outlets");
        if (res.data?.success && res.data.data?.locations && res.data.data.locations.length > 0) {
          setActiveLocationId(res.data.data.locations[0].id);
        }
      } catch (err) { }
    }
    fetchOutlets();
  }, []);

  useEffect(() => {
    async function fetchInventory() {
      if (!activeLocationId) return;
      try {
        const [catRes, itemRes] = await Promise.all([
          axios.get(`/api/inventory/category?locationId=${activeLocationId}`).catch(() => null),
          axios.get(`/api/inventory/item?locationId=${activeLocationId}`).catch(() => null),
        ]);

        if (catRes?.data?.success && Array.isArray(catRes.data.data?.categories)) {
          const fetchedCats: StockCategory[] = catRes.data.data.categories.map((c: any) => ({
            id: c.id,
            name: c.name,
          }));
          if (fetchedCats.length > 0) {
            setCategories(fetchedCats);
          }
        }

        if (itemRes?.data?.success && Array.isArray(itemRes.data.data?.items)) {
          const deletedIds = getSoftDeletedInventoryIds();
          const fetchedMaterials: Material[] = itemRes.data.data.items
            .filter((it: any) => !deletedIds.has(it.id))
            .map((it: any) => ({
              id: it.id,
              itemId: `INV-${it.id.slice(0, 4).toUpperCase()}`,
              name: it.name,
              currentStock: it.currentStock ?? 0,
              unit: it.unit || "boxes",
              minStockLevel: it.reorderThreshold ?? 0,
              createdAt: new Date().toISOString().slice(0, 10),
              categoryId: it.categoryId ?? null,
              categoryName: it.categoryName ?? null,
              movements: [],
              locationId: activeLocationId,
            }));
          setMaterials(fetchedMaterials);
        }
      } catch (err) {
        console.error("Failed to load inventory data:", err);
      }
    }
    fetchInventory();
  }, [activeLocationId]);

  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"All" | StockLevel>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [unitsList, setUnitsList] = useState<string[]>([
    "boxes",
    "pieces",
    "kg",
    "g",
    "L",
    "ml",
  ]);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState("");

  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [profileTab, setProfileTab] = useState<"detail" | "history">("detail");

  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);

  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingMaterial, setAdjustingMaterial] = useState<Material | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    adjustType: "purchase" as "purchase" | "adjustment",
    quantity: "" as number | "",
    newQuantity: "" as number | "",
    note: "",
  });

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");

  function getMaterialCategory(m: Material): string {
    return m.categoryName ?? UNCATEGORIZED;
  }

  async function addNewCategory() {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    let newCat: StockCategory = { id: `cat-${Date.now()}`, name: trimmed };
    if (activeLocationId) {
      try {
        const res = await axios.post("/api/inventory/category", {
          locationId: activeLocationId,
          name: trimmed,
        });
        if (res.data?.success && res.data.data?.category) {
          newCat = { id: res.data.data.category.id, name: res.data.data.category.name };
        }
      } catch (err) {
        console.error("Failed to create category on server:", err);
      }
    }
    setCategories((prev) => [...prev, newCat]);
    setForm((p) => ({ ...p, categoryId: newCat.id }));
    setNewCategoryInput("");
    setIsAddingCategory(false);
  }

  function openAddModal() {
    setModalMode("add");
    setEditingId(null);
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? "" });
    setIsAddingCategory(false);
    setNewCategoryInput("");
    setModalOpen(true);
  }

  function openEditModal(m: Material) {
    setModalMode("edit");
    setEditingId(m.id);
    setForm(materialToForm(m));
    setIsAddingCategory(false);
    setNewCategoryInput("");
    setModalOpen(true);
  }

  async function openProfile(m: Material) {
    setSelectedMaterial(m);
    setProfileTab("detail");

    if (m.id && !m.id.startsWith("m")) {
      try {
        const res = await axios.get(`/api/inventory/item/${m.id}/movement`);
        if (res.data?.success && Array.isArray(res.data.data?.movements)) {
          const fetchedMovements: Movement[] = res.data.data.movements.map((mv: any) => ({
            id: mv.id,
            type: mv.type === "received" ? "purchase" : mv.type === "adjusted" ? "adjustment" : "wastage",
            quantity: Math.abs(mv.quantity),
            note: mv.note ?? "",
            createdAt: mv.createdAt,
            createdByName: mv.recordedByUserName ?? "System",
          }));
          setSelectedMaterial((prev) => (prev?.id === m.id ? { ...prev, movements: fetchedMovements } : prev));
          setMaterials((prev) => prev.map((item) => (item.id === m.id ? { ...item, movements: fetchedMovements } : item)));
        }
      } catch (err) {
        console.error("Failed to fetch movements history:", err);
      }
    }
  }

  function requestDelete(m: Material) {
    setDeleteTarget(m);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    addSoftDeletedInventoryId(deleteTarget.id);

    const locId = activeLocationId || (deleteTarget as any).locationId;
    if (locId && deleteTarget.id && !deleteTarget.id.startsWith("m")) {
      try {
        await axios.delete(`/api/inventory/item?locationId=${locId}`, {
          params: { id: deleteTarget.id },
        }).catch(() =>
          axios.delete(`/api/inventory/item/${deleteTarget.id}?locationId=${locId}`)
        );
      } catch (err) {
        console.warn("Server delete item attempt:", err);
      }
    }
    setMaterials((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setSelectedMaterial((prev) => (prev?.id === deleteTarget.id ? null : prev));
    setDeleteTarget(null);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const normalized = form.name.trim().toLowerCase();
    const isDuplicate = materials.some(
      (m) => m.name.toLowerCase() === normalized && (!editingId || m.id !== editingId)
    );
    if (isDuplicate) {
      setDuplicateName(form.name.trim());
      setShowDuplicateModal(true);
      return;
    }

    const category = categories.find((c) => c.id === form.categoryId);
    const locId = activeLocationId;

    if (!locId) {
      alert("Please select or create an outlet location before managing inventory.");
      return;
    }

    const payload: any = {
      locationId: locId,
      name: form.name.trim(),
      unit: form.unit,
      reorderThreshold: Number(form.minStockLevel) || 0,
    };
    if (isValidUuid(form.categoryId)) {
      payload.categoryId = form.categoryId;
    }

    if (modalMode === "edit" && editingId) {
      if (isValidUuid(editingId)) {
        try {
          const res = await axios.patch(`/api/inventory/item/${editingId}`, payload);
          if (res.data?.error) {
            alert(res.data.error);
            return;
          }
        } catch (err: any) {
          alert(err.response?.data?.error || "Failed to update item on server.");
          return;
        }
      }
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? {
              ...m,
              name: form.name.trim(),
              unit: form.unit,
              minStockLevel: Number(form.minStockLevel) || 0,
              categoryId: form.categoryId || null,
              categoryName: category?.name ?? null,
            }
            : m
        )
      );
      setSelectedMaterial((prev) =>
        prev && prev.id === editingId
          ? {
            ...prev,
            name: form.name.trim(),
            unit: form.unit,
            minStockLevel: Number(form.minStockLevel) || 0,
            categoryId: form.categoryId || null,
            categoryName: category?.name ?? null,
          }
          : prev
      );
    } else {
      let createdId = String(Date.now());
      try {
        const res = await axios.post("/api/inventory/item", payload);
        if (res.data?.success && res.data.data?.item) {
          createdId = res.data.data.item.id;
        } else if (res.data?.error) {
          alert(res.data.error);
          return;
        }
      } catch (err: any) {
        alert(err.response?.data?.error || "Failed to create item on server.");
        return;
      }

      const newMaterial: Material = {
        id: createdId,
        itemId: `INV-${1000 + materials.length + 1}`,
        name: form.name.trim(),
        unit: form.unit,
        currentStock: 0,
        minStockLevel: Number(form.minStockLevel) || 0,
        createdAt: new Date().toISOString().slice(0, 10),
        categoryId: form.categoryId || null,
        categoryName: category?.name ?? null,
        movements: [],
      };
      setMaterials((prev) => [newMaterial, ...prev]);
      setCurrentPage(1);
    }

    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(false);
  }

  function openAdjust(m: Material) {
    setAdjustingMaterial(m);
    setAdjustForm({ adjustType: "purchase", quantity: "", newQuantity: m.currentStock, note: "" });
    setAdjustModalOpen(true);
  }

  async function handleSaveAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingMaterial) return;

    const isPurchase = adjustForm.adjustType === "purchase";
    const amount = isPurchase ? adjustForm.quantity : adjustForm.newQuantity;
    if (amount === "") return;

    const numericAmount = Number(amount);
    const newStock = isPurchase ? adjustingMaterial.currentStock + numericAmount : numericAmount;

    const locId = activeLocationId || (adjustingMaterial as any).locationId;
    const movementType = isPurchase ? "received" : "adjusted";
    const quantityToSend = isPurchase ? numericAmount : (newStock - adjustingMaterial.currentStock);

    if (locId && quantityToSend !== 0 && !adjustingMaterial.id.startsWith("m")) {
      try {
        await axios.post(`/api/inventory/item/${adjustingMaterial.id}/movement`, {
          locationId: locId,
          type: movementType,
          quantity: quantityToSend,
          note: adjustForm.note.trim() || undefined,
        });
      } catch (err) {
        console.error("Failed to save movement on server:", err);
      }
    }

    const newMovement: Movement = {
      id: `mv-${Date.now()}`,
      type: isPurchase ? "purchase" : "adjustment",
      quantity: isPurchase ? numericAmount : Math.abs(newStock - adjustingMaterial.currentStock),
      note: adjustForm.note.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdByName: "You",
    };

    setMaterials((prev) =>
      prev.map((m) =>
        m.id === adjustingMaterial.id
          ? { ...m, currentStock: newStock, movements: [newMovement, ...(m.movements || [])] }
          : m
      )
    );
    setSelectedMaterial((prev) =>
      prev && prev.id === adjustingMaterial.id
        ? { ...prev, currentStock: newStock, movements: [newMovement, ...(prev.movements || [])] }
        : prev
    );

    setAdjustModalOpen(false);
    setAdjustingMaterial(null);
    setAdjustForm({ adjustType: "purchase", quantity: "", newQuantity: "", note: "" });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => {
      const matchesQuery = !q || m.name.toLowerCase().includes(q);
      const matchesStock = stockFilter === "All" || getStockLevel(m) === stockFilter;
      const matchesCategory =
        categoryFilter === "All" ||
        (categoryFilter === UNCATEGORIZED
          ? !m.categoryId || !m.categoryName
          : m.categoryId === categoryFilter);
      return matchesQuery && matchesStock && matchesCategory;
    });
  }, [materials, query, stockFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMaterials = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const stats = useMemo(() => {
    const inStock = materials.filter((m) => getStockLevel(m) === "in_stock").length;
    const lowStock = materials.filter((m) => getStockLevel(m) === "low_stock").length;
    const outOfStock = materials.filter((m) => getStockLevel(m) === "out_of_stock").length;
    return [
      { icon: Package, label: "Total Items", value: String(materials.length) },
      { icon: PackageCheck, label: "In Stock", value: String(inStock) },
      { icon: AlertTriangle, label: "Low Stock", value: String(lowStock) },
      { icon: PackageX, label: "Out of Stock", value: String(outOfStock) },
    ];
  }, [materials]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">

      <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
          Inventory
        </h1>
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-[0.85rem] font-medium text-slate-500">{stat.label}</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                  <stat.icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search inventory..."
                  className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(e.target.value as "All" | StockLevel);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All stock levels</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              <div className="relative">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                >
                  <option value="All">All categories</option>
                  <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add Item
            </button>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-900/5">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[0.75rem] font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">Threshold</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 bg-white">
                {paginatedMaterials.map((m) => {
                  const stockLevel = getStockLevel(m);
                  const stockStyle = STOCK_STYLE[stockLevel];
                  const category = getMaterialCategory(m);
                  const catColor = CATEGORY_COLORS[category] ?? "bg-slate-100 text-slate-600";

                  return (
                    <tr
                      key={m.id}
                      onClick={() => openProfile(m)}
                      className="cursor-pointer transition-colors hover:bg-[#7da3b3]/[0.06]"
                    >
                      <td className="px-5 py-4 text-[0.9rem] font-semibold text-slate-900">
                        {m.name}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${catColor}`}
                        >
                          <Tag className="h-3 w-3" strokeWidth={2} />
                          {category}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[0.85rem] text-slate-700">
                        <p className="flex items-center gap-1.5">
                          <Boxes className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                          {m.currentStock} {m.unit}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[0.85rem] text-slate-500">
                        &lt; {m.minStockLevel} {m.unit}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${stockStyle.badge}`}
                        >
                          {stockStyle.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAdjust(m);
                            }}
                            aria-label="Adjust stock"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Sliders className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(m);
                            }}
                            aria-label="Edit item"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <SquarePen className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDelete(m);
                            }}
                            aria-label="Delete item"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-500"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="bg-white py-16 text-center text-slate-500">
                      No inventory items match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-xs">
              <span className="text-[0.7rem] text-slate-500 font-medium">
                Showing{" "}
                <strong className="text-slate-800">{startIndex + 1}</strong>{" "}
                to{" "}
                <strong className="text-slate-800">
                  {Math.min(startIndex + itemsPerPage, filtered.length)}
                </strong>{" "}
                of <strong className="text-slate-800">{filtered.length}</strong> items
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
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
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setModalOpen(false)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setModalOpen(false)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <h2 className="text-[0.95rem] font-semibold text-slate-900">
                {modalMode === "edit" ? "Edit Item" : "Add Item"}
              </h2>
            </div>

            <div className="px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Tag className="h-3.5 w-3.5" strokeWidth={2} />
                    Item name
                  </span>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}

                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Layers className="h-3.5 w-3.5" strokeWidth={2} />
                    Category
                  </span>
                  {!isAddingCategory ? (
                    <select
                      value={form.categoryId}
                      onChange={(e) => {
                        if (e.target.value === ADD_NEW_VALUE) {
                          setIsAddingCategory(true);
                        } else {
                          update("categoryId", e.target.value);
                        }
                      }}
                      className={inputClass}
                    >
                      <option value="">{UNCATEGORIZED}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value={ADD_NEW_VALUE}>+ Add New Category</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="New category name"
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addNewCategory();
                          }
                          if (e.key === "Escape") {
                            setIsAddingCategory(false);
                            setNewCategoryInput("");
                          }
                        }}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={addNewCategory}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7da3b3] text-white transition-colors hover:bg-[#345263]"
                      >
                        <Check className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategoryInput("");
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-900/10 text-slate-500 transition-colors hover:bg-slate-50"
                      >
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                      <Boxes className="h-3.5 w-3.5" strokeWidth={2} />
                      Unit
                    </span>
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => update("unit", e.target.value)}
                      placeholder="e.g. boxes, pieces, kg, ml"
                      className={inputClass}
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                    Low stock warning threshold
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.minStockLevel}
                    onChange={(e) =>
                      update("minStockLevel", e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="0"
                    className={inputClass}
                  />
                </label>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                  >
                    {modalMode === "edit" ? "Save Changes" : "Add Item"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Item detail side panel */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div
            onClick={() => setSelectedMaterial(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setSelectedMaterial(null)}
                className="inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAdjust(selectedMaterial)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-amber-600 transition-colors hover:bg-amber-50"
                >
                  <Sliders className="h-3.5 w-3.5" strokeWidth={2} />
                  Adjust
                </button>
                <button
                  onClick={() => requestDelete(selectedMaterial)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] font-medium text-rose-500 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Delete
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              {/* Identity */}
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedMaterial.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem] text-slate-500">
                  <span>{getMaterialCategory(selectedMaterial)}</span>
                  <span className="text-slate-300">|</span>
                  <span>
                    {selectedMaterial.currentStock} {selectedMaterial.unit} in stock
                  </span>
                  <span className="text-slate-300">|</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium ${STOCK_STYLE[getStockLevel(selectedMaterial)].badge}`}
                  >
                    {STOCK_STYLE[getStockLevel(selectedMaterial)].label}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex items-center gap-6 border-b border-slate-900/10">
                {(
                  [
                    { key: "detail", label: "Detail Information" },
                    { key: "history", label: "Movement History" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setProfileTab(tab.key)}
                    className={`-mb-px border-b-2 px-1 pb-3 text-[0.85rem] font-medium transition-colors ${profileTab === tab.key
                      ? "border-[#3f6274] text-[#3f6274]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {profileTab === "detail" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    Item Information
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-y-4 text-[0.85rem]">
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <IdCard className="h-3.5 w-3.5" strokeWidth={2} />
                        Item ID
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedMaterial.itemId ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Boxes className="h-3.5 w-3.5" strokeWidth={2} />
                        Current Stock
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {selectedMaterial.currentStock} {selectedMaterial.unit}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                        Low Stock Threshold
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        &lt; {selectedMaterial.minStockLevel} {selectedMaterial.unit}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                        Created
                      </p>
                      <p className="mt-1 font-medium text-slate-800">
                        {formatDateLabel(selectedMaterial.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {profileTab === "history" && (
                <div className="mt-5 rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                  <p className="flex items-center gap-1.5 border-l-2 border-[#3f6274] pl-2 text-[0.9rem] font-semibold text-slate-900">
                    <History className="h-3.5 w-3.5" strokeWidth={2} />
                    Stock Movement History
                  </p>

                  {selectedMaterial.movements.length === 0 ? (
                    <p className="mt-4 text-[0.85rem] text-slate-500">
                      No stock movements recorded for this item.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {selectedMaterial.movements.map((mv) => {
                        let badgeColor = "bg-slate-100 text-slate-600";
                        if (mv.type === "purchase") badgeColor = "bg-emerald-100 text-emerald-700";
                        if (mv.type === "wastage") badgeColor = "bg-rose-100 text-rose-700";
                        if (mv.type === "adjustment") badgeColor = "bg-amber-100 text-amber-700";

                        return (
                          <div
                            key={mv.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-900/5 p-3"
                          >
                            <div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium uppercase ${badgeColor}`}
                              >
                                {mv.type}
                              </span>
                              {mv.note && (
                                <p className="mt-1.5 text-[0.8rem] text-slate-500">{mv.note}</p>
                              )}
                              <p className="mt-1 flex items-center gap-1 text-[0.75rem] text-slate-400">
                                <Clock className="h-3 w-3" strokeWidth={2} />
                                {formatDateTime(mv.createdAt)}
                                {mv.createdByName && <> · by {mv.createdByName}</>}
                              </p>
                            </div>
                            <p className="shrink-0 text-[0.9rem] font-semibold text-slate-800">
                              {mv.type === "purchase" ? "+" : mv.type === "wastage" ? "-" : ""}
                              {mv.quantity} {selectedMaterial.unit}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust stock modal */}
      {adjustModalOpen && adjustingMaterial && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div
            onClick={() => setAdjustModalOpen(false)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-[1.05rem] font-semibold text-slate-900">Adjust Stock</h3>
            <p className="mt-1 text-[0.8rem] text-slate-500">{adjustingMaterial.name}</p>

            <form onSubmit={handleSaveAdjust} className="mt-4 space-y-4">
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAdjustForm((p) => ({ ...p, adjustType: "purchase" }))}
                  className={`flex-1 rounded-full py-2 text-[0.78rem] font-semibold transition-all ${adjustForm.adjustType === "purchase"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  Restock (Purchase)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustForm((p) => ({ ...p, adjustType: "adjustment" }))}
                  className={`flex-1 rounded-full py-2 text-[0.78rem] font-semibold transition-all ${adjustForm.adjustType === "adjustment"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  Manual Adjustment
                </button>
              </div>

              {adjustForm.adjustType === "purchase" ? (
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Package className="h-3.5 w-3.5" strokeWidth={2} />
                    Purchase quantity
                  </span>
                  <input
                    required
                    type="number"
                    min={1}
                    value={adjustForm.quantity}
                    onChange={(e) =>
                      setAdjustForm((p) => ({
                        ...p,
                        quantity: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g. 5"
                    className={inputClass}
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                    <Boxes className="h-3.5 w-3.5" strokeWidth={2} />
                    New stock count
                  </span>
                  <input
                    required
                    type="number"
                    min={0}
                    value={adjustForm.newQuantity}
                    onChange={(e) =>
                      setAdjustForm((p) => ({
                        ...p,
                        newQuantity: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g. 17"
                    className={inputClass}
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-medium text-slate-600">
                  <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                  {adjustForm.adjustType === "purchase" ? "Invoice reference" : "Reason / note"}
                </span>
                <input
                  type="text"
                  value={adjustForm.note}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="rounded-full bg-[#7da3b3] px-6 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
                >
                  {adjustForm.adjustType === "purchase" ? "Save Purchase" : "Apply Adjustment"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="rounded-full px-5 py-2.5 text-[0.9rem] font-medium text-slate-500 transition-colors hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate name modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
          <div
            onClick={() => setShowDuplicateModal(false)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <AlertTriangle className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">Already Exists</h3>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-slate-500">
              An item named <span className="font-semibold text-slate-800">"{duplicateName}"</span>{" "}
              already exists in your inventory.
            </p>
            <button
              onClick={() => setShowDuplicateModal(false)}
              className="mt-6 w-full rounded-full bg-[#7da3b3] px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-[#345263]"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div
            onClick={() => setDeleteTarget(null)}
            className="absolute inset-0"
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-[1.05rem] font-semibold text-slate-900">
              Do you want to delete {deleteTarget.name}?
            </h3>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-[0.9rem] font-medium text-white transition-colors hover:bg-rose-600"
              >
                Delete
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