"""Seed admin user only. Business data is imported via import_data.py."""
import os
from datetime import datetime, timezone
from auth import hash_password, verify_password


async def seed_data(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@dms.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    now = datetime.now(timezone.utc).isoformat()

    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": now,
        })
    elif not verify_password(admin_password, existing_admin.get("password_hash", "")):
        await db.users.update_one(
            {"_id": existing_admin["_id"]},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
