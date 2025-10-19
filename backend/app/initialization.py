from __future__ import annotations

import json
import logging
from typing import Any, Optional

from .config import Settings, get_settings
from .database import get_db_pool
from .security import hash_password

logger = logging.getLogger(__name__)


async def init_db(settings: Optional[Settings] = None) -> None:
    settings = settings or get_settings()
    pool = await get_db_pool(settings)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # Users table
            await cur.execute(
                """
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
                """
            )

            # Departments table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS departments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # Companies table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS companies (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    address TEXT,
                    phone VARCHAR(50),
                    email VARCHAR(255),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_name (name)
                )
                """
            )

            # Contacts table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS contacts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    company_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    title VARCHAR(255),
                    phone VARCHAR(50),
                    email VARCHAR(255),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                    INDEX idx_company (company_id)
                )
                """
            )

            # Quotes table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS quotes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    quote_number VARCHAR(50) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    client_name VARCHAR(255) NOT NULL,
                    department_id INT NOT NULL,
                    company_id INT,
                    contact_id INT,
                    project_address TEXT,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'draft',
                    version INT DEFAULT 1,
                    equipment_markup_default DECIMAL(5,2) DEFAULT 20.00,
                    tax_rate DECIMAL(5,2) DEFAULT 8.00,
                    tax_enabled BOOLEAN DEFAULT TRUE,
                    created_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    FOREIGN KEY (company_id) REFERENCES companies(id),
                    FOREIGN KEY (contact_id) REFERENCES contacts(id),
                    FOREIGN KEY (created_by) REFERENCES users(id),
                    INDEX idx_status (status),
                    INDEX idx_department (department_id),
                    INDEX idx_created_by (created_by),
                    INDEX idx_quote_number (quote_number)
                )
                """
            )

            # Quote sequence table for safe concurrent numbering
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS quote_numbers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    year INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # Quote versions
            await cur.execute(
                """
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
                """
            )

            # Rooms table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS rooms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    quote_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    quantity INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
                    INDEX idx_quote (quote_id)
                )
                """
            )

            # Systems table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS systems (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    INDEX idx_room (room_id)
                )
                """
            )

            # Equipment table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS equipment (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    system_id INT NOT NULL,
                    item_name VARCHAR(255) NOT NULL,
                    model VARCHAR(255),
                    description TEXT,
                    quantity INT NOT NULL,
                    unit_cost DECIMAL(10,2) NOT NULL,
                    markup_override DECIMAL(5,2),
                    vendor VARCHAR(255),
                    tax_exempt BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
                    INDEX idx_system (system_id),
                    INDEX idx_vendor (vendor)
                )
                """
            )

            # Labor table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS labor (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    role_name VARCHAR(255) NOT NULL,
                    cost_rate DECIMAL(10,2) NOT NULL,
                    sell_rate DECIMAL(10,2) NOT NULL,
                    hours DECIMAL(10,2) NOT NULL,
                    department_id INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    INDEX idx_room (room_id)
                )
                """
            )

            # Services table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS services (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_id INT NOT NULL,
                    service_name VARCHAR(255) NOT NULL,
                    percentage_of_equipment DECIMAL(5,2) NOT NULL,
                    department_id INT,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    INDEX idx_room (room_id)
                )
                """
            )

            # Templates table
            await cur.execute(
                """
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
                """
            )

            # Vendor prices table
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS vendor_prices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    item_name VARCHAR(255) NOT NULL,
                    model VARCHAR(255),
                    cost DECIMAL(10,2) NOT NULL,
                    description TEXT,
                    vendor VARCHAR(255) NOT NULL,
                    department_id INT,
                    all_departments BOOLEAN DEFAULT FALSE,
                    expiration_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (department_id) REFERENCES departments(id),
                    INDEX idx_vendor (vendor),
                    INDEX idx_item (item_name),
                    INDEX idx_expiration (expiration_date)
                )
                """
            )

            # Metrics table
            await cur.execute(
                """
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
                """
            )

            # Approvals table
            await cur.execute(
                """
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
                """
            )

            if settings.bootstrap_admin_enabled:
                await cur.execute("SELECT id FROM users WHERE username = %s", (settings.bootstrap_admin_username,))
                user_exists = await cur.fetchone()
                if not user_exists:
                    admin_password = hash_password(settings.bootstrap_admin_password or "")
                    await cur.execute(
                        "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                        (settings.bootstrap_admin_username, admin_password, "admin"),
                    )
                    logger.info("Bootstrap admin user created: %s", settings.bootstrap_admin_username)
            else:
                logger.info("Bootstrap admin creation skipped; BOOTSTRAP_ADMIN_PASSWORD not provided")

            for dept_name in ["AV", "LV", "IT"]:
                await cur.execute("SELECT id FROM departments WHERE name = %s", (dept_name,))
                if not await cur.fetchone():
                    await cur.execute("INSERT INTO departments (name) VALUES (%s)", (dept_name,))


async def record_quote_snapshot(cur: Any, quote_id: int, changed_by: int) -> None:
    await cur.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,))
    quote_snapshot = await cur.fetchone()
    if quote_snapshot:
        await cur.execute(
            "INSERT INTO quote_versions (quote_id, version, data, changed_by) VALUES (%s, %s, %s, %s)",
            (
                quote_id,
                quote_snapshot["version"],
                json.dumps(quote_snapshot, default=str),
                changed_by,
            ),
        )
