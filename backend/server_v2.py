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
# ============ Auth Routes ============

@api_router.post("/auth/register")
async def register(user_data: UserCreate, current_user = Depends(require_admin), cur = Depends(get_db)):
    """Admin only - register new users"""
    password_hash = hash_password(user_data.password)
    try:
        await cur.execute(
            "INSERT INTO users (username, password_hash, role, department_id) VALUES (%s, %s, %s, %s)",
            (user_data.username, password_hash, user_data.role, user_data.department_id)
        )
        return {"message": "User created successfully"}
    except aiomysql.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")

@api_router.post("/auth/login")
async def login(credentials: UserLogin, cur = Depends(get_db)):
    await cur.execute("SELECT * FROM users WHERE username = %s", (credentials.username,))
    user = await cur.fetchone()
    
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['username'], user['role'])
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "role": user['role'],
            "department_id": user['department_id']
        }
    }

@api_router.get("/auth/me")
async def get_me(user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT id, username, role, department_id, created_at FROM users WHERE id = %s", (user['user_id'],))
    user_data = await cur.fetchone()
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    return user_data

# ============ Department Routes ============

@api_router.post("/departments")
async def create_department(dept: DepartmentCreate, user = Depends(require_admin), cur = Depends(get_db)):
    try:
        await cur.execute("INSERT INTO departments (name) VALUES (%s)", (dept.name,))
        return {"message": "Department created successfully"}
    except aiomysql.IntegrityError:
        raise HTTPException(status_code=400, detail="Department already exists")

@api_router.get("/departments")
async def get_departments(user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT * FROM departments ORDER BY name")
    return await cur.fetchall()

@api_router.put("/departments/{dept_id}")
async def update_department(dept_id: int, dept: DepartmentCreate, user = Depends(require_admin), cur = Depends(get_db)):
    await cur.execute("UPDATE departments SET name = %s WHERE id = %s", (dept.name, dept_id))
    return {"message": "Department updated successfully"}

@api_router.delete("/departments/{dept_id}")
async def delete_department(dept_id: int, user = Depends(require_admin), cur = Depends(get_db)):
    await cur.execute("DELETE FROM departments WHERE id = %s", (dept_id,))
    return {"message": "Department deleted successfully"}

# ============ Quote Routes ============

@api_router.post("/quotes")
async def create_quote(quote: QuoteCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """INSERT INTO quotes (name, client_name, department_id, description, equipment_markup_default, 
           tax_rate, tax_enabled, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (quote.name, quote.client_name, quote.department_id, quote.description, 
         quote.equipment_markup_default, quote.tax_rate, quote.tax_enabled, user['user_id'])
    )
    quote_id = cur.lastrowid
    return {"id": quote_id, "message": "Quote created successfully"}

@api_router.get("/quotes")
async def get_quotes(user = Depends(get_current_user), cur = Depends(get_db)):
    if user['role'] == 'admin':
        await cur.execute("""
            SELECT q.*, d.name as department_name, u.username as created_by_username
            FROM quotes q
            LEFT JOIN departments d ON q.department_id = d.id
            LEFT JOIN users u ON q.created_by = u.id
            ORDER BY q.updated_at DESC
        """)
    else:
        await cur.execute("""
            SELECT q.*, d.name as department_name, u.username as created_by_username
            FROM quotes q
            LEFT JOIN departments d ON q.department_id = d.id
            LEFT JOIN users u ON q.created_by = u.id
            WHERE q.department_id = (SELECT department_id FROM users WHERE id = %s)
            ORDER BY q.updated_at DESC
        """, (user['user_id'],))
    
    return await cur.fetchall()

@api_router.get("/quotes/{quote_id}")
async def get_quote(quote_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("""
        SELECT q.*, d.name as department_name, u.username as created_by_username
        FROM quotes q
        LEFT JOIN departments d ON q.department_id = d.id
        LEFT JOIN users u ON q.created_by = u.id
        WHERE q.id = %s
    """, (quote_id,))
    quote = await cur.fetchone()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return quote

@api_router.put("/quotes/{quote_id}")
async def update_quote(quote_id: int, quote_data: QuoteUpdate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT version FROM quotes WHERE id = %s", (quote_id,))
    current = await cur.fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Save version
    await cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
    quote_snapshot = await cur.fetchone()
    await cur.execute(
        "INSERT INTO quote_versions (quote_id, version, data, changed_by) VALUES (%s, %s, %s, %s)",
        (quote_id, current['version'], json.dumps(quote_snapshot, default=str), user['user_id'])
    )
    
    # Update quote
    update_fields = []
    values = []
    for field, value in quote_data.model_dump(exclude_unset=True).items():
        update_fields.append(f"{field} = %s")
        values.append(value)
    
    if update_fields:
        update_fields.append("version = version + 1")
        values.append(quote_id)
        await cur.execute(
            f"UPDATE quotes SET {', '.join(update_fields)} WHERE id = %s",
            tuple(values)
        )
    
    return {"message": "Quote updated successfully"}

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("DELETE FROM quotes WHERE id = %s", (quote_id,))
    return {"message": "Quote deleted successfully"}

# ============ Room Routes ============

@api_router.post("/rooms")
async def create_room(room: RoomCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        "INSERT INTO rooms (quote_id, name, quantity) VALUES (%s, %s, %s)",
        (room.quote_id, room.name, room.quantity)
    )
    return {"id": cur.lastrowid, "message": "Room created successfully"}

@api_router.get("/rooms/quote/{quote_id}")
async def get_rooms_by_quote(quote_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT * FROM rooms WHERE quote_id = %s", (quote_id,))
    return await cur.fetchall()

@api_router.put("/rooms/{room_id}")
async def update_room(room_id: int, room: RoomCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        "UPDATE rooms SET name = %s, quantity = %s WHERE id = %s",
        (room.name, room.quantity, room_id)
    )
    return {"message": "Room updated successfully"}

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("DELETE FROM rooms WHERE id = %s", (room_id,))
    return {"message": "Room deleted successfully"}

# ============ System Routes (NEW) ============

@api_router.post("/systems")
async def create_system(system: SystemCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        "INSERT INTO systems (room_id, name, description) VALUES (%s, %s, %s)",
        (system.room_id, system.name, system.description)
    )
    return {"id": cur.lastrowid, "message": "System created successfully"}

@api_router.get("/systems/room/{room_id}")
async def get_systems_by_room(room_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT * FROM systems WHERE room_id = %s", (room_id,))
    return await cur.fetchall()

@api_router.put("/systems/{system_id}")
async def update_system(system_id: int, system: SystemCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        "UPDATE systems SET name = %s, description = %s WHERE id = %s",
        (system.name, system.description, system_id)
    )
    return {"message": "System updated successfully"}

@api_router.delete("/systems/{system_id}")
async def delete_system(system_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("DELETE FROM systems WHERE id = %s", (system_id,))
    return {"message": "System deleted successfully"}

# ============ Equipment Routes (UPDATED) ============

@api_router.post("/equipment")
async def create_equipment(equip: EquipmentCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """INSERT INTO equipment (system_id, item_name, description, quantity, unit_cost, 
           markup_override, vendor, tax_exempt) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (equip.system_id, equip.item_name, equip.description, equip.quantity, 
         equip.unit_cost, equip.markup_override, equip.vendor, equip.tax_exempt)
    )
    return {"id": cur.lastrowid, "message": "Equipment created successfully"}

@api_router.get("/equipment/system/{system_id}")
async def get_equipment_by_system(system_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    # Get quote's default markup
    await cur.execute("""
        SELECT q.equipment_markup_default 
        FROM quotes q
        JOIN rooms r ON q.id = r.quote_id
        JOIN systems s ON r.id = s.room_id
        WHERE s.id = %s
    """, (system_id,))
    quote_data = await cur.fetchone()
    default_markup = float(quote_data['equipment_markup_default']) if quote_data else 20.0
    
    await cur.execute("SELECT * FROM equipment WHERE system_id = %s", (system_id,))
    equipment = await cur.fetchall()
    
    # Calculate prices with markup
    for eq in equipment:
        markup = float(eq['markup_override']) if eq['markup_override'] else default_markup
        unit_cost = float(eq['unit_cost'])
        unit_price = unit_cost * (1 + markup / 100)
        eq['unit_price'] = round(unit_price, 2)
        eq['total_cost'] = round(unit_cost * eq['quantity'], 2)
        eq['total_price'] = round(unit_price * eq['quantity'], 2)
        eq['margin_dollars'] = round((unit_price - unit_cost) * eq['quantity'], 2)
        eq['margin_percent'] = round(markup, 2)
    
    return equipment

@api_router.put("/equipment/{equip_id}")
async def update_equipment(equip_id: int, equip: EquipmentCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """UPDATE equipment SET item_name = %s, description = %s, quantity = %s, unit_cost = %s,
           markup_override = %s, vendor = %s, tax_exempt = %s WHERE id = %s""",
        (equip.item_name, equip.description, equip.quantity, equip.unit_cost,
         equip.markup_override, equip.vendor, equip.tax_exempt, equip_id)
    )
    return {"message": "Equipment updated successfully"}

@api_router.delete("/equipment/{equip_id}")
async def delete_equipment(equip_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("DELETE FROM equipment WHERE id = %s", (equip_id,))
    return {"message": "Equipment deleted successfully"}

# ============ Labor Routes (UPDATED) ============

@api_router.post("/labor")
async def create_labor(labor: LaborCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """INSERT INTO labor (room_id, role_name, cost_rate, sell_rate, hours, department_id) 
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (labor.room_id, labor.role_name, labor.cost_rate, labor.sell_rate, labor.hours, labor.department_id)
    )
    return {"id": cur.lastrowid, "message": "Labor created successfully"}

@api_router.get("/labor/room/{room_id}")
async def get_labor_by_room(room_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT * FROM labor WHERE room_id = %s", (room_id,))
    labor = await cur.fetchall()
    
    # Calculate totals and margins
    for lb in labor:
        lb['total_cost'] = round(float(lb['cost_rate']) * float(lb['hours']), 2)
        lb['total_price'] = round(float(lb['sell_rate']) * float(lb['hours']), 2)
        lb['margin_dollars'] = round(lb['total_price'] - lb['total_cost'], 2)
        lb['margin_percent'] = round((lb['margin_dollars'] / lb['total_cost'] * 100) if lb['total_cost'] > 0 else 0, 2)
    
    return labor

@api_router.put("/labor/{labor_id}")
async def update_labor(labor_id: int, labor: LaborCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """UPDATE labor SET role_name = %s, cost_rate = %s, sell_rate = %s, hours = %s,
           department_id = %s WHERE id = %s""",
        (labor.role_name, labor.cost_rate, labor.sell_rate, labor.hours, labor.department_id, labor_id)
    )
    return {"message": "Labor updated successfully"}

@api_router.delete("/labor/{labor_id}")
async def delete_labor(labor_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("DELETE FROM labor WHERE id = %s", (labor_id,))
    return {"message": "Labor deleted successfully"}

# ============ Service Routes (UPDATED) ============

@api_router.post("/services")
async def create_service(service: ServiceCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """INSERT INTO services (room_id, service_name, percentage_of_equipment, department_id, description) 
           VALUES (%s, %s, %s, %s, %s)""",
        (service.room_id, service.service_name, service.percentage_of_equipment, service.department_id, service.description)
    )
    return {"id": cur.lastrowid, "message": "Service created successfully"}

@api_router.get("/services/room/{room_id}")
async def get_services_by_room(room_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("SELECT * FROM services WHERE room_id = %s", (room_id,))
    return await cur.fetchall()

@api_router.put("/services/{service_id}")
async def update_service(service_id: int, service: ServiceCreate, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute(
        """UPDATE services SET service_name = %s, percentage_of_equipment = %s, 
           department_id = %s, description = %s WHERE id = %s""",
        (service.service_name, service.percentage_of_equipment, service.department_id, service.description, service_id)
    )
    return {"message": "Service updated successfully"}

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: int, user = Depends(get_current_user), cur = Depends(get_db)):
    await cur.execute("DELETE FROM services WHERE id = %s", (service_id,))
    return {"message": "Service deleted successfully"}

