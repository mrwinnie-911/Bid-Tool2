import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { Plus, Save, Trash2, Download, Search, ChevronDown, ChevronUp, FileText, History } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QuoteBuilder = ({ user, onLogout }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [systems, setSystems] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [labor, setLabor] = useState([]);
  const [services, setServices] = useState([]);
  const [vendorPrices, setVendorPrices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFinancials, setShowFinancials] = useState(false);
  const [financials, setFinancials] = useState(null);
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  
  // Quote form data
  const [quoteData, setQuoteData] = useState({
    name: '',
    client_name: '',
    department_id: '',
    company_id: '',
    contact_id: '',
    project_address: '',
    description: '',
    equipment_markup_default: 20,
    tax_rate: 8,
    tax_enabled: true,
    status: 'draft',
    quote_number: ''
  });

  // Room form
  const [roomForm, setRoomForm] = useState({ name: '', quantity: 1 });
  const [showRoomDialog, setShowRoomDialog] = useState(false);

  // System form
  const [systemForm, setSystemForm] = useState({ name: '', description: '' });
  const [showSystemDialog, setShowSystemDialog] = useState(false);

  // Equipment form
  const [equipForm, setEquipForm] = useState({
    item_name: '',
    model: '',
    description: '',
    quantity: 1,
    unit_cost: 0,
    markup_override: null,
    vendor: '',
    tax_exempt: false
  });

  // Labor form
  const [laborForm, setLaborForm] = useState({
    role_name: '',
    cost_rate: 0,
    sell_rate: 0,
    hours: 0,
    department_id: ''
  });

  // Service form
  const [serviceForm, setServiceForm] = useState({
    service_name: '',
    percentage_of_equipment: 5,
    department_id: '',
    description: ''
  });

  useEffect(() => {
    fetchDepartments();
    if (id) {
      fetchQuote();
      fetchRooms();
      fetchVersions();
    }
  }, [id]);

  useEffect(() => {
    if (selectedRoom) {
      fetchSystems();
      fetchRoomData(selectedRoom);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (selectedSystem) {
      fetchEquipment();
    }
  }, [selectedSystem]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      searchVendorPrices();
    }
  }, [searchQuery]);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to fetch departments');
    }
  };

  const fetchQuote = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuoteData({
        name: response.data.name,
        client_name: response.data.client_name,
        department_id: response.data.department_id.toString(),
        description: response.data.description || '',
        equipment_markup_default: response.data.equipment_markup_default || 20,
        tax_rate: response.data.tax_rate || 0,
        tax_enabled: response.data.tax_enabled || false,
        status: response.data.status
      });
    } catch (error) {
      toast.error('Failed to load quote');
    }
  };

  const fetchVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes/${id}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(response.data);
    } catch (error) {
      console.error('Failed to fetch versions');
    }
  };

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/rooms/quote/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRooms(response.data);
      if (response.data.length > 0 && !selectedRoom) {
        setSelectedRoom(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch rooms');
    }
  };

  const fetchSystems = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/systems/room/${selectedRoom}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystems(response.data);
      if (response.data.length > 0 && !selectedSystem) {
        setSelectedSystem(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch systems');
    }
  };

  const fetchEquipment = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/equipment/system/${selectedSystem}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEquipment(response.data);
    } catch (error) {
      console.error('Failed to fetch equipment');
    }
  };

  const fetchRoomData = async (roomId) => {
    try {
      const token = localStorage.getItem('token');
      
      const [laborRes, servicesRes] = await Promise.all([
        axios.get(`${API}/labor/room/${roomId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services/room/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setLabor(laborRes.data);
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Failed to fetch room data');
    }
  };

  const searchVendorPrices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/vendor-prices/search?q=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendorPrices(response.data);
    } catch (error) {
      console.error('Failed to search vendor prices');
    }
  };

  const fetchFinancials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes/${id}/financials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFinancials(response.data);
      setShowFinancials(true);
    } catch (error) {
      toast.error('Failed to load financials');
    }
  };

  const handleSaveQuote = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (id) {
        await axios.put(`${API}/quotes/${id}`, quoteData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Quote updated successfully');
        fetchVersions();
      } else {
        const response = await axios.post(`${API}/quotes`, quoteData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Quote created successfully');
        navigate(`/quotes/${response.data.id}`);
      }
    } catch (error) {
      toast.error('Failed to save quote');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/quotes/${id}/status?status=${newStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuoteData({ ...quoteData, status: newStatus });
      toast.success(`Status changed to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRestoreVersion = async (version) => {
    if (!window.confirm(`Restore to version ${version}?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/quotes/${id}/restore-version/${version}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Version restored');
      fetchQuote();
      fetchVersions();
      setShowVersions(false);
    } catch (error) {
      toast.error('Failed to restore version');
    }
  };

  const handleAddRoom = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/rooms`, {
        quote_id: parseInt(id),
        ...roomForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Room added successfully');
      setRoomForm({ name: '', quantity: 1 });
      setShowRoomDialog(false);
      fetchRooms();
    } catch (error) {
      toast.error('Failed to add room');
    }
  };

  const handleAddSystem = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room first');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/systems`, {
        room_id: selectedRoom,
        ...systemForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('System added successfully');
      setSystemForm({ name: '', description: '' });
      setShowSystemDialog(false);
      fetchSystems();
    } catch (error) {
      toast.error('Failed to add system');
    }
  };

  const handleAddEquipment = async () => {
    if (!selectedSystem) {
      toast.error('Please select a system first');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/equipment`, {
        system_id: selectedSystem,
        ...equipForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Equipment added successfully');
      setEquipForm({ item_name: '', description: '', quantity: 1, unit_cost: 0, markup_override: null, vendor: '', tax_exempt: false });
      fetchEquipment();
    } catch (error) {
      toast.error('Failed to add equipment');
    }
  };

  const handleAddLabor = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room first');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/labor`, {
        room_id: selectedRoom,
        ...laborForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Labor added successfully');
      setLaborForm({ role_name: '', cost_rate: 0, sell_rate: 0, hours: 0, department_id: '' });
      fetchRoomData(selectedRoom);
    } catch (error) {
      toast.error('Failed to add labor');
    }
  };

  const handleAddService = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room first');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/services`, {
        room_id: selectedRoom,
        ...serviceForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service added successfully');
      setServiceForm({ service_name: '', percentage_of_equipment: 5, department_id: '', description: '' });
      fetchRoomData(selectedRoom);
    } catch (error) {
      toast.error('Failed to add service');
    }
  };

  const handleDeleteEquipment = async (equipId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/equipment/${equipId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Equipment deleted');
      fetchEquipment();
    } catch (error) {
      toast.error('Failed to delete equipment');
    }
  };

  const handleDownloadBOM = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes/${id}/bom/export`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BOM_Quote_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('BOM downloaded successfully');
    } catch (error) {
      toast.error('Failed to download BOM');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-500',
      pending: 'bg-yellow-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      revision: 'bg-blue-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="quote-builder-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Manrope' }}>
                {id ? 'Edit Quote' : 'New Quote'}
              </h1>
            </div>
            {id && (
              <div className="flex gap-2 items-center">
                <Select value={quoteData.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="revision">Revision</SelectItem>
                  </SelectContent>
                </Select>
                <Badge className={getStatusColor(quoteData.status)}>
                  {quoteData.status.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {id && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowVersions(!showVersions)}
                >
                  <History className="w-4 h-4 mr-2" />
                  Versions ({versions.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={fetchFinancials}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Financials
                </Button>
                {quoteData.status === 'approved' && (
                  <Button
                    variant="outline"
                    onClick={handleDownloadBOM}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download BOM
                  </Button>
                )}
              </>
            )}
            <Button
              data-testid="save-quote-button"
              onClick={handleSaveQuote}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Quote'}
            </Button>
          </div>
        </div>

        {/* Version History Sidebar */}
        {showVersions && (
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">Version {v.version}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(v.created_at).toLocaleString()} by {v.changed_by_username}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestoreVersion(v.version)}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
                {versions.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No version history yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financial Breakdown Modal */}
        {showFinancials && financials && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Financial Breakdown</CardTitle>
              <Button variant="ghost" onClick={() => setShowFinancials(false)}>Close</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Project Totals */}
                <div className="border rounded p-4 bg-blue-50">
                  <h3 className="font-bold text-lg mb-3">Project Totals</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Equipment</div>
                      <div className="text-sm">Cost: ${financials.totals.equipment_cost}</div>
                      <div className="text-sm">Price: ${financials.totals.equipment_price}</div>
                      <div className="text-sm font-bold text-green-600">Margin: ${financials.totals.equipment_margin}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Labor</div>
                      <div className="text-sm">Cost: ${financials.totals.labor_cost}</div>
                      <div className="text-sm">Price: ${financials.totals.labor_price}</div>
                      <div className="text-sm font-bold text-green-600">Margin: ${financials.totals.labor_margin}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Services</div>
                      <div className="text-sm font-bold text-green-600">Price: ${financials.totals.services_price}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Tax</div>
                      <div className="text-sm">${financials.totals.tax}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Grand Total:</span>
                      <span>${financials.totals.grand_total}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-green-600">
                      <span>Total Margin:</span>
                      <span>${financials.totals.total_margin} ({financials.totals.margin_percent}%)</span>
                    </div>
                  </div>
                </div>

                {/* Room Breakdown */}
                {financials.rooms.map((room, idx) => (
                  <div key={idx} className="border rounded p-4">
                    <h4 className="font-bold mb-2">{room.name} (Qty: {room.quantity})</h4>
                    <div className="text-sm space-y-1">
                      <div>Equipment: ${room.equipment_price} (Cost: ${room.equipment_cost})</div>
                      <div>Labor: ${room.labor_price} (Cost: ${room.labor_cost})</div>
                      <div>Services: ${room.services_price}</div>
                      <div className="font-bold text-green-600">Room Margin: ${room.margin}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Details */}
        <Card>
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quote Name</Label>
                <Input
                  data-testid="quote-name-input"
                  value={quoteData.name}
                  onChange={(e) => setQuoteData({ ...quoteData, name: e.target.value })}
                  placeholder="Enter quote name"
                />
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  data-testid="client-name-input"
                  value={quoteData.client_name}
                  onChange={(e) => setQuoteData({ ...quoteData, client_name: e.target.value })}
                  placeholder="Enter client name"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={quoteData.department_id}
                  onValueChange={(value) => setQuoteData({ ...quoteData, department_id: value })}
                >
                  <SelectTrigger data-testid="department-select">
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
              <div className="space-y-2">
                <Label>Default Equipment Markup (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={quoteData.equipment_markup_default}
                  onChange={(e) => setQuoteData({ ...quoteData, equipment_markup_default: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={quoteData.tax_rate}
                  onChange={(e) => setQuoteData({ ...quoteData, tax_rate: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <span>Tax Enabled</span>
                  <Switch
                    checked={quoteData.tax_enabled}
                    onCheckedChange={(checked) => setQuoteData({ ...quoteData, tax_enabled: checked })}
                  />
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                data-testid="description-input"
                value={quoteData.description}
                onChange={(e) => setQuoteData({ ...quoteData, description: e.target.value })}
                placeholder="Enter quote description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rooms, Systems & Items */}
        {id && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rooms, Systems & Items</CardTitle>
              <Dialog open={showRoomDialog} onOpenChange={setShowRoomDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="add-room-button" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Room Name</Label>
                      <Input
                        value={roomForm.name}
                        onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                        placeholder="e.g., Conference Room A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity (for identical rooms)</Label>
                      <Input
                        type="number"
                        value={roomForm.quantity}
                        onChange={(e) => setRoomForm({ ...roomForm, quantity: parseInt(e.target.value) })}
                      />
                    </div>
                    <Button onClick={handleAddRoom} className="w-full">
                      Add Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No rooms yet. Add a room to get started.</p>
              ) : (
                <div className="space-y-4">
                  <Select value={selectedRoom?.toString()} onValueChange={(val) => setSelectedRoom(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          {room.name} (Qty: {room.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedRoom && (
                    <>
                      {/* Systems */}
                      <div className="border rounded p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">Systems</h4>
                          <Dialog open={showSystemDialog} onOpenChange={setShowSystemDialog}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Add System
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add System</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>System Name</Label>
                                  <Input
                                    value={systemForm.name}
                                    onChange={(e) => setSystemForm({ ...systemForm, name: e.target.value })}
                                    placeholder="e.g., Audio System"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Textarea
                                    value={systemForm.description}
                                    onChange={(e) => setSystemForm({ ...systemForm, description: e.target.value })}
                                  />
                                </div>
                                <Button onClick={handleAddSystem} className="w-full">
                                  Add System
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <Select value={selectedSystem?.toString()} onValueChange={(val) => setSelectedSystem(parseInt(val))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a system" />
                          </SelectTrigger>
                          <SelectContent>
                            {systems.map((system) => (
                              <SelectItem key={system.id} value={system.id.toString()}>
                                {system.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Tabs defaultValue="equipment">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="equipment">Equipment</TabsTrigger>
                          <TabsTrigger value="labor">Labor</TabsTrigger>
                          <TabsTrigger value="services">Services</TabsTrigger>
                        </TabsList>

                        {/* Equipment Tab */}
                        <TabsContent value="equipment" className="space-y-4">
                          {selectedSystem && (
                            <>
                              <div className="border rounded-lg p-4 space-y-4">
                                <h4 className="font-semibold">Add Equipment</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Item Name</Label>
                                    <Input
                                      value={equipForm.item_name}
                                      onChange={(e) => setEquipForm({ ...equipForm, item_name: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Vendor</Label>
                                    <Input
                                      value={equipForm.vendor}
                                      onChange={(e) => setEquipForm({ ...equipForm, vendor: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <Input
                                      type="number"
                                      value={equipForm.quantity}
                                      onChange={(e) => setEquipForm({ ...equipForm, quantity: parseInt(e.target.value) })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Unit Cost</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={equipForm.unit_cost}
                                      onChange={(e) => setEquipForm({ ...equipForm, unit_cost: parseFloat(e.target.value) })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Markup Override (%) - Optional</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={equipForm.markup_override || ''}
                                      onChange={(e) => setEquipForm({ ...equipForm, markup_override: e.target.value ? parseFloat(e.target.value) : null })}
                                      placeholder={`Default: ${quoteData.equipment_markup_default}%`}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                      <span>Tax Exempt</span>
                                      <Switch
                                        checked={equipForm.tax_exempt}
                                        onCheckedChange={(checked) => setEquipForm({ ...equipForm, tax_exempt: checked })}
                                      />
                                    </Label>
                                  </div>
                                </div>
                                <Button onClick={handleAddEquipment} className="w-full">
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Equipment
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {equipment.map((eq) => (
                                  <div key={eq.id} className="flex items-center justify-between p-3 border rounded">
                                    <div className="flex-1">
                                      <div className="font-medium">{eq.item_name}</div>
                                      <div className="text-sm text-gray-600">
                                        {eq.quantity} × ${eq.unit_cost} cost → ${eq.unit_price} sell ({eq.markup_percent}% markup)
                                      </div>
                                      <div className="text-sm text-green-600 font-semibold">
                                        Total: ${eq.total_price} | Margin: ${eq.margin_dollars}
                                      </div>
                                      {eq.tax_exempt && <Badge variant="outline" className="mt-1">Tax Exempt</Badge>}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteEquipment(eq.id)}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                  </div>
                                ))}
                                {equipment.length === 0 && <p className="text-center text-gray-500 py-4">No equipment added yet</p>}
                              </div>
                            </>
                          )}
                          {!selectedSystem && <p className="text-center text-gray-500 py-4">Select a system to add equipment</p>}
                        </TabsContent>

                        {/* Labor Tab */}
                        <TabsContent value="labor" className="space-y-4">
                          <div className="border rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold">Add Labor</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Role Name</Label>
                                <Input
                                  value={laborForm.role_name}
                                  onChange={(e) => setLaborForm({ ...laborForm, role_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Department</Label>
                                <Select
                                  value={laborForm.department_id}
                                  onValueChange={(value) => setLaborForm({ ...laborForm, department_id: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select dept" />
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
                              <div className="space-y-2">
                                <Label>Cost Rate ($/hr)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={laborForm.cost_rate}
                                  onChange={(e) => setLaborForm({ ...laborForm, cost_rate: parseFloat(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Sell Rate ($/hr)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={laborForm.sell_rate}
                                  onChange={(e) => setLaborForm({ ...laborForm, sell_rate: parseFloat(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Hours</Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={laborForm.hours}
                                  onChange={(e) => setLaborForm({ ...laborForm, hours: parseFloat(e.target.value) })}
                                />
                              </div>
                            </div>
                            <Button onClick={handleAddLabor} className="w-full">
                              <Plus className="w-4 h-4 mr-2" />
                              Add Labor
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {labor.map((lb) => (
                              <div key={lb.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex-1">
                                  <div className="font-medium">{lb.role_name}</div>
                                  <div className="text-sm text-gray-600">
                                    {lb.hours} hrs × ${lb.cost_rate} cost → ${lb.sell_rate} sell
                                  </div>
                                  <div className="text-sm text-green-600 font-semibold">
                                    Total: ${lb.total_price} | Margin: ${lb.margin_dollars} ({lb.margin_percent}%)
                                  </div>
                                </div>
                              </div>
                            ))}
                            {labor.length === 0 && <p className="text-center text-gray-500 py-4">No labor added yet</p>}
                          </div>
                        </TabsContent>

                        {/* Services Tab */}
                        <TabsContent value="services" className="space-y-4">
                          <div className="border rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold">Add Third-Party Service</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Service Name</Label>
                                <Input
                                  value={serviceForm.service_name}
                                  onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>% of Equipment Price</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={serviceForm.percentage_of_equipment}
                                  onChange={(e) => setServiceForm({ ...serviceForm, percentage_of_equipment: parseFloat(e.target.value) })}
                                />
                              </div>
                            </div>
                            <Button onClick={handleAddService} className="w-full">
                              <Plus className="w-4 h-4 mr-2" />
                              Add Service
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {services.map((sv) => (
                              <div key={sv.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex-1">
                                  <div className="font-medium">{sv.service_name}</div>
                                  <div className="text-sm text-gray-600">
                                    {sv.percentage_of_equipment}% of equipment price
                                  </div>
                                </div>
                              </div>
                            ))}
                            {services.length === 0 && <p className="text-center text-gray-500 py-4">No services added yet</p>}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default QuoteBuilder;
