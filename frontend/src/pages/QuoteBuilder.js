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
import Layout from '@/components/Layout';
import { Plus, Save, Trash2, Download, Search } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QuoteBuilder = ({ user, onLogout }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [labor, setLabor] = useState([]);
  const [services, setServices] = useState([]);
  const [vendorPrices, setVendorPrices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Quote form data
  const [quoteData, setQuoteData] = useState({
    name: '',
    client_name: '',
    department_id: '',
    description: ''
  });

  // Room form
  const [roomForm, setRoomForm] = useState({ name: '', system_type: '' });
  const [showRoomDialog, setShowRoomDialog] = useState(false);

  // Equipment form
  const [equipForm, setEquipForm] = useState({
    item_name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    vendor: ''
  });

  // Labor form
  const [laborForm, setLaborForm] = useState({
    role_name: '',
    rate: 0,
    hours: 0,
    department_id: ''
  });

  // Service form
  const [serviceForm, setServiceForm] = useState({
    service_name: '',
    cost: 0,
    department_id: '',
    description: ''
  });

  useEffect(() => {
    fetchDepartments();
    if (id) {
      fetchQuote();
      fetchRooms();
    }
  }, [id]);

  useEffect(() => {
    if (selectedRoom) {
      fetchRoomData(selectedRoom);
    }
  }, [selectedRoom]);

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
        description: response.data.description || ''
      });
    } catch (error) {
      toast.error('Failed to load quote');
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

  const fetchRoomData = async (roomId) => {
    try {
      const token = localStorage.getItem('token');
      
      const [equipRes, laborRes, servicesRes] = await Promise.all([
        axios.get(`${API}/equipment/room/${roomId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/labor/room/${roomId}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/services/room/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setEquipment(equipRes.data);
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

  const handleSaveQuote = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (id) {
        await axios.put(`${API}/quotes/${id}`, quoteData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Quote updated successfully');
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
      setRoomForm({ name: '', system_type: '' });
      setShowRoomDialog(false);
      fetchRooms();
    } catch (error) {
      toast.error('Failed to add room');
    }
  };

  const handleAddEquipment = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room first');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/equipment`, {
        room_id: selectedRoom,
        ...equipForm
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Equipment added successfully');
      setEquipForm({ item_name: '', description: '', quantity: 1, unit_price: 0, vendor: '' });
      fetchRoomData(selectedRoom);
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
      setLaborForm({ role_name: '', rate: 0, hours: 0, department_id: '' });
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
      setServiceForm({ service_name: '', cost: 0, department_id: '', description: '' });
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
      fetchRoomData(selectedRoom);
    } catch (error) {
      toast.error('Failed to delete equipment');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quote_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  };

  const calculateTotals = () => {
    const equipTotal = equipment.reduce((sum, e) => sum + (parseFloat(e.total_price) || 0), 0);
    const laborTotal = labor.reduce((sum, l) => sum + (parseFloat(l.total_cost) || 0), 0);
    const serviceTotal = services.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);
    return {
      equipment: equipTotal,
      labor: laborTotal,
      services: serviceTotal,
      total: equipTotal + laborTotal + serviceTotal
    };
  };

  const totals = calculateTotals();

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="quote-builder-container">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Manrope' }}>
              {id ? 'Edit Quote' : 'New Quote'}
            </h1>
          </div>
          <div className="flex gap-2">
            {id && (
              <Button
                data-testid="download-pdf-button"
                onClick={handleDownloadPDF}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
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

        {/* Rooms & Items */}
        {id && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rooms & Items</CardTitle>
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
                    <DialogDescription>Create a new room for this quote</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Room Name</Label>
                      <Input
                        data-testid="room-name-input"
                        value={roomForm.name}
                        onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                        placeholder="e.g., Conference Room A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>System Type</Label>
                      <Input
                        data-testid="system-type-input"
                        value={roomForm.system_type}
                        onChange={(e) => setRoomForm({ ...roomForm, system_type: e.target.value })}
                        placeholder="e.g., AV System, Network"
                      />
                    </div>
                    <Button data-testid="submit-room-button" onClick={handleAddRoom} className="w-full">
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
                  {/* Room Selector */}
                  <Select value={selectedRoom?.toString()} onValueChange={(val) => setSelectedRoom(parseInt(val))}>
                    <SelectTrigger data-testid="room-selector">
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id.toString()}>
                          {room.name} - {room.system_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedRoom && (
                    <Tabs defaultValue="equipment" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="equipment">Equipment</TabsTrigger>
                        <TabsTrigger value="labor">Labor</TabsTrigger>
                        <TabsTrigger value="services">Services</TabsTrigger>
                      </TabsList>

                      {/* Equipment Tab */}
                      <TabsContent value="equipment" className="space-y-4">
                        <div className="border rounded-lg p-4 space-y-4">
                          <h4 className="font-semibold">Add Equipment</h4>
                          
                          {/* Vendor Price Search */}
                          <div className="space-y-2">
                            <Label>Search Vendor Prices</Label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <Input
                                data-testid="vendor-search-input"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                            {vendorPrices.length > 0 && (
                              <div className="max-h-32 overflow-y-auto border rounded space-y-1 p-2">
                                {vendorPrices.map((vp) => (
                                  <div
                                    key={vp.id}
                                    className="p-2 hover:bg-gray-100 rounded cursor-pointer text-sm"
                                    onClick={() => {
                                      setEquipForm({
                                        ...equipForm,
                                        item_name: vp.item_name,
                                        description: vp.description || '',
                                        unit_price: parseFloat(vp.price),
                                        vendor: vp.vendor
                                      });
                                      setSearchQuery('');
                                      setVendorPrices([]);
                                    }}
                                  >
                                    <div className="font-medium">{vp.item_name}</div>
                                    <div className="text-gray-500">${vp.price} - {vp.vendor}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Item Name</Label>
                              <Input
                                data-testid="equipment-name-input"
                                value={equipForm.item_name}
                                onChange={(e) => setEquipForm({ ...equipForm, item_name: e.target.value })}
                                placeholder="Item name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Vendor</Label>
                              <Input
                                data-testid="equipment-vendor-input"
                                value={equipForm.vendor}
                                onChange={(e) => setEquipForm({ ...equipForm, vendor: e.target.value })}
                                placeholder="Vendor"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Quantity</Label>
                              <Input
                                data-testid="equipment-quantity-input"
                                type="number"
                                value={equipForm.quantity}
                                onChange={(e) => setEquipForm({ ...equipForm, quantity: parseInt(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unit Price</Label>
                              <Input
                                data-testid="equipment-price-input"
                                type="number"
                                step="0.01"
                                value={equipForm.unit_price}
                                onChange={(e) => setEquipForm({ ...equipForm, unit_price: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>
                          <Button data-testid="add-equipment-button" onClick={handleAddEquipment} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Equipment
                          </Button>
                        </div>

                        {/* Equipment List */}
                        <div className="space-y-2">
                          {equipment.map((eq) => (
                            <div key={eq.id} className="flex items-center justify-between p-3 border rounded" data-testid={`equipment-item-${eq.id}`}>
                              <div className="flex-1">
                                <div className="font-medium">{eq.item_name}</div>
                                <div className="text-sm text-gray-600">
                                  {eq.quantity} x ${eq.unit_price} = ${eq.total_price}
                                </div>
                                {eq.vendor && <div className="text-xs text-gray-500">Vendor: {eq.vendor}</div>}
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
                          {equipment.length === 0 && (
                            <p className="text-center text-gray-500 py-4">No equipment added yet</p>
                          )}
                        </div>
                      </TabsContent>

                      {/* Labor Tab */}
                      <TabsContent value="labor" className="space-y-4">
                        <div className="border rounded-lg p-4 space-y-4">
                          <h4 className="font-semibold">Add Labor</h4>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Role Name</Label>
                              <Input
                                data-testid="labor-role-input"
                                value={laborForm.role_name}
                                onChange={(e) => setLaborForm({ ...laborForm, role_name: e.target.value })}
                                placeholder="e.g., Technician"
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
                              <Label>Rate ($/hr)</Label>
                              <Input
                                data-testid="labor-rate-input"
                                type="number"
                                step="0.01"
                                value={laborForm.rate}
                                onChange={(e) => setLaborForm({ ...laborForm, rate: parseFloat(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Hours</Label>
                              <Input
                                data-testid="labor-hours-input"
                                type="number"
                                step="0.5"
                                value={laborForm.hours}
                                onChange={(e) => setLaborForm({ ...laborForm, hours: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>
                          <Button data-testid="add-labor-button" onClick={handleAddLabor} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Labor
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {labor.map((lb) => (
                            <div key={lb.id} className="flex items-center justify-between p-3 border rounded" data-testid={`labor-item-${lb.id}`}>
                              <div className="flex-1">
                                <div className="font-medium">{lb.role_name}</div>
                                <div className="text-sm text-gray-600">
                                  {lb.hours} hrs x ${lb.rate}/hr = ${lb.total_cost}
                                </div>
                              </div>
                            </div>
                          ))}
                          {labor.length === 0 && (
                            <p className="text-center text-gray-500 py-4">No labor added yet</p>
                          )}
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
                                data-testid="service-name-input"
                                value={serviceForm.service_name}
                                onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                                placeholder="Service name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Cost</Label>
                              <Input
                                data-testid="service-cost-input"
                                type="number"
                                step="0.01"
                                value={serviceForm.cost}
                                onChange={(e) => setServiceForm({ ...serviceForm, cost: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>
                          <Button data-testid="add-service-button" onClick={handleAddService} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Service
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {services.map((sv) => (
                            <div key={sv.id} className="flex items-center justify-between p-3 border rounded" data-testid={`service-item-${sv.id}`}>
                              <div className="flex-1">
                                <div className="font-medium">{sv.service_name}</div>
                                <div className="text-sm text-gray-600">${sv.cost}</div>
                              </div>
                            </div>
                          ))}
                          {services.length === 0 && (
                            <p className="text-center text-gray-500 py-4">No services added yet</p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        {id && (
          <Card data-testid="totals-card">
            <CardHeader>
              <CardTitle>Quote Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Equipment Total:</span>
                  <span className="font-semibold">${totals.equipment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Labor Total:</span>
                  <span className="font-semibold">${totals.labor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Services Total:</span>
                  <span className="font-semibold">${totals.services.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Grand Total:</span>
                  <span className="text-blue-600" data-testid="grand-total">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default QuoteBuilder;
