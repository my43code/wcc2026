import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, Field

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DB_PATH = Path(os.getenv("WCC_DATABASE", BASE_DIR / "wcc.db"))
ADMIN_USERNAME = os.getenv("WCC_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("WCC_ADMIN_PASSWORD", "ChangeMe123!")
SECRET_KEY = os.getenv("WCC_SECRET_KEY", "development-secret-change-before-production")
TOKEN_TTL = 8 * 60 * 60

Category = Literal["news_events", "early_learning", "primary_school", "secondary_school", "student_life"]

app = FastAPI(title="Waigani Christian College API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def database():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialise_database() -> None:
    with database() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                event_date TEXT,
                published INTEGER NOT NULL DEFAULT 1,
                promoted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS enquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                year_level TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'new',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        count = db.execute("SELECT COUNT(*) AS count FROM posts").fetchone()["count"]
        if count == 0:
            db.executemany(
                "INSERT INTO posts (title, summary, body, category, event_date, promoted) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    ("College Open Day 2026", "Tour our campus, meet our teachers and see learning in action.", "Families are warmly invited to experience our learning community.", "news_events", "2026-08-12", 1),
                    ("Culture & Arts Festival", "An evening celebrating student performance, stories and creativity.", "Join students and families for a celebration of culture and creative expression.", "student_life", "2026-08-22", 0),
                    ("Inter-house Athletics", "Our school community comes together for a day of energy and team spirit.", "Students will represent their houses in a full program of athletics.", "secondary_school", "2026-09-05", 0),
                ],
            )


initialise_database()


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


def row_dict(row: sqlite3.Row) -> dict:
    result = dict(row)
    for key in ("published", "promoted"):
        if key in result:
            result[key] = bool(result[key])
    return result


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


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
    clauses, values = [], []
    if not admin:
        clauses.append("published = 1")
    else:
        require_admin(authorization)
    if category:
        clauses.append("category = ?")
        values.append(category)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with database() as db:
        rows = db.execute(f"SELECT * FROM posts {where} ORDER BY promoted DESC, COALESCE(event_date, created_at) DESC", values).fetchall()
    return [row_dict(row) for row in rows]


@app.post("/api/posts", status_code=201)
def create_post(post: PostInput, _: str = Depends(require_admin)):
    with database() as db:
        cursor = db.execute(
            "INSERT INTO posts (title, summary, body, category, event_date, published, promoted) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (post.title, post.summary, post.body, post.category, post.event_date, post.published, post.promoted),
        )
        row = db.execute("SELECT * FROM posts WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return row_dict(row)


@app.put("/api/posts/{post_id}")
def update_post(post_id: int, post: PostInput, _: str = Depends(require_admin)):
    with database() as db:
        cursor = db.execute(
            "UPDATE posts SET title=?, summary=?, body=?, category=?, event_date=?, published=?, promoted=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (post.title, post.summary, post.body, post.category, post.event_date, post.published, post.promoted, post_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Post not found")
        row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return row_dict(row)


@app.delete("/api/posts/{post_id}", status_code=204)
def delete_post(post_id: int, _: str = Depends(require_admin)):
    with database() as db:
        if db.execute("DELETE FROM posts WHERE id = ?", (post_id,)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Post not found")


@app.post("/api/enquiries", status_code=201)
def create_enquiry(enquiry: EnquiryInput):
    with database() as db:
        cursor = db.execute(
            "INSERT INTO enquiries (name, email, year_level, message) VALUES (?, ?, ?, ?)",
            (enquiry.name, enquiry.email, enquiry.year_level, enquiry.message),
        )
    return {"id": cursor.lastrowid, "status": "received"}


@app.get("/api/enquiries")
def list_enquiries(_: str = Depends(require_admin)):
    with database() as db:
        rows = db.execute("SELECT * FROM enquiries ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]


@app.patch("/api/enquiries/{enquiry_id}")
def update_enquiry(enquiry_id: int, change: EnquiryStatus, _: str = Depends(require_admin)):
    with database() as db:
        if db.execute("UPDATE enquiries SET status = ? WHERE id = ?", (change.status, enquiry_id)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Enquiry not found")
    return {"id": enquiry_id, "status": change.status}


@app.get("/api/search")
def search(q: str = Query(min_length=2, max_length=100)):
    pattern = f"%{q}%"
    with database() as db:
        rows = db.execute(
            "SELECT id, title, summary, category, event_date, promoted FROM posts WHERE published=1 AND (title LIKE ? OR summary LIKE ? OR body LIKE ?) ORDER BY promoted DESC, created_at DESC LIMIT 20",
            (pattern, pattern, pattern),
        ).fetchall()
    return [row_dict(row) for row in rows]
