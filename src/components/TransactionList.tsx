import { useState, useMemo, Fragment } from "react";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Tags,
  Check,
  RotateCcw,
  PlusCircle,
  CheckSquare,
  Trash2,
  Edit2,
  Tag,
  Calendar,
  MessageSquare,
  X
} from "lucide-react";
import { Transaction, TransactionCategory } from "../types";

interface TransactionListProps {
  transactions: Transaction[];
  onUpdateCategory: (txId: string, newCategory: TransactionCategory) => void;
  onBatchUpdateCategory?: (txIds: string[], newCategory: TransactionCategory) => void;
  onDeleteTransactions?: (txIds: string[]) => void;
  onUpdateNotesTags?: (txId: string, notes: string, tags: string[]) => void;
  currency: string;
  activeStatementId: string;
  theme?: "light" | "dark";
}

const ITEMS_PER_PAGE = 15;

export default function TransactionList({
  transactions,
  onUpdateCategory,
  onBatchUpdateCategory,
  onDeleteTransactions,
  onUpdateNotesTags,
  currency,
  activeStatementId,
  theme = "dark"
}: TransactionListProps) {
  // Theme helpers
  const isLight = theme === "light";

  // Filtering & searching states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<"ALL" | "WITHDRAWAL" | "DEPOSIT">("ALL");
  const [sortField, setSortField] = useState<"date" | "amount" | "balance">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Active editing index (category)
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Active editing notes / tags state
  const [editingNotesTxId, setEditingNotesTxId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [tempTags, setTempTags] = useState("");

  const [expandedTxIds, setExpandedTxIds] = useState<string[]>([]);
  const [tempNotesTxId, setTempNotesTxId] = useState<string | null>(null);

  const toggleRowExpansion = (txId: string) => {
    setExpandedTxIds((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    );
  };

  const getMonthFromDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const monthRaw = parts[1].toLowerCase();
      const monthMap: Record<string, string> = {
        "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
        "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
        "jan": "Jan", "feb": "Feb", "mar": "Mar", "apr": "Apr", "may": "May", "jun": "Jun",
        "jul": "Jul", "aug": "Aug", "sep": "Sep", "oct": "Oct", "nov": "Nov", "dec": "Dec"
      };
      return monthMap[monthRaw] || "Other";
    }
    return "Other";
  };

  const getFullMonthName = (shortMonth: string) => {
    const names: Record<string, string> = {
      "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April",
      "May": "May", "Jun": "June", "Jul": "July", "Aug": "August",
      "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December"
    };
    return names[shortMonth] || shortMonth;
  };

  // Extract represented months
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((tx) => {
      const m = getMonthFromDate(tx.date);
      if (m && m !== "Other") {
        months.add(m);
      }
    });
    const order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return ["ALL", ...Array.from(months).sort((a, b) => order.indexOf(a) - order.indexOf(b))];
  }, [transactions]);

  // Parse custom Date for sorting safely
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthRaw = parts[1];
      const year = parseInt(parts[2], 10);

      const monthNames: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };

      let mIndex = parseInt(monthRaw, 10) - 1;
      if (isNaN(mIndex)) {
        mIndex = monthNames[monthRaw.toLowerCase().substring(0, 3)] ?? 0;
      }
      return new Date(year, mIndex, day).getTime();
    }
    return 0;
  };

  // 1. Process Filtering & Searching
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search query includes: description (merchant), date, category, source, notes, tags, and amount
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const numQuery = q.replace(/[BDT$,\s]/gi, "");
      result = result.filter(
        (tx) => {
          const descMatch = tx.description.toLowerCase().includes(q);
          const dateMatch = tx.date.includes(q);
          const catMatch = tx.category.toLowerCase().includes(q);
          const noteMatch = tx.notes && tx.notes.toLowerCase().includes(q);
          const tagMatch = tx.tags && tx.tags.some(t => t.toLowerCase().includes(q));
          const chqMatch = tx.chqNo && tx.chqNo.toLowerCase().includes(q);
          
          let amtMatch = false;
          if (numQuery.length > 0 && !isNaN(Number(numQuery))) {
            const wAmt = tx.withdrawal ? tx.withdrawal.toFixed(2) : "";
            const dAmt = tx.deposit ? tx.deposit.toFixed(2) : "";
            const bAmt = tx.balance ? tx.balance.toFixed(2) : "";
            amtMatch = wAmt.includes(numQuery) || dAmt.includes(numQuery) || bAmt.includes(numQuery);
          }
          
          return descMatch || dateMatch || catMatch || !!noteMatch || !!tagMatch || !!chqMatch || amtMatch;
        }
      );
    }

    // Month Filter
    if (selectedMonth !== "ALL") {
      result = result.filter((tx) => getMonthFromDate(tx.date) === selectedMonth);
    }

    // Category Filter
    if (selectedCategory !== "ALL") {
      result = result.filter((tx) => tx.category === selectedCategory);
    }

    // Type Filter
    if (selectedType === "WITHDRAWAL") {
      result = result.filter((tx) => tx.withdrawal !== null && tx.withdrawal > 0);
    } else if (selectedType === "DEPOSIT") {
      result = result.filter((tx) => tx.deposit !== null && tx.deposit > 0);
    }

    // 2. Sort results
    result.sort((a, b) => {
      let comparison = 0;

      if (sortField === "date") {
        comparison = parseDate(a.date) - parseDate(b.date);
      } else if (sortField === "amount") {
        const amtA = a.withdrawal || a.deposit || 0;
        const amtB = b.withdrawal || b.deposit || 0;
        comparison = amtA - amtB;
      } else if (sortField === "balance") {
        comparison = a.balance - b.balance;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [transactions, searchQuery, selectedCategory, selectedType, selectedMonth, sortField, sortOrder]);

  // Reset pagination on filter alteration
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("ALL");
    setSelectedType("ALL");
    setSelectedMonth("ALL");
    setSortField("date");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Get current paginated chunk
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  // Selection states & helpers
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [lastStatementId, setLastStatementId] = useState(activeStatementId);
  
  if (activeStatementId !== lastStatementId) {
    setSelectedTxIds([]);
    setSelectedMonth("ALL");
    setLastStatementId(activeStatementId);
  }

  const currentPageIds = useMemo(() => paginatedTransactions.map((tx) => tx.id), [paginatedTransactions]);
  const areAllCurrentPageSelected = useMemo(() => 
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedTxIds.includes(id)),
    [currentPageIds, selectedTxIds]
  );

  const handleSelectAllToggle = () => {
    if (areAllCurrentPageSelected) {
      setSelectedTxIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedTxIds((prev) => {
        const next = [...prev];
        currentPageIds.forEach((id) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleSelectRowToggle = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Beautiful badge colors depending on categories
  const getCategoryBadgeStyles = (cat: TransactionCategory) => {
    switch (cat) {
      case TransactionCategory.BKASH:
        return "bg-pink-950/40 text-pink-400 border border-pink-800/60";
      case TransactionCategory.NAGAD:
        return "bg-amber-950/40 text-amber-500 border border-amber-800/60";
      case TransactionCategory.ATM:
        return "bg-cyan-950/40 text-cyan-400 border border-cyan-800/60";
      case TransactionCategory.NPSB_TRANSFER:
        return "bg-purple-950/40 text-purple-400 border border-purple-800/60";
      case TransactionCategory.CARD_PURCHASE:
        return "bg-indigo-950/40 text-indigo-400 border border-indigo-800/60";
      case TransactionCategory.REMIT_DEPOSIT:
        return "bg-emerald-950/40 text-emerald-400 border border-emerald-800/60";
      case TransactionCategory.CHARGES_TAX:
        return "bg-rose-950/40 text-rose-400 border border-rose-800/60";
      case TransactionCategory.INTEREST:
        return "bg-blue-950/40 text-blue-400 border border-blue-800/60";
      case TransactionCategory.MOBILE_RECHARGE:
        return "bg-violet-950/40 text-violet-400 border border-violet-800/60";
      case TransactionCategory.UNASSIGNED:
      default:
        return "bg-slate-900 text-slate-400 border border-slate-700";
    }
  };

  // CSV Bulk exporter of currently filtered list
  const exportToCSV = () => {
    const headers = ["Date", "Description", "Category", "Withdrawal (Debit)", "Deposit (Credit)", "Ledger Balance"];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((tx) => {
        const descEscaped = `"${tx.description.replace(/"/g, '""')}"`;
        return [
          tx.date,
          descEscaped,
          tx.category,
          tx.withdrawal || "",
          tx.deposit || "",
          tx.balance
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `bank_statement_filtered_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className={`border rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all duration-300 ${
        isLight 
          ? "bg-white border-slate-200 text-slate-800" 
          : "bg-slate-900 border-slate-800 text-slate-100"
      }`} 
      id="transaction-log-panel"
    >
      {/* Search and Filters Strip */}
      <div 
        className={`p-5 border-b space-y-4 transition-colors ${
          isLight 
            ? "border-slate-200 bg-slate-50/50" 
            : "border-slate-800 bg-slate-900/50"
        }`} 
        id="filters-strip"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className={`text-sm font-semibold ${isLight ? "text-slate-800" : "text-slate-200"}`}>Account Activity</h3>
            <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-500"}`}>
              Showing <span className="font-bold">{filteredTransactions.length}</span> of {transactions.length} total ledger records
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className={`inline-flex items-center gap-2 px-3 py-1.5 self-start text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
              isLight 
                ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900" 
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
            id="csv-export-button"
          >
            <Download className="w-3.5 h-3.5" />
            Export current CSV
          </button>
        </div>

        {/* Filters Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Quick Search */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search description, notes, tags, date..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full pl-9 pr-4 py-1.5 text-xs rounded-lg outline-none transition-all placeholder-slate-400 border ${
                isLight 
                  ? "bg-white border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20" 
                  : "bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-indigo-500"
              }`}
            />
          </div>

          {/* Type dropdown */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as any);
                setCurrentPage(1);
              }}
              className={`w-full text-xs py-1.5 px-2.5 rounded-lg outline-none transition-all cursor-pointer border ${
                isLight 
                  ? "bg-white border-slate-200 text-slate-700 focus:border-indigo-500" 
                  : "bg-slate-950 border-slate-800 text-slate-300 focus:border-indigo-500"
              }`}
            >
              <option value="ALL">All Transactions</option>
              <option value="WITHDRAWAL">Debits Only (-)</option>
              <option value="DEPOSIT">Credits Only (+)</option>
            </select>
          </div>

          {/* Category dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full text-xs py-1.5 px-2.5 rounded-lg outline-none transition-all cursor-pointer border ${
                isLight 
                  ? "bg-white border-slate-200 text-slate-700 focus:border-indigo-500" 
                  : "bg-slate-950 border-slate-800 text-slate-300 focus:border-indigo-500"
              }`}
            >
              <option value="ALL">All Categories</option>
              {Object.values(TransactionCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By criteria */}
          <div>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split("-");
                setSortField(field as any);
                setSortOrder(order as any);
                setCurrentPage(1);
              }}
              className={`w-full text-xs py-1.5 px-2.5 rounded-lg outline-none transition-all cursor-pointer border ${
                isLight 
                  ? "bg-white border-slate-200 text-slate-700 focus:border-indigo-500" 
                  : "bg-slate-950 border-slate-800 text-slate-300 focus:border-indigo-500"
              }`}
            >
              <option value="date-desc">Newest to Oldest</option>
              <option value="date-asc">Oldest to Newest</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
              <option value="balance-desc">Balance: Max to Min</option>
              <option value="balance-asc">Balance: Min to Max</option>
            </select>
          </div>

          {/* Reset button */}
          <button
            onClick={handleResetFilters}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border ${
              isLight 
                ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200" 
                : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Dynamic Month-Wise One-Click Filters Strip */}
      <div 
        className={`p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
          isLight 
            ? "border-slate-200/80 bg-slate-50/40" 
            : "border-slate-800/40 bg-slate-950/20"
        }`} 
        id="monthly-tabs-selector"
      >
        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          Filter Months:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {uniqueMonths.map((m) => (
            <button
              key={m}
              onClick={() => {
                setSelectedMonth(m);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold select-none cursor-pointer border transition-all duration-150 ${
                selectedMonth === m
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                  : isLight
                  ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600 hover:text-slate-100"
              }`}
            >
              {m === "ALL" ? "All Months" : getFullMonthName(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Ledger Grid */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs border-collapse" id="ledger-table">
          <thead>
            <tr 
              className={`font-semibold border-b transition-colors ${
                isLight 
                  ? "bg-slate-50 text-slate-600 border-slate-200" 
                  : "bg-slate-950 text-slate-400 border-slate-800"
              }`}
            >
              <th className="p-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={areAllCurrentPageSelected}
                  onChange={handleSelectAllToggle}
                  className={`w-4 h-4 rounded cursor-pointer accent-indigo-600 ${
                    isLight 
                      ? "border-slate-300 bg-white" 
                      : "border-slate-800 bg-slate-950"
                  }`}
                />
              </th>
              <th className="p-4 w-28">Date</th>
              <th className="p-4 min-w-[220px]">Description</th>
              <th className="p-4 w-44 font-medium">Category Badge</th>
              <th className="p-4 w-32 text-right">Debit (WD)</th>
              <th className="p-4 w-32 text-right">Credit (DEP)</th>
              <th className="p-4 w-36 text-right">Ledger Balance</th>
            </tr>
          </thead>
          <tbody 
            className={`divide-y transition-colors ${
              isLight 
                ? "divide-slate-200/60 bg-white" 
                : "divide-slate-800/60 bg-slate-900/30"
            }`}
          >
            {paginatedTransactions.map((tx) => {
              const isSelected = selectedTxIds.includes(tx.id);
              const isExpanded = expandedTxIds.includes(tx.id);
              return (
                <Fragment key={tx.id}>
                  <tr
                    className={`transition-colors duration-150 ${
                      isSelected
                        ? isLight
                          ? "bg-indigo-50 hover:bg-indigo-100/60"
                          : "bg-indigo-950/20 hover:bg-indigo-950/30"
                        : isLight
                        ? "hover:bg-slate-50/60"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-4 w-12 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRowToggle(tx.id)}
                        className="w-4 h-4 rounded cursor-pointer accent-indigo-600"
                      />
                    </td>

                    {/* Date with Expansion Button */}
                    <td className={`p-4 whitespace-nowrap font-mono tracking-tight font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            toggleRowExpansion(tx.id);
                            setTempNotesTxId(tx.id);
                            setTempNotes(tx.notes || "");
                            setTempTags(tx.tags ? tx.tags.join(", ") : "");
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isExpanded
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : isLight
                                ? "bg-slate-100 hover:bg-slate-200 border-slate-205 text-slate-500"
                                : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400"
                          }`}
                          title="Expand to write private notes or add custom tags"
                        >
                          <SlidersHorizontal className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90 text-white" : ""}`} />
                        </button>
                        <span>{tx.date}</span>
                      </div>
                    </td>

                    {/* Description, Notes, and Tags Badges */}
                    <td className="p-4">
                      <div className={`font-semibold block ${isLight ? "text-slate-800" : "text-slate-200"}`}>{tx.description}</div>
                      {tx.chqNo && (
                        <span className={`text-[10px] font-semibold font-mono mt-0.5 inline-block ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                          CHQ NO: {tx.chqNo}
                        </span>
                      )}
                      {tx.source === "uploaded" && (
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-500 font-bold px-1.5 py-0.5 rounded ml-2 uppercase font-mono">
                          Imports
                        </span>
                      )}

                      {/* NOTES & TAGS RECORD KEEPING READOUT */}
                      <div className="mt-1.5 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5 group/notes mt-1">
                          {tx.notes && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border ${
                              isLight ? "bg-slate-50 text-slate-700 border-slate-200" : "bg-slate-800/40 text-slate-350 border-slate-800"
                            }`}>
                              <MessageSquare className="w-2.5 h-2.5 text-indigo-400" />
                              <span className="italic font-medium">{tx.notes}</span>
                            </span>
                          )}

                          {tx.tags && tx.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {tx.tags.map((tag) => (
                                <span key={tag} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                  isLight 
                                    ? "bg-slate-100 text-slate-700 border border-slate-200" 
                                    : "bg-[#1e293b] text-slate-300 border border-[#334155]/60"
                                }`}>
                                  <Tag className="w-2 h-2 text-indigo-400" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => {
                              toggleRowExpansion(tx.id);
                              setTempNotesTxId(tx.id);
                              setTempNotes(tx.notes || "");
                              setTempTags(tx.tags ? tx.tags.join(", ") : "");
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 hover:underline opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-1"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                            {tx.notes || (tx.tags && tx.tags.length > 0) ? "Modify Memo Notes" : "Add private note/tag"}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Category Reassignment Badge */}
                    <td className="p-4 whitespace-nowrap">
                      {editingTxId === tx.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={tx.category}
                            onChange={(e) => {
                              onUpdateCategory(tx.id, e.target.value as TransactionCategory);
                              setEditingTxId(null);
                            }}
                            className={`border text-[10px] py-1 px-1.5 rounded outline-none cursor-pointer focus:border-indigo-500 ${
                              isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-950 border-slate-800 text-slate-200"
                            }`}
                            autoFocus
                          >
                            {Object.values(TransactionCategory).map((catOption) => (
                              <option key={catOption} value={catOption}>
                                {catOption}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingTxId(null)}
                            className={`p-1 hover:text-indigo-500 transition ${isLight ? "text-slate-400" : "text-slate-500"}`}
                            title="Finish Editing"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/cat">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getCategoryBadgeStyles(tx.category)}`}>
                            {tx.category}
                          </span>
                          <button
                            onClick={() => setEditingTxId(tx.id)}
                            className={`p-1 transition-colors opacity-0 group-hover/cat:opacity-100 cursor-pointer ${
                              isLight ? "text-slate-400 hover:text-slate-600" : "text-slate-600 hover:text-slate-300"
                            }`}
                            title="Reclassify Transaction"
                          >
                            <Tags className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Debit */}
                    <td className="p-4 text-right whitespace-nowrap">
                      {tx.withdrawal !== null ? (
                        <span className="font-mono text-rose-500 font-semibold tracking-tight">
                          -{tx.withdrawal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className={`font-mono ${isLight ? "text-slate-300" : "text-slate-800"}`}>-</span>
                      )}
                    </td>

                    {/* Credit */}
                    <td className="p-4 text-right whitespace-nowrap">
                      {tx.deposit !== null ? (
                        <span className="font-mono text-emerald-500 font-semibold tracking-tight">
                          +{tx.deposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className={`font-mono ${isLight ? "text-slate-300" : "text-slate-800"}`}>-</span>
                      )}
                    </td>

                    {/* Ledger Balance */}
                    <td className={`p-4 text-right whitespace-nowrap font-bold font-mono tracking-tight ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                      {tx.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      <span className={`text-[10px] ml-1 font-sans font-bold uppercase ${isLight ? "text-slate-400" : "text-slate-600"}`}>
                        {currency}
                      </span>
                    </td>
                  </tr>

                  {/* EXPANDABLE PRIVATE NOTES & TAGGING SUBSECTION */}
                  {isExpanded && (
                    <tr className={`${isLight ? "bg-slate-50/45" : "bg-slate-900/15"} transition-all duration-300`}>
                      <td colSpan={7} className="p-4 border-l-4 border-indigo-600">
                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border ${
                          isLight 
                            ? "bg-white border-slate-200" 
                            : "bg-slate-905 border-slate-800/80"
                        }`}>
                          
                          {/* Column 1: Financial Memo Notes */}
                          <div className="space-y-3">
                            <label className={`block text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 ${
                              isLight ? "text-slate-550" : "text-slate-400"
                            }`}>
                              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                              Private Record Note / Comment
                            </label>
                            <textarea
                              value={tempNotesTxId === tx.id ? tempNotes : (tx.notes || "")}
                              onChange={(e) => {
                                setTempNotesTxId(tx.id);
                                setTempNotes(e.target.value);
                              }}
                              placeholder="Write private transaction description, receipts metadata or manual verification notes..."
                              className={`w-full h-28 p-3 text-xs rounded-xl border outline-none resize-none transition-all ${
                                isLight 
                                  ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-indigo-500" 
                                  : "bg-slate-950 border-slate-800/80 text-slate-100 focus:bg-slate-950/40 focus:border-indigo-500"
                              }`}
                            />
                          </div>

                          {/* Column 2: Class Tags management */}
                          <div className="space-y-3 flex flex-col justify-between">
                            <div>
                              <label className={`block text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1.5 mb-2 ${
                                isLight ? "text-slate-550" : "text-slate-400"
                              }`}>
                                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                Custom Classification Tags (comma separated)
                              </label>
                              
                              <input
                                type="text"
                                value={tempNotesTxId === tx.id ? tempTags : (tx.tags ? tx.tags.join(", ") : "")}
                                onChange={(e) => {
                                  setTempNotesTxId(tx.id);
                                  setTempTags(e.target.value);
                                }}
                                placeholder="e.g. Tax-Deductible, Reimbursable, Personal, Business Expense"
                                className={`w-full p-2.5 text-xs rounded-xl border outline-none transition-all ${
                                  isLight 
                                    ? "bg-slate-50 border-slate-250 text-slate-800 focus:bg-white focus:border-indigo-500" 
                                    : "bg-slate-950 border-slate-800/80 text-slate-100 focus:bg-slate-950/40 focus:border-indigo-505"
                                }`}
                              />

                              {/* Presets Grid */}
                              <div className="mt-3">
                                <span className={`text-[9px] uppercase tracking-wider font-bold block mb-1.5 ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                                  Interactive Quick Presets Toggle:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {["Tax-Deductible", "Reimbursable", "Personal", "Business Expense", "Salary", "Utilities", "Investments"].map((preset) => (
                                    <button
                                      key={preset}
                                      onClick={() => {
                                        const currentTagsStr = tempNotesTxId === tx.id ? tempTags : (tx.tags ? tx.tags.join(", ") : "");
                                        let items = currentTagsStr.split(",").map(t => t.trim()).filter(Boolean);
                                        if (items.includes(preset)) {
                                          items = items.filter(i => i !== preset);
                                        } else {
                                          items.push(preset);
                                        }
                                        setTempNotesTxId(tx.id);
                                        setTempTags(items.join(", "));
                                        
                                        // Update instantly for maximum response feel!
                                        if (onUpdateNotesTags) {
                                          onUpdateNotesTags(tx.id, tempNotesTxId === tx.id ? tempNotes : (tx.notes || ""), items);
                                        }
                                      }}
                                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                                        (tempNotesTxId === tx.id ? tempTags : (tx.tags ? tx.tags.join(", ") : "")).split(",").map(t => t.trim()).includes(preset)
                                          ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                                          : isLight
                                            ? "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                                            : "bg-slate-950 text-slate-400 hover:bg-slate-900 border-slate-800"
                                      }`}
                                    >
                                      + {preset}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Actions panel */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800/10">
                              <span className={`text-[10px] font-mono ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                                Row Index: #{tx.id.substring(0, 8)}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setTempNotesTxId(null);
                                    toggleRowExpansion(tx.id);
                                  }}
                                  className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                                    isLight 
                                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                                      : "bg-slate-950 text-slate-400 hover:bg-slate-900"
                                  }`}
                                >
                                  Close
                                </button>
                                <button
                                  onClick={() => {
                                    const savedNotes = tempNotesTxId === tx.id ? tempNotes : (tx.notes || "");
                                    const savedTagsStr = tempNotesTxId === tx.id ? tempTags : (tx.tags ? tx.tags.join(", ") : "");
                                    const list = savedTagsStr.split(",").map(t => t.trim()).filter(Boolean);
                                    if (onUpdateNotesTags) {
                                      onUpdateNotesTags(tx.id, savedNotes, list);
                                    }
                                    setTempNotesTxId(null);
                                    toggleRowExpansion(tx.id);
                                  }}
                                  className="px-4 py-2 text-xs font-extrabold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
                                >
                                  Save Record Notes
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {paginatedTransactions.length === 0 && (
              <tr>
                <td colSpan={7} className={`p-8 text-center font-medium text-xs ${isLight ? "text-slate-400 bg-slate-50/20" : "text-slate-500 bg-slate-900/10"}`}>
                  Zero ledger entries matched your chosen filter bounds
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls Footer */}
      {totalPages > 1 && (
        <div 
          className={`p-4 border-t flex items-center justify-between transition-colors ${
            isLight 
              ? "border-slate-200 bg-slate-50/50" 
              : "border-slate-800 bg-slate-900/50"
          }`} 
          id="pagination-footer"
        >
          <div className={`${isLight ? "text-slate-500" : "text-slate-400"} text-xs`}>
            Page <span className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>{currentPage}</span> of{" "}
            <span className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>{totalPages}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                currentPage > 1 ? "cursor-pointer" : ""
              } ${
                isLight 
                  ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800" 
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                currentPage < totalPages ? "cursor-pointer" : ""
              } ${
                isLight 
                  ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800" 
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Batch Actions Dock */}
      {selectedTxIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 w-11/12 max-w-2xl" id="batch-actions-bar">
          <div className={`backdrop-blur-md border rounded-2xl px-5 py-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 ${
            isLight 
              ? "bg-white/95 border-slate-200" 
              : "bg-slate-900/95 border-slate-800"
          }`}>
            
            {/* Header / Selected Count */}
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-xl flex-shrink-0">
                <CheckSquare className="w-4 h-4" />
              </span>
              <div>
                <span className={`text-xs font-bold block ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                  Batch Actions ({selectedTxIds.length} item{selectedTxIds.length > 1 ? "s" : ""} selected)
                </span>
                <span className={`text-[10px] font-medium block ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                  Perform operations across select subset
                </span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Batch category update dropdown selector */}
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:inline ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  Set Cat:
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const selectedCat = e.target.value as TransactionCategory;
                    if (selectedCat && onBatchUpdateCategory) {
                      onBatchUpdateCategory(selectedTxIds, selectedCat);
                      setSelectedTxIds([]); // Clear selection
                    }
                  }}
                  className={`border text-[11px] py-1.5 px-2.5 rounded-lg outline-none cursor-pointer focus:border-indigo-500 ${
                    isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"
                  }`}
                >
                  <option value="" disabled hidden>Choose category...</option>
                  {Object.values(TransactionCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete action button */}
              {onDeleteTransactions && (
                <button
                  onClick={() => {
                    if (confirm(`Are you absolutely sure you want to delete these ${selectedTxIds.length} transactions? This will permanently recalculate bank analytical indicators.`)) {
                      onDeleteTransactions(selectedTxIds);
                      setSelectedTxIds([]); // Clear selection after deletion
                    }
                  }}
                  className="px-3.5 py-1.5 inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-slate-100 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-md shadow-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected
                </button>
              )}

              {/* Cancel selection button */}
              <button
                onClick={() => setSelectedTxIds([])}
                className={`p-1 px-2.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                  isLight 
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200" 
                    : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-slate-700"
                }`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
