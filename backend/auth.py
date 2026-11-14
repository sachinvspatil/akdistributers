"""Authentication utilities: password hashing, JWT tokens, get_current_user dependency."""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
import bcrypt
import jwt
from fastapi import HTTPException, Request, Depends
from bson import ObjectId

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12h for convenience in a business app
REFRESH_TOKEN_DAYS = 7
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        secure=COOKIE_SECURE, samesite="lax", max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True,
        secure=COOKIE_SECURE, samesite="lax", max_age=REFRESH_TOKEN_DAYS * 24 * 3600, path="/",
    )


def clear_auth_cookies(response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def _get_db(request: Request):
    return request.app.state.db


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        db = _get_db(request)
        try:
            oid = ObjectId(payload["sub"])
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid user id")
        user = await db.users.find_one({"_id": oid})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
