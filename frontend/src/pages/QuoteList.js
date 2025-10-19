import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { Plus, Download, Eye, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QuoteList = ({ user, onLogout }) => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuotes(response.data);
    } catch (error) {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (quoteId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/quotes/${quoteId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quote_${quoteId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  };

  const handleDelete = async (quoteId) => {
    if (!window.confirm('Are you sure you want to delete this quote?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/quotes/${quoteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Quote deleted successfully');
      fetchQuotes();
    } catch (error) {
      toast.error('Failed to delete quote');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-500',
      pending: 'bg-yellow-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6" data-testid="quote-list-container">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Manrope' }}>Quotes</h1>
            <p className="text-gray-600 mt-2">Manage your project quotes</p>
          </div>
          <Button 
            data-testid="create-quote-button"
            onClick={() => navigate('/quotes/new')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Quote
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : quotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No quotes yet. Create your first quote to get started.</p>
              <Button 
                onClick={() => navigate('/quotes/new')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Quote
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {quotes.map((quote) => (
              <Card key={quote.id} className="card-hover" data-testid={`quote-card-${quote.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{quote.name}</CardTitle>
                        <Badge className={getStatusColor(quote.status)}>
                          {quote.status.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">v{quote.version}</Badge>
                      </div>
                      <CardDescription className="text-base">
                        Client: {quote.client_name} | Department: {quote.department_name}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`view-quote-${quote.id}`}
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`download-pdf-${quote.id}`}
                        onClick={() => handleDownloadPDF(quote.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`delete-quote-${quote.id}`}
                        onClick={() => handleDelete(quote.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Created: {new Date(quote.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span>By: {quote.created_by_username}</span>
                    </div>
                    <div>
                      <span>Updated: {new Date(quote.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {quote.description && (
                    <p className="mt-3 text-gray-700">{quote.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default QuoteList;
