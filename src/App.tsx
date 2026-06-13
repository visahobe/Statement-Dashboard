import { useState } from "react";
import { PRELOADED_STATEMENTS } from "./data";
import { BankStatement, TransactionCategory, CategorizationRule } from "./types";
import OverviewStats from "./components/OverviewStats";
import VisualCharts from "./components/VisualCharts";
import TransactionList from "./components/TransactionList";
import StatementUploader from "./components/StatementUploader";
import RecurringTransactions from "./components/RecurringTransactions";
import { jsPDF } from "jspdf";
import {
  Landmark,
  Calendar,
  LayoutDashboard,
  BarChart3,
  PlusCircle,
  FileSpreadsheet,
  Sun,
  Moon,
  Edit2,
  Save,
  X,
  FileDown,
  UserCheck
} from "lucide-react";

export default function App() {
  const [statements, setStatements] = useState<BankStatement[]>(PRELOADED_STATEMENTS);
  const [activeStatementId, setActiveStatementId] = useState<string>("city-bank");
  const [activeTab, setActiveTab] = useState<"dashboard" | "charts" | "importer">("dashboard");
  
  // Theme state: "dark" or "light"
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Dynamic budget states per bank statement (persistent)
  const [statementBudgets, setStatementBudgets] = useState<Record<string, number>>({
    "city-bank": 110000,
    "ebl-bank": 75000,
  });

  // Dynamic state for auto-categorization rules
  const [categorizationRules, setCategorizationRules] = useState<CategorizationRule[]>([
    { id: "rule-1", keyword: "bkash", category: TransactionCategory.BKASH },
    { id: "rule-2", keyword: "nagad", category: TransactionCategory.NAGAD },
    { id: "rule-3", keyword: "atm", category: TransactionCategory.ATM },
    { id: "rule-4", keyword: "npsb", category: TransactionCategory.NPSB_TRANSFER },
    { id: "rule-5", keyword: "transfer", category: TransactionCategory.NPSB_TRANSFER },
    { id: "rule-6", keyword: "purchase", category: TransactionCategory.CARD_PURCHASE },
    { id: "rule-7", keyword: "deposit", category: TransactionCategory.REMIT_DEPOSIT },
    { id: "rule-8", keyword: "remit", category: TransactionCategory.REMIT_DEPOSIT },
    { id: "rule-9", keyword: "charge", category: TransactionCategory.CHARGES_TAX },
    { id: "rule-10", keyword: "tax on", category: TransactionCategory.CHARGES_TAX },
    { id: "rule-11", keyword: "interest", category: TransactionCategory.INTEREST },
    { id: "rule-12", keyword: "recharge", category: TransactionCategory.MOBILE_RECHARGE },
  ]);

  const handleAddRule = (newRule: CategorizationRule) => {
    setCategorizationRules((prev) => [newRule, ...prev]);
  };

  const handleRemoveRule = (id: string) => {
    setCategorizationRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateNotesTags = (txId: string, notes: string, tags: string[]) => {
    setStatements((prev) =>
      prev.map((stmt) => {
        if (stmt.id === activeStatementId) {
          return {
            ...stmt,
            transactions: stmt.transactions.map((tx) =>
              tx.id === txId ? { ...tx, notes, tags } : tx
            )
          };
        }
        return stmt;
      })
    );
  };

  const isLight = theme === "light";

  // Get active statement object
  const activeStatement = statements.find((s) => s.id === activeStatementId) || statements[0];
  const activeBudget = statementBudgets[activeStatement.id] ?? 80000;

  // Edit customer statement profile states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editOwner, setEditOwner] = useState(activeStatement.accountName);
  const [editAccNum, setEditAccNum] = useState(activeStatement.accountNumber);
  const [editCustId, setEditCustId] = useState(activeStatement.customerId || "");
  const [editTier, setEditTier] = useState(activeStatement.productName || "");
  const [editPrintDate, setEditPrintDate] = useState(activeStatement.printDate || "");
  const [editAddress, setEditAddress] = useState(activeStatement.address || "");
  const [editBranch, setEditBranch] = useState(activeStatement.branch || "");

  // Reset edit inputs when opening
  const triggerOpenEditingProfile = () => {
    setEditOwner(activeStatement.accountName);
    setEditAccNum(activeStatement.accountNumber);
    setEditCustId(activeStatement.customerId || "");
    setEditTier(activeStatement.productName || "");
    setEditPrintDate(activeStatement.printDate || "");
    setEditAddress(activeStatement.address || "");
    setEditBranch(activeStatement.branch || "");
    setIsEditingProfile(true);
  };

  // Callback to save edited statement properties
  const handleUpdateStatementProfile = () => {
    setStatements((prev) =>
      prev.map((stmt) => {
        if (stmt.id === activeStatementId) {
          return {
            ...stmt,
            accountName: editOwner,
            accountNumber: editAccNum,
            customerId: editCustId,
            productName: editTier,
            printDate: editPrintDate,
            address: editAddress,
            branch: editBranch
          };
        }
        return stmt;
      })
    );
    setIsEditingProfile(false);
  };

  // Callback to update budget
  const handleUpdateBudget = (newVal: number) => {
    setStatementBudgets((prev) => ({
      ...prev,
      [activeStatement.id]: newVal
    }));
  };

  // Callback to handle manual uploaded statement additions
  const handleImportStatement = (newStmt: BankStatement) => {
    setStatements((prev) => [newStmt, ...prev]);
    setActiveStatementId(newStmt.id);
    setActiveTab("dashboard");
  };

  // Callback to let user re-classify category dynamically
  const handleUpdateCategory = (txId: string, newCategory: TransactionCategory) => {
    setStatements((prev) =>
      prev.map((stmt) => {
        if (stmt.id === activeStatementId) {
          return {
            ...stmt,
            transactions: stmt.transactions.map((tx) =>
              tx.id === txId ? { ...tx, category: newCategory } : tx
            )
          };
        }
        return stmt;
      })
    );
  };

  // Mass re-classification handler
  const handleBatchUpdateCategory = (txIds: string[], newCategory: TransactionCategory) => {
    setStatements((prev) =>
      prev.map((stmt) => {
        if (stmt.id === activeStatementId) {
          return {
            ...stmt,
            transactions: stmt.transactions.map((tx) =>
              txIds.includes(tx.id) ? { ...tx, category: newCategory } : tx
            )
          };
        }
        return stmt;
      })
    );
  };

  // Permanently delete transaction list, dynamically adjusting closing balance and total flows
  const handleDeleteTransactions = (txIds: string[]) => {
    setStatements((prev) =>
      prev.map((stmt) => {
        if (stmt.id === activeStatementId) {
          const updatedTxs = stmt.transactions.filter((tx) => !txIds.includes(tx.id));
          
          const sumW = updatedTxs.reduce((sum, tx) => sum + (tx.withdrawal || 0), 0);
          const sumD = updatedTxs.reduce((sum, tx) => sum + (tx.deposit || 0), 0);
          const calculatedClosing = stmt.openingBalance + sumD - sumW;

          return {
            ...stmt,
            transactions: updatedTxs,
            totalWithdrawals: parseFloat(sumW.toFixed(2)),
            totalDeposits: parseFloat(sumD.toFixed(2)),
            closingBalance: parseFloat(calculatedClosing.toFixed(2))
          };
        }
        return stmt;
      })
    );
  };

  // High quality vector Executive PDF builder
  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    // Title header band
    doc.setFillColor(30, 27, 75); // Dark Purple/indigo brand color
    doc.rect(0, 0, 210, 42, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("EXECUTIVE FINANCIAL ANALYSIS REPORT", 14, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);
    doc.text(`Powered by Google AI Studio Smart Ledger Dashboard`, 14, 31);
    doc.text(`User Profile Verified Holder: ${activeStatement.accountName}`, 14, 36);
    
    // 1. Bank Profile segments
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("1. ACCOUNT HOLDER & STATEMENT METADATA", 14, 52);
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(220, 222, 230);
    doc.line(14, 55, 196, 55);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Verified Owner Name : ${activeStatement.accountName}`, 14, 62);
    doc.text(`Financial Institution: ${activeStatement.bankName} (${activeStatement.branch || "General Branch"})`, 14, 68);
    doc.text(`Account Ledger Num  : ${activeStatement.accountNumber}`, 14, 74);
    doc.text(`Customer Referral ID: ${activeStatement.customerId || "N/A"}`, 14, 80);
    doc.text(`Statement Period    : ${activeStatement.period}`, 14, 86);
    doc.text(`Billing Account Tier: ${activeStatement.productName || "GENERAL SAVINGS A/C"}`, 14, 92);
    doc.text(`Billing Address     : ${activeStatement.address || "ANAN TELECOM, JAMGORA, ASHULIA, DHAKA"}`, 14, 98);
    
    // Aggregator counts
    let totalD = 0;
    let totalW = 0;
    let countD = 0;
    let countW = 0;
    const categorySums: Record<string, number> = {};
    
    activeStatement.transactions.forEach((tx) => {
      if (tx.deposit && tx.deposit > 0) {
        totalD += tx.deposit;
        countD++;
      }
      if (tx.withdrawal && tx.withdrawal > 0) {
        totalW += tx.withdrawal;
        countW++;
        categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.withdrawal;
      }
    });
    
    const netC = totalD - totalW;
    const savingsR = totalD > 0 ? (netC / totalD) * 100 : 0;
    const latestB = activeStatement.transactions[activeStatement.transactions.length - 1]?.balance ?? activeStatement.closingBalance;
    
    // 2. Statistics Summary Card
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("2. STATEMENT COMPREHENSIVE CASHFLOWS & METRICS", 14, 110);
    doc.line(14, 113, 196, 113);
    
    doc.setFont("helvetica", "normal");
    doc.text("Statement Starting Opening Balance:", 14, 120);
    doc.setFont("helvetica", "bold");
    doc.text(`${activeStatement.openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${activeStatement.currency}`, 125, 120);
    
    doc.setFont("helvetica", "normal");
    doc.text("Total Statement Deposits (Inward Cashflow):", 14, 127);
    doc.setFont("helvetica", "bold");
    doc.text(`+${totalD.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${activeStatement.currency} (${countD} deposits)`, 125, 127);
    
    doc.setFont("helvetica", "normal");
    doc.text("Total Statement Withdrawals (Outward Cashflow):", 14, 134);
    doc.setFont("helvetica", "bold");
    doc.text(`-${totalW.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${activeStatement.currency} (${countW} withdrawals)`, 125, 134);
    
    doc.setFont("helvetica", "normal");
    doc.text("Calculated Net Cash Income Surplus/Deficit:", 14, 141);
    doc.setFont("helvetica", "bold");
    doc.text(`${netC >= 0 ? "+" : ""}${netC.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${activeStatement.currency}`, 125, 141);
    
    doc.setFont("helvetica", "normal");
    doc.text("Calculated Percentage Surplus Retention (Savings Rate):", 14, 148);
    doc.setFont("helvetica", "bold");
    doc.text(`${savingsR.toFixed(1)}%`, 125, 148);
    
    doc.setFont("helvetica", "normal");
    doc.text("Calculated Ledger Closing End Balance:", 14, 155);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 27, 75);
    doc.text(`${latestB.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${activeStatement.currency}`, 125, 155);
    
    // 3. Category Splits
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("3. THEMATIC SECTOR SPENDING SPLITS", 14, 168);
    doc.line(14, 171, 196, 171);
    
    doc.setFont("helvetica", "normal");
    let yPos = 178;
    const expenseEntries = Object.entries(categorySums).sort((a, b) => b[1] - a[1]);
    
    if (expenseEntries.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.text("No outgoing transactions/withdrawals identified on this ledger.", 14, yPos);
    } else {
      expenseEntries.forEach(([cat, sum]) => {
        if (yPos < 275) {
          doc.setFont("helvetica", "bold");
          doc.text(cat, 14, yPos);
          doc.setFont("helvetica", "normal");
          const ratio = totalW > 0 ? (sum / totalW) * 100 : 0;
          doc.text(`${sum.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${activeStatement.currency}  [ ${ratio.toFixed(1)}% of total debit flow ]`, 100, yPos);
          yPos += 7;
        }
      });
    }
    
    // Page 2: Recurring analysis & statement declaration
    doc.addPage();
    
    // Header strip page 2
    doc.setFillColor(30, 27, 75);
    doc.rect(0, 0, 210, 15, "F");
    
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("4. PATTERN INTELLIGENCE SUMMARY & DETECTED RECURRING DEBITS", 14, 30);
    doc.line(14, 33, 196, 33);
    
    // Manual recurring items aggregator
    const matchedGroups: Array<{ desc: string, amount: number, occurrences: number, dates: string[], category: string }> = [];
    const processed = new Set<string>();
    const txList = activeStatement.transactions;
    
    for (let i = 0; i < txList.length; i++) {
      const txA = txList[i];
      if (processed.has(txA.id)) continue;
      
      const valA = txA.withdrawal || txA.deposit || 0;
      if (valA === 0) continue;
      
      const matches: typeof txList = [txA];
      for (let j = i + 1; j < txList.length; j++) {
        const txB = txList[j];
        if (processed.has(txB.id)) continue;
        
        const valB = txB.withdrawal || txB.deposit || 0;
        const similarity = (Math.abs(valA - valB) / Math.max(valA, valB)) * 100;
        
        const descA_clean = txA.description.trim().substring(0, 12).toLowerCase();
        const descB_clean = txB.description.trim().substring(0, 12).toLowerCase();
        
        if (descA_clean === descB_clean && similarity <= 5) {
          matches.push(txB);
          processed.add(txB.id);
        }
      }
      
      if (matches.length >= 2) {
        matchedGroups.push({
          desc: txA.description,
          amount: valA,
          occurrences: matches.length,
          dates: matches.map(m => m.date),
          category: txA.category
        });
      }
      processed.add(txA.id);
    }
    
    doc.setFont("helvetica", "normal");
    let yPos2 = 40;
    if (matchedGroups.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.text("No repeating withdrawals or credit streams matching amount/descriptor signatures were found.", 14, yPos2);
    } else {
      matchedGroups.forEach((g) => {
        if (yPos2 < 250) {
          doc.setFont("helvetica", "bold");
          doc.text(g.desc, 14, yPos2);
          doc.setFont("helvetica", "normal");
          doc.text(`Frequency: ${g.occurrences}x matching similar ranges of BDT ${g.amount.toLocaleString()} [Category: ${g.category}]`, 14, yPos2 + 5);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(110, 110, 120);
          doc.text(`Identified dates: ${g.dates.join(", ")}`, 14, yPos2 + 9);
          doc.setTextColor(50, 50, 50);
          doc.setFontSize(9.5);
          yPos2 += 16;
        }
      });
    }
    
    // Corporate closing notice
    doc.line(14, 255, 196, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("CONSTITUTION STATEMENT DECLARATION", 14, 260);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("This analytical review compiles all parsed details in standard compliance format. Ensure proper local storage.", 14, 265);
    doc.text("© 2026 Google AI Studio - Strictly Confidential for Anawar Hossain Ridoy.", 14, 270);
    
    doc.save(`CorporatePDFReport_${activeStatement.accountName.split(" ").join("_")}.pdf`);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 selection:bg-indigo-500/30 selection:text-indigo-200 ${
      isLight ? "bg-white text-slate-800" : "bg-[#0b0f19] text-slate-100"
    }`}>

      {/* Primary header portal */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-300 ${
        isLight ? "bg-white/80 border-slate-200" : "bg-[#0b0f19]/80 border-[#1e293b]"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            
            {/* Owner & Statement Profile titles */}
            <div className="space-y-1" id="app-profile-title">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg border transition-colors ${
                  isLight ? "bg-indigo-50 text-indigo-650 border-indigo-100" : "bg-indigo-500/10 text-indigo-400 border-indigo-505/20"
                }`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <span className={`text-[10px] font-extrabold tracking-widest uppercase ${isLight ? "text-indigo-600" : "text-indigo-455"}`}>
                  Account Ledger & Executive Analytics
                </span>
              </div>
              <h1 className={`text-2xl font-black tracking-tight flex items-center gap-2.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                {activeStatement.accountName}
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  isLight ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-slate-800 text-slate-400 border-slate-700/60"
                }`}>
                  Verified Owner
                </span>
              </h1>
              <p className={`text-xs flex items-center gap-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Statement Period: <strong className={isLight ? "text-slate-700" : "text-slate-300"}>{activeStatement.period}</strong>
              </p>
            </div>

            {/* Profile Action Utilities, theme switch and Bank selection */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Theme Toggler Button */}
              <button
                onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isLight 
                    ? "bg-slate-100 border-slate-200 text-amber-600 hover:bg-slate-200" 
                    : "bg-slate-900 text-teal-400 border-slate-800 hover:border-slate-700 hover:text-white"
                }`}
                title="Toggle UI Color Interface Style"
                id="theme-toggler-header"
              >
                {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>

              {/* Generate PDF summary button */}
              <button
                onClick={generatePDFReport}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md hover:shadow-emerald-600/20 cursor-pointer"
                title="Download complete parsed financial overview report as PDF document"
              >
                <FileDown className="w-4 h-4" />
                Executive PDF Report
              </button>

              <div className="h-4 w-px bg-slate-300/20 hidden sm:block" />

              {statements.map((stmt) => (
                <button
                  key={stmt.id}
                  onClick={() => {
                    setActiveStatementId(stmt.id);
                    setActiveTab("dashboard");
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    activeStatementId === stmt.id
                      ? "bg-indigo-600 text-white border-indigo-505 shadow-md shadow-indigo-600/10"
                      : isLight
                        ? "bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                        : "bg-slate-900/60 text-slate-300 hover:text-white border-slate-800"
                  }`}
                >
                  <Landmark className={`w-3.5 h-3.5 ${activeStatementId === stmt.id ? "text-indigo-200" : "text-indigo-500"}`} />
                  {stmt.bankName}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container portal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Core meta specifications card */}
        <section 
          className={`border rounded-2xl p-6 transition-all duration-300 ${
            isLight 
              ? "bg-white border-slate-200 text-slate-800" 
              : "bg-[#131b2e] border-[#1e293b] text-slate-100"
          }`} 
          id="bank-specifications-panel"
        >
          {isEditingProfile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-500/10">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Edit Profile Owner Details</span>
                <span className="text-[10px] text-slate-400 font-mono">Changes apply to live dashboard instantly</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Verified Owner Name</label>
                  <input
                    type="text"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-sans font-semibold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Account Ledger Number</label>
                  <input
                    type="text"
                    value={editAccNum}
                    onChange={(e) => setEditAccNum(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono font-bold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Customer ID Code</label>
                  <input
                    type="text"
                    value={editCustId}
                    onChange={(e) => setEditCustId(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono font-bold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Product/Tier Category</label>
                  <input
                    type="text"
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-sans font-semibold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Billing Branch</label>
                  <input
                    type="text"
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-sans font-semibold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Print Date</label>
                  <input
                    type="text"
                    value={editPrintDate}
                    onChange={(e) => setEditPrintDate(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-mono font-bold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Physical Billing Profile Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className={`w-full px-2.5 py-1.5 text-xs rounded border outline-none font-sans font-semibold ${
                      isLight ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500" : "bg-slate-950 border-slate-800 text-white focus:border-indigo-400"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer ${
                    isLight ? "bg-slate-10 text-slate-600 hover:bg-slate-150" : "bg-slate-80 hover:bg-slate-850 text-slate-350"
                  }`}
                >
                  <X className="w-3.5 h-3.5 inline mr-1" />
                  Cancel
                </button>
                <button
                  onClick={handleUpdateStatementProfile}
                  className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 inline mr-1" />
                  Save instant profile updates
                </button>
              </div>
            </div>
          ) : (
            <div className="relative group/specs">
              {/* Quick Profile Editing Toggler Button */}
              <button
                onClick={triggerOpenEditingProfile}
                className={`absolute top-0 right-0 p-1.5 rounded-lg border transition-all cursor-pointer opacity-80 group-hover/specs:opacity-100 ${
                  isLight 
                    ? "bg-slate-50 border-slate-200 text-indigo-600 hover:bg-slate-100" 
                    : "bg-slate-900 border-slate-800 text-indigo-400 hover:bg-slate-800"
                }`}
                title="One-click changes to Verified Owner Details"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1 inline" />
                <span className="text-[10px] font-bold">Edit Details</span>
              </button>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 pr-24">
                <div className="space-y-1">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? "text-slate-450" : "text-slate-500"}`}>Bank Identity</span>
                  <span className={`text-xs font-extrabold block ${isLight ? "text-slate-850" : "text-slate-200"}`}>{activeStatement.bankName}</span>
                  {activeStatement.branch && (
                    <span className="text-[10px] text-indigo-500 block font-bold">{activeStatement.branch}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? "text-slate-450" : "text-slate-500"}`}>Account Number</span>
                  <span className={`text-xs font-mono font-bold tracking-wider block ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                    {activeStatement.accountNumber}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? "text-slate-450" : "text-slate-500"}`}>CustomerID / Ref</span>
                  <span className={`text-xs font-mono font-bold tracking-wide block ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                    {activeStatement.customerId || "N/A - Imported"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? "text-slate-450" : "text-slate-500"}`}>Tier Product</span>
                  <span className={`text-xs block font-extrabold font-mono ${isLight ? "text-indigo-650" : "text-indigo-400"}`}>
                    {activeStatement.productName || "GENERAL SAVINGS A/C"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? "text-slate-450" : "text-slate-500"}`}>Print Date</span>
                  <span className={`text-xs block font-bold font-mono ${isLight ? "text-slate-700" : "text-slate-350"}`}>
                    {activeStatement.printDate || "12-06-2026"}
                  </span>
                </div>

                <div className="space-y-1 col-span-2 md:col-span-1">
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${isLight ? "text-slate-450" : "text-slate-500"}`}>Billing Address</span>
                  <span className={`text-[9px] leading-snug block font-medium truncate ${isLight ? "text-slate-650" : "text-slate-300"}`} title={activeStatement.address || "CB Account Holder"}>
                    {activeStatement.address || "ANAN TELECOM, JAMGORA, DHAKA"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Global Financial metrics indicators widget */}
        <OverviewStats 
          statement={activeStatement} 
          currency={activeStatement.currency} 
          theme={theme}
          monthlyBudget={activeBudget}
          onUpdateBudget={handleUpdateBudget}
        />

        {/* Dynamic section tabs */}
        <div className={`flex border-b gap-6 transition-all duration-300 ${isLight ? "border-slate-200" : "border-slate-800"}`} id="dashboard-sections-navigation">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`pb-3.5 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Ledger & Logging
          </button>
          
          <button
            onClick={() => setActiveTab("charts")}
            className={`pb-3.5 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "charts"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Visual Trends
          </button>
          
          <button
            onClick={() => setActiveTab("importer")}
            className={`pb-3.5 text-xs font-black flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "importer"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Import / OCR Paste
          </button>
        </div>

        {/* Tab content renderer portal */}
        <section className="transition-all duration-300">
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Recurring Pattern Intelligence component */}
              <RecurringTransactions
                transactions={activeStatement.transactions}
                currency={activeStatement.currency}
                theme={theme}
              />

              {/* Transactions Listing with Full Batch Capability */}
              <TransactionList
                transactions={activeStatement.transactions}
                onUpdateCategory={handleUpdateCategory}
                onBatchUpdateCategory={handleBatchUpdateCategory}
                onDeleteTransactions={handleDeleteTransactions}
                onUpdateNotesTags={handleUpdateNotesTags}
                currency={activeStatement.currency}
                activeStatementId={activeStatement.id}
                theme={theme}
              />
            </div>
          )}

          {activeTab === "charts" && (
            <VisualCharts
              transactions={activeStatement.transactions}
              currency={activeStatement.currency}
              theme={theme}
            />
          )}

          {activeTab === "importer" && (
            <StatementUploader 
              onImportStatement={handleImportStatement} 
              theme={theme}
              rules={categorizationRules}
              onAddRule={handleAddRule}
              onRemoveRule={handleRemoveRule}
            />
          )}
        </section>
      </main>

      {/* Compact footer credit card */}
      <footer className={`border-t text-center py-7 text-[11px] font-mono tracking-tight transition-color duration-300 ${
        isLight ? "bg-slate-100 border-slate-200 text-slate-500" : "bg-slate-950/40 border-slate-900 text-slate-500"
      }`}>
        <span>© 2026 Google AI Studio Financial Portal. Proprietary management workspace powered for ANAWAR HOSSAIN RIDOY.</span>
      </footer>
    </div>
  );
}
