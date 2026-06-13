import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Transaction, TransactionCategory } from "../types";

// Date parsing helper to sort chronologically
function parseDateString(dateStr: string): Date {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthRaw = parts[1];
    const year = parseInt(parts[2], 10);

    const monthNames: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    let monthIndex = parseInt(monthRaw, 10) - 1;
    if (isNaN(monthIndex)) {
      monthIndex = monthNames[monthRaw.toLowerCase().substring(0, 3)] ?? 0;
    }
    return new Date(year, monthIndex, day);
  }
  return new Date();
}

interface VisualChartsProps {
  transactions: Transaction[];
  currency: string;
  theme?: "light" | "dark";
}

export default function VisualCharts({ 
  transactions, 
  currency,
  theme = "dark" 
}: VisualChartsProps) {
  const isLight = theme === "light";

  // 1. Balance Curve Data (sorted chronologically)
  const balanceData = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime()
    );

    const aggregated: Record<string, { date: string; balance: number; timestamp: number }> = {};
    
    sorted.forEach((tx) => {
      aggregated[tx.date] = {
        date: tx.date,
        balance: tx.balance,
        timestamp: parseDateString(tx.date).getTime()
      };
    });

    return Object.values(aggregated).sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions]);

  // 2. Weekly activity (deposits vs withdrawals)
  const weeklyCashflow = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime()
    );

    const weeklyBuckets: Record<string, { Deposits: number; Withdrawals: number }> = {};

    sorted.forEach((tx) => {
      const parsedDate = parseDateString(tx.date);
      // Rough week calculation
      const year = parsedDate.getFullYear();
      const monthShort = parsedDate.toLocaleString("default", { month: "short" });
      const day = parsedDate.getDate();
      
      let weekLabel = "";
      if (day <= 7) weekLabel = `${monthShort} W1`;
      else if (day <= 14) weekLabel = `${monthShort} W2`;
      else if (day <= 21) weekLabel = `${monthShort} W3`;
      else weekLabel = `${monthShort} W4+`;

      if (!weeklyBuckets[weekLabel]) {
        weeklyBuckets[weekLabel] = { Deposits: 0, Withdrawals: 0 };
      }

      if (tx.deposit && tx.deposit > 0) {
        weeklyBuckets[weekLabel].Deposits += tx.deposit;
      }
      if (tx.withdrawal && tx.withdrawal > 0) {
        weeklyBuckets[weekLabel].Withdrawals += tx.withdrawal;
      }
    });

    return Object.entries(weeklyBuckets).map(([week, values]) => ({
      week,
      Deposits: parseFloat(values.Deposits.toFixed(2)),
      Withdrawals: parseFloat(values.Withdrawals.toFixed(2))
    }));
  }, [transactions]);

  // 3. Category Expenses distribution
  const categoryData = useMemo(() => {
    const distribution: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.withdrawal && tx.withdrawal > 0) {
        distribution[tx.category] = (distribution[tx.category] || 0) + tx.withdrawal;
      }
    });

    return Object.entries(distribution)
      .map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const primaryColor = "#6366f1"; // Indigo-500
  const depositColor = "#10b981"; // Emerald-500
  const withdrawalColor = "#f43f5e"; // Rose-500

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="charts-container">
      {/* 1. Account Balance curves */}
      <div 
        className={`border rounded-2xl p-5 shadow-xl flex flex-col transition-all duration-300 ${
          isLight 
            ? "bg-white border-slate-200 text-slate-850" 
            : "bg-slate-900 border-slate-800 text-slate-100"
        }`} 
        id="chart-balance-trajectory"
      >
        <div className="mb-4">
          <h3 className={`text-sm font-semibold ${isLight ? "text-slate-805" : "text-slate-300"}`}>Balance Curve over Time</h3>
          <p className="text-xs text-slate-500">Continuous ledger balance progression chronologically</p>
        </div>
        <div className="h-64 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#f1f5f9" : "#1e293b"} vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" tickFormatter={(str) => str.substring(0, 5)} tickLine={false} fontSize={10} />
              <YAxis
                stroke="#64748b"
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                tickLine={false}
                fontSize={10}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: isLight ? "#ffffff" : "#0f172a", 
                  borderColor: isLight ? "#e2e8f0" : "#334155",
                  borderRadius: "12px",
                  color: isLight ? "#1e293b" : "#f1f5f9"
                }}
                labelClassName="text-xs font-semibold"
                itemStyle={{ color: primaryColor, fontSize: "11px" }}
                formatter={(value: any) => [`${parseFloat(value).toLocaleString()} ${currency}`, "Balance"]}
              />
              <Area type="monotone" dataKey="balance" stroke={primaryColor} strokeWidth={2} fillOpacity={1} fill="url(#balanceGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Monthly / Weekly Activity */}
      <div 
        className={`border rounded-2xl p-5 shadow-xl flex flex-col transition-all duration-300 ${
          isLight 
            ? "bg-white border-slate-200 text-slate-850" 
            : "bg-slate-900 border-slate-800 text-slate-100"
        }`} 
        id="chart-weekly-activity"
      >
        <div className="mb-4">
          <h3 className={`text-sm font-semibold ${isLight ? "text-slate-805" : "text-slate-300"}`}>Deposit vs Withdrawal (Weekly Cashflow)</h3>
          <p className="text-xs text-slate-500">Weekly cumulative incoming vs outgoing funds</p>
        </div>
        <div className="h-64 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyCashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#f1f5f9" : "#1e293b"} vertical={false} />
              <XAxis dataKey="week" stroke="#64748b" tickLine={false} fontSize={10} />
              <YAxis
                stroke="#64748b"
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                tickLine={false}
                fontSize={10}
              />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: isLight ? "#ffffff" : "#0f172a", 
                  borderColor: isLight ? "#e2e8f0" : "#334155",
                  borderRadius: "12px",
                  color: isLight ? "#1e293b" : "#f1f5f9"
                }}
                labelClassName="text-xs font-semibold"
                itemStyle={{ fontSize: "11px" }}
                formatter={(value: any, name: string) => [
                  `${parseFloat(value).toLocaleString()} ${currency}`,
                  name
                ]}
              />
              <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Deposits" fill={depositColor} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Withdrawals" fill={withdrawalColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Category Expenses breakdown */}
      <div 
        className={`border rounded-2xl p-5 shadow-xl flex flex-col lg:col-span-2 transition-all duration-300 ${
          isLight 
            ? "bg-white border-slate-200 text-slate-850" 
            : "bg-slate-900 border-slate-800 text-slate-100"
        }`} 
        id="chart-pie-expenses"
      >
        <div className="mb-4">
          <h3 className={`text-sm font-semibold ${isLight ? "text-slate-805" : "text-slate-300"}`}>Category Expense Distribution</h3>
          <p className="text-xs text-slate-500">Breakdown of outbound transactions by category</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#f1f5f9" : "#1e293b"} horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={120} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: isLight ? "#ffffff" : "#0f172a", 
                    borderColor: isLight ? "#e2e8f0" : "#334155",
                    borderRadius: "12px",
                    color: isLight ? "#1e293b" : "#f1f5f9"
                  }}
                  itemStyle={{ color: withdrawalColor, fontSize: "11px" }}
                  formatter={(value: any) => [`${parseFloat(value).toLocaleString()} ${currency}`, "Withdrawal"]}
                />
                <Bar dataKey="value" fill={withdrawalColor} radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, index) => {
                    const colors = ["#f43f5e", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#10b981"];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={`p-4 border rounded-xl flex flex-col justify-center overflow-y-auto max-h-64 ${
            isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/50 border-slate-800"
          }`}>
            <h4 className="text-xs font-bold text-slate-400 mb-3 tracking-widest uppercase">Expenses Ranked</h4>
            <div className="space-y-3">
              {categoryData.map((item, idx) => {
                const totalWithdrawalsSum = categoryData.reduce((acc, c) => acc + c.value, 0);
                const percent = totalWithdrawalsSum ? ((item.value / totalWithdrawalsSum) * 100).toFixed(1) : "0";
                return (
                  <div key={item.name} className="flex justify-between items-center text-xs">
                    <span className={`font-semibold truncate max-w-[120px] ${isLight ? "text-slate-700" : "text-slate-300"}`}>{item.name}</span>
                    <div className="text-right">
                      <span className={`font-bold ${isLight ? "text-slate-800" : "text-slate-200"}`}>{item.value.toLocaleString()} {currency}</span>
                      <span className="text-slate-400 block text-[10px] font-bold font-mono">{percent}%</span>
                    </div>
                  </div>
                );
              })}
              {categoryData.length === 0 && (
                <div className="text-center text-slate-400 py-6 text-xs">No debit data available to categorize</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
