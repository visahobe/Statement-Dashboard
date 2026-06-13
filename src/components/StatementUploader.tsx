import React, { useState, useRef } from "react";
import { UploadCloud, Clipboard, CheckCircle2, AlertCircle, Sparkles, X } from "lucide-react";
import { BankStatement, Transaction, TransactionCategory, CategorizationRule } from "../types";

interface StatementUploaderProps {
  onImportStatement: (statement: BankStatement) => void;
  theme?: "light" | "dark";
  rules: CategorizationRule[];
  onAddRule: (rule: CategorizationRule) => void;
  onRemoveRule: (id: string) => void;
}

export default function StatementUploader({ 
  onImportStatement,
  theme = "dark",
  rules = [],
  onAddRule,
  onRemoveRule
}: StatementUploaderProps) {
  const isLight = theme === "light";
  const [dragActive, setDragActive] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importBankName, setImportBankName] = useState("My Uploaded Bank");
  const [pastedText, setPastedText] = useState("");
  const [showPasteModal, setShowPasteModal] = useState(false);

  // States for rule-builder inputs
  const [newRuleKeyword, setNewRuleKeyword] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<TransactionCategory>(TransactionCategory.BKASH);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const parseStatementContent = (text: string, filename: string): BankStatement | null => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedTxs: Transaction[] = [];

    const dateRegex = /(\d{2}[-/]\d{2}[-/]\d{4})|(\d{2}[-/][a-zA-Z]{3}[-/]\d{4})/;

    let rollingBalance = 0;

    lines.forEach((line) => {
      const match = line.match(dateRegex);
      if (match) {
        const dateStr = match[0].replace(/\//g, "-");
        let restStr = line.replace(match[0], "").trim();

        const moneyRegex = /(-?\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;
        const numbers = restStr.match(moneyRegex);

        let desc = restStr;
        let withdrawal: number | null = null;
        let deposit: number | null = null;
        let balance = 0;

        if (numbers && numbers.length >= 2) {
          const firstVal = parseFloat(numbers[0].replace(/,/g, ""));
          const lastVal = parseFloat(numbers[numbers.length - 1].replace(/,/g, ""));

          if (firstVal < 0) {
            withdrawal = Math.abs(firstVal);
          } else if (firstVal > 0) {
            // Determine if credit or debit based on position or context
            const lowerDesc = desc.toLowerCase();
            if (lowerDesc.includes("transfer") || lowerDesc.includes("recharge") || lowerDesc.includes("payment") || lowerDesc.includes("cashout") || lowerDesc.includes("fee")) {
              withdrawal = firstVal;
            } else {
              deposit = firstVal;
            }
          }

          balance = lastVal;
          desc = restStr.replace(numbers[0], "").replace(numbers[numbers.length - 1], "").replace(/[|,\s]+/g, " ").trim();
        } else if (numbers && numbers.length === 1) {
          const singleVal = parseFloat(numbers[0].replace(/,/g, ""));
          const lowerDesc = desc.toLowerCase();
          if (lowerDesc.includes("interest") || lowerDesc.includes("credit") || lowerDesc.includes("deposit")) {
            deposit = singleVal;
          } else {
            withdrawal = singleVal;
          }
          balance = rollingBalance + (deposit || 0) - (withdrawal || 0);
          desc = restStr.replace(numbers[0], "").replace(/[|,\s]+/g, " ").trim();
        }

        if (desc.startsWith("|")) desc = desc.substring(1).trim();
        if (desc.endsWith("|")) desc = desc.substring(0, desc.length - 1).trim();

        rollingBalance = balance;

        // Auto-categorize via evaluation rules keyword mapping
        let category = TransactionCategory.UNASSIGNED;
        const d = desc.toLowerCase();
        for (const rule of rules) {
          if (d.includes(rule.keyword.toLowerCase())) {
            category = rule.category;
            break;
          }
        }

        parsedTxs.push({
          id: `tx-uploaded-${Math.random().toString(36).substring(2, 9)}`,
          date: dateStr,
          description: desc || "Transactional Flow",
          chqNo: "",
          withdrawal,
          deposit,
          balance,
          category,
          source: "uploaded",
          notes: "",
          tags: []
        });
      }
    });

    if (parsedTxs.length === 0) return null;

    const openingVal = parsedTxs[0].balance - (parsedTxs[0].deposit || 0) + (parsedTxs[0].withdrawal || 0);
    const sumW = parsedTxs.reduce((sum, tx) => sum + (tx.withdrawal || 0), 0);
    const sumD = parsedTxs.reduce((sum, tx) => sum + (tx.deposit || 0), 0);

    return {
      id: `statement-uploaded-${Date.now()}`,
      bankName: importBankName,
      accountName: "ANAWAR HOSSAIN RIDOY",
      accountNumber: "230415174400" + Math.floor(10 + Math.random() * 90),
      customerId: "CB4151744",
      period: "12-04-2026 To 12-06-2026",
      productName: "GENERAL SAVINGS A/C",
      currency: "BDT",
      address: "ZIRABO, ASHULIA, DHAKA, BANGLADESH",
      printDate: "12-06-2026",
      openingBalance: parseFloat(openingVal.toFixed(2)),
      closingBalance: parseFloat(rollingBalance.toFixed(2)),
      totalWithdrawals: parseFloat(sumW.toFixed(2)),
      totalDeposits: parseFloat(sumD.toFixed(2)),
      transactions: parsedTxs
    };
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const stmt = parseStatementContent(text, file.name);
      if (stmt) {
        onImportStatement(stmt);
        setSuccessMsg(`Decoded ${stmt.transactions.length} items from ${file.name} successfully!`);
        setErrorMsg(null);
      } else {
        setErrorMsg(`Failed to extract valid chronologies from file ${file.name}. Ensure it contains columns with dates and decimal values.`);
        setSuccessMsg(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg("Error standard reading file.");
    };
    reader.readAsText(file);
  };

  const handlePastedTextSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg("Clipboard string cannot be fully empty.");
      return;
    }

    const stmt = parseStatementContent(pastedText, "pasted_text");
    if (stmt) {
      onImportStatement(stmt);
      setSuccessMsg(`Decoded ${stmt.transactions.length} items from clipboard OCR text successfully!`);
      setPastedText("");
      setShowPasteModal(false);
    } else {
      setErrorMsg("No valid ledger entries decoded. Double-check clipboard text conforms with dates and transaction figures.");
    }
  };

  return (
    <div 
      className={`border rounded-2xl p-6 shadow-xl space-y-6 transition-all duration-300 ${
        isLight 
          ? "bg-white border-slate-200 text-slate-800" 
          : "bg-slate-900 border-slate-800 text-slate-100"
      }`} 
      id="uploader-panel"
    >
      <div>
        <h3 className={`text-sm font-semibold ${isLight ? "text-slate-800" : "text-slate-200"}`}>Import Additional Statements</h3>
        <p className="text-xs text-slate-505 text-slate-500">Drag or click files to parse bank transactions, or directly paste OCR statement readouts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Bank name helper input */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider block text-slate-400">Custom Bank Label</label>
          <input
            type="text"
            value={importBankName}
            onChange={(e) => setImportBankName(e.target.value)}
            className={`w-full px-3 py-1.5 text-xs rounded-lg outline-none transition font-sans font-bold ${
              isLight 
                ? "bg-slate-50 border border-slate-300 text-slate-800 focus:border-indigo-550" 
                : "bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 text-slate-200"
            }`}
            placeholder="e.g. City Bank, HSBC, etc."
          />
        </div>

        {/* Action button to open paste snippet */}
        <div className="md:col-span-2 flex items-end">
          <button
            onClick={() => setShowPasteModal(true)}
            className={`w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer border ${
              isLight 
                ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-250" 
                : "bg-slate-850 hover:bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-200"
            }`}
          >
            <Clipboard className="w-4 h-4 text-indigo-550 text-indigo-400" />
            Paste Statement Block / OCR
          </button>
        </div>
      </div>

      {/* Drag Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all ${
          dragActive
            ? "border-indigo-500 bg-indigo-500/5"
            : isLight
              ? "border-slate-300 hover:border-indigo-400 bg-slate-50/50"
              : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        id="drop-target-area"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.txt,.tsv"
          onChange={handleFileInputChange}
        />
        <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
        <p className={`text-xs font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
          Drag and drop statement file here, or{" "}
          <span className="text-indigo-500 hover:text-indigo-400 cursor-pointer font-bold underline animate-pulse" onClick={triggerFileInput}>
            browse from system
          </span>
        </p>
        <p className="text-[10px] text-slate-500 mt-1.5 font-mono">Supports raw .CSV, .TXT statements with chronological listings</p>
      </div>

      {/* Success / Error notification strips */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2 text-emerald-600 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-600 text-xs font-bold">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 animate-[shake_0.4s_ease-in-out]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* OCR/Clipboard paste popup modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" id="paste-modal">
          <div className={`rounded-2xl w-full max-w-xl p-6 shadow-2xl flex flex-col max-h-[85vh] border ${
            isLight ? "bg-white border-slate-200 text-slate-800" : "bg-slate-900 border-slate-800 text-slate-100"
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-indigo-500/10 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-550 text-indigo-400" />
                <h4 className={`text-sm font-bold ${isLight ? "text-slate-850" : "text-white"}`}>OCR & Text Auto-Decoder</h4>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight ? "text-slate-400 hover:bg-slate-100 text-slate-500" : "text-slate-550 hover:bg-slate-800 text-slate-350"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <p className="text-xs text-slate-500 leading-relaxed font-bold">
                Paste any standard block of text containing transactions (like your statement OCR details). Our engine will inspect rows to extract dates, references, debit/credit values and construct structural records.
              </p>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="05-Jan-2026 | Opening Balance | | 96,417.14 | 96,417.14&#10;05-Jan-2026 | EBL bKash Transfer | 4,100.00 | | 92,317.14"
                className={`w-full flex-1 p-3 rounded-lg outline-none text-xs font-mono resize-none h-48 border font-bold ${
                  isLight 
                    ? "bg-slate-50 border-slate-300 text-slate-800 focus:border-indigo-500" 
                    : "bg-slate-950 border-slate-800 focus:border-indigo-400 text-slate-200"
                }`}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-indigo-500/10 mt-4">
              <button
                onClick={() => setShowPasteModal(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                  isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-600" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handlePastedTextSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition cursor-pointer"
              >
                Decode Clipboard Text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART CATEGORIZATION RULES PANEL */}
      <div 
        className={`border rounded-2xl p-6 shadow-md space-y-6 transition-all duration-300 mt-6 ${
          isLight 
            ? "bg-white border-slate-200 text-slate-800" 
            : "bg-[#131b2e] border-[#1e293b] text-slate-100"
        }`}
        id="rules-manager-panel"
      >
        <div>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? "text-slate-800" : "text-slate-200"}`}>
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Smart Auto-Categorization Rules Manager
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Assign custom transaction categories automatically based on keyword matching logic in descriptions.
          </p>
        </div>

        {/* Create Rule Form */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/30 border-[#1e293b]"} grid grid-cols-1 md:grid-cols-3 gap-3 items-end`}>
          <div className="space-y-1.5">
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? "text-slate-500" : "text-slate-450"}`}>If description contains:</span>
            <input
              type="text"
              value={newRuleKeyword}
              onChange={(e) => setNewRuleKeyword(e.target.value)}
              placeholder="e.g. netflix, uber, ebl, payroll"
              className={`w-full px-3 py-1.5 text-xs rounded-lg outline-none font-semibold ${
                isLight 
                  ? "bg-white border border-slate-305 text-slate-850 focus:border-indigo-500" 
                  : "bg-slate-900 border border-slate-800 focus:border-indigo-505 text-slate-200"
              }`}
            />
          </div>
          <div className="space-y-1.5">
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? "text-slate-500" : "text-slate-450"}`}>Assign to category:</span>
            <select
              value={newRuleCategory}
              onChange={(e) => setNewRuleCategory(e.target.value as TransactionCategory)}
              className={`w-full px-3 py-1.5 text-xs rounded-lg outline-none font-semibold cursor-pointer ${
                isLight 
                  ? "bg-white border border-slate-205 text-slate-850" 
                  : "bg-slate-905 border border-slate-800 text-slate-200"
              }`}
            >
              {Object.values(TransactionCategory).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (!newRuleKeyword.trim()) return;
              onAddRule({
                id: `rule-${Date.now()}`,
                keyword: newRuleKeyword.trim().toLowerCase(),
                category: newRuleCategory
              });
              setNewRuleKeyword("");
            }}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-xs transition cursor-pointer"
          >
            Create Match Rule
          </button>
        </div>

        {/* Existing active rules list */}
        <div className="space-y-2">
          <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
            Evaluation Rules Order ({rules.length} matched rules)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1 text-slate-200">
            {rules.map((rule) => (
              <div 
                key={rule.id} 
                className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                  isLight 
                    ? "bg-white border-slate-250 text-slate-850" 
                    : "bg-[#182237] border-[#1e293b] text-slate-100"
                }`}
              >
                <div>
                  <span className="font-semibold block truncate max-w-[130px]">
                    matches <strong className="text-indigo-400 font-mono">"{rule.keyword}"</strong>
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold mt-1 inline-block ${
                    isLight ? "bg-indigo-50 text-indigo-650" : "bg-indigo-950/40 text-indigo-305"
                  }`}>
                    {rule.category}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveRule(rule.id)}
                  className={`p-1 rounded-md transition hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer ${
                    isLight ? "text-slate-400 hover:text-slate-600" : "text-slate-500 hover:text-white"
                  }`}
                  title="Remove Rule"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
