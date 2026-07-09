"""Pydantic models and MongoDB helpers for the Distribution Management System."""
from datetime import datetime, timezone
from typing import Optional, List, Annotated, Any
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator, EmailStr
from bson import ObjectId


def _validate_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, str):
        return v
    raise ValueError("Invalid ObjectId")


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc: dict) -> "BaseDocument":
        if doc is None:
            return None
        if "_id" in doc:
            doc = {**doc, "_id": str(doc["_id"])}
        return cls(**doc)

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("_id", None)
        return data


# ---------- User ----------
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str  # 'admin' | 'salesperson'
    salesperson_id: Optional[str] = None  # link to salesperson doc when role == salesperson


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: str
    created_at: Optional[str] = None


# ---------- Product ----------
class ProductIn(BaseModel):
    name: str
    brand: str
    sku: str
    selling_price: float
    commission_per_unit: float
    current_stock: int = 0


class ProductOut(ProductIn):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ---------- Salesperson ----------
class SalespersonIn(BaseModel):
    name: str
    mobile: str
    area: str
    status: str = "active"  # active | inactive
    email: Optional[EmailStr] = None
    password: Optional[str] = None  # only on create


class SalespersonUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    area: Optional[str] = None
    status: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


class SalespersonOut(BaseModel):
    id: str
    name: str
    mobile: str
    area: str
    status: str
    email: Optional[str] = None
    user_id: Optional[str] = None
    created_at: Optional[str] = None


# ---------- Vendor ----------
class VendorIn(BaseModel):
    shop_name: str
    owner_name: str
    mobile: str
    area: str
    address: str


class VendorOut(VendorIn):
    id: str
    created_at: Optional[str] = None


# ---------- Inventory Transactions ----------
class InventoryTxnIn(BaseModel):
    product_id: str
    type: str  # 'stock_added' | 'stock_allocated' | 'stock_returned'
    quantity: int
    salesperson_id: Optional[str] = None
    note: Optional[str] = None


class InventoryTxnOut(InventoryTxnIn):
    id: str
    product_name: Optional[str] = None
    salesperson_name: Optional[str] = None
    created_at: str


# ---------- Stock Allocation ----------
class AllocationIn(BaseModel):
    salesperson_id: str
    product_id: str
    quantity: int
    date: Optional[str] = None  # YYYY-MM-DD


class AllocationOut(BaseModel):
    id: str
    salesperson_id: str
    salesperson_name: Optional[str] = None
    product_id: str
    product_name: Optional[str] = None
    quantity: int
    date: str
    created_at: str


# ---------- Sales ----------
class SaleIn(BaseModel):
    vendor_id: str
    product_id: str
    quantity: int
    date: Optional[str] = None
    salesperson_id: Optional[str] = None  # admin-only field; salesperson uses own


class SaleOut(BaseModel):
    id: str
    vendor_id: str
    vendor_name: Optional[str] = None
    product_id: str
    product_name: Optional[str] = None
    salesperson_id: str
    salesperson_name: Optional[str] = None
    quantity: int
    unit_price: float
    sale_value: float
    commission: float
    date: str
    created_at: str


# ---------- Collections ----------
class CollectionIn(BaseModel):
    vendor_id: str
    amount: float
    payment_mode: str  # cash | upi | card | cheque | bank_transfer
    date: Optional[str] = None
    note: Optional[str] = None
    salesperson_id: Optional[str] = None  # admin-only


class CollectionOut(BaseModel):
    id: str
    vendor_id: str
    vendor_name: Optional[str] = None
    salesperson_id: str
    salesperson_name: Optional[str] = None
    amount: float
    payment_mode: str
    date: str
    note: Optional[str] = None
    created_at: str


# ---------- Auth request bodies ----------
class LoginBody(BaseModel):
    email: EmailStr
    password: str
