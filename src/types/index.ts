export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  created_at: string;
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
}

export interface Expense extends Transaction {
  type: 'expense';
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}
