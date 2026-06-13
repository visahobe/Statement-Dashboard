import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  HelpCircle,
  PiggyBank,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Lock
} from "lucide-react";
import { BankStatement } from "../types";

export interface OverviewStatsProps {
  statement: BankStatement;
  currency: string;
  theme?: "light" | "dark";
  monthlyBudget: number;
  onUpdateBudget: (budget: number) => void;
}

export default function OverviewStats({ 
  statement, 
  currency, 
  theme = "dark",
  monthlyBudget,
  onUpdateBudget
}: OverviewStatsProps) {
  const transactions = statement.transactions;
  const isLight = theme === "light";

  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState(monthlyBudget.toString());

  const analysis = useMemo(() => {
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let countDeposits = 0;
    let countWithdrawals = 0;

    const categorySums: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.deposit && tx.deposit > 0) {
        totalDeposits += tx.deposit;
        countDeposits++;
      }
      if (tx.withdrawal && tx.withdrawal > 0) {
        totalWithdrawals += tx.withdrawal;
        countWithdrawals++;

        categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.withdrawal;
      }
    });

    const netCashflow = totalDeposits - totalWithdrawals;
    const savingRate = totalDeposits > 0 ? (netCashflow / totalDeposits) * 100 : 0;

    // Find top expense category
    let topCategoryName = "None";
    let topCategorySum = 0;
    Object.entries(categorySums).forEach(([cat, val]) => {
      if (val > topCategorySum) {
        topCategorySum = val;
        topCategoryName = cat;
      }
    });

    const avgWithdrawal = countWithdrawals > 0 ? totalWithdrawals / countWithdrawals : 0;
    const avgDeposit = countDeposits > 0 ? totalDeposits / countDeposits : 0;

    return {
      totalDeposits,
      totalWithdrawals,
      netCashflow,
      savingRate,
      topCategoryName,
      topCategorySum,
      avgWithdrawal,
      avgDeposit,
      countDeposits,
      countWithdrawals
    };
  }, [transactions]);

  const latestBalance = useMemo(() => {
    if (transactions.length === 0) return statement.closingBalance;
    return transactions[transactions.length - 1]?.balance ?? statement.closingBalance;
  }, [transactions, statement.closingBalance]);

  // Budget computations
  const totalSpent = analysis.totalWithdrawals;
  const remainingBudget = monthlyBudget - totalSpent;
  const utilizationPercentage = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
  
  // Util bar color mapping
  const getUtilColorClasses = (percent: number) => {
    if (percent >= 100) return { bar: "bg-rose-500", text: "text-rose-500", bgLight: "bg-rose-500/10", label: "Budget Overdrawn!" };
    if (percent >= 85) return { bar: "bg-amber-500", text: "text-amber-500", bgLight: "bg-amber-500/10", label: "Approaching Limit" };
    return { bar: "bg-emerald-500", text: "text-emerald-500", bgLight: "bg-emerald-500/10", label: "Safe Margin Available" };
  };

  const statusStyle = getUtilColorClasses(utilizationPercentage);

  const handleSaveBudget = () => {
    const val = parseFloat(tempBudgetInput);
    if (!isNaN(val) && val >= 0) {
      onUpdateBudget(val);
    }
    setIsEditingBudget(false);
  };

  return (
    <div className="space-y-6" id="overview-metrics-section">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5" id="stats-grid">
        {/* 1. Account Available Balance */}
        <div 
          className={`rounded-2xl p-5 shadow-lg relative overflow-visible flex flex-col justify-between transition-all duration-300 border ${
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-slate-900 border-slate-800 text-slate-100"
          }`} 
          id="stat-available-balance"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 group relative cursor-help ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Ledger End Balance
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-500 transition-colors" />
                <span className={`absolute z-50 bottom-full left-0 mb-2 w-64 p-3 border text-xs rounded-xl shadow-xl leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 ${
                  isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"
                }`}>
                  The actual ledger balance of your account at the end of the loaded statement cycle, tracking real-time imports chronologically.
                </span>
              </span>
              <span className={`text-2xl font-bold font-mono tracking-tight block ${isLight ? "text-slate-900" : "text-white"}`}>
                {latestBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span className="text-xs font-sans font-bold text-indigo-500 ml-1.5 uppercase">{currency}</span>
              </span>
            </div>
            <span className={`p-3 rounded-xl border ${isLight ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-indigo-950/40 text-indigo-400 border-indigo-800/60"}`}>
              <CircleDollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isLight ? "border-slate-100 text-slate-500" : "border-slate-800/80 text-slate-500"}`}>
            <span>Opening: <strong className={`${isLight ? "text-slate-700" : "text-slate-300"} font-mono`}>{statement.openingBalance.toLocaleString()} {currency}</strong></span>
            <span className={`font-bold px-1.5 py-0.5 rounded uppercase font-mono text-[9px] ${isLight ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-slate-400"}`}>
              {statement.currency}
            </span>
          </div>
        </div>

        {/* 2. Cumulative deposits */}
        <div 
          className={`rounded-2xl p-5 shadow-lg relative overflow-visible flex flex-col justify-between transition-all duration-300 border ${
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-slate-900 border-slate-800 text-slate-100"
          }`} 
          id="stat-total-deposits"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 group relative cursor-help ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Total Income
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-500 transition-colors" />
                <span className={`absolute z-50 bottom-full left-0 mb-2 w-64 p-3 border text-xs rounded-xl shadow-xl leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 ${
                  isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"
                }`}>
                  Cumulative credits added to the account (cash deposits, bank clearings, mobile wallet inputs, interest accrued).
                </span>
              </span>
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-500 block">
                {analysis.totalDeposits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span className={`text-xs font-sans font-semibold ml-1.5 uppercase ${isLight ? "text-slate-400" : "text-slate-500"}`}>{currency}</span>
              </span>
            </div>
            <span className={`p-3 rounded-xl border ${isLight ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"}`}>
              <ArrowUpRight className="w-5 h-5" />
            </span>
          </div>
          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isLight ? "border-slate-100 text-slate-500" : "border-slate-800/80 text-slate-500"}`}>
            <span>Credits: <strong className={isLight ? "text-slate-750" : "text-slate-300"}>{analysis.countDeposits} times</strong></span>
            <span className="flex items-center gap-0.5">
              Avg: <strong className="text-emerald-600 font-mono">+{analysis.avgDeposit.toFixed(0)}</strong>
            </span>
          </div>
        </div>

        {/* 3. Cumulative withdrawals */}
        <div 
          className={`rounded-2xl p-5 shadow-lg relative overflow-visible flex flex-col justify-between transition-all duration-300 border ${
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-slate-900 border-slate-800 text-slate-100"
          }`} 
          id="stat-total-withdrawals"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 group relative cursor-help ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Total Outflow
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-rose-500 transition-colors" />
                <span className={`absolute z-50 bottom-full left-0 mb-2 w-64 p-3 border text-xs rounded-xl shadow-xl leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 ${
                  isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"
                }`}>
                  Cumulative withdrawals debited (mobile recharge, MFS transactions, ATM cash-outs, utility bill pays).
                </span>
              </span>
              <span className="text-2xl font-bold font-mono tracking-tight text-rose-500 block">
                {analysis.totalWithdrawals.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span className={`text-xs font-sans font-semibold ml-1.5 uppercase ${isLight ? "text-slate-400" : "text-slate-500"}`}>{currency}</span>
              </span>
            </div>
            <span className={`p-3 rounded-xl border ${isLight ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-rose-950/40 text-rose-400 border-rose-800/60"}`}>
              <ArrowDownLeft className="w-5 h-5" />
            </span>
          </div>
          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isLight ? "border-slate-100 text-slate-500" : "border-slate-800/80 text-slate-500"}`}>
            <span>Debits: <strong className={isLight ? "text-slate-750" : "text-slate-300"}>{analysis.countWithdrawals} times</strong></span>
            <span className="flex items-center gap-0.5">
              Avg: <strong className="text-rose-600 font-mono">-{analysis.avgWithdrawal.toFixed(0)}</strong>
            </span>
          </div>
        </div>

        {/* 4. Net Change & Savings Velocity */}
        <div 
          className={`rounded-2xl p-5 shadow-lg relative overflow-visible flex flex-col justify-between transition-all duration-300 border ${
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-slate-900 border-slate-800 text-slate-100"
          }`} 
          id="stat-net-velocity"
        >
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 group relative cursor-help ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                Net Savings / Rate
                <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-500 transition-colors" />
                <span className={`absolute z-50 bottom-full right-0 md:left-0 md:right-auto mb-2 w-64 p-3 border text-xs rounded-xl shadow-xl leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 ${
                  isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"
                }`}>
                  Net surplus (deposits minus withdrawals) and the relative savings margin. A positive rate means you are building equity.
                </span>
              </span>
              <span className={`text-2xl font-bold font-mono tracking-tight block ${analysis.netCashflow >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {analysis.netCashflow >= 0 ? "+" : ""}
                {analysis.netCashflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                <span className={`text-xs font-sans font-semibold ml-1.5 uppercase ${isLight ? "text-slate-400" : "text-slate-500"}`}>{currency}</span>
              </span>
            </div>
            <span className={`p-3 rounded-xl border ${
              analysis.netCashflow >= 0
                ? isLight ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
                : isLight ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-rose-950/40 text-rose-400 border-rose-800/60"
            }`}>
              {analysis.netCashflow >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </span>
          </div>
          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${isLight ? "border-slate-100 text-slate-500" : "border-slate-800/80 text-slate-500"}`}>
            <span className="truncate max-w-[130px]">
              Top Cat: <strong className="text-indigo-500">{analysis.topCategoryName}</strong>
            </span>
            <span className={`font-bold ${analysis.savingRate >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              S.Rate: {analysis.savingRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* DYNAMIC SPENDING BUDGET PROGRESS BAR VISUALIZER */}
      <div 
        className={`border p-6 rounded-2xl shadow-lg transition-all duration-300 ${
          isLight 
            ? "bg-white border-slate-200 text-slate-800" 
            : "bg-slate-900 border-slate-800 text-slate-100"
        }`} 
        id="spending-budget-visualizer"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isLight ? "bg-indigo-50 text-indigo-600" : "bg-indigo-950/40 text-indigo-400"}`}>
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isLight ? "text-slate-800" : "text-slate-250"}`}>Statement Spending Limits</h3>
              <p className={`text-xs ${isLight ? "text-slate-500" : "text-slate-500 font-medium"}`}>
                Monitor outstanding debits against your manual monthly target limit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isEditingBudget ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={tempBudgetInput}
                  onChange={(e) => setTempBudgetInput(e.target.value)}
                  className={`w-28 px-2 py-1 text-xs rounded border outline-none font-mono font-bold ${
                    isLight 
                      ? "bg-slate-50 border-slate-350 text-slate-900 focus:border-indigo-500" 
                      : "bg-slate-950 border-slate-750 text-white focus:border-indigo-400"
                  }`}
                  placeholder="Set Budget..."
                  min="1"
                  autoFocus
                />
                <button
                  onClick={handleSaveBudget}
                  className="px-2.5 py-1 text-xs font-bold leading-tight bg-indigo-600 hover:bg-indigo-500 text-white rounded cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingBudget(false);
                    setTempBudgetInput(monthlyBudget.toString());
                  }}
                  className={`px-2.5 py-1 text-xs font-bold leading-tight rounded cursor-pointer ${
                    isLight ? "bg-slate-10 text-slate-600" : "bg-slate-850 text-slate-350"
                  }`}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`text-[10px] block uppercase font-bold tracking-widest ${isLight ? "text-slate-400" : "text-slate-500"}`}>Monthly Limit</span>
                  <span className={`text-sm font-bold font-mono ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                    {monthlyBudget.toLocaleString()} {currency}
                  </span>
                </div>
                <button
                  onClick={() => setIsEditingBudget(true)}
                  className="text-xs font-bold text-indigo-500 hover:text-indigo-400 hover:underline cursor-pointer"
                >
                  Change Limit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* The Progress Bar Elements */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className={`${isLight ? "text-slate-650" : "text-slate-350"}`}>
              Utilized: <strong className="font-mono">{totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })} {currency}</strong>
            </span>
            <span className={`font-semibold text-[10px] px-2 py-0.5 rounded-full ${statusStyle.bgLight} ${statusStyle.text} uppercase tracking-wider font-bold`}>
              {statusStyle.label} ({utilizationPercentage.toFixed(1)}%)
            </span>
          </div>

          {/* Bar track container */}
          <div className={`h-3 w-full rounded-full overflow-hidden ${isLight ? "bg-slate-100" : "bg-slate-950/80 border border-slate-800/40"}`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ease-out ${statusStyle.bar}`}
              style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className={isLight ? "text-slate-500" : "text-slate-400"}>
              Remaining balance:{" "}
              <strong className={`font-mono ${remainingBudget >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold text-sm"}`}>
                {remainingBudget >= 0 ? "+" : ""}
                {remainingBudget.toLocaleString("en-US", { maximumFractionDigits: 0 })} {currency}
              </strong>
            </span>
            <span className={`text-[10px] font-mono ${isLight ? "text-slate-400" : "text-slate-500"}`}>
              0%
            </span>
            <span className={`text-[10px] font-mono ${isLight ? "text-slate-400" : "text-slate-500"}`}>
              100%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
