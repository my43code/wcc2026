import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from httpx import HTTPError
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError
from supabase import Client, create_client

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
ADMIN_USERNAME = os.getenv("WCC_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("WCC_ADMIN_PASSWORD", "ChangeMe123!")
SECRET_KEY = os.getenv("WCC_SECRET_KEY", "development-secret-change-before-production")
TOKEN_TTL = 8 * 60 * 60

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY "
        "in backend/.env."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

Category = Literal["news_events", "early_learning", "primary_school", "secondary_school", "student_life"]

app = FastAPI(title="Waigani Christian College API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    username: str
    password: str


class PostInput(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    summary: str = Field(min_length=5, max_length=400)
    body: str = Field(default="", max_length=10000)
    category: Category
    event_date: str | None = None
    published: bool = True
    promoted: bool = False


class EnquiryInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    year_level: str = Field(min_length=2, max_length=80)
    message: str = Field(default="", max_length=3000)


class EnquiryStatus(BaseModel):
    status: Literal["new", "in_progress", "resolved"]


def encode_token(username: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"sub": username, "exp": int(time.time()) + TOKEN_TTL}).encode()).decode().rstrip("=")
    signature = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def require_admin(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin sign-in required")
    token = authorization.removeprefix("Bearer ")
    try:
        payload, signature = token.split(".", 1)
        expected = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(signature, expected):
            raise ValueError
        decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if decoded["exp"] < time.time() or decoded["sub"] != ADMIN_USERNAME:
            raise ValueError
        return decoded["sub"]
    except (ValueError, KeyError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid") from None


@app.get("/api/health")
def health_check():
    try:
        supabase.table("posts").select("id").limit(1).execute()
    except (APIError, HTTPError) as error:
        raise HTTPException(status_code=503, detail="Database connection unavailable") from error
    return {"status": "healthy", "database": "supabase"}


@app.post("/api/auth/login")
def login(credentials: LoginRequest):
    if not secrets.compare_digest(credentials.username, ADMIN_USERNAME) or not secrets.compare_digest(credentials.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    return {"access_token": encode_token(credentials.username), "token_type": "bearer", "expires_in": TOKEN_TTL}


@app.get("/api/admin/me")
def admin_profile(username: str = Depends(require_admin)):
    return {"username": username, "role": "Administrator"}


@app.get("/api/posts")
def list_posts(category: Category | None = None, admin: bool = False, authorization: str | None = Header(default=None)):
    query = supabase.table("posts").select("*")
    if admin:
        require_admin(authorization)
    else:
        query = query.eq("published", True)
    if category:
        query = query.eq("category", category)
    return query.order("promoted", desc=True).order("created_at", desc=True).execute().data


@app.post("/api/posts", status_code=201)
def create_post(post: PostInput, _: str = Depends(require_admin)):
    result = supabase.table("posts").insert(post.model_dump()).execute()
    return result.data[0]


@app.put("/api/posts/{post_id}")
def update_post(post_id: int, post: PostInput, _: str = Depends(require_admin)):
    result = supabase.table("posts").update(post.model_dump()).eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    return result.data[0]


@app.delete("/api/posts/{post_id}", status_code=204)
def delete_post(post_id: int, _: str = Depends(require_admin)):
    result = supabase.table("posts").delete().eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")


@app.post("/api/enquiries", status_code=201)
def create_enquiry(enquiry: EnquiryInput):
    result = supabase.table("enquiries").insert(enquiry.model_dump()).execute()
    return {"id": result.data[0]["id"], "status": "received"}


@app.get("/api/enquiries")
def list_enquiries(_: str = Depends(require_admin)):
    return supabase.table("enquiries").select("*").order("created_at", desc=True).execute().data


@app.patch("/api/enquiries/{enquiry_id}")
def update_enquiry(enquiry_id: int, change: EnquiryStatus, _: str = Depends(require_admin)):
    result = supabase.table("enquiries").update({"status": change.status}).eq("id", enquiry_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"id": enquiry_id, "status": change.status}


@app.get("/api/search")
def search(q: str = Query(min_length=2, max_length=100)):
    return supabase.rpc("search_published_posts", {"search_term": q}).execute().data
