import json
import os
import re
from datetime import date
from typing import Any, Literal, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
LANGFLOW_API_URL = os.getenv("LANGFLOW_API_URL", "")
LANGFLOW_API_KEY = os.getenv("LANGFLOW_API_KEY", "")
SUPABASE_USER_ID = os.getenv("SUPABASE_USER_ID", "")
SUPABASE_WALLET_ID = os.getenv("SUPABASE_WALLET_ID", "")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="FinTalk Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TransactionCreate(BaseModel):
    type: Literal["income", "expense"]
    category: str = Field(min_length=1)
    amount: float = Field(gt=0)
    description: Optional[str] = None
    wallet_id: Optional[str] = None


class TransactionResponse(TransactionCreate):
    id: str
    created_at: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    transaction: Optional[TransactionCreate] = None


class ChatResponse(BaseModel):
    reply: str
    expense_added: bool = False
    transaction_added: bool = False


def require_supabase() -> Client:
    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase belum dikonfigurasi. Periksa SUPABASE_URL dan SUPABASE_KEY di backend/.env.",
        )
    return supabase


def resolve_user_id(client: Client) -> str:
    if SUPABASE_USER_ID:
        return SUPABASE_USER_ID

    try:
        response = client.table("users").select("id").limit(2).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Tidak bisa menentukan user Supabase. Isi SUPABASE_USER_ID di backend/.env.",
        ) from exc

    users = response.data or []
    if len(users) == 1:
        return str(users[0]["id"])
    raise HTTPException(
        status_code=503,
        detail="Isi SUPABASE_USER_ID di backend/.env agar data transaksi terikat ke user yang benar.",
    )


def fetch_transactions() -> list[dict[str, Any]]:
    client = require_supabase()
    user_id = resolve_user_id(client)
    transactions: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0

    try:
        while True:
            response = (
                client.table("transactions")
                .select("id,type,amount,description,transaction_date,created_at,categories(name)")
                .eq("user_id", user_id)
                .order("transaction_date", desc=True)
                .range(offset, offset + page_size - 1)
                .execute()
            )
            rows = response.data or []
            for row in rows:
                category = row.get("categories")
                if isinstance(category, list):
                    category = category[0] if category else None
                transactions.append(
                    {
                        "id": str(row["id"]),
                        "created_at": row.get("transaction_date") or row.get("created_at"),
                        "type": row.get("type") or "expense",
                        "category": (
                            category.get("name")
                            if isinstance(category, dict)
                            else "Lain-lain"
                        ),
                        "amount": row.get("amount"),
                        "description": row.get("description"),
                    }
                )
            if len(rows) < page_size:
                return transactions
            offset += page_size
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gagal membaca tabel transactions dari Supabase. "
                "Periksa izin SELECT dan relasi categories."
            ),
        ) from exc


def fetch_wallets() -> list[dict[str, str]]:
    client = require_supabase()
    user_id = resolve_user_id(client)
    try:
        response = (
            client.table("wallets")
            .select("id,name")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return [
            {"id": str(row["id"]), "name": str(row.get("name") or "Dompet")}
            for row in response.data or []
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Gagal mengambil daftar dompet dari Supabase.",
        ) from exc


def fetch_categories() -> list[dict[str, str]]:
    client = require_supabase()
    user_id = resolve_user_id(client)
    try:
        response = (
            client.table("categories")
            .select("id,name,type")
            .eq("user_id", user_id)
            .order("name")
            .execute()
        )
        return [
            {
                "id": str(row["id"]),
                "name": str(row["name"]),
                "type": str(row["type"]),
            }
            for row in response.data or []
        ]
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Gagal mengambil daftar kategori dari Supabase.",
        ) from exc


def transaction_context(transactions: list[dict[str, Any]]) -> str:
    total_income = sum(
        float(item.get("amount") or 0)
        for item in transactions
        if item.get("type") == "income"
    )
    total_expense = sum(
        float(item.get("amount") or 0)
        for item in transactions
        if item.get("type") != "income"
    )
    category_totals: dict[str, dict[str, float]] = {
        "income": {},
        "expense": {},
    }
    for item in transactions:
        transaction_type = "income" if item.get("type") == "income" else "expense"
        category = str(item.get("category") or "Lain-lain")
        totals = category_totals[transaction_type]
        totals[category] = totals.get(category, 0) + float(item.get("amount") or 0)

    recent_transactions = [
        {
            "date": item.get("created_at"),
            "type": item.get("type"),
            "category": item.get("category"),
            "amount": item.get("amount"),
            "description": item.get("description"),
        }
        for item in transactions[:20]
    ]
    return json.dumps(
        {
            "currency": "IDR",
            "transaction_count": len(transactions),
            "total_income": total_income,
            "total_expense": total_expense,
            "balance": total_income - total_expense,
            "totals_by_type_and_category": category_totals,
            "recent_transactions": recent_transactions,
        },
        ensure_ascii=False,
    )


def extract_langflow_reply(payload: Any) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    if isinstance(payload.get("reply"), str) and payload["reply"].strip():
        return payload["reply"].strip()

    outputs = payload.get("outputs", [])
    if not isinstance(outputs, list):
        return None
    for flow_output in outputs:
        if not isinstance(flow_output, dict):
            continue
        component_outputs = flow_output.get("outputs", [])
        if not isinstance(component_outputs, list):
            continue
        for component_output in component_outputs:
            if not isinstance(component_output, dict):
                continue
            results = component_output.get("results", {})
            message = results.get("message") if isinstance(results, dict) else None
            if isinstance(message, str) and message.strip():
                return message.strip()
            if isinstance(message, dict):
                text = message.get("text")
                if isinstance(text, str) and text.strip():
                    return text.strip()
                data = message.get("data")
                if isinstance(data, dict) and isinstance(data.get("text"), str):
                    return data["text"].strip()

            artifacts = component_output.get("artifacts", {})
            if isinstance(artifacts, dict):
                message_text = artifacts.get("message")
                if isinstance(message_text, str) and message_text.strip():
                    return message_text.strip()
                if isinstance(message_text, dict):
                    text = message_text.get("text")
                    if isinstance(text, str) and text.strip():
                        return text.strip()
    return None


async def ask_langflow(message: str, context: str) -> str:
    if not LANGFLOW_API_URL:
        raise HTTPException(
            status_code=503,
            detail="Langflow belum dikonfigurasi. Isi LANGFLOW_API_URL di backend/.env.",
        )

    prompt = (
        "Kamu adalah FinTalk, asisten keuangan pribadi berbahasa Indonesia. "
        "Gunakan hanya data transaksi aktual dalam konteks JSON untuk menjawab "
        "pertanyaan tentang keuangan pengguna. Jika data tidak cukup, katakan "
        "dengan jelas. Berikan insight yang ringkas, sebutkan angka dan periode "
        "hanya jika didukung data. Jangan mengarang transaksi atau memberi "
        "nasihat investasi yang menjanjikan hasil.\n\n"
        f"KONTEKS_TRANSAKSI_JSON:\n{context}\n\n"
        f"PESAN_PENGGUNA:\n{message}"
    )
    headers = {"Content-Type": "application/json"}
    if LANGFLOW_API_KEY:
        headers["x-api-key"] = LANGFLOW_API_KEY

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                LANGFLOW_API_URL,
                headers=headers,
                json={
                    "input_value": prompt,
                    "input_type": "chat",
                    "output_type": "chat",
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gagal menghubungi Langflow. Periksa URL, API key, dan status flow.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Langflow mengembalikan respons yang bukan JSON valid.",
        ) from exc

    reply = extract_langflow_reply(payload)
    if not reply:
        raise HTTPException(
            status_code=502,
            detail="Respons Langflow tidak berisi jawaban. Periksa output flow Langflow.",
        )
    return reply


@app.get("/api/transactions", response_model=list[TransactionResponse])
async def get_transactions() -> list[dict[str, Any]]:
    return fetch_transactions()


@app.get("/api/wallets")
async def get_wallets() -> list[dict[str, str]]:
    return fetch_wallets()


@app.get("/api/categories")
async def get_categories() -> list[dict[str, str]]:
    return fetch_categories()


@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(
    transaction: TransactionCreate,
) -> dict[str, Any]:
    client = require_supabase()
    try:
        user_id = resolve_user_id(client)
        if transaction.wallet_id:
            wallet_id = transaction.wallet_id
        elif SUPABASE_WALLET_ID:
            wallet_id = SUPABASE_WALLET_ID
        else:
            wallets_response = (
                client.table("wallets")
                .select("id")
                .eq("id", wallet_id)
                .eq("user_id", user_id)
                .limit(2)
                .execute()
            )
            wallets = wallets_response.data or []
            if len(wallets) != 1:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Isi SUPABASE_WALLET_ID di backend/.env karena user ini "
                        "memiliki lebih dari satu dompet."
                    ),
                )
            wallet_id = str(wallets[0]["id"])

        categories_response = (
            client.table("categories")
            .select("id,name")
            .eq("user_id", user_id)
            .eq("type", transaction.type)
            .execute()
        )
        requested_category = re.sub(r"[^a-z0-9]", "", transaction.category.lower())
        categories = categories_response.data or []
        matched_categories = [
            category
            for category in categories
            if (
                normalized_category := re.sub(
                    r"[^a-z0-9]", "", str(category.get("name", "")).lower()
                )
            )
            and (
                normalized_category in requested_category
                or requested_category in normalized_category
            )
        ]
        if not matched_categories:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Kategori '{transaction.category}' tidak ditemukan di database "
                    f"untuk tipe {transaction.type}."
                ),
            )
        if len(matched_categories) > 1:
            raise HTTPException(
                status_code=422,
                detail=f"Kategori '{transaction.category}' cocok dengan beberapa kategori database.",
            )

        wallet_check = (
            client.table("wallets")
            .select("id")
            .eq("id", wallet_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not wallet_check.data:
            raise HTTPException(
                status_code=422,
                detail="SUPABASE_WALLET_ID bukan dompet milik SUPABASE_USER_ID.",
            )

        response = (
            client.table("transactions")
            .insert(
                {
                    "user_id": user_id,
                    "wallet_id": wallet_id,
                    "category_id": matched_categories[0]["id"],
                    "type": transaction.type,
                    "amount": transaction.amount,
                    "description": transaction.description,
                    "transaction_date": date.today().isoformat(),
                }
            )
            .execute()
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gagal menyimpan ke tabel transactions. Periksa izin INSERT, "
                "SUPABASE_WALLET_ID, dan policy RLS Supabase."
            ),
        ) from exc

    if not response.data:
        raise HTTPException(
            status_code=502,
            detail="Supabase tidak mengembalikan transaksi yang baru disimpan.",
        )
    row = response.data[0]
    return {
        "id": str(row["id"]),
        "created_at": row.get("transaction_date") or row.get("created_at"),
        "type": row.get("type") or transaction.type,
        "category": transaction.category,
        "amount": row.get("amount"),
        "description": row.get("description"),
    }


@app.get("/api/expenses", response_model=list[TransactionResponse])
async def get_expenses() -> list[dict[str, Any]]:
    return [
        transaction
        for transaction in fetch_transactions()
        if transaction.get("type") == "expense"
    ]


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    added_transaction = False
    if request.transaction is not None:
        try:
            await create_transaction(request.transaction)
            added_transaction = True
        except HTTPException as exc:
            raise exc

    try:
        transactions = fetch_transactions()
        reply = await ask_langflow(request.message, transaction_context(transactions))
    except HTTPException as exc:
        if added_transaction:
            detail = exc.detail
            message = detail if isinstance(detail, str) else str(detail)
            raise HTTPException(
                status_code=exc.status_code,
                detail={
                    "message": (
                        f"Transaksi berhasil disimpan, tetapi AI belum dapat menjawab: {message}"
                    ),
                    "transaction_added": True,
                },
            ) from exc
        raise

    return ChatResponse(
        reply=reply,
        expense_added=bool(request.transaction and request.transaction.type == "expense"),
        transaction_added=added_transaction,
    )
