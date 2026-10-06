import { useState, useRef, useEffect, FormEvent } from 'react';
import { Send, Sparkles, Bot, User } from 'lucide-react';
import { API_ENDPOINTS, STORAGE_KEYS } from '../config';
import { detectTransactionCategory, detectTransactionType, parseTransactionText } from '../constants/expense';
import { ChatMessage, Transaction } from '../types';

interface ChatAreaProps {
  onExpenseAdded: () => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'ai',
    text: 'Halo! Saya FinTalk AI. Kamu bisa mencatat pemasukan atau pengeluaran, atau menanyakan tips keuangan yang dibutuhkan.',
  },
];

const QUICK_PROMPTS = [
  'Catat gaji saya 6500000',
  'Beli kebutuhan bulanan 350000',
  'Transfer masuk dari proyek 1200000',
  'Bagaimana cara mengatur anggaran bulanan?',
];

function hasTransactionIntent(text: string): boolean {
  return (
    !text.includes('?') &&
    /\b(catat|tambah(?:kan)?|beli|belanja|bayar|makan|minum|jajan|kopi|bensin|ojek|parkir|gaji|bonus|thr|honor|pendapatan|penghasilan|pemasukan|transfer masuk|penjualan|komisi|insentif|habis|keluar)\b/i.test(
      text,
    )
  );
}

export default function ChatArea({ onExpenseAdded }: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const parsed = parseTransactionText(text);
      const shouldRecord = parsed.amount > 0 && hasTransactionIntent(text);
      const response = await fetch(API_ENDPOINTS.chat, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          ...(shouldRecord
            ? {
                transaction: {
                  type: parsed.type,
                  category: parsed.category,
                  amount: parsed.amount,
                  description: parsed.description,
                },
              }
            : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const detail = data.detail;
        const message =
          typeof detail === 'string'
            ? detail
            : detail?.message ?? 'Permintaan chat gagal diproses.';

        if (detail?.transaction_added) onExpenseAdded();
        setMessages((prev) => [...prev, { role: 'ai', text: message }]);
        return;
      }

      setMessages((prev) => [...prev, { role: 'ai', text: data.reply }]);

      if (data.expense_added || data.transaction_added) {
        onExpenseAdded();
      }
    } catch (error) {
      if (!(error instanceof TypeError)) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim pesan.',
          },
        ]);
        return;
      }

      const parsed = parseTransactionText(text);

      if (parsed.amount > 0 && hasTransactionIntent(text)) {
        const currentList = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) ?? '[]') as Transaction[];
        const newTransaction: Transaction = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          created_at: new Date().toISOString(),
          type: parsed.type,
          category: parsed.category || detectTransactionCategory(text, detectTransactionType(text)),
          amount: parsed.amount,
          description: parsed.description,
        };

        const updatedTransactions = [newTransaction, ...currentList];
        localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(updatedTransactions));

        const legacyExpenses = updatedTransactions
          .filter((item) => item.type === 'expense')
          .map((item) => ({ ...item, type: 'expense' }));
        localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(legacyExpenses));

        onExpenseAdded();

        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: `${parsed.type === 'income' ? 'Berhasil mencatat pemasukan' : 'Berhasil mencatat pengeluaran'}: Rp ${parsed.amount.toLocaleString('id-ID')} (${parsed.category})!`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: 'Backend atau AI belum terhubung, jadi pesan belum dapat diproses. Periksa koneksi lalu coba lagi.',
          },
        ]);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">FinTalk AI Assistant</h2>
            <p className="text-[11px] sm:text-xs text-slate-500">Catat pemasukan atau pengeluaran dengan cepat</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isUser
                    ? 'bg-emerald-600 text-white'
                    : 'bg-teal-50 text-teal-700 border border-teal-200'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-100 text-slate-500 text-xs rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 border border-slate-200/50">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">Contoh:</span>
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => sendMessage(prompt)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer text-[11px]"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="p-2 sm:p-3 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="flex min-w-0 items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tulis pemasukan atau pengeluaran…"
            className="min-w-0 flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 text-sm rounded-xl px-3 sm:px-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
            aria-label="Kirim Pesan"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
