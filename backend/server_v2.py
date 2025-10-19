from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
import aiomysql
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
import openpyxl
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MySQL connection pool
pool = None

async def get_db_pool():
    global pool
    if pool is None:
        pool = await aiomysql.create_pool(
            host=os.environ.get('MYSQL_HOST', 'localhost'),
            port=int(os.environ.get('MYSQL_PORT', '3306')),
            user=os.environ.get('MYSQL_USER', 'root'),
            password=os.environ.get('MYSQL_PASSWORD', ''),
            db=os.environ.get('MYSQL_DATABASE', 'avlv_quotes'),
            autocommit=True,
            minsize=1,
            maxsize=10
        )
    return pool

async def get_db():
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            yield cur

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# ============ Models ============

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = 'estimator'
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
    description: Optional[str] = None
    equipment_markup_default: float = 20.0  # Default 20% markup
    tax_rate: float = 0.0
    tax_enabled: bool = False

class QuoteUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    department_id: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None
    equipment_markup_default: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_enabled: Optional[bool] = None

class RoomCreate(BaseModel):
    quote_id: int
    name: str
    quantity: int = 1  # NEW: Room quantity

class SystemCreate(BaseModel):
    room_id: int
    name: str
    description: Optional[str] = None

class EquipmentCreate(BaseModel):
    system_id: int
    item_name: str
    description: Optional[str] = None
    quantity: int
    unit_cost: float  # What you pay
    markup_override: Optional[float] = None  # Override project default
    vendor: Optional[str] = None
    tax_exempt: bool = False  # NEW: Tax exemption flag

class LaborCreate(BaseModel):
    room_id: int
    role_name: str
    cost_rate: float  # What you pay per hour
    sell_rate: float  # What you charge per hour
    hours: float
    department_id: Optional[int] = None

class ServiceCreate(BaseModel):
    room_id: int
    service_name: str
    percentage_of_equipment: float  # Percentage of equipment sell price
    department_id: Optional[int] = None
    description: Optional[str] = None

class TemplateCreate(BaseModel):
    name: str
    department_id: Optional[int] = None
    services: List[Dict[str, Any]]  # List of service templates
    labor: List[Dict[str, Any]]  # List of labor templates
    tax_settings: Dict[str, Any]  # Tax configuration

class VendorPriceCreate(BaseModel):
    item_name: str
    cost: float  # Changed from price to cost
    description: Optional[str]
    vendor: str
    department_id: Optional[int]

# ============ Auth Helper Functions ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: int, username: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============ Database Initialization ============

async def init_db():
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # Users table
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    department_id INT,
                    azure_enabled BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    INDEX idx_role (role)
                )
            """)

            # Departments table
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS departments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Quotes table - UPDATED
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS quotes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    client_name VARCHAR(255) NOT NULL,
                    department_id INT NOT NULL,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'draft',
                    version INT DEFAULT 1,
                    equipment_markup_default DECIMAL(5,2) DEFAULT 20.00,
                    tax_rate DECIMAL(5,2) DEFAULT 0.00,
                    tax_enabled BOOLEAN DEFAULT FALSE,
                    created_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    FOREIGN KEY (created_by) REFERENCES users(id),
                    INDEX idx_status (status),
                    INDEX idx_department (department_id),
                    INDEX idx_created_by (created_by)
                )
            """)

            # Quote versions
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS quote_versions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    quote_id INT NOT NULL,
                    version INT NOT NULL,
                    data JSON NOT NULL,
                    changed_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
                    FOREIGN KEY (changed_by) REFERENCES users(id),
                    INDEX idx_quote_version (quote_id, version)
                )
            """)

            # Rooms table - UPDATED
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS rooms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    quote_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    quantity INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
                    INDEX idx_quote (quote_id)
                )
            """)

            # NEW: Systems table
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS systems (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    INDEX idx_room (room_id)
                )
            """)

            # Equipment table - UPDATED
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS equipment (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    system_id INT NOT NULL,
                    item_name VARCHAR(255) NOT NULL,
                    description TEXT,
                    quantity INT NOT NULL,
                    unit_cost DECIMAL(10, 2) NOT NULL,
                    markup_override DECIMAL(5, 2) NULL,
                    vendor VARCHAR(255),
                    tax_exempt BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
                    INDEX idx_system (system_id)
                )
            """)

            # Labor table - UPDATED
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS labor (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    role_name VARCHAR(255) NOT NULL,
                    cost_rate DECIMAL(10, 2) NOT NULL,
                    sell_rate DECIMAL(10, 2) NOT NULL,
                    hours DECIMAL(10, 2) NOT NULL,
                    department_id INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    INDEX idx_room (room_id)
                )
            """)

            # Services table - UPDATED
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS services (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    service_name VARCHAR(255) NOT NULL,
                    percentage_of_equipment DECIMAL(5, 2) NOT NULL,
                    department_id INT,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    INDEX idx_room (room_id)
                )
            """)

            # Vendor prices - UPDATED
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS vendor_prices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    item_name VARCHAR(255) NOT NULL,
                    cost DECIMAL(10, 2) NOT NULL,
                    description TEXT,
                    vendor VARCHAR(255) NOT NULL,
                    department_id INT,
                    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    INDEX idx_vendor (vendor),
                    INDEX idx_item (item_name)
                )
            """)

            # NEW: Templates table
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS templates (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    department_id INT,
                    services_json JSON NOT NULL,
                    labor_json JSON NOT NULL,
                    tax_settings_json JSON NOT NULL,
                    created_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    FOREIGN KEY (created_by) REFERENCES users(id),
                    INDEX idx_department (department_id)
                )
            """)

            # Metrics table
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS metrics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    metric_name VARCHAR(255) NOT NULL,
                    metric_type VARCHAR(100) NOT NULL,
                    config JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user (user_id)
                )
            """)

            # Approvals table
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS approvals (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    quote_id INT NOT NULL,
                    approver_id INT NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
                    FOREIGN KEY (approver_id) REFERENCES users(id),
                    INDEX idx_quote (quote_id),
                    INDEX idx_status (status)
                )
            """)

            # Create default admin user if not exists
            await cur.execute("SELECT id FROM users WHERE username = 'admin'")
            if not await cur.fetchone():
                admin_password = hash_password('admin123')
                await cur.execute(
                    "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                    ('admin', admin_password, 'admin')
                )

            # Create default departments if not exist
            for dept_name in ['AV', 'LV', 'IT']:
                await cur.execute("SELECT id FROM departments WHERE name = %s", (dept_name,))
                if not await cur.fetchone():
                    await cur.execute("INSERT INTO departments (name) VALUES (%s)", (dept_name,))

print("Database initialization script created successfully!")