import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Settings, LogOut } from 'lucide-react';

const Layout = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope' }}>AV/LV Quoting</h1>
            </div>
            
            <nav className="flex items-center gap-4">
              <Button
                data-testid="nav-dashboard"
                variant={isActive('/dashboard') ? 'default' : 'ghost'}
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button
                data-testid="nav-quotes"
                variant={isActive('/quotes') ? 'default' : 'ghost'}
                onClick={() => navigate('/quotes')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Quotes
              </Button>
              {user?.role === 'admin' && (
                <Button
                  data-testid="nav-admin"
                  variant={isActive('/admin') ? 'default' : 'ghost'}
                  onClick={() => navigate('/admin')}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <div className="font-medium" data-testid="user-display-name">{user?.username}</div>
                  <div className="text-gray-500 text-xs">{user?.role}</div>
                </div>
                <Button
                  data-testid="logout-button"
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
