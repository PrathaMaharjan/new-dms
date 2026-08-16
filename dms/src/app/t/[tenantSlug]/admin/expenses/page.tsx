"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
    Plus,
    Search,
    Wallet,
    Calendar,
    Tag,
    FileText,
    X,
    Pencil,
    Trash2,
    Receipt,
    TrendingDown,
    Package,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Check,
    Filter,
    Loader2,
} from "lucide-react";

interface ExpenseCategory {
    id: string;
    name: string;
}

interface ExpenseItem {
    expenseId: string;
    description: string;
    category: string;
    categoryId: string | null;
    amount: number;
    date: string;
    notes: string | null;
    source: "manual" | "inventory";
    editable: boolean;
    createdByName?: string;
}

const ADD_NEW_VALUE = "__add_new__";
const ITEMS_PER_PAGE = 8;

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NP", {
        style: "currency",
        currency: "NPR",
        maximumFractionDigits: 2,
    }).format(amount);
}

function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [activeLocationId, setActiveLocationId] = useState<string>("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState<string>("All");

    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const hasDateFilter = Boolean(dateFrom || dateTo);

    const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null);

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState("");

    const [form, setForm] = useState({
        description: "",
        categoryId: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
    });

    // Fetch outlets on mount to determine the active location ID
    useEffect(() => {
        async function fetchOutlets() {
            try {
                const res = await axios.get("/api/outlets");
                if (res.data?.success && Array.isArray(res.data?.data?.locations) && res.data.data.locations.length > 0) {
                    setActiveLocationId(res.data.data.locations[0].id);
                }
            } catch (err) {
                console.error("Failed to load location:", err);
            }
        }
        fetchOutlets();
    }, []);

    // Fetch categories
    const fetchCategories = useCallback(async (locId: string) => {
        if (!locId) return;
        try {
            const res = await axios.get(`/api/expenses/category?locationId=${locId}`);
            if (res.data?.success && Array.isArray(res.data?.data?.categories)) {
                setCategories(res.data.data.categories);
            } else {
                setCategories([]);
            }
        } catch (err) {
            console.error("Failed to load categories:", err);
        }
    }, []);

    // Fetch expenses
    const fetchExpenses = useCallback(async (locId: string) => {
        if (!locId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/expenses?locationId=${locId}&limit=100`);
            if (res.data?.success && Array.isArray(res.data?.data?.expenses)) {
                const mapped: ExpenseItem[] = res.data.data.expenses.map((e: any) => {
                    const isInv = e.source === "inventory_purchase";
                    return {
                        expenseId: e.id,
                        description: e.description || (isInv ? `Restock: ${e.categoryName}` : "Expense"),
                        category: isInv ? "Supplies (Restock)" : (e.categoryName || "General"),
                        categoryId: null,
                        amount: (e.amountCents ?? 0) / 100,
                        date: e.date,
                        notes: e.expenseNote || (isInv ? e.description : null) || null,
                        source: isInv ? "inventory" : "manual",
                        editable: !isInv,
                        createdByName: e.createdByName,
                    };
                });
                setExpenses(mapped);
            } else {
                setExpenses([]);
            }
        } catch (err) {
            console.error("Failed to load expenses:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeLocationId) {
            fetchCategories(activeLocationId);
            fetchExpenses(activeLocationId);
        }
    }, [activeLocationId, fetchCategories, fetchExpenses]);

    async function addNewCategory() {
        const trimmed = newCategoryInput.trim();
        if (!trimmed || !activeLocationId) {
            setIsAddingCategory(false);
            setNewCategoryInput("");
            return;
        }

        const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            setForm((p) => ({ ...p, categoryId: existing.id }));
            setIsAddingCategory(false);
            setNewCategoryInput("");
            return;
        }

        try {
            const res = await axios.post("/api/expenses/category", {
                locationId: activeLocationId,
                name: trimmed,
            });
            if (res.data?.success && res.data?.data?.category) {
                const created = res.data.data.category;
                setCategories((prev) => [...prev, created]);
                setForm((p) => ({ ...p, categoryId: created.id }));
            }
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || "Failed to create category.");
        } finally {
            setNewCategoryInput("");
            setIsAddingCategory(false);
        }
    }

    function clearDateFilter() {
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    }

    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            const matchesSearch =
                !search.trim() ||
                expense.description.toLowerCase().includes(search.toLowerCase()) ||
                expense.category.toLowerCase().includes(search.toLowerCase()) ||
                (expense.notes ?? "").toLowerCase().includes(search.toLowerCase());

            const matchesCategory =
                categoryFilter === "All" ||
                (categoryFilter === "inventory"
                    ? expense.source === "inventory"
                    : expense.category.toLowerCase() === categoryFilter.toLowerCase());

            const matchesDateFrom = !dateFrom || expense.date >= dateFrom;
            const matchesDateTo = !dateTo || expense.date <= dateTo;

            return matchesSearch && matchesCategory && matchesDateFrom && matchesDateTo;
        });
    }, [expenses, search, categoryFilter, dateFrom, dateTo]);

    const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedExpenses = filteredExpenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const stats = useMemo(() => {
        return {
            totalExpenses: expenses.length,
            totalSpend: expenses.reduce((sum, e) => sum + e.amount, 0),
            fromInventory: expenses.filter((e) => e.source === "inventory").length,
            manualCount: expenses.filter((e) => e.source === "manual").length,
        };
    }, [expenses]);

    function resetForm() {
        setForm({
            description: "",
            categoryId: categories.length > 0 ? categories[0].id : "",
            amount: "",
            date: new Date().toISOString().slice(0, 10),
            notes: "",
        });
        setEditingExpense(null);
        setErrorMsg(null);
        setIsAddingCategory(false);
        setNewCategoryInput("");
    }

    function handleOpenEdit(expense: ExpenseItem) {
        if (!expense.editable || expense.source === "inventory") return;
        setEditingExpense(expense);

        const matchCat = categories.find(
            (c) => c.id === expense.categoryId || c.name.toLowerCase() === expense.category.toLowerCase()
        );

        setForm({
            description: expense.description,
            categoryId: matchCat?.id || (categories.length > 0 ? categories[0].id : ""),
            amount: String(expense.amount),
            date: expense.date,
            notes: expense.notes ?? "",
        });
        setIsAddingCategory(false);
        setNewCategoryInput("");
        setIsModalOpen(true);
    }

    async function handleSaveExpense() {
        setErrorMsg(null);

        if (!form.description.trim() || !form.amount || !form.date) {
            setErrorMsg("Please fill in description, amount, and date.");
            return;
        }
        if (!form.categoryId) {
            setErrorMsg("Please select an expense category.");
            return;
        }
        const amountNum = Number(form.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setErrorMsg("Enter a valid amount greater than 0.");
            return;
        }
        if (!activeLocationId) {
            setErrorMsg("Location not initialized.");
            return;
        }

        setSubmitting(true);
        try {
            if (editingExpense) {
                await axios.patch(`/api/expenses/${editingExpense.expenseId}`, {
                    categoryId: form.categoryId,
                    amountCents: Math.round(amountNum * 100),
                    description: form.description.trim(),
                    expenseNote: form.notes.trim() || undefined,
                    expenseDate: form.date,
                });
            } else {
                await axios.post("/api/expenses", {
                    locationId: activeLocationId,
                    categoryId: form.categoryId,
                    amountCents: Math.round(amountNum * 100),
                    description: form.description.trim(),
                    expenseNote: form.notes.trim() || undefined,
                    expenseDate: form.date,
                });
            }

            await fetchExpenses(activeLocationId);
            resetForm();
            setIsModalOpen(false);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || "Failed to save expense.");
        } finally {
            setSubmitting(false);
        }
    }

    async function confirmDeleteExpense() {
        if (!deleteTarget) return;
        try {
            await axios.delete(`/api/expenses/${deleteTarget.expenseId}`);
            if (activeLocationId) {
                await fetchExpenses(activeLocationId);
            }
        } catch (err: any) {
            console.error("Failed to delete expense:", err);
        } finally {
            setDeleteTarget(null);
        }
    }

    function handlePageChange(newPage: number) {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    }

    return (
        <div className="relative min-h-screen bg-slate-50">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 w-full bg-white px-6 py-6 lg:px-10 border-b border-slate-900/5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#345263] sm:text-3xl">
                            Expenses
                        </h1>

                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1600px] px-6 pb-10 pt-6 lg:px-10">
                {/* Stat Cards */}
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between">
                            <p className="text-[0.85rem] font-medium text-slate-500">Total Expenses</p>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                <Receipt className="h-4 w-4" strokeWidth={2} />
                            </div>
                        </div>
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{stats.totalExpenses}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between">
                            <p className="text-[0.85rem] font-medium text-slate-500">Total Spend</p>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                                <TrendingDown className="h-4 w-4" strokeWidth={2} />
                            </div>
                        </div>
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                            {formatCurrency(stats.totalSpend)}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-900/5 bg-white p-6 shadow-sm">
                        <div className="flex items-start justify-between">
                            <p className="text-[0.85rem] font-medium text-slate-500">From Inventory</p>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                <Package className="h-4 w-4" strokeWidth={2} />
                            </div>
                        </div>
                        <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{stats.fromInventory}</p>
                        <p className="mt-1 text-[0.75rem] text-slate-400">{stats.manualCount} manual</p>
                    </div>
                </div>

                {/* Table Card */}
                <div className="mt-10 overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4 p-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                                <input
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder="Search expenses..."
                                    className="w-56 rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-4 text-[0.9rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#7da3b3]"
                                />
                            </div>

                            <div className="relative">
                                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => {
                                        setCategoryFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="appearance-none rounded-full border border-slate-900/10 bg-white py-2.5 pl-9 pr-8 text-[0.9rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                                >
                                    <option value="All">All Categories</option>
                                    <option value="inventory">Inventory (Restocks)</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        max={dateTo || undefined}
                                        onChange={(e) => {
                                            setDateFrom(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-36 rounded-full border border-slate-900/10 bg-white py-2.5 pl-8 pr-3 text-[0.85rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                                        aria-label="From date"
                                    />
                                </div>
                                <span className="text-xs text-slate-400">to</span>
                                <div className="relative">
                                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={2} />
                                    <input
                                        type="date"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        onChange={(e) => {
                                            setDateTo(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-36 rounded-full border border-slate-900/10 bg-white py-2.5 pl-8 pr-3 text-[0.85rem] text-slate-900 outline-none focus:border-[#7da3b3]"
                                        aria-label="To date"
                                    />
                                </div>
                                {hasDateFilter && (
                                    <button
                                        onClick={clearDateFilter}
                                        title="Clear date filter"
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                    >
                                        <X className="h-4 w-4" strokeWidth={2} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Add Expense Button next to the filters */}
                        <button
                            onClick={() => {
                                resetForm();
                                setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-[0.9rem] font-medium text-white shadow-sm transition-colors hover:bg-[#345263]"
                        >
                            <Plus className="h-4 w-4" strokeWidth={2} />
                            Add Expense
                        </button>
                    </div>

                    {errorMsg && !isModalOpen && (
                        <div className="mx-6 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {errorMsg}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-[#3f6274]" />
                            <p className="mt-3 text-sm text-slate-500">Loading expenses...</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full min-w-[900px] border-collapse text-left">
                                    <thead>
                                        <tr className="border-y border-slate-900/5 bg-slate-50/60">
                                            <th className="px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Description
                                            </th>
                                            <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Category
                                            </th>
                                            <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Notes
                                            </th>
                                            <th className="px-4 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Amount
                                            </th>
                                            <th className="px-6 py-3 text-right text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedExpenses.map((expense) => (
                                            <tr
                                                key={expense.expenseId}
                                                className="group border-b border-slate-900/5 transition-colors last:border-b-0 hover:bg-[#7da3b3]/[0.04]"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                                            {expense.source === "inventory" ? (
                                                                <Package className="h-4 w-4" strokeWidth={2} />
                                                            ) : (
                                                                <Wallet className="h-4 w-4" strokeWidth={2} />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.9rem] font-medium text-slate-900">{expense.description}</span>
                                                            {expense.source === "inventory" && (
                                                                <span className="mt-0.5 text-[0.72rem] font-medium text-amber-600">
                                                                    Auto-logged from inventory
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[0.75rem] font-medium text-slate-600">
                                                        <Tag className="h-3 w-3" strokeWidth={2} />
                                                        {expense.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-[0.85rem] text-slate-600">{formatDate(expense.date)}</td>
                                                <td className="max-w-[220px] px-4 py-4 text-[0.85rem] text-slate-500">
                                                    <span className="line-clamp-2">{expense.notes || "—"}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right text-[0.9rem] font-semibold text-slate-800">
                                                    {formatCurrency(expense.amount)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!expense.editable || expense.source === "inventory" ? (
                                                        <span className="pr-1 text-[0.72rem] italic text-slate-300">Locked</span>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                                                            <button
                                                                onClick={() => handleOpenEdit(expense)}
                                                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#3f6274]"
                                                                title="Edit Expense"
                                                            >
                                                                <Pencil className="h-4 w-4" strokeWidth={2} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteTarget(expense)}
                                                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                                title="Remove Expense"
                                                            >
                                                                <Trash2 className="h-4 w-4" strokeWidth={2} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {paginatedExpenses.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                                                    No expenses recorded.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="block divide-y divide-slate-100 md:hidden">
                                {paginatedExpenses.map((expense) => (
                                    <div key={expense.expenseId} className="flex flex-col gap-4 bg-white p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                                    {expense.source === "inventory" ? (
                                                        <Package className="h-4 w-4" strokeWidth={2} />
                                                    ) : (
                                                        <Wallet className="h-4 w-4" strokeWidth={2} />
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium text-slate-900">{expense.description}</h4>
                                                    <span className="mt-0.5 inline-block text-xs font-medium text-slate-500">
                                                        {expense.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800">{formatCurrency(expense.amount)}</span>
                                        </div>

                                        <div className="space-y-1.5 rounded-xl bg-slate-50/60 p-3 text-xs text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                                                <span className="font-medium text-slate-700">{formatDate(expense.date)}</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                                                <span className="text-slate-600">{expense.notes || "No notes added"}</span>
                                            </div>
                                            {expense.source === "inventory" && (
                                                <div className="flex items-center gap-2 pt-1">
                                                    <span className="text-xs font-medium text-amber-600">Auto-logged from inventory</span>
                                                </div>
                                            )}
                                        </div>

                                        {expense.editable && expense.source !== "inventory" && (
                                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                                                <button
                                                    onClick={() => handleOpenEdit(expense)}
                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(expense)}
                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-100 bg-rose-50/40 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {paginatedExpenses.length === 0 && (
                                    <div className="px-4 py-12 text-center text-sm text-slate-400">No expenses recorded.</div>
                                )}
                            </div>

                            {/* Pagination */}
                            {filteredExpenses.length > 0 && (
                                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-xs">
                                    <span className="text-[0.7rem] font-medium text-slate-500">
                                        Page <strong className="text-slate-800">{currentPage}</strong> of{" "}
                                        <strong className="text-slate-800">{totalPages}</strong>
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
                        </>
                    )}
                </div>
            </div>

            {/* Add / Edit Expense Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm overflow-y-auto"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-xl"
                    >
                        <div className="flex items-center justify-between border-b border-slate-900/5 px-6 py-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7da3b3]/15 text-[#3f6274]">
                                    <Wallet className="h-5 w-5" strokeWidth={2} />
                                </div>
                                <h2 className="text-lg font-semibold text-[#345263]">
                                    {editingExpense ? "Edit Expense" : "Add New Expense"}
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="h-5 w-5" strokeWidth={2} />
                            </button>
                        </div>

                        {errorMsg && (
                            <div className="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {errorMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 sm:gap-5">
                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-[0.8rem] font-semibold text-slate-500">Description</label>
                                <input
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="e.g. Electricity bill, equipment repair..."
                                    className="w-full rounded-xl border border-slate-900/10 bg-slate-50/30 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#7da3b3] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7da3b3]/10 transition-all"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-[0.8rem] font-semibold text-slate-500">Category</label>
                                {!isAddingCategory ? (
                                    <div className="relative">
                                        <select
                                            value={form.categoryId}
                                            onChange={(e) => {
                                                if (e.target.value === ADD_NEW_VALUE) {
                                                    setIsAddingCategory(true);
                                                } else {
                                                    setForm({ ...form, categoryId: e.target.value });
                                                }
                                            }}
                                            className="w-full appearance-none rounded-xl border border-slate-900/10 bg-slate-50/30 px-3 py-2.5 pr-9 text-sm text-slate-800 focus:border-[#7da3b3] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7da3b3]/10 transition-all"
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                            <option value={ADD_NEW_VALUE}>+ Add New Category</option>
                                        </select>
                                        <Tag className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            autoFocus
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
                                            className="flex-1 rounded-xl border border-slate-900/10 bg-slate-50/30 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#7da3b3] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7da3b3]/10 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={addNewCategory}
                                            title="Add category"
                                            className="rounded-xl bg-[#3f6274] p-2.5 text-white transition-colors hover:bg-[#345263]"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddingCategory(false);
                                                setNewCategoryInput("");
                                            }}
                                            title="Cancel"
                                            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-50"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1.5 block text-[0.8rem] font-semibold text-slate-500">Amount (NPR)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-slate-900/10 bg-slate-50/30 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#7da3b3] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7da3b3]/10 transition-all"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-[0.8rem] font-semibold text-slate-500">Date</label>
                                <div className="relative">
                                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        className="w-full rounded-xl border border-slate-900/10 bg-slate-50/30 py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-[#7da3b3] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7da3b3]/10 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <label className="mb-1.5 block text-[0.8rem] font-semibold text-slate-500">Notes</label>
                                <div className="relative">
                                    <FileText className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <textarea
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Optional details — vendor, invoice number, reason, etc."
                                        rows={3}
                                        className="w-full resize-none rounded-xl border border-slate-900/10 bg-slate-50/30 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#7da3b3] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#7da3b3]/10 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-900/5 bg-slate-50/50 p-6 sm:flex-row sm:justify-end sm:gap-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-full rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:w-auto"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={handleSaveExpense}
                                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#749fb1] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#345263] disabled:opacity-50 sm:w-auto"
                            >
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                {editingExpense ? "Save Changes" : "Add Expense"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-900/5 bg-white shadow-xl"
                    >
                        <div className="flex flex-col items-center gap-3 p-8 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                                <AlertTriangle className="h-7 w-7" strokeWidth={2} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[#345263]">Remove Expense</h2>
                                <p className="mt-2 px-2 text-sm text-slate-500">
                                    Are you sure you want to remove{" "}
                                    <span className="font-semibold text-slate-700">{deleteTarget.description}</span>? This can&apos;t
                                    be undone.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3 border-t border-slate-900/5 bg-slate-50/50 p-6">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteExpense}
                                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}