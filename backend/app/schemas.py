from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "estimator"
    department_id: Optional[int] = None


class UserLogin(BaseModel):
    username: str
    password: str


class DepartmentCreate(BaseModel):
    name: str


class QuoteCreate(BaseModel):
    name: str
    client_name: str
    department_id: int
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    project_address: Optional[str] = None
    description: Optional[str] = None
    equipment_markup_default: float = 20.0
    tax_rate: float = 8.0
    tax_enabled: bool = True


class QuoteUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    department_id: Optional[int] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    project_address: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    equipment_markup_default: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_enabled: Optional[bool] = None


class RoomCreate(BaseModel):
    quote_id: int
    name: str
    quantity: int = 1


class SystemCreate(BaseModel):
    room_id: int
    name: str
    description: Optional[str] = None


class EquipmentCreate(BaseModel):
    system_id: int
    item_name: str
    model: Optional[str] = None
    description: Optional[str] = None
    quantity: int
    unit_cost: float
    markup_override: Optional[float] = None
    vendor: Optional[str] = None
    tax_exempt: bool = False


class LaborCreate(BaseModel):
    room_id: int
    role_name: str
    cost_rate: float
    sell_rate: float
    hours: float
    department_id: Optional[int] = None


class ServiceCreate(BaseModel):
    room_id: int
    service_name: str
    percentage_of_equipment: float
    department_id: Optional[int] = None
    description: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    department_id: Optional[int] = None
    services: List[Dict[str, Any]]
    labor: List[Dict[str, Any]]
    tax_settings: Dict[str, Any]


class VendorPriceCreate(BaseModel):
    item_name: str
    model: Optional[str] = None
    cost: float
    description: Optional[str] = None
    vendor: str
    department_id: Optional[int] = None
    all_departments: bool = False
    expiration_date: Optional[str] = None


class CompanyCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class ContactCreate(BaseModel):
    company_id: int
    name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(min_length=8)
