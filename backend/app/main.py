import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from httpx import HTTPError
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError
from postgrest.types import ReturnMethod
from supabase import Client, create_client

BASE_DIR = Path(__file__).resolve().parent.parent
# Real deployment environment variables keep priority. Locally, private
# overrides in .env.local take priority over the shared .env file.
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_KEY")
ADMIN_USERNAME = os.getenv("WCC_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("WCC_ADMIN_PASSWORD", "ChangeMe123!")
SECRET_KEY = os.getenv("WCC_SECRET_KEY", "development-secret-change-before-production")
TOKEN_TTL = 8 * 60 * 60
MEDIA_BUCKET = "post-media"
MEDIA_TYPES = {
    "image/jpeg": ("image", ".jpg", 10 * 1024 * 1024),
    "image/png": ("image", ".png", 10 * 1024 * 1024),
    "image/webp": ("image", ".webp", 10 * 1024 * 1024),
    "image/gif": ("image", ".gif", 10 * 1024 * 1024),
    "video/mp4": ("video", ".mp4", 50 * 1024 * 1024),
    "video/webm": ("video", ".webm", 50 * 1024 * 1024),
    "video/quicktime": ("video", ".mov", 50 * 1024 * 1024),
}

SUPABASE_API_KEY = SUPABASE_SECRET_KEY or SUPABASE_PUBLISHABLE_KEY
supabase: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_API_KEY)
    if SUPABASE_URL and SUPABASE_API_KEY
    else None
)

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
    media_url: str | None = Field(default=None, max_length=2000)
    media_type: Literal["image", "video"] | None = None
    media_path: str | None = Field(default=None, max_length=500)


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


def require_database(secret: bool = False) -> Client:
    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Add SUPABASE_URL and a Supabase API key.",
        )
    if secret and not SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Admin database access requires SUPABASE_SECRET_KEY in backend/.env.local.",
        )
    return supabase


def require_admin_database(_: str = Depends(require_admin)) -> Client:
    return require_database(secret=True)


@app.get("/api/health")
def health_check():
    database = require_database()
    try:
        database.table("posts").select("id").limit(1).execute()
    except (APIError, HTTPError) as error:
        raise HTTPException(status_code=503, detail="Database connection unavailable") from error
    return {
        "status": "healthy",
        "database": "supabase",
        "access": "admin" if SUPABASE_SECRET_KEY else "public-only",
    }


@app.post("/api/auth/login")
def login(credentials: LoginRequest):
    if not secrets.compare_digest(credentials.username, ADMIN_USERNAME) or not secrets.compare_digest(credentials.password, ADMIN_PASSWORD):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    return {"access_token": encode_token(credentials.username), "token_type": "bearer", "expires_in": TOKEN_TTL}


@app.get("/api/admin/me")
def admin_profile(username: str = Depends(require_admin)):
    return {"username": username, "role": "Administrator"}


@app.post("/api/media", status_code=201)
async def upload_post_media(file: UploadFile = File(...), database: Client = Depends(require_admin_database)):
    media_config = MEDIA_TYPES.get(file.content_type or "")
    if not media_config:
        raise HTTPException(
            status_code=415,
            detail="Use a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.",
        )

    media_type, extension, size_limit = media_config
    contents = await file.read(size_limit + 1)
    await file.close()
    if len(contents) > size_limit:
        limit_mb = size_limit // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"{media_type.title()} must be {limit_mb} MB or smaller.")

    media_path = f"posts/{uuid.uuid4().hex}{extension}"
    try:
        bucket = database.storage.from_(MEDIA_BUCKET)
        bucket.upload(media_path, contents, {"content-type": file.content_type, "upsert": "false"})
        media_url = bucket.get_public_url(media_path)
    except Exception as error:
        raise HTTPException(status_code=502, detail="Unable to upload media to Supabase Storage.") from error

    return {"media_url": media_url, "media_type": media_type, "media_path": media_path}


@app.get("/api/posts")
def list_posts(category: Category | None = None, admin: bool = False, authorization: str | None = Header(default=None)):
    if admin:
        require_admin(authorization)
        database = require_database(secret=True)
    else:
        database = require_database()
    query = database.table("posts").select("*")
    if not admin:
        query = query.eq("published", True)
    if category:
        query = query.eq("category", category)
    return query.order("promoted", desc=True).order("created_at", desc=True).execute().data


@app.post("/api/posts", status_code=201)
def create_post(post: PostInput, database: Client = Depends(require_admin_database)):
    result = database.table("posts").insert(post.model_dump()).execute()
    return result.data[0]


@app.put("/api/posts/{post_id}")
def update_post(post_id: int, post: PostInput, database: Client = Depends(require_admin_database)):
    current = database.table("posts").select("media_path").eq("id", post_id).execute().data
    if not current:
        raise HTTPException(status_code=404, detail="Post not found")
    previous_media_path = current[0].get("media_path")
    result = database.table("posts").update(post.model_dump()).eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if previous_media_path and previous_media_path != post.media_path:
        try:
            database.storage.from_(MEDIA_BUCKET).remove([previous_media_path])
        except Exception:
            pass
    return result.data[0]


@app.delete("/api/posts/{post_id}", status_code=204)
def delete_post(post_id: int, database: Client = Depends(require_admin_database)):
    result = database.table("posts").delete().eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    media_path = result.data[0].get("media_path")
    if media_path:
        try:
            database.storage.from_(MEDIA_BUCKET).remove([media_path])
        except Exception:
            pass


@app.post("/api/enquiries", status_code=201)
def create_enquiry(enquiry: EnquiryInput):
    # Visitors may insert enquiries but must never be able to read them back.
    # A minimal response avoids requiring a SELECT policy on private records.
    require_database().table("enquiries").insert(
        enquiry.model_dump(), returning=ReturnMethod.minimal
    ).execute()
    return {"status": "received"}


@app.get("/api/enquiries")
def list_enquiries(database: Client = Depends(require_admin_database)):
    return database.table("enquiries").select("*").order("created_at", desc=True).execute().data


@app.patch("/api/enquiries/{enquiry_id}")
def update_enquiry(enquiry_id: int, change: EnquiryStatus, database: Client = Depends(require_admin_database)):
    result = database.table("enquiries").update({"status": change.status}).eq("id", enquiry_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"id": enquiry_id, "status": change.status}


@app.get("/api/search")
def search(q: str = Query(min_length=1, max_length=100)):
    return require_database().rpc("search_published_posts", {"search_term": q}).execute().data
