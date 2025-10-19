# Quick Start - External MySQL Connection

## Option 1: Use the Helper Script (Easiest)

Run the interactive setup script:

```bash
bash /app/scripts/setup_external_mysql.sh
```

The script will:
1. Show your current configuration
2. Ask for your external MySQL credentials
3. Test the connection
4. Update the configuration
5. Restart the backend automatically

## Option 2: Manual Update (Quick)

1. Edit the file:
```bash
nano /app/backend/.env
```

2. Update these lines:
```bash
MYSQL_HOST=your-database-host.com
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=avlv_quotes
```

3. Save and restart:
```bash
sudo supervisorctl restart backend
```

## Common Cloud Provider Examples

### AWS RDS
```bash
MYSQL_HOST=mydb.abc123.us-east-1.rds.amazonaws.com
MYSQL_PORT=3306
MYSQL_USER=admin
MYSQL_PASSWORD=YourPassword
MYSQL_DATABASE=avlv_quotes
```

### Google Cloud SQL
```bash
MYSQL_HOST=12.34.56.78
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=YourPassword
MYSQL_DATABASE=avlv_quotes
```

### Azure Database for MySQL
```bash
MYSQL_HOST=myserver.mysql.database.azure.com
MYSQL_PORT=3306
MYSQL_USER=myadmin@myserver
MYSQL_PASSWORD=YourPassword
MYSQL_DATABASE=avlv_quotes
```

### DigitalOcean Managed Database
```bash
MYSQL_HOST=db-mysql-nyc3-12345.ondigitalocean.com
MYSQL_PORT=25060
MYSQL_USER=doadmin
MYSQL_PASSWORD=YourPassword
MYSQL_DATABASE=avlv_quotes
```

### PlanetScale
```bash
MYSQL_HOST=aws.connect.psdb.cloud
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=pscale_pw_xxxxx
MYSQL_DATABASE=avlv_quotes
```

## Verify Connection

Check if it's working:
```bash
tail -n 20 /var/log/supervisor/backend.out.log
```

Look for:
```
INFO: Database initialized with enhanced schema
```

## Troubleshooting

### If connection fails:

1. **Check if database exists:**
```bash
# Log into your external MySQL and run:
CREATE DATABASE IF NOT EXISTS avlv_quotes;
```

2. **Test connectivity:**
```bash
telnet your-database-host.com 3306
# or
nc -zv your-database-host.com 3306
```

3. **Check firewall rules:**
- Whitelist your application server IP in the database firewall

4. **View backend errors:**
```bash
tail -f /var/log/supervisor/backend.err.log
```

## Need Help?

- Full documentation: `/app/docs/EXTERNAL_MYSQL_SETUP.md`
- Test connection: `bash /app/scripts/setup_external_mysql.sh`
- View logs: `tail -f /var/log/supervisor/backend.err.log`
