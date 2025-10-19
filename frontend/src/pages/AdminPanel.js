import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Layout from '@/components/Layout';
import { Plus, Trash2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminPanel = ({ user, onLogout }) => {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [vendorPrices, setVendorPrices] = useState([]);
  const [newDept, setNewDept] = useState('');
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'estimator',
    department_id: ''
  });

  const [importData, setImportData] = useState({
    file: null,
    vendor: '',
    department_id: '',
    all_departments: false,
    headers: [],
    mapping: {
      item_name: '',
      price: '',
      description: ''
    }
  });

  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
    fetchVendorPrices();
  }, []);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(response.data);
    } catch (error) {
      toast.error('Failed to fetch departments');
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const fetchVendorPrices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vendor-prices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendorPrices(response.data.slice(0, 50)); // Show recent 50
    } catch (error) {
      toast.error('Failed to fetch vendor prices');
    }
  };

  const handleAddDepartment = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/departments`, { name: newDept }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Department added successfully');
      setNewDept('');
      setShowDeptDialog(false);
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add department');
    }
  };

  const handleDeleteDepartment = async (deptId) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/departments/${deptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Department deleted successfully');
      fetchDepartments();
    } catch (error) {
      toast.error('Failed to delete department');
    }
  };

  const handleAddUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/auth/register`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User created successfully');
      setNewUser({ username: '', password: '', role: 'estimator', department_id: '' });
      setShowUserDialog(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/vendor-prices/import`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setImportData({
        ...importData,
        file,
        headers: response.data.headers
      });
      toast.success(`File uploaded. Found ${response.data.row_count} rows.`);
    } catch (error) {
      toast.error('Failed to upload file');
    }
  };

  const handleImportMapped = async () => {
    if (!importData.file || !importData.vendor || !importData.mapping.item_name || !importData.mapping.price) {
      toast.error('Please fill all required fields');
      return;
    }

    const formData = new FormData();
    formData.append('file', importData.file);
    formData.append('mapping', JSON.stringify(importData.mapping));
    formData.append('vendor', importData.vendor);
    if (importData.department_id) {
      formData.append('department_id', importData.department_id);
    }
    formData.append('all_departments', importData.all_departments.toString());

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/vendor-prices/import-mapped`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success(response.data.message);
      setShowImportDialog(false);
      setImportData({
        file: null,
        vendor: '',
        department_id: '',
        all_departments: false,
        headers: [],
        mapping: { item_name: '', price: '', description: '' }
      });
      fetchVendorPrices();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import prices');
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser({
      id: userToEdit.id,
      role: userToEdit.role,
      department_id: userToEdit.department_id?.toString() || ''
    });
    setShowEditUserDialog(true);
  };

  const handleUpdateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/users/${editingUser.id}`, {
        role: editingUser.role,
        department_id: editingUser.department_id ? parseInt(editingUser.department_id) : null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User updated successfully');
      setShowEditUserDialog(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="admin-panel-container">
        <div>
          <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Manrope' }}>Admin Panel</h1>
          <p className="text-gray-600 mt-2">Manage departments, users, and vendor pricing</p>
        </div>

        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="vendor-prices">Vendor Prices</TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Manage company departments</CardDescription>
                </div>
                <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-department-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Department</DialogTitle>
                      <DialogDescription>Create a new department for your organization</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Department Name</Label>
                        <Input
                          data-testid="department-name-input"
                          value={newDept}
                          onChange={(e) => setNewDept(e.target.value)}
                          placeholder="e.g., Audio-Visual"
                        />
                      </div>
                      <Button data-testid="submit-department-button" onClick={handleAddDepartment} className="w-full">
                        Add Department
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between p-3 border rounded" data-testid={`department-item-${dept.id}`}>
                      <div>
                        <div className="font-medium">{dept.name}</div>
                        <div className="text-sm text-gray-500">Created: {new Date(dept.created_at).toLocaleDateString()}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDepartment(dept.id)}
                        data-testid={`delete-department-${dept.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {departments.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No departments yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage user accounts</CardDescription>
                </div>
                <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-user-button">
                      <Plus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                      <DialogDescription>Create a new user account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          data-testid="user-username-input"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder="Username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          data-testid="user-password-input"
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="Password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                        >
                          <SelectTrigger data-testid="user-role-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="estimator">Estimator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Department (Optional)</Label>
                        <Select
                          value={newUser.department_id}
                          onValueChange={(value) => setNewUser({ ...newUser, department_id: value })}
                        >
                          <SelectTrigger data-testid="user-department-select">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id.toString()}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button data-testid="submit-user-button" onClick={handleAddUser} className="w-full">
                        Create User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 border rounded" data-testid={`user-item-${u.id}`}>
                      <div>
                        <div className="font-medium">{u.username}</div>
                        <div className="text-sm text-gray-500">
                          Role: {u.role} | Department: {u.department_name || 'None'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(u)}
                          data-testid={`edit-user-${u.id}`}
                        >
                          Edit
                        </Button>
                        {u.role !== 'admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                            data-testid={`delete-user-${u.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>Update user role and department</DialogDescription>
                </DialogHeader>
                {editingUser && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={editingUser.role}
                        onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                      >
                        <SelectTrigger data-testid="edit-user-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="estimator">Estimator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Department (Optional)</Label>
                      <Select
                        value={editingUser.department_id}
                        onValueChange={(value) => setEditingUser({ ...editingUser, department_id: value })}
                      >
                        <SelectTrigger data-testid="edit-user-department-select">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id.toString()}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button data-testid="submit-edit-user-button" onClick={handleUpdateUser} className="w-full">
                      Update User
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Vendor Prices Tab */}}
          <TabsContent value="vendor-prices" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Vendor Price Import</CardTitle>
                  <CardDescription>Import vendor price sheets from Excel</CardDescription>
                </div>
                <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="import-prices-button">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Prices
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Import Vendor Prices</DialogTitle>
                      <DialogDescription>Upload Excel file and map columns</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Excel File</Label>
                        <Input
                          data-testid="excel-file-input"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileUpload}
                        />
                      </div>

                      {importData.headers.length > 0 && (
                        <>
                          <div className="space-y-2">
                            <Label>Vendor Name</Label>
                            <Input
                              data-testid="vendor-name-input"
                              value={importData.vendor}
                              onChange={(e) => setImportData({ ...importData, vendor: e.target.value })}
                              placeholder="Vendor name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Department (Optional)</Label>
                            <Select
                              value={importData.department_id}
                              onValueChange={(value) => setImportData({ ...importData, department_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                              <SelectContent>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id.toString()}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="border rounded p-4 space-y-3">
                            <h4 className="font-semibold">Column Mapping</h4>
                            
                            <div className="space-y-2">
                              <Label>Item Name Column *</Label>
                              <Select
                                value={importData.mapping.item_name}
                                onValueChange={(value) => setImportData({
                                  ...importData,
                                  mapping: { ...importData.mapping, item_name: value }
                                })}
                              >
                                <SelectTrigger data-testid="item-name-column-select">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {importData.headers.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Price Column *</Label>
                              <Select
                                value={importData.mapping.price}
                                onValueChange={(value) => setImportData({
                                  ...importData,
                                  mapping: { ...importData.mapping, price: value }
                                })}
                              >
                                <SelectTrigger data-testid="price-column-select">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {importData.headers.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Description Column (Optional)</Label>
                              <Select
                                value={importData.mapping.description}
                                onValueChange={(value) => setImportData({
                                  ...importData,
                                  mapping: { ...importData.mapping, description: value }
                                })}
                              >
                                <SelectTrigger data-testid="description-column-select">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {importData.headers.map((header) => (
                                    <SelectItem key={header} value={header}>
                                      {header}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Button data-testid="submit-import-button" onClick={handleImportMapped} className="w-full">
                            Import Prices
                          </Button>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {vendorPrices.map((vp) => (
                    <div key={vp.id} className="flex items-center justify-between p-3 border rounded" data-testid={`vendor-price-${vp.id}`}>
                      <div className="flex-1">
                        <div className="font-medium">{vp.item_name}</div>
                        <div className="text-sm text-gray-500">
                          ${vp.price} | Vendor: {vp.vendor}
                        </div>
                        {vp.description && (
                          <div className="text-xs text-gray-400">{vp.description}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(vp.imported_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  {vendorPrices.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No vendor prices imported yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminPanel;
