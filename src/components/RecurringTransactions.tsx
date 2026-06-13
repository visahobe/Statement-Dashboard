import { useMemo } from "react";
import { RefreshCw, ArrowUpRight, ArrowDownLeft, CalendarRange, Sparkles } from "lucide-react";
import { Transaction, TransactionCategory } from "../types";

export interface RecurringTransactionsProps {
  transactions: Transaction[];
  currency: string;
  theme?: "light" | "dark";
}

interface RecurringGroup {
  descriptionPattern: string;
  amount: number;
  type: "DEPOSIT" | "WITHDRAWAL";
  count: number;
  totalVolume: number;
  category: TransactionCategory;
  dates: string[];
  estimatedIntervalDays: number | null;
}

export default function RecurringTransactions({ 
  transactions, 
  currency,
  theme = "dark" 
}: RecurringTransactionsProps) {
  const isLight = theme === "light";

  // Identify recurring transactions based on description pattern + amount
  const recurringGroups = useMemo(() => {
    const groups: Map<string, Transaction[]> = new Map();

    transactions.forEach((tx) => {
      // 1. Simplify description to find a standard pattern (strip long integers/IDs)
      const cleaned = tx.description
        .replace(/\d{8,}/g, "#ID") // replace long transaction numbers
        .replace(/\d{2}-\d{2}-\d{4}/g, "#DATE") // replace full dates
        .trim();

      const amt = tx.withdrawal || tx.deposit || 0;
      if (amt === 0) return;

      const key = `${tx.withdrawal ? "W" : "D"}_${cleaned.substring(0, 30).toLowerCase()}_${amt.toFixed(0)}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    });

    const parsedGroups: RecurringGroup[] = [];

    groups.forEach((txList, key) => {
      if (txList.length < 2) return; // Only repeating items (2 or more times)

      const proto = txList[0];
      const isWithdrawal = proto.withdrawal !== null;
      const amount = isWithdrawal ? proto.withdrawal! : proto.deposit!;
      
      // Clean up description representing the group
      let displayPattern = proto.description
        .replace(/\d{8,}/g, "...")
        .replace(/\d{2}-\d{2}-\d{4}/g, "...");

      // Shorten if too long
      if (displayPattern.length > 50) {
        displayPattern = displayPattern.substring(0, 48) + "...";
      }

      // Calculate average interval
      let estimatedIntervalDays: number | null = null;
      if (txList.length >= 2) {
        const parseDateString = (dateStr: string) => {
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

        const timestamps = txList.map(t => parseDateString(t.date)).filter(Boolean).sort((a, b) => a - b);
        if (timestamps.length >= 2) {
          let diffSum = 0;
          for (let i = 1; i < timestamps.length; i++) {
            diffSum += (timestamps[i] - timestamps[i-1]);
          }
          const avgMs = diffSum / (timestamps.length - 1);
          estimatedIntervalDays = Math.round(avgMs / (1000 * 60 * 60 * 24));
        }
      }

      parsedGroups.push({
        descriptionPattern: displayPattern,
        amount,
        type: isWithdrawal ? "WITHDRAWAL" : "DEPOSIT",
        count: txList.length,
        totalVolume: amount * txList.length,
        category: proto.category,
        dates: txList.map(t => t.date),
        estimatedIntervalDays
      });
    });

    // Sort by count (frequency) desc, then volume desc
    return parsedGroups.sort((a, b) => b.count - a.count || b.totalVolume - a.totalVolume);
  }, [transactions]);

  // UI rendering of recurring indicators
  return (
    <div 
      className={`border rounded-2xl p-6 shadow-xl space-y-4 transition-colors duration-300 ${
        isLight 
          ? "bg-white border-slate-200 text-slate-800" 
          : "bg-slate-900 border-slate-800 text-slate-100"
      }`} 
      id="recurring-analytics-panel"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="p-1 bg-indigo-500/10 text-indigo-500 rounded-md border border-indigo-500/20">
              <RefreshCw className="w-4 h-4 animate-[spin_8s_linear_infinite]" />
            </span>
            <h3 className={`text-sm font-bold ${isLight ? "text-slate-850" : "text-slate-200"}`}>Recurring Pattern Analyzer</h3>
          </div>
          <p className="text-xs text-slate-500">
            Intelligent detection of automatic transfers, repeating bills, regular salaries, and subscriptions
          </p>
        </div>
        <div className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${
          isLight 
            ? "border-slate-200 bg-slate-50 text-slate-600" 
            : "border-slate-800 bg-slate-950 text-slate-400"
        }`}>
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          {recurringGroups.length} Patterns Found
        </div>
      </div>

      {recurringGroups.length === 0 ? (
        <div className={`p-5 text-center rounded-xl border text-xs text-slate-500 ${
          isLight ? "bg-slate-50/50 border-slate-200" : "bg-slate-950/40 border-slate-800/60"
        }`}>
          No clear repeating debit/credit patterns found in this statement period (needs similar description & exact amount 2+ times)
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="recurring-list-grid">
          {recurringGroups.slice(0, 6).map((group, index) => (
            <div
              key={`${group.descriptionPattern}_${index}`}
              className={`border rounded-xl p-4 transition-all duration-300 flex flex-col justify-between space-y-3 shadow-md ${
                isLight 
                  ? "bg-slate-50/50 hover:bg-slate-55 border-slate-200 hover:border-indigo-200" 
                  : "bg-slate-950/40 hover:bg-slate-950/80 border-slate-800/60 hover:border-slate-700/80"
              }`}
            >
              <div className="space-y-2">
                {/* Badge Type & Frequency */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                    group.type === "DEPOSIT"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  }`}>
                    {group.type === "DEPOSIT" ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <ArrowDownLeft className="w-3 h-3 text-rose-500" />
                    )}
                    {group.type === "DEPOSIT" ? "Auto Deposit" : "Standing Outflow"}
                  </span>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isLight ? "bg-slate-200 text-slate-700" : "bg-slate-800 text-slate-400"
                  }`}>
                    Repeats {group.count}x
                  </span>
                </div>

                {/* Pattern Title */}
                <div>
                  <h4 className={`text-xs font-semibold line-clamp-1 truncate ${isLight ? "text-slate-800" : "text-slate-200"}`} title={group.descriptionPattern}>
                    {group.descriptionPattern}
                  </h4>
                  <span className={`text-[10px] font-semibold block mt-0.5 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                    Category: <span className="text-indigo-500 font-bold">{group.category}</span>
                  </span>
                </div>
              </div>

              {/* Amount & Estimated Interval Info */}
              <div className={`pt-3 border-t flex items-center justify-between text-xs ${isLight ? "border-slate-200" : "border-slate-800/50"}`}>
                <div>
                  <span className={`text-[10px] block uppercase font-bold ${isLight ? "text-slate-400" : "text-slate-500"}`}>Amount</span>
                  <span className={`text-sm font-extrabold font-mono ${isLight ? "text-slate-800" : "text-white"}`}>
                    {group.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    <span className={`text-[10px] font-bold ml-1 uppercase ${isLight ? "text-slate-400" : "text-slate-500"}`}>{currency}</span>
                  </span>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] block uppercase font-bold ${isLight ? "text-slate-400" : "text-slate-500"}`}>Est. Cycle</span>
                  <span className="text-xs font-bold text-indigo-500 font-mono inline-flex items-center gap-1">
                    <CalendarRange className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" />
                    {group.estimatedIntervalDays !== null
                      ? group.estimatedIntervalDays === 0
                        ? "Same day"
                        : `~Every ${group.estimatedIntervalDays} days`
                      : "Irregular"}
                  </span>
                </div>
              </div>

              {/* Volume aggregate micro line */}
              <div className={`text-[10px] flex items-center justify-between pt-1 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
                <span>Cumulative volume:</span>
                <strong className={`font-mono ${isLight ? "text-slate-700" : "text-slate-300"}`}>{group.totalVolume.toLocaleString()} {currency}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
