import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, PieChart as PieChartIcon, Plus, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { API_ENDPOINTS, STORAGE_KEYS } from '../config';
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY,
  DEFAULT_COLOR,
} from '../constants/expense';
import { Transaction, TransactionType } from '../types';

interface DashboardProps {
  refreshTrigger: number;
}

type TransactionForm = {
  type: TransactionType;
  category: string;
  amount: string;
  description: string;
  walletId: string;
};

type WalletOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
  type: TransactionType;
};

const emptyForm: TransactionForm = {
  type: 'income',
  category: '',
  amount: '',
  description: '',
  walletId: '',
};

function loadTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];

  const savedTransactions = localStorage.getItem(STORAGE_KEYS.transactions);
  if (savedTransactions) {
    try {
      const parsed = JSON.parse(savedTransactions) as Transaction[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      localStorage.removeItem(STORAGE_KEYS.transactions);
    }
  }

  const legacyExpenses = localStorage.getItem(STORAGE_KEYS.expenses);
  if (legacyExpenses) {
    try {
      const parsed = JSON.parse(legacyExpenses) as Transaction[];
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          ...item,
          type: item.type ?? 'expense',
          category: item.category || DEFAULT_CATEGORY,
        }));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEYS.expenses);
    }
  }

  return [];
}

export default function Dashboard({ refreshTrigger }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [loadMessage, setLoadMessage] = useState<string>('');
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);

      const readApiList = async <T,>(url: string, label: string): Promise<T[]> => {
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof data.detail === 'string' ? data.detail : `Gagal mengambil ${label}.`,
          );
        }
        if (!Array.isArray(data)) throw new Error(`Format ${label} dari backend tidak valid.`);
        return data as T[];
      };

      const [transactionResult, walletResult, categoryResult] = await Promise.allSettled([
        readApiList<Transaction>(API_ENDPOINTS.transactions, 'transaksi'),
        readApiList<WalletOption>(API_ENDPOINTS.wallets, 'daftar dompet'),
        readApiList<CategoryOption>(API_ENDPOINTS.categories, 'daftar kategori'),
      ]);

      if (transactionResult.status === 'fulfilled') {
        const normalized = transactionResult.value.map((item) => ({
          id: item.id ?? `${Date.now()}-${Math.random()}`,
          created_at: item.created_at ?? new Date().toISOString(),
          type: item.type ?? 'expense',
          category: item.category || DEFAULT_CATEGORY,
          amount: Number(item.amount || 0),
          description: item.description || 'Transaksi',
        }));
        setTransactions(normalized);
        setIsLiveApi(true);
        setLoadMessage('');
      } else {
        setTransactions(loadTransactions());
        setIsLiveApi(false);
        setLoadMessage(
          transactionResult.reason instanceof Error
            ? transactionResult.reason.message
            : 'Tidak dapat mengambil transaksi dari database.',
        );
      }

      if (walletResult.status === 'fulfilled') {
        setWallets(walletResult.value);
        setForm((current) => ({
          ...current,
          walletId:
            current.walletId && walletResult.value.some((wallet) => wallet.id === current.walletId)
              ? current.walletId
              : walletResult.value.length === 1
                ? walletResult.value[0].id
                : '',
        }));
      } else {
        setWallets([]);
        setSaveMessage(
          walletResult.reason instanceof Error
            ? walletResult.reason.message
            : 'Gagal mengambil daftar dompet.',
        );
      }

      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value);
      } else {
        setCategories([]);
        setSaveMessage(
          categoryResult.reason instanceof Error
            ? categoryResult.reason.message
            : 'Gagal mengambil daftar kategori.',
        );
      }

      setLoading(false);
    }

    fetchTransactions();
  }, [refreshTrigger]);

  const totalIncome = transactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalExpense = transactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  const categoryMap = useMemo(() => {
    const map: Record<string, number> = {};

    transactions.forEach((item) => {
      const categoryName = item.category || DEFAULT_CATEGORY;
      map[categoryName] = (map[categoryName] || 0) + Number(item.amount || 0);
    });

    return map;
  }, [transactions]);

  const chartData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  const recentTransactions = transactions.slice(0, 8);

  const formatRupiah = (value: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);

  const categoryOptions = categories.filter((category) => category.type === form.type);

  const handleSaveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(form.amount);
    if (
      !form.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !form.walletId ||
      !form.category
    ) {
      return;
    }

    const nextTransaction: Transaction = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      created_at: new Date().toISOString(),
      type: form.type,
      category: form.category,
      amount,
      description: form.description.trim(),
    };

    setSaveMessage('');
    try {
      const response = await fetch(API_ENDPOINTS.transactions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nextTransaction, wallet_id: form.walletId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : data.detail?.message ?? 'Transaksi gagal disimpan ke database.',
        );
      }

      const savedTransaction = data as Transaction;
      const nextTransactions = [savedTransaction, ...transactions];
      setTransactions(nextTransactions);
      setIsLiveApi(true);
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(nextTransactions));
      localStorage.setItem(
        STORAGE_KEYS.expenses,
        JSON.stringify(nextTransactions.filter((item) => item.type === 'expense')),
      );
      setForm({ ...emptyForm, type: form.type, walletId: form.walletId });
      setSaveMessage('Transaksi berhasil disimpan ke database.');
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : 'Transaksi gagal disimpan. Periksa koneksi backend dan database.',
      );
    }
  };

  return (
    <div className="flex min-w-0 flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Ringkasan Keuangan</h2>
          <p className="text-xs text-slate-500 mt-0.5">Monitor pemasukan, pengeluaran, dan detail transaksi</p>
        </div>
        
      </div>
      {loadMessage && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
          Database belum tersambung: {loadMessage}
        </p>
      )}

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <span>Pemasukan</span>
            <ArrowDownCircle className="w-4 h-4" />
          </div>
          <div className="mt-2 whitespace-nowrap text-[clamp(1rem,2vw,1.5rem)] leading-tight font-extrabold tracking-tight tabular-nums text-slate-900">{formatRupiah(totalIncome)}</div>
        </div>

        <div className="min-w-0 rounded-xl border border-rose-200 bg-rose-50 p-3 sm:p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-700">
            <span>Pengeluaran</span>
            <ArrowUpCircle className="w-4 h-4" />
          </div>
          <div className="mt-2 whitespace-nowrap text-[clamp(1rem,2vw,1.5rem)] leading-tight font-extrabold tracking-tight tabular-nums text-slate-900">{formatRupiah(totalExpense)}</div>
        </div>

        <div className="min-w-0 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:p-4 min-[420px]:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sky-700">
            <span>Saldo</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className={`mt-2 whitespace-nowrap text-[clamp(1rem,2vw,1.5rem)] leading-tight font-extrabold tracking-tight tabular-nums ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatRupiah(balance)}
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveTransaction} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Tambah Transaksi</h3>
          <div className="inline-flex items-center gap-2 rounded-full bg-white p-1 shadow-sm border border-slate-200">
            {(['income', 'expense'] as TransactionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type, category: '' }))}
                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  form.type === type
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="number"
            min="1"
            step="1"
            required
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="Jumlah (contoh: 10000)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <select
            value={form.category}
            required
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">
              {categoryOptions.length
                ? form.type === 'income'
                  ? 'Pilih kategori pemasukan'
                  : 'Pilih kategori pengeluaran'
                : 'Kategori belum tersedia di database'}
            </option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={form.description}
            required
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Deskripsi transaksi"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <select
            value={form.walletId}
            required
            aria-label="Dompet transaksi"
            onChange={(event) => setForm((prev) => ({ ...prev, walletId: event.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">
              {wallets.length ? 'Pilih dompet' : 'Dompet belum tersedia'}
            </option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!wallets.length || !categoryOptions.length}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Simpan
          </button>
        </div>
      </form>
      {saveMessage && (
        <p
          className={`mt-2 text-xs ${
            saveMessage.startsWith('Transaksi berhasil')
              ? 'text-emerald-700'
              : 'text-rose-600'
          }`}
          role="status"
        >
          {saveMessage}
        </p>
      )}

      <div className="mt-6 flex-1 min-h-[260px] flex flex-col">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Distribusi Berdasarkan Kategori</h3>
          <PieChartIcon className="w-4 h-4 text-slate-400" />
        </div>

        {chartData.length > 0 ? (
          <div className="w-full h-52 sm:h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={CATEGORY_COLORS[entry.name] || DEFAULT_COLOR}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatRupiah(Number(value)), 'Jumlah']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-slate-600 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            {loading ? 'Memuat data...' : 'Belum ada transaksi'}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Detail Transaksi</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.type === 'income'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                    <span className="truncate font-medium text-slate-800">{item.description || item.category}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{item.category}</div>
                </div>
                <span
                  className={`font-semibold ${
                    item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {formatRupiah(Number(item.amount))}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-xs text-slate-400 py-3">Belum ada transaksi yang dicatat.</p>
          )}
        </div>
      </div>
    </div>
  );
}
