# Connect to External MySQL Database

## Quick Setup

Simply update the MySQL connection details in `/app/backend/.env`:

```bash
# MySQL Configuration - Update these for your external database
MYSQL_HOST=your-external-host.com
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=avlv_quotes
```

## Step-by-Step Instructions

### 1. Get Your External MySQL Credentials

You'll need:
- **Host**: Your MySQL server address (e.g., `db.example.com` or IP address)
- **Port**: Usually `3306` (default MySQL port)
- **Username**: Your MySQL username
- **Password**: Your MySQL password
- **Database**: The database name (can be `avlv_quotes` or any name you prefer)

### 2. Update the .env File

Edit `/app/backend/.env` and replace the MySQL section:

```bash
# Example for AWS RDS
MYSQL_HOST=mydb.abc123.us-east-1.rds.amazonaws.com
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=MySecurePassword123!
MYSQL_DATABASE=avlv_quotes

# Example for DigitalOcean
MYSQL_HOST=db-mysql-nyc3-12345.ondigitalocean.com
MYSQL_PORT=25060
MYSQL_USER=doadmin
MYSQL_PASSWORD=MyPassword123
MYSQL_DATABASE=avlv_quotes

# Example for Azure Database
MYSQL_HOST=myserver.mysql.database.azure.com
MYSQL_PORT=3306
MYSQL_USER=myadmin@myserver
MYSQL_PASSWORD=MyPassword
MYSQL_DATABASE=avlv_quotes

# Example for any external server
MYSQL_HOST=192.168.1.100
MYSQL_PORT=3306
MYSQL_USER=avlv_user
MYSQL_PASSWORD=SecurePassword
MYSQL_DATABASE=avlv_quotes
```

### 3. Ensure Database Exists

Make sure the database exists on your external MySQL server. If not, create it:

```sql
CREATE DATABASE IF NOT EXISTS avlv_quotes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Restart the Backend

After updating the .env file, restart the backend service:

```bash
sudo supervisorctl restart backend
```

### 5. Verify Connection

Check the backend logs to ensure connection is successful:

```bash
tail -n 50 /var/log/supervisor/backend.out.log
```

You should see:
```
INFO: Database initialized with enhanced schema
```

## Firewall & Security Configuration

### For Cloud Databases (AWS RDS, Azure, etc.)

1. **Whitelist the IP address** of your application server in the database firewall rules
2. **Enable SSL/TLS** if supported (recommended for production)
3. **Use VPC/Private Network** if both servers are in the same cloud

### For Self-Hosted MySQL

Ensure your MySQL server allows remote connections:

1. Edit MySQL config (`/etc/mysql/mysql.conf.d/mysqld.cnf`):
   ```
   bind-address = 0.0.0.0
   ```

2. Grant remote access to your user:
   ```sql
   CREATE USER 'avlv_user'@'%' IDENTIFIED BY 'SecurePassword';
   GRANT ALL PRIVILEGES ON avlv_quotes.* TO 'avlv_user'@'%';
   FLUSH PRIVILEGES;
   ```

3. Restart MySQL:
   ```bash
   sudo systemctl restart mysql
   ```

## SSL/TLS Connection (Recommended for Production)

To connect via SSL, add SSL parameters to the connection. Update `/app/backend/server.py` if needed:

```python
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
            maxsize=10,
            ssl={'ssl': True}  # Enable SSL
        )
    return pool
```

## Testing Connection

### Quick Test Script

Create a test file to verify your connection:

```bash
cat > /tmp/test_mysql_connection.py << 'EOF'
import aiomysql
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path('/app/backend')
load_dotenv(ROOT_DIR / '.env')

async def test_connection():
    try:
        pool = await aiomysql.create_pool(
            host=os.environ.get('MYSQL_HOST'),
            port=int(os.environ.get('MYSQL_PORT', '3306')),
            user=os.environ.get('MYSQL_USER'),
            password=os.environ.get('MYSQL_PASSWORD'),
            db=os.environ.get('MYSQL_DATABASE'),
            autocommit=True,
            minsize=1,
            maxsize=2
        )
        
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT VERSION()")
                version = await cur.fetchone()
                print(f"✓ Connected successfully!")
                print(f"✓ MySQL Version: {version[0]}")
                print(f"✓ Host: {os.environ.get('MYSQL_HOST')}")
                print(f"✓ Database: {os.environ.get('MYSQL_DATABASE')}")
        
        pool.close()
        await pool.wait_closed()
        print("✓ Connection test successful!")
        
    except Exception as e:
        print(f"✗ Connection failed: {str(e)}")
        print(f"✗ Host: {os.environ.get('MYSQL_HOST')}")
        print(f"✗ Port: {os.environ.get('MYSQL_PORT')}")
        print(f"✗ User: {os.environ.get('MYSQL_USER')}")
        print(f"✗ Database: {os.environ.get('MYSQL_DATABASE')}")

asyncio.run(test_connection())
EOF

python3 /tmp/test_mysql_connection.py
```

## Troubleshooting

### Connection Refused
- Check if MySQL server is running
- Verify firewall allows connections on port 3306
- Ensure IP is whitelisted in cloud provider settings

### Access Denied
- Verify username and password are correct
- Check user has permissions for the database
- Ensure user can connect from remote hosts (not just localhost)

### Database Not Found
- Create the database manually on the external server
- Use the exact database name in .env

### SSL/TLS Errors
- If SSL is required, enable it in the connection
- Download SSL certificates if provided by your database host

## Migration from Local to External MySQL

If you have existing data locally that you want to migrate:

```bash
# 1. Export data from local MySQL
mysqldump -u root -proot123 avlv_quotes > /tmp/avlv_quotes_backup.sql

# 2. Import to external MySQL
mysql -h your-external-host.com -u your_username -p your_database < /tmp/avlv_quotes_backup.sql
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `MYSQL_HOST` | MySQL server hostname or IP | `db.example.com` |
| `MYSQL_PORT` | MySQL port (default 3306) | `3306` |
| `MYSQL_USER` | Database username | `avlv_admin` |
| `MYSQL_PASSWORD` | Database password | `SecurePass123!` |
| `MYSQL_DATABASE` | Database name | `avlv_quotes` |

## Security Best Practices

1. ✅ Use strong passwords (16+ characters, mixed case, numbers, symbols)
2. ✅ Enable SSL/TLS for connections
3. ✅ Whitelist only necessary IP addresses
4. ✅ Use read-only users for reporting/analytics
5. ✅ Regular backups (daily recommended)
6. ✅ Keep MySQL version updated
7. ✅ Use VPC/private network when possible
8. ✅ Enable MySQL audit logging
9. ✅ Rotate passwords periodically
10. ✅ Use separate credentials for dev/staging/production

## Support

If you encounter issues:
1. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
2. Test connection with the test script above
3. Verify network connectivity: `telnet your-host 3306`
4. Check MySQL server logs on the external server
