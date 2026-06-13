export enum TransactionCategory {
  BKASH = "bKash",
  NAGAD = "Nagad",
  ATM = "ATM Withdrawal",
  NPSB_TRANSFER = "Fund Transfer (NPSB)",
  CARD_PURCHASE = "Card / POS Purchase",
  REMIT_DEPOSIT = "Salary & Cash Deposit",
  CHARGES_TAX = "Charges & Taxes",
  INTEREST = "Interest Liquidation",
  MOBILE_RECHARGE = "Mobile Recharge",
  UNASSIGNED = "Other Expense"
}

export interface Transaction {
  id: string; // unique ID
  date: string; // DD-MM-YYYY format
  description: string;
  withdrawal: number | null; // debit
  deposit: number | null; // credit
  balance: number;
  category: TransactionCategory;
  chqNo?: string;
  source: "preloaded" | "uploaded";
  notes?: string;
  tags?: string[];
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  category: TransactionCategory;
}

export interface BankStatement {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  customerId?: string;
  period: string;
  currency: string;
  branch?: string;
  productName?: string;
  address?: string;
  printDate?: string;
  openingBalance: number;
  closingBalance: number;
  totalWithdrawals: number;
  totalDeposits: number;
  transactions: Transaction[];
}
