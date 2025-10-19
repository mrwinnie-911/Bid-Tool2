import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import { BarChart3, TrendingUp, FileText, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="dashboard-container">
        <div>
          <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Manrope' }}>Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user.username}!</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="card-hover" data-testid="total-quotes-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Quotes</CardTitle>
                  <FileText className="w-5 h-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats?.quotes_by_status?.reduce((acc, s) => acc + s.count, 0) || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover" data-testid="pending-quotes-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Pending Quotes</CardTitle>
                  <TrendingUp className="w-5 h-5 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats?.quotes_by_status?.find(s => s.status === 'pending')?.count || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover" data-testid="approved-quotes-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats?.quotes_by_status?.find(s => s.status === 'approved')?.count || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover" data-testid="total-revenue-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Estimated Revenue</CardTitle>
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      stats?.revenue_by_department?.reduce((acc, d) => 
                        acc + (parseFloat(d.equipment_total) || 0) + 
                        (parseFloat(d.labor_total) || 0) + 
                        (parseFloat(d.services_total) || 0), 0
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="quotes-by-department-card">
                <CardHeader>
                  <CardTitle>Quotes by Department</CardTitle>
                  <CardDescription>Current distribution across departments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.quotes_by_department?.map((dept, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{dept.name || 'Unassigned'}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" 
                              style={{ width: `${(dept.count / (stats?.quotes_by_department?.reduce((acc, d) => acc + d.count, 0) || 1)) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-900 w-8">{dept.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="revenue-by-department-card">
                <CardHeader>
                  <CardTitle>Revenue by Department</CardTitle>
                  <CardDescription>Estimated revenue breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.revenue_by_department?.map((dept, idx) => {
                      const total = (parseFloat(dept.equipment_total) || 0) + 
                                   (parseFloat(dept.labor_total) || 0) + 
                                   (parseFloat(dept.services_total) || 0);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">{dept.name}</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(total)}</span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex justify-between">
                              <span>Equipment:</span>
                              <span>{formatCurrency(dept.equipment_total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Labor:</span>
                              <span>{formatCurrency(dept.labor_total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Services:</span>
                              <span>{formatCurrency(dept.services_total)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card data-testid="recent-activity-card">
              <CardHeader>
                <CardTitle>Recent Quote Activity (90 Days)</CardTitle>
                <CardDescription>Daily quote creation trend</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recent_quotes?.length > 0 ? (
                  <div className="flex items-end gap-2 h-48">
                    {stats.recent_quotes.slice(-30).map((day, idx) => (
                      <div 
                        key={idx} 
                        className="flex-1 bg-gradient-to-t from-blue-500 to-purple-600 rounded-t" 
                        style={{ height: `${(day.count / Math.max(...stats.recent_quotes.map(d => d.count))) * 100}%`, minHeight: '4px' }}
                        title={`${day.date}: ${day.count} quotes`}
                      ></div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
