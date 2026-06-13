import { useState, useEffect } from "react";
import { 
  initAuth, 
  googleSignIn, 
  logout 
} from "../lib/firebase";
import { User } from "firebase/auth";
import { BankStatement, Transaction } from "../types";
import { 
  Cloud, 
  FileText, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FolderUp, 
  FolderDown, 
  LogOut, 
  ArrowRight,
  ExternalLink,
  ChevronDown
} from "lucide-react";

interface WorkspacePanelProps {
  activeStatement: BankStatement;
  onImportStatement: (statement: BankStatement) => void;
  theme: "light" | "dark";
}

export default function WorkspacePanel({
  activeStatement,
  onImportStatement,
  theme
}: WorkspacePanelProps) {
  const isLight = theme === "light";
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Drive States
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; mimeType: string }[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveActionStatus, setDriveActionStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);

  // Docs States
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  const [createdDocUrl, setCreatedDocUrl] = useState<string | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [docStatus, setDocStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Gmail States
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Initialize auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setDriveActionStatus(null);
    setDocStatus(null);
    setEmailStatus(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error("Authentication or scope loading failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setDriveFiles([]);
      setCreatedDocId(null);
      setCreatedDocUrl(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ----------------------------------------------------
  // GOOGLE DRIVE INTEGRATION
  // ----------------------------------------------------

  // Save parsed statement (ledger) as JSON file to Google Drive
  const handleSaveToDrive = async () => {
    if (!accessToken) return;
    
    // Explicit User Confirmation Dialog (MANDATORY per safety guidelines)
    const confirmed = window.confirm(
      `Do you want to save the ledger "${activeStatement.bankName} - ${activeStatement.accountName}" directly as a backup statement inside your Google Drive?`
    );
    if (!confirmed) return;

    setUploadingToDrive(true);
    setDriveActionStatus(null);

    try {
      const filename = `${activeStatement.id}-backup-${new Date().toISOString().split('T')[0]}.json`;
      const fileData = JSON.stringify(activeStatement, null, 2);

      // Multipart Upload format for metadata + content
      const boundary = "------LedgerMultipartBoundary314159265";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        mimeType: "application/json",
        description: `Backed up transaction ledger of ${activeStatement.accountName} from Bangladesh Bank Ledger Analyzer.`
      };

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        fileData +
        closeDelim;

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });

      if (!res.ok) {
        throw new Error(`Drive upload status returned code ${res.status}`);
      }

      const result = await res.json();
      setDriveActionStatus({
        type: "success",
        msg: `Successfully saved backup file "${filename}" to Google Drive (ID: ${result.id.substring(0, 12)}...)`
      });
      
      // Auto-refresh file list
      loadDriveFiles();
    } catch (err: any) {
      console.error("Drive upload error:", err);
      setDriveActionStatus({
        type: "error",
        msg: `Failed to backup ledger file: ${err.message}`
      });
    } finally {
      setUploadingToDrive(false);
    }
  };

  // List recent JSON backup files or statements from Google Drive
  const loadDriveFiles = async () => {
    if (!accessToken) return;
    setLoadingDrive(true);
    setDriveActionStatus(null);
    try {
      // Find JSON files containing statement or backup metadata
      const query = encodeURIComponent("mimeType = 'application/json' and trashed = false");
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=10&fields=files(id,name,mimeType)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        throw new Error(`API returned code ${res.status}`);
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      console.error("Listing Drive files failed:", err);
      setDriveActionStatus({
        type: "error",
        msg: `Failed to load statements index: ${err.message}`
      });
    } finally {
      setLoadingDrive(false);
    }
  };

  // Import / parse the selected statement from Google Drive
  const handleImportFromFile = async (fileId: string, filename: string) => {
    if (!accessToken) return;
    const confirmed = window.confirm(`Are you sure you want to download and import "${filename}"? This will add or replace current ledger details.`);
    if (!confirmed) return;

    setLoadingDrive(true);
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        throw new Error(`Downloading file failed: ${res.status}`);
      }
      const data = await res.json();
      
      // Check if it's a valid BankStatement
      if (data && data.id && data.bankName && Array.isArray(data.transactions)) {
        onImportStatement(data);
        setDriveActionStatus({
          type: "success",
          msg: `Successfully loaded ledger "${data.bankName}" with ${data.transactions.length} items from Drive!`
        });
      } else {
        throw new Error("Invalid statement file format. Must be a valid analyzer backup JSON.");
      }
    } catch (err: any) {
      console.error("Error importing statement from Drive:", err);
      setDriveActionStatus({
        type: "error",
        msg: `Import failed: ${err.message}`
      });
    } finally {
      setLoadingDrive(false);
    }
  };

  // ----------------------------------------------------
  // GOOGLE DOCS INTEGRATION
  // ----------------------------------------------------

  // Generate an automated executive summary document inside Google Docs
  const handleGenerateDocReport = async () => {
    if (!accessToken) return;
    
    // Explicit user authorization confirmation
    const confirmed = window.confirm("Create a secure, fully-formatted executive financial details ledger sheet on Google Docs?");
    if (!confirmed) return;

    setGeneratingDoc(true);
    setDocStatus(null);
    setCreatedDocId(null);
    setCreatedDocUrl(null);

    try {
      const docTitle = `Executive Financial Audit - ${activeStatement.bankName} (${activeStatement.accountName})`;
      
      // Step A: Create and initialize blank doc with Title
      const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: docTitle })
      });

      if (!createRes.ok) {
        throw new Error(`Docs creation returned code ${createRes.status}`);
      }

      const docObj = await createRes.json();
      const documentId = docObj.documentId;

      // Calculate brief aggregates to write in the document
      let totalW = 0;
      let totalD = 0;
      activeStatement.transactions.forEach((tx) => {
        totalW += (tx.withdrawal || 0);
        totalD += (tx.deposit || 0);
      });

      // Construct a highly detailed professional text layout
      const summaryText = 
        `EXECUTIVE FINANCIAL ANALYSIS REPORT\n` +
        `===================================\n` +
        `Generated on: ${new Date().toLocaleString()}\n` +
        `Software Portal: Bangladesh Bank Statement Ledger Analyzer\n\n` +
        `1. ACCOUNT HOLDER PROFILE\n` +
        `-------------------------\n` +
        `Institution  : ${activeStatement.bankName}\n` +
        `Account Name : ${activeStatement.accountName}\n` +
        `Account No   : ${activeStatement.accountNumber}\n` +
        `Customer Ref : ${activeStatement.customerId || "N/A"}\n` +
        `Period Range : ${activeStatement.period}\n` +
        `Billing Tier : ${activeStatement.productName || "General Savings"}\n` +
        `Branch Office: ${activeStatement.branch || "General Branch"}\n\n` +
        `2. CASHFLOW LEDGER PERFORMANCE METRICS\n` +
        `-------------------------------------\n` +
        `Opening Ledger Balance : ${activeStatement.openingBalance.toLocaleString()} ${activeStatement.currency}\n` +
        `Total Realized Deposits: +${totalD.toLocaleString()} ${activeStatement.currency}\n` +
        `Total Realized Debits  : -${totalW.toLocaleString()} ${activeStatement.currency}\n` +
        `Net Ledger Difference  : ${(totalD - totalW).toLocaleString()} ${activeStatement.currency}\n` +
        `Closing Ledger Balance : ${activeStatement.closingBalance.toLocaleString()} ${activeStatement.currency}\n\n` +
        `3. STATEMENT TRANSACTION ENTRIES (${activeStatement.transactions.length} rows)\n` +
        `--------------------------------------------------------\n` +
        activeStatement.transactions.map((tx) => 
          `[${tx.date}] ${tx.description.substring(0, 30).padEnd(30)} | ` +
          `Withdrawal: ${(tx.withdrawal ? `-${tx.withdrawal.toLocaleString()}` : "0").padEnd(10)} | ` +
          `Deposit: ${(tx.deposit ? `+${tx.deposit.toLocaleString()}` : "0").padEnd(10)} | ` +
          `L. Bal: ${tx.balance.toLocaleString()} ${activeStatement.currency} | ` +
          `Class: ${tx.category}`
        ).join("\n") +
        `\n\n===================================\n` +
        `Audit record complete. Authorized by holder workspace session.\n`;

      // Step B: Write text content to Google Doc using batchUpdate API
      const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: summaryText
              }
            }
          ]
        })
      });

      if (!updateRes.ok) {
        throw new Error(`Docs writing returned code ${updateRes.status}`);
      }

      setCreatedDocId(documentId);
      setCreatedDocUrl(`https://docs.google.com/document/d/${documentId}/edit`);
      setDocStatus({
        type: "success",
        msg: `Successfully compiled financial analysis report to Google Docs!`
      });
    } catch (err: any) {
      console.error("Docs report failed:", err);
      setDocStatus({
        type: "error",
        msg: `Failed to compile Doc report: ${err.message}`
      });
    } finally {
      setGeneratingDoc(false);
    }
  };

  // ----------------------------------------------------
  // GMAIL INTEGRATION
  // ----------------------------------------------------

  // Send statement summary directly via users' Gmail SMTP proxy REST API
  const handleSendGmailReport = async () => {
    if (!accessToken) return;
    if (!recipientEmail.trim()) {
      alert("Please specify a valid recipient email address first.");
      return;
    }

    const confirmed = window.confirm(`Send out this comprehensive financial ledger audit summary securely to ${recipientEmail} via your Gmail account?`);
    if (!confirmed) return;

    setSendingEmail(true);
    setEmailStatus(null);

    try {
      let totalW = 0;
      let totalD = 0;
      activeStatement.transactions.forEach((tx) => {
        totalW += (tx.withdrawal || 0);
        totalD += (tx.deposit || 0);
      });

      // HTML message body formatting
      const htmlBody = `
        <div style="font-family: 'Inter', sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
          <div style="background-color: #312e81; padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 850; letter-spacing: -0.5px;">EXECUTIVE STATEMENT AUDIT ALERT</h1>
            <p style="color: #a5b4fc; margin: 5px 0 0 0; font-size: 11px; font-weight: 600;">Bangladesh Bank Statement Analysis Portal</p>
          </div>

          <p style="font-size: 13px; line-height: 1.6;">Hello,</p>
          <p style="font-size: 13px; line-height: 1.6;">You are receiving this official ledger metadata extract for <strong>${activeStatement.accountName}</strong>. Find the cashflow recap figures listed below:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12.5px;">
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Bank Institution</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">${activeStatement.bankName} (${activeStatement.branch || 'General'})</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Verification Account No</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; font-family: monospace;">${activeStatement.accountNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Statement Period Range</td>
              <td style="padding: 10px; text-align: right;">${activeStatement.period}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; font-weight: bold; color: #475569;">Opening Balance</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: #475569;">${activeStatement.openingBalance.toLocaleString()} ${activeStatement.currency}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f0fdf4;">
              <td style="padding: 10px; font-weight: bold; color: #15803d;">Total Inward Deposits</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: #15803d;">+${totalD.toLocaleString()} ${activeStatement.currency}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fef2f2;">
              <td style="padding: 10px; font-weight: bold; color: #b91c1c;">Total Outward Debits</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: #b91c1c;">-${totalW.toLocaleString()} ${activeStatement.currency}</td>
            </tr>
            <tr style="border-bottom: 2px solid #312e81; background-color: #e0e7ff;">
              <td style="padding: 12px 10px; font-weight: bold; color: #312e81;">Net Ending Balance</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: bold; color: #312e81; font-size: 14px;">${activeStatement.closingBalance.toLocaleString()} ${activeStatement.currency}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            This email was compiled and transmitted via automated Google Workspace Rest authorization in real-time.
          </div>
        </div>
      `;

      // Formulate mime raw content
      const subject = `Executive Summary Alert: ${activeStatement.bankName} - ${activeStatement.accountName}`;
      const mailString = [
        `To: ${recipientEmail}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        htmlBody
      ].join("\r\n");

      // RFC 2822 Web-safe base64url conversion
      const rawBase64 = btoa(unescape(encodeURIComponent(mailString)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: rawBase64 })
      });

      if (!res.ok) {
        throw new Error(`Gmail API response status ${res.status}`);
      }

      setEmailStatus({
        type: "success",
        msg: `Email successfully transmitted to ${recipientEmail} via Gmail SMTP API!`
      });
      setRecipientEmail("");
    } catch (err: any) {
      console.error("Gmail transmission failed:", err);
      setEmailStatus({
        type: "error",
        msg: `Failed to dispatch Gmail: ${err.message}`
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div 
      className={`border rounded-2xl p-6 shadow-xl transition-all duration-300 ${
        isLight 
          ? "bg-white border-slate-200 text-slate-850" 
          : "bg-[#0b1329] border-slate-800 text-slate-100"
      }`}
      id="google-workspace-integrations-panel"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 mb-6 border-slate-850/10">
        <div>
          <h2 className="text-sm font-black flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-indigo-500 animate-pulse" />
            Google Workspace Productivity Suite
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Connect your secure Google account to back up statements to Drive, export audit notes to Docs, or instantly email recap reports using Gmail.
          </p>
        </div>

        {/* Auth Status & Login Button */}
        {needsAuth ? (
          <button
            onClick={handleSignIn}
            disabled={isLoggingIn}
            className="gsi-material-button text-xs py-1 px-1.5 font-bold transition-all flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg shadow-sm cursor-pointer"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            )}
            <span className="gsi-material-button-contents font-semibold">{isLoggingIn ? "Logging in..." : "Google authentication"}</span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className={`text-[10px] font-bold block ${isLight ? "text-slate-805" : "text-slate-300"}`}>{user?.displayName || "Workspace User"}</span>
              <span className="text-[9px] text-[#22c55e] block font-extrabold uppercase font-mono tracking-wider">● Authorized</span>
            </div>
            <button
              onClick={handleLogout}
              className={`p-2 rounded-xl transition border cursor-pointer ${
                isLight 
                  ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100" 
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
              title="Sign out of Google Workspace"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        )}
      </div>

      {needsAuth ? (
        <div className={`p-8 rounded-2xl text-center border font-sans ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/40 border-slate-850"}`}>
          <div className="p-3 bg-indigo-500/15 text-indigo-505 w-fit rounded-full mx-auto mb-3">
            <Cloud className="w-6 h-6 text-indigo-400" />
          </div>
          <h3 className="text-sm font-black mb-1">Google Workspace Cloud Capabilities Locked</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4 leading-normal">
            Authenticate using your Google account to unlock cloud storage features, document report creation, and transactional mailing services.
          </p>
          <button 
            onClick={handleSignIn}
            className="px-6 py-2 bg-indigo-650 hover:bg-indigo-600 font-extrabold text-xs text-white rounded-xl shadow-md transition-all cursor-pointer"
          >
            Authenticate Google Profile
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
          
          {/* COLUMN 1: GOOGLE DRIVE BACKUPS */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/20 border-slate-850"}`}>
            <div className="space-y-3.5">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-indigo-500 flex items-center gap-1.5">
                <FolderUp className="w-4 h-4" />
                Google Drive Storage
              </span>
              
              <p className="text-xs text-slate-400 leading-normal font-medium">
                Store fully classified dynamic JSON statements files directly onto your Drive folders as continuous historical backups.
              </p>

              {driveActionStatus && (
                <div className={`p-2.5 rounded-lg border text-[10.5px] leading-snug flex items-start gap-1.5 ${
                  driveActionStatus.type === "success" 
                    ? "bg-emerald-500/5 border-emerald-505/10 text-emerald-400" 
                    : "bg-rose-500/5 border-rose-505/10 text-rose-400"
                }`}>
                  {driveActionStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <span>{driveActionStatus.msg}</span>
                </div>
              )}

              {/* List of Loaded Files */}
              <div className="space-y-2 pt-1 border-t border-slate-800/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold block">Drive Backups Index</span>
                  <button 
                    onClick={loadDriveFiles}
                    disabled={loadingDrive}
                    className="text-[9px] text-indigo-500 hover:underline font-black cursor-pointer uppercase"
                  >
                    {loadingDrive ? "Loading..." : "Scan drive files"}
                  </button>
                </div>

                {driveFiles.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {driveFiles.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleImportFromFile(f.id, f.name)}
                        className={`w-full p-2 rounded text-left text-[11px] font-semibold border flex items-center justify-between transition-all cursor-pointer ${
                          isLight 
                            ? "bg-white hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-200" 
                            : "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300"
                        }`}
                        title="Click to download and overlay content"
                      >
                        <span className="truncate max-w-[140px] font-mono">{f.name}</span>
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-black shrink-0">IMPORT</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 italic py-3 text-center border border-dashed border-slate-800/10 rounded-lg">
                    No matching backup files loaded yet. Click 'Scan drive files'.
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveToDrive}
              disabled={uploadingToDrive}
              className="w-full mt-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white font-extrabold text-[11px] rounded-xl transition-all uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              {uploadingToDrive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <FolderDown className="w-3.5 h-3.5 mr-1" />
              )}
              {uploadingToDrive ? "Uploading backup..." : "Backup Current Statement"}
            </button>
          </div>

          {/* COLUMN 2: GOOGLE DOCS REPORTS */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/20 border-slate-850"}`}>
            <div className="space-y-3.5">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#2d55ff] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#2b579a]" />
                Google Docs Builder
              </span>
              
              <p className="text-xs text-slate-400 leading-normal font-medium">
                Produce a comprehensive Executive Financial Summary report containing account metadata, key total cashflows, and organized lists.
              </p>

              {docStatus && (
                <div className={`p-2.5 rounded-lg border text-[10.5px] leading-snug flex items-start gap-1.5 ${
                  docStatus.type === "success" 
                    ? "bg-emerald-500/5 border-emerald-505/10 text-emerald-400" 
                    : "bg-rose-500/5 border-rose-505/10 text-rose-400"
                }`}>
                  {docStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <span>{docStatus.msg}</span>
                </div>
              )}

              {createdDocUrl && (
                <div className="pt-2">
                  <a
                    href={createdDocUrl}
                    target="_blank"
                    rel="referrer"
                    className="block p-3 rounded-lg border border-[#4285f4] bg-[#4285f4]/5 text-center transition hover:bg-[#4285f4]/15 shadow-sm text-[11px] font-extrabold text-blue-400"
                  >
                    Open Document Report In Docs
                    <ExternalLink className="w-3.5 h-3.5 inline ml-1.5" />
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateDocReport}
              disabled={generatingDoc}
              className="w-full mt-4 py-2 bg-[#2b579a] hover:bg-[#1a3d6d] disabled:opacity-50 text-white font-extrabold text-[11px] rounded-xl transition-all uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              {generatingDoc ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <FileText className="w-3.5 h-3.5 mr-1" />
              )}
              {generatingDoc ? "Generating Document..." : "Create Audit Google Doc"}
            </button>
          </div>

          {/* COLUMN 3: GMAIL DISPATCH SERVICE */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/20 border-slate-850"}`}>
            <div className="space-y-3.5">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#ea4335] flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                Gmail SMTP Service
              </span>
              
              <p className="text-xs text-slate-400 leading-normal font-medium">
                Dispatch structured recap email alerts dynamically containing transactional cashflows totals directly from your Google mailbox.
              </p>

              {emailStatus && (
                <div className={`p-2.5 rounded-lg border text-[10.5px] leading-snug flex items-start gap-1.5 ${
                  emailStatus.type === "success" 
                    ? "bg-emerald-500/5 border-emerald-505/10 text-emerald-400" 
                    : "bg-rose-500/5 border-rose-505/10 text-rose-400"
                }`}>
                  {emailStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <span>{emailStatus.msg}</span>
                </div>
              )}

              {/* Email Address Form input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[9.5px] font-black uppercase text-slate-400 block tracking-wider">Recipient Email Address</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. manager@firm.com, accountant@office.ca"
                  className={`w-full px-3 py-1.5 text-xs rounded-xl border outline-none font-semibold ${
                    isLight 
                      ? "bg-white border-slate-250 text-slate-850 focus:border-indigo-500" 
                      : "bg-slate-900 border-slate-800 text-slate-100 focus:border-indigo-400"
                  }`}
                />
              </div>
            </div>

            <button
              onClick={handleSendGmailReport}
              disabled={sendingEmail || !recipientEmail.trim()}
              className="w-full mt-4 py-2 bg-[#ea4335] hover:bg-[#c53229] disabled:opacity-50 text-white font-extrabold text-[11px] rounded-xl transition-all uppercase flex items-center justify-center gap-1 cursor-pointer"
            >
              {sendingEmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5 mr-1" />
              )}
              {sendingEmail ? "Mailing update..." : "Send summary via Gmail"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
