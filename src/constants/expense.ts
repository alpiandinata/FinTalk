import { TransactionType } from '../types';

export const INCOME_CATEGORIES = {
  salary: 'Gaji',
  sideIncome: 'Pendapatan Tambahan',
  business: 'Usaha',
  bonus: 'Bonus',
  other: 'Lain-lain',
} as const;

export const EXPENSE_CATEGORIES = {
  food: 'Makanan & Minuman',
  transportation: 'Transportasi',
  utilities: 'Tagihan & Utilitas',
  entertainment: 'Hiburan',
  shopping: 'Belanja',
  other: 'Lain-lain',
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  [INCOME_CATEGORIES.salary]: '#10B981',
  [INCOME_CATEGORIES.sideIncome]: '#14B8A6',
  [INCOME_CATEGORIES.business]: '#22C55E',
  [INCOME_CATEGORIES.bonus]: '#84CC16',
  [EXPENSE_CATEGORIES.food]: '#F59E0B',
  [EXPENSE_CATEGORIES.transportation]: '#F97316',
  [EXPENSE_CATEGORIES.utilities]: '#6366F1',
  [EXPENSE_CATEGORIES.entertainment]: '#EC4899',
  [EXPENSE_CATEGORIES.shopping]: '#8B5CF6',
  [EXPENSE_CATEGORIES.other]: '#64748B',
};

export const DEFAULT_COLOR = '#8B5CF6';
export const DEFAULT_CATEGORY = EXPENSE_CATEGORIES.other;
export const DEFAULT_INCOME_CATEGORY = INCOME_CATEGORIES.salary;

export function detectTransactionType(text: string): TransactionType {
  const lower = text.toLowerCase();

  if (
    /(gaji|salary|bonus|thr|honor|pendapatan|transfer masuk|komisi|insentif|penjualan|invoice|penghasilan|hadiah|usaha)/.test(lower)
  ) {
    return 'income';
  }

  return 'expense';
}

export function detectTransactionCategory(text: string, type: TransactionType): string {
  const lower = text.toLowerCase();

  if (type === 'income') {
    if (/(gaji|salary|upah|penghasilan|honor)/.test(lower)) return INCOME_CATEGORIES.salary;
    if (/(bonus|thr|insentif|komisi)/.test(lower)) return INCOME_CATEGORIES.bonus;
    if (/(usaha|jualan|penjualan|invoice|produk)/.test(lower)) return INCOME_CATEGORIES.business;
    if (/(pendapatan|tambahan|freelance|project|side)/.test(lower)) return INCOME_CATEGORIES.sideIncome;
    return INCOME_CATEGORIES.other;
  }

  if (lower.includes('makan') || lower.includes('kopi') || lower.includes('minum') || lower.includes('jajan') || lower.includes('warteg')) {
    return EXPENSE_CATEGORIES.food;
  }

  if (lower.includes('bensin') || lower.includes('ojek') || lower.includes('parkir') || lower.includes('tol') || lower.includes('transport')) {
    return EXPENSE_CATEGORIES.transportation;
  }

  if (lower.includes('listrik') || lower.includes('wifi') || lower.includes('pulsa') || lower.includes('tagihan') || lower.includes('air')) {
    return EXPENSE_CATEGORIES.utilities;
  }

  if (lower.includes('nonton') || lower.includes('game') || lower.includes('bioskop') || lower.includes('jalan')) {
    return EXPENSE_CATEGORIES.entertainment;
  }

  if (lower.includes('beli') || lower.includes('shop') || lower.includes('belanja') || lower.includes('fashion')) {
    return EXPENSE_CATEGORIES.shopping;
  }

  return DEFAULT_CATEGORY;
}

export function parseTransactionText(text: string) {
  const clean = text
    .replace(/rp/gi, '')
    .replace(/idr/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const source = clean.match(/\d[\d.,]*/g)?.[0] ?? '0';
  const amount = Number(source.replace(/\./g, '').replace(/,/g, ''));
  const type = detectTransactionType(clean);

  return {
    amount: Number.isFinite(amount) ? amount : 0,
    type,
    category: detectTransactionCategory(clean, type),
    description: clean || (type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
  };
}
