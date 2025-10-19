# AV/LV Quoting Application

A comprehensive web application for managing Audio-Visual (AV) and Low Voltage (LV) project quotes, built with FastAPI, React, and MySQL.

## Features

### Core Functionality
- **Quote Management**: Create, edit, and track project quotes with version history
- **Department-Based Organization**: Manage quotes by department with custom department creation
- **Room-Based Structure**: Organize quotes by rooms with system types
- **Comprehensive Costing**: Track equipment, labor, and third-party services
- **PDF Generation**: Export professional quotes as branded PDFs
- **Vendor Price Import**: Import price sheets from Excel with flexible column mapping

### User Management
- **Role-Based Access**: Admin and Estimator roles with department-level permissions
- **Authentication**: Secure JWT-based authentication with Azure AD framework ready
- **Department Filtering**: Users see only their department's data (except admins)

### Dashboard & Analytics
- **Custom Metrics**: User-defined dashboard metrics
- **Department Forecasting**: Revenue and quote tracking by department
- **90-Day Activity Charts**: Visual quote activity trends
- **Status Tracking**: Monitor quote progress from draft to approved

### Advanced Features
- **Version History**: Track all quote changes with complete audit trail
- **Approval Workflow**: Multi-level approval system (framework ready)
- **Vendor Search**: Quick search through imported vendor prices
- **Real-time Calculations**: Automatic totals for equipment, labor, and services

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.11)
- **Database**: MySQL/MariaDB
- **ORM**: SQLAlchemy + aiomysql
- **Authentication**: JWT + bcrypt
- **PDF Generation**: ReportLab
- **Excel Processing**: openpyxl

### Frontend
- **Framework**: React 19
- **Routing**: React Router v7
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Notifications**: Sonner

## Database Schema

### Core Tables
- **users**: User accounts with roles and department assignments
- **departments**: Organizational departments
- **quotes**: Main quote records with status and versioning
- **quote_versions**: Complete quote history
- **rooms**: Room definitions within quotes
- **equipment**: Equipment items per room
- **labor**: Labor entries per room
- **services**: Third-party services per room
- **vendor_prices**: Imported vendor pricing database
- **metrics**: User-defined dashboard metrics
- **approvals**: Quote approval workflow

## Getting Started

### Prerequisites
- MySQL/MariaDB installed and running
- Node.js 20+ and Yarn
- Python 3.11+

### Installation

1. **Database Setup**
```bash
mysql -e "CREATE DATABASE IF NOT EXISTS avlv_quotes;"
mysql -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('root123'); FLUSH PRIVILEGES;"
```

2. **Backend Setup**
```bash
cd /app/backend
pip install -r requirements.txt

# Update .env file with your MySQL credentials
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_USER=root
# MYSQL_PASSWORD=root123
# MYSQL_DATABASE=avlv_quotes

supervisorctl restart backend
```

3. **Frontend Setup**
```bash
cd /app/frontend
yarn install
supervisorctl restart frontend
```

### Default Credentials
- **Username**: admin
- **Password**: admin123

## Configuration

### Environment Variables

**Backend (.env)**
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=avlv_quotes
JWT_SECRET=your-secret-key-change-in-production
CORS_ORIGINS=*

# Azure AD (Optional - Framework Ready)
# AZURE_AD_ENABLED=false
# AZURE_AD_TENANT_ID=your-tenant-id
# AZURE_AD_CLIENT_ID=your-client-id
# AZURE_AD_CLIENT_SECRET=your-client-secret
```

**Frontend (.env)**
```env
REACT_APP_BACKEND_URL=your-backend-url
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create user (admin only)
- `GET /api/auth/me` - Get current user

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department
- `PUT /api/departments/{id}` - Update department
- `DELETE /api/departments/{id}` - Delete department

### Quotes
- `GET /api/quotes` - List quotes
- `POST /api/quotes` - Create quote
- `GET /api/quotes/{id}` - Get quote details
- `PUT /api/quotes/{id}` - Update quote
- `DELETE /api/quotes/{id}` - Delete quote
- `GET /api/quotes/{id}/versions` - Get version history
- `GET /api/quotes/{id}/pdf` - Download quote PDF

### Rooms, Equipment, Labor, Services
- Similar CRUD patterns for each entity
- All linked to parent room or quote

### Vendor Prices
- `POST /api/vendor-prices/import` - Upload Excel file
- `POST /api/vendor-prices/import-mapped` - Import with column mapping
- `GET /api/vendor-prices/search?q=query` - Search prices

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard metrics

## Usage Guide

### Creating a Quote

1. **Login** with your credentials
2. **Navigate to Quotes** page
3. **Click "New Quote"**
4. **Fill in quote details**:
   - Quote name
   - Client name
   - Department
   - Description
5. **Save the quote**
6. **Add rooms** to organize the quote
7. **For each room, add**:
   - Equipment items (with vendor search)
   - Labor entries (with department-specific rates)
   - Third-party services
8. **Review totals** in the quote summary
9. **Download PDF** for client presentation

### Importing Vendor Prices

1. **Navigate to Admin Panel**
2. **Click "Vendor Prices" tab**
3. **Click "Import Prices"**
4. **Upload Excel file**
5. **Map columns**:
   - Item Name (required)
   - Price (required)
   - Description (optional)
6. **Select vendor and department**
7. **Click "Import Prices"**

### Managing Departments

1. **Navigate to Admin Panel** (admin only)
2. **Click "Departments" tab**
3. **Add new departments** as your company grows
4. **Assign users to departments**

## Features Ready for Future Enhancement

### Azure AD Integration
The application includes a complete framework for Azure AD integration:
- OAuth flow code structure in place
- Feature flag (`AZURE_AD_ENABLED`) for easy activation
- Environment variables configured
- Simply add your Azure credentials and enable

### Regional Tax Support
Framework ready for:
- Regional tax calculations
- Multi-currency support
- Configurable tax rules per department/region

### Client Portal
Structure in place for:
- Client login capability
- Quote viewing and approval
- Document sharing

## Architecture Highlights

### Backend Design
- **Async/Await**: Fully asynchronous for high performance
- **Connection Pooling**: Efficient database connections
- **JWT Authentication**: Stateless, scalable auth
- **Role-Based Access Control**: Secure permission system
- **Version Control**: Complete quote history tracking

### Frontend Design
- **Component-Based**: Reusable UI components
- **Responsive Design**: Works on all screen sizes
- **Professional Styling**: Modern gradient and shadow effects
- **Accessible**: Built with Radix UI for accessibility
- **Type-Safe Forms**: Zod validation

### Database Design
- **Normalized Schema**: Efficient data structure
- **Foreign Key Constraints**: Data integrity
- **Indexed Queries**: Fast lookups
- **Cascading Deletes**: Automatic cleanup

## Performance Considerations

- Connection pooling (min 1, max 10 connections)
- Async database operations
- Efficient React rendering with hooks
- Lazy loading for large lists
- PDF generation optimized for speed

## Security Features

- Password hashing with bcrypt
- JWT token expiration (24 hours)
- CORS configuration
- SQL injection prevention (parameterized queries)
- Role-based access control
- Audit logging ready

## Troubleshooting

### Database Connection Issues
```bash
# Restart MySQL
service mariadb restart

# Check MySQL status
service mariadb status

# Reset root password
mysql -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('root123'); FLUSH PRIVILEGES;"
```

### Backend Not Starting
```bash
# Check logs
tail -f /var/log/supervisor/backend.err.log

# Restart backend
supervisorctl restart backend
```

### Frontend Issues
```bash
# Clear cache and rebuild
cd /app/frontend
rm -rf node_modules
yarn install
supervisorctl restart frontend
```

## Future Roadmap

- [ ] Advanced reporting with custom date ranges
- [ ] Email notifications for approvals
- [ ] Project scheduling integration
- [ ] Inventory management
- [ ] Mobile app
- [ ] Advanced forecasting with ML
- [ ] Multi-language support
- [ ] API for third-party integrations

## Support

For issues or questions:
1. Check logs in `/var/log/supervisor/`
2. Verify database connection
3. Ensure all services are running: `supervisorctl status`

## License

Proprietary - All rights reserved
