import { useState } from 'react';
import { Wallet, Code2, Database, Terminal, CheckCircle2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import ChatArea from './components/ChatArea';

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  const handleExpenseAdded = () => {
    // Memperbarui Dashboard saat ada pengeluaran baru dari ChatArea
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-slate-900 tracking-tight">FinTalk</h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  MVP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Smart Financial Assistant
              </p>
            </div>
          </div>

          
        </div>
      </header>

      {/* Main Content: 2-Column Grid */}
      <main className="flex-1 max-w-6xl w-full min-w-0 mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          <div className="min-w-0">
            <Dashboard refreshTrigger={refreshTrigger} />
          </div>

          <div className="min-w-0 h-[min(70dvh,520px)] min-h-[380px] sm:h-[520px] lg:h-[480px]">
            <ChatArea onExpenseAdded={handleExpenseAdded} />
          </div>
        </div>
      </main>

      {/* Quick Setup Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Panduan Menjalankan FinTalk</h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600">
              {/* Step 1: Database */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>1. Supabase Database (`supabase_schema.sql`)</span>
                </div>
                <p>
                  Jalankan skrip SQL di file <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200">supabase_schema.sql</code> melalui menu <strong>SQL Editor</strong> di dashboard Supabase Anda.
                </p>
              </div>

              {/* Step 2: Backend */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                  <Terminal className="w-4 h-4 text-emerald-600" />
                  <span>2. Backend (FastAPI - `backend/main.py`)</span>
                </div>
                <pre className="mt-1.5 p-2.5 rounded-lg bg-slate-900 text-slate-200 text-[11px] overflow-x-auto font-mono">
{`cd backend
pip install -r requirements.txt
cp ../.env.example .env
# isi SUPABASE_URL dan SUPABASE_KEY
uvicorn main:app --reload --port 8000`}
                </pre>
              </div>

              {/* Step 3: Frontend */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>3. Frontend (React + Vite)</span>
                </div>
                <pre className="mt-1.5 p-2.5 rounded-lg bg-slate-900 text-slate-200 text-[11px] overflow-x-auto font-mono">
{`cp .env.example .env
# atur VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev`}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
