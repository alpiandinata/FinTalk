# FinTalk

FinTalk is a personal finance dashboard and Indonesian-language AI assistant. The React frontend uses a FastAPI backend to read and save income and expense transactions in Supabase. Chat requests can pass a current transaction summary to a configured Langflow flow.

## Features

- View income, expenses, balance, categories, and recent transactions from Supabase.
- Add income or expenses to a selected wallet and database category.
- Ask the configured Langflow assistant for insights using saved transaction data.
- Responsive layout: dashboard and chat stack on phones and tablets, and display side by side on desktop.

## Requirements

- Node.js and npm
- Python 3.10 or newer
- A Supabase project using the `transactions`, `categories`, `wallets`, and `users` tables
- Optional: a reachable Langflow flow endpoint

## Configure Supabase

1. Run [`supabase_schema.sql`](./supabase_schema.sql) in the Supabase SQL Editor. It checks for the tables and columns this backend expects; it does not create tables or change data.
2. Copy [`backend/.env.example`](./backend/.env.example) to `backend/.env`.
3. Set `SUPABASE_URL` and `SUPABASE_KEY`. The key must be allowed to read and write the configured tables. Keep privileged keys on the backend only.
4. If the database has more than one user, set `SUPABASE_USER_ID` to the user whose transactions the app should use.
5. The dashboard loads wallets and categories belonging to that user. Select a wallet in the form before saving. `SUPABASE_WALLET_ID` is only used by chat-created transactions if no wallet was explicitly selected.

This MVP does not authenticate users. Do not expose it publicly or use it for multiple people until authentication and per-user access controls are implemented.

## Configure Langflow (optional)

Set `LANGFLOW_API_URL` in `backend/.env`, for example:

```text
https://<langflow-host>/api/v1/run/<flow-id>
```

Set `LANGFLOW_API_KEY` if the Langflow deployment requires an API key. The flow should accept the `input_value` chat input and return a text or chat output. When the URL is blank or Langflow is unavailable, chat requests show an error; transaction viewing and saving do not depend on Langflow.

## Run locally

### Backend

From the repository root, create and activate a virtual environment, install backend dependencies, and start FastAPI:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Set-Location backend
uvicorn main:app --reload --port 8000
```

Create `backend/.env` before starting the API. Its default address is `http://localhost:8000`.

### Frontend

In another terminal from the repository root:

```powershell
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:3000`. To use another backend address, set `VITE_API_BASE_URL` in a frontend `.env` file, for example:

```text
VITE_API_BASE_URL=http://localhost:8000
```

Do not put Supabase or Langflow secret keys in the frontend `.env`.

## Checks

```powershell
npm run lint
npm run build
```

## API endpoints

- `GET /api/transactions` — list transactions for the configured user
- `POST /api/transactions` — save income or expense
- `GET /api/wallets` — list that user's wallets
- `GET /api/categories` — list that user's categories
- `POST /api/chat` — send a chat request with the latest transaction context
