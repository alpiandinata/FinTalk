export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export const API_ENDPOINTS = {
  transactions: `${API_BASE_URL}/api/transactions`,
  wallets: `${API_BASE_URL}/api/wallets`,
  categories: `${API_BASE_URL}/api/categories`,
  chat: `${API_BASE_URL}/api/chat`,
} as const;

export const STORAGE_KEYS = {
  expenses: 'fintalk_expenses',
  transactions: 'fintalk_transactions',
} as const;
