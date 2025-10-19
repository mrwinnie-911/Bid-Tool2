#!/bin/bash

# External MySQL Connection Helper Script
# This script helps you connect your AV/LV Quoting app to an external MySQL database

echo "=================================="
echo "External MySQL Setup Helper"
echo "=================================="
echo ""

# Get current settings
source /app/backend/.env 2>/dev/null

echo "Current MySQL Configuration:"
echo "  Host: ${MYSQL_HOST}"
echo "  Port: ${MYSQL_PORT}"
echo "  User: ${MYSQL_USER}"
echo "  Database: ${MYSQL_DATABASE}"
echo ""

read -p "Do you want to update MySQL connection? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter your external MySQL details:"
    echo ""
    
    read -p "MySQL Host (e.g., db.example.com): " NEW_HOST
    read -p "MySQL Port [3306]: " NEW_PORT
    NEW_PORT=${NEW_PORT:-3306}
    read -p "MySQL Username: " NEW_USER
    read -sp "MySQL Password: " NEW_PASSWORD
    echo ""
    read -p "Database Name [avlv_quotes]: " NEW_DB
    NEW_DB=${NEW_DB:-avlv_quotes}
    
    echo ""
    echo "Updating .env file..."
    
    # Backup current .env
    cp /app/backend/.env /app/backend/.env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update .env file
    sed -i "s/^MYSQL_HOST=.*/MYSQL_HOST=$NEW_HOST/" /app/backend/.env
    sed -i "s/^MYSQL_PORT=.*/MYSQL_PORT=$NEW_PORT/" /app/backend/.env
    sed -i "s/^MYSQL_USER=.*/MYSQL_USER=$NEW_USER/" /app/backend/.env
    sed -i "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=$NEW_PASSWORD/" /app/backend/.env
    sed -i "s/^MYSQL_DATABASE=.*/MYSQL_DATABASE=$NEW_DB/" /app/backend/.env
    
    echo "✓ Configuration updated!"
    echo ""
    
    # Test connection
    echo "Testing connection..."
    python3 << EOF
import aiomysql
import asyncio

async def test():
    try:
        pool = await aiomysql.create_pool(
            host='$NEW_HOST',
            port=int('$NEW_PORT'),
            user='$NEW_USER',
            password='$NEW_PASSWORD',
            db='$NEW_DB',
            autocommit=True,
            minsize=1,
            maxsize=2,
            connect_timeout=10
        )
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT VERSION()")
                version = await cur.fetchone()
                print(f"✓ Connection successful!")
                print(f"✓ MySQL Version: {version[0]}")
        pool.close()
        await pool.wait_closed()
        return True
    except Exception as e:
        print(f"✗ Connection failed: {str(e)}")
        return False

success = asyncio.run(test())
exit(0 if success else 1)
EOF
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "Restarting backend service..."
        sudo supervisorctl restart backend
        sleep 3
        
        echo ""
        echo "=================================="
        echo "✓ Setup Complete!"
        echo "=================================="
        echo ""
        echo "Your app is now connected to:"
        echo "  Host: $NEW_HOST"
        echo "  Database: $NEW_DB"
        echo ""
        echo "Check backend logs for any issues:"
        echo "  tail -f /var/log/supervisor/backend.err.log"
        echo ""
    else
        echo ""
        echo "=================================="
        echo "✗ Connection Failed"
        echo "=================================="
        echo ""
        echo "Please verify:"
        echo "  1. MySQL server is running and accessible"
        echo "  2. Firewall allows connections on port $NEW_PORT"
        echo "  3. Username and password are correct"
        echo "  4. Database '$NEW_DB' exists"
        echo "  5. User has proper permissions"
        echo ""
        echo "Your previous configuration has been backed up."
        echo "To restore it, run:"
        echo "  cp /app/backend/.env.backup.* /app/backend/.env"
        echo "  sudo supervisorctl restart backend"
        echo ""
    fi
else
    echo "No changes made."
fi

echo ""
echo "For detailed instructions, see: /app/docs/EXTERNAL_MYSQL_SETUP.md"
echo ""
