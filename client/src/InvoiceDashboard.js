import React, { useState, useEffect } from 'react';
import EmailModal from './EmailModal';

const API_BASE = '/texon-invoicing-portal/api';

function InvoiceDashboard({ token }) {
  const [statistics, setStatistics] = useState(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01',
    end: new Date().toISOString().split('T')[0]
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    column: 'placedon',
    order: 'desc'
  });
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [settings, setSettings] = useState({});
  const [filters, setFilters] = useState({
    daysOutstanding: 'all', // all, over90, 60to90, 30to60, under30
    searchTerm: '',
    searchType: 'all' // all, order_number, customer
  });
  const [notesModal, setNotesModal] = useState({
    isOpen: false,
    invoice: null,
    userNotes: [],
    brightpearlNotes: [],
    isLoading: false,
    newNote: ''
  });

  // Email functionality state
  const [emailModal, setEmailModal] = useState({
    isOpen: false,
    invoice: null,
    emailType: 'invoice' // 'invoice' or 'reminder'
  });
  const [userEmailSettings, setUserEmailSettings] = useState(null);

  // Load invoice statistics
  const loadStatistics = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/invoices/statistics?start_date=${dateRange.start}&end_date=${dateRange.end}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatistics(data.statistics);
        }
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // Load unpaid invoices with pagination and sorting
  const loadUnpaidInvoices = async (page = currentPage, sort = sortConfig, currentFilters = filters) => {
    setIsLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        page: page,
        limit: itemsPerPage,
        sort_by: sort.column,
        sort_order: sort.order
      });

      // Add filter parameters
      if (currentFilters.daysOutstanding !== 'all') {
        params.append('days_outstanding_filter', currentFilters.daysOutstanding);
      }
      
      if (currentFilters.searchTerm.trim()) {
        params.append('search_term', currentFilters.searchTerm.trim());
        params.append('search_type', currentFilters.searchType);
      }

      const response = await fetch(
        `${API_BASE}/invoices/unpaid?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUnpaidInvoices(data.invoices);
          setPagination(data.pagination);
        } else {
          setError(data.error || 'Failed to load invoices');
        }
      } else {
        setError('Server error loading invoices');
      }
    } catch (error) {
      setError('Network error loading invoices');
    }
    
    setIsLoading(false);
  };

  // Load settings to get per-page configuration
  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        
        // Update items per page from settings
        const perPage = parseInt(data.invoices_per_page) || 25;
        setItemsPerPage(perPage);
        return perPage; // Return the per page value so we can use it immediately
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Keep default value if settings load fails
    }
    return 25; // Return default if loading fails
  };

  // Load data when component mounts or parameters change
  useEffect(() => {
    const initializeData = async () => {
      const perPage = await loadSettings(); // Wait for settings to load first
      loadStatistics();
      // Load invoices with the correct per-page setting
      loadUnpaidInvoices(currentPage, sortConfig, filters);
    };
    
    initializeData();
  }, [dateRange]);

  // Reload invoices when items per page changes
  useEffect(() => {
    if (itemsPerPage !== 25) { // Only reload if different from default
      setCurrentPage(1); // Reset to first page
      loadUnpaidInvoices(1, sortConfig);
    }
  }, [itemsPerPage]);

  // Reload invoices when filters change
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
    loadUnpaidInvoices(1, sortConfig, filters);
  }, [filters]);

  // Handle date range changes
  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1); // Reset to first page when date range changes
  };

  // Handle page changes
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadUnpaidInvoices(newPage, sortConfig, filters);
  };

  // Handle sorting
  const handleSort = (column) => {
    const newOrder = sortConfig.column === column && sortConfig.order === 'desc' ? 'asc' : 'desc';
    const newSortConfig = { column, order: newOrder };
    setSortConfig(newSortConfig);
    setCurrentPage(1); // Reset to first page when sorting changes
    loadUnpaidInvoices(1, newSortConfig, filters);
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      daysOutstanding: 'all',
      searchTerm: '',
      searchType: 'all'
    });
  };

  // Notes functionality
  const openNotesModal = async (invoice) => {
    setNotesModal(prev => ({
      ...prev,
      isOpen: true,
      invoice: invoice,
      isLoading: true,
      userNotes: [],
      brightpearlNotes: [],
      newNote: ''
    }));

    // Load notes for this order
    try {
      const response = await fetch(`${API_BASE}/orders/${invoice.id}/notes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotesModal(prev => ({
            ...prev,
            userNotes: data.userNotes || data.notes || [], // Handle both old and new API format
            brightpearlNotes: data.brightpearlNotes || [],
            isLoading: false
          }));
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotesModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const closeNotesModal = () => {
    setNotesModal({
      isOpen: false,
      invoice: null,
      userNotes: [],
      brightpearlNotes: [],
      isLoading: false,
      newNote: ''
    });
  };

  const addNote = async () => {
    if (!notesModal.newNote.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/orders/${notesModal.invoice.id}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: notesModal.newNote.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Add the new note to the user notes list
          setNotesModal(prev => ({
            ...prev,
            userNotes: [data.note, ...prev.userNotes],
            newNote: ''
          }));
          
          // Refresh the invoices to update the notes count
          loadUnpaidInvoices(currentPage, sortConfig, filters);
        }
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      const response = await fetch(`${API_BASE}/orders/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Remove the note from the user notes list
        setNotesModal(prev => ({
          ...prev,
          userNotes: prev.userNotes.filter(note => note.id !== noteId)
        }));
        
        // Refresh the invoices to update the notes count
        loadUnpaidInvoices(currentPage, sortConfig, filters);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Payment link functionality
  const generatePaymentLink = async (orderId) => {
    try {
      console.log(`Generating payment link for order ${orderId}...`);

      const response = await fetch(`${API_BASE}/orders/${orderId}/payment-link`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`Payment link generated: ${data.paymentLink}`);
          
          // Refresh the invoices to show the new payment link
          loadUnpaidInvoices(currentPage, sortConfig, filters);
          
          // Optional: Show success message or open link immediately
          if (window.confirm('Payment link generated successfully! Would you like to open it now?')) {
            window.open(data.paymentLink, '_blank');
          }
        } else {
          console.error('Payment link generation failed:', data.error);
          alert('Failed to generate payment link: ' + data.error);
        }
      } else {
        console.error('Payment link generation request failed:', response.status);
        alert('Failed to generate payment link. Please try again.');
      }
    } catch (error) {
      console.error('Error generating payment link:', error);
      alert('Error generating payment link. Please try again.');
    }
  };

  // Email functionality
  const loadUserEmailSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/user/email-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserEmailSettings(data.settings);
        }
      } else if (response.status === 404) {
        // No email settings found
        setUserEmailSettings(null);
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    }
  };

  const openEmailModal = (invoice, emailType) => {
    setEmailModal({
      isOpen: true,
      invoice: invoice,
      emailType: emailType
    });
  };

  const closeEmailModal = () => {
    setEmailModal({
      isOpen: false,
      invoice: null,
      emailType: 'invoice'
    });
  };

  const handleSendEmail = async (emailData) => {
    try {
      const response = await fetch(`${API_BASE}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: emailData.orderId,
          emailType: emailData.emailType,
          to: emailData.to,
          subject: emailData.subject,
          body: emailData.body
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // No need to refresh entire dashboard - EmailModal will handle its own updates
        return true;
      } else {
        console.error('Email sending failed:', result.error);
        alert('Failed to send email: ' + (result.error || 'Unknown error'));
        return false;
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error sending email: ' + error.message);
      return false;
    }
  };

  // Load email settings when component mounts
  useEffect(() => {
    loadUserEmailSettings();
  }, [token]);

  // Get sort indicator for column headers
  const getSortIndicator = (column) => {
    if (sortConfig.column !== column) return ' ↕️';
    return sortConfig.order === 'asc' ? ' ↑' : ' ↓';
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Render pagination controls
  const renderPagination = () => {
    if (!pagination || pagination.total_pages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pagination.current_page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.total_pages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return (
      <div className="pagination-controls">
        <button 
          onClick={() => handlePageChange(1)}
          disabled={pagination.current_page === 1}
          className="btn-secondary pagination-btn"
        >
          ⏮️ First
        </button>
        
        <button 
          onClick={() => handlePageChange(pagination.current_page - 1)}
          disabled={!pagination.has_prev_page}
          className="btn-secondary pagination-btn"
        >
          ◀️ Prev
        </button>

        {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`pagination-btn ${page === pagination.current_page ? 'active' : 'btn-secondary'}`}
          >
            {page}
          </button>
        ))}

        <button 
          onClick={() => handlePageChange(pagination.current_page + 1)}
          disabled={!pagination.has_next_page}
          className="btn-secondary pagination-btn"
        >
          Next ▶️
        </button>
        
        <button 
          onClick={() => handlePageChange(pagination.total_pages)}
          disabled={pagination.current_page === pagination.total_pages}
          className="btn-secondary pagination-btn"
        >
          Last ⏭️
        </button>

        <span className="pagination-info">
          Page {pagination.current_page} of {pagination.total_pages} 
          ({pagination.total_count.toLocaleString()} total invoices)
        </span>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <h2>Invoice Dashboard</h2>
      
      {/* Date Range Filter */}
      <div className="date-filter">
        <h3>📅 Date Range Filter</h3>
        <div className="date-inputs">
          <div>
            <label>Start Date:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
            />
          </div>
          <div>
            <label>End Date:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Financial Overview */}
      {statistics && (
        <div className="financial-overview">
          <h3>💰 Financial Overview</h3>
          <div className="stats-grid">
            <div className="stat-card total-orders">
              <h4>Total Orders</h4>
              <p className="stat-number">{statistics.total_orders.toLocaleString()}</p>
              <small>All orders in date range</small>
            </div>
            
            <div className="stat-card paid-orders">
              <h4>Paid Orders</h4>
              <p className="stat-number">{statistics.paid_orders.toLocaleString()}</p>
              <p className="stat-amount">{formatCurrency(statistics.paid_amount)}</p>
            </div>
            
            <div className="stat-card unpaid-orders">
              <h4>🚨 Unpaid Orders</h4>
              <p className="stat-number unpaid">{statistics.unpaid_orders.toLocaleString()}</p>
              <p className="stat-amount unpaid">{formatCurrency(statistics.unpaid_amount)}</p>
            </div>
            
            <div className="stat-card total-revenue">
              <h4>Total Revenue</h4>
              <p className="stat-amount">{formatCurrency(statistics.total_amount)}</p>
              <small>Paid + Outstanding</small>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <h3>🔍 Filters</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Days Outstanding:</label>
            <select 
              value={filters.daysOutstanding} 
              onChange={(e) => handleFilterChange('daysOutstanding', e.target.value)}
              className="filter-select"
            >
              <option value="all">All Invoices</option>
              <option value="over90">Over 90 Days</option>
              <option value="60to90">60-90 Days</option>
              <option value="30to60">30-60 Days</option>
              <option value="under30">Under 30 Days</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Search:</label>
            <div className="search-group">
              <input
                type="text"
                placeholder="Search invoices..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                className="search-input"
              />
              <select 
                value={filters.searchType} 
                onChange={(e) => handleFilterChange('searchType', e.target.value)}
                className="search-type-select"
              >
                <option value="all">All Fields</option>
                <option value="order_number">Order Number</option>
                <option value="customer">Customer Name/Email</option>
              </select>
            </div>
          </div>
          
          <div className="filter-group">
            <button 
              onClick={clearFilters}
              className="btn-secondary clear-filters-btn"
              disabled={filters.daysOutstanding === 'all' && !filters.searchTerm.trim()}
            >
              🗑️ Clear Filters
            </button>
          </div>
        </div>
        
        {/* Active Filters Display */}
        {(filters.daysOutstanding !== 'all' || filters.searchTerm.trim()) && (
          <div className="active-filters">
            <h4>Active Filters:</h4>
            <div className="filter-tags">
              {filters.daysOutstanding !== 'all' && (
                <span className="filter-tag">
                  Days Outstanding: {
                    filters.daysOutstanding === 'over90' ? 'Over 90 Days' :
                    filters.daysOutstanding === '60to90' ? '60-90 Days' :
                    filters.daysOutstanding === '30to60' ? '30-60 Days' :
                    'Under 30 Days'
                  }
                  <button 
                    onClick={() => handleFilterChange('daysOutstanding', 'all')}
                    className="remove-filter"
                  >
                    ×
                  </button>
                </span>
              )}
              
              {filters.searchTerm.trim() && (
                <span className="filter-tag">
                  Search: "{filters.searchTerm}" in {
                    filters.searchType === 'all' ? 'All Fields' :
                    filters.searchType === 'order_number' ? 'Order Number' :
                    'Customer Name/Email'
                  }
                  <button 
                    onClick={() => handleFilterChange('searchTerm', '')}
                    className="remove-filter"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Unpaid Invoices Table */}
      <div className="unpaid-invoices-section">
        <h3>📋 Unpaid Invoices</h3>
        
        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {renderPagination()}
        
        {isLoading ? (
          <div className="loading">🔄 Loading invoices...</div>
        ) : (
          <>
            {unpaidInvoices.length === 0 ? (
              <div className="no-invoices">
                <p>✅ No unpaid invoices found in the selected date range.</p>
              </div>
            ) : (
              <div className="invoices-table">
                <table>
                  <thead>
                    <tr>
                      <th 
                        onClick={() => handleSort('id')} 
                        className="sortable-header"
                        title="Click to sort by Order Number"
                      >
                        Order #{getSortIndicator('id')}
                      </th>
                      <th 
                        onClick={() => handleSort('invoicenumber')} 
                        className="sortable-header"
                        title="Click to sort by Invoice Number"
                      >
                        Invoice #{getSortIndicator('invoicenumber')}
                      </th>
                      <th 
                        onClick={() => handleSort('reference')} 
                        className="sortable-header"
                        title="Click to sort by Order Reference"
                      >
                        Order Ref{getSortIndicator('reference')}
                      </th>
                      <th 
                        onClick={() => handleSort('customercontact_id')} 
                        className="sortable-header"
                        title="Click to sort by Billing Contact"
                      >
                        Billing Contact{getSortIndicator('customercontact_id')}
                      </th>
                      <th 
                        onClick={() => handleSort('deliverycontact_id')} 
                        className="sortable-header"
                        title="Click to sort by Delivery Contact"
                      >
                        Delivery Contact{getSortIndicator('deliverycontact_id')}
                      </th>
                      <th 
                        onClick={() => handleSort('company_name')} 
                        className="sortable-header"
                        title="Click to sort by Company"
                      >
                        Company{getSortIndicator('company_name')}
                      </th>
                      <th 
                        onClick={() => handleSort('placedon')} 
                        className="sortable-header"
                        title="Click to sort by Order Date"
                      >
                        Order Date{getSortIndicator('placedon')}
                      </th>
                      <th 
                        onClick={() => handleSort('totalvalue')} 
                        className="sortable-header"
                        title="Click to sort by Amount"
                      >
                        Amount{getSortIndicator('totalvalue')}
                      </th>
                      <th 
                        onClick={() => handleSort('payment_status')} 
                        className="sortable-header"
                        title="Click to sort by Invoice Status"
                      >
                        Invoice Status{getSortIndicator('payment_status')}
                      </th>
                      <th 
                        onClick={() => handleSort('order_status')} 
                        className="sortable-header"
                        title="Click to sort by Order Status"
                      >
                        Order Status{getSortIndicator('order_status')}
                      </th>
                      <th 
                        onClick={() => handleSort('shipping_status')} 
                        className="sortable-header"
                        title="Click to sort by Shipping Status"
                      >
                        Shipping Status{getSortIndicator('shipping_status')}
                      </th>
                      <th 
                        onClick={() => handleSort('stock_status')} 
                        className="sortable-header"
                        title="Click to sort by Stock Status"
                      >
                        Stock Status{getSortIndicator('stock_status')}
                      </th>
                      <th 
                        onClick={() => handleSort('days_outstanding')} 
                        className="sortable-header"
                        title="Click to sort by Days Outstanding"
                      >
                        Days Outstanding{getSortIndicator('days_outstanding')}
                      </th>
                      <th>
                        Notes
                      </th>
                      <th>
                        Payment
                      </th>
                      <th>
                        Email Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidInvoices.map((invoice) => {
                      const orderDate = new Date(invoice.orderDate);
                      const daysOutstanding = invoice.days_outstanding || Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <tr key={invoice.id} className={daysOutstanding > 30 ? 'overdue' : ''}>
                          <td>
                            <strong>{invoice.orderNumber || `#${invoice.id}`}</strong>
                          </td>
                          <td>
                            <strong>{invoice.invoiceNumber || 'N/A'}</strong>
                          </td>
                          <td>
                            <strong>{invoice.orderRef || 'N/A'}</strong>
                          </td>
                          <td>
                            <div>
                              <strong>{invoice.billingContact?.name || invoice.customer.name}</strong>
                              <br />
                              <small>{invoice.billingContact?.email || invoice.customer.email}</small>
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>{invoice.deliveryContact?.name || 'Same as Billing'}</strong>
                              <br />
                              <small>{invoice.deliveryContact?.email || ''}</small>
                            </div>
                          </td>
                          <td>{invoice.company.name || 'N/A'}</td>
                          <td>{formatDate(invoice.orderDate)}</td>
                          <td>
                            {invoice.paymentStatus?.toLowerCase().includes('partial') && invoice.paidAmount > 0 ? (
                              <div>
                                <strong>{formatCurrency(invoice.outstandingAmount)}</strong>
                                <br />
                                <small style={{ color: '#6c757d' }}>
                                  Total: {formatCurrency(invoice.totalAmount)} | 
                                  Paid: {formatCurrency(invoice.paidAmount)}
                                </small>
                              </div>
                            ) : (
                              <strong>{formatCurrency(invoice.totalAmount)}</strong>
                            )}
                          </td>
                          <td>
                            <span 
                              className="status-badge" 
                              style={{ backgroundColor: invoice.paymentStatusColor || invoice.statusColor, color: 'white' }}
                            >
                              {invoice.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <span 
                              className="status-badge" 
                              style={{ backgroundColor: invoice.orderStatusColor, color: 'white' }}
                            >
                              {invoice.orderStatus}
                            </span>
                          </td>
                          <td>
                            <span 
                              className="status-badge" 
                              style={{ backgroundColor: invoice.shippingStatusColor, color: 'white' }}
                            >
                              {invoice.shippingStatus}
                            </span>
                          </td>
                          <td>
                            <span 
                              className="status-badge" 
                              style={{ backgroundColor: invoice.stockStatusColor, color: 'white' }}
                            >
                              {invoice.stockStatus}
                            </span>
                          </td>
                          <td>
                            <span className={daysOutstanding > 30 ? 'overdue-days' : 'normal-days'}>
                              {daysOutstanding} days
                            </span>
                          </td>
                          <td>
                            <button 
                              className="notes-button"
                              onClick={() => openNotesModal(invoice)}
                              title={
                                (invoice.hasNotes || invoice.hasBrightpearlNotes) 
                                  ? `View ${invoice.notesCount || 0} user note${(invoice.notesCount || 0) !== 1 ? 's' : ''} + ${invoice.brightpearlNotesCount || 0} Brightpearl note${(invoice.brightpearlNotesCount || 0) !== 1 ? 's' : ''}${
                                      invoice.brightpearlNotes?.some(note => note.fileId) ? ' (includes file attachments)' : ''
                                    }` 
                                  : 'Add note'
                              }
                            >
                              📝 
                              {(invoice.notesCount > 0 || invoice.brightpearlNotesCount > 0) && (
                                <span className="notes-count">
                                  {(invoice.notesCount || 0) + (invoice.brightpearlNotesCount || 0)}
                                </span>
                              )}
                              {invoice.hasBrightpearlNotes && (
                                <span className="brightpearl-indicator" title="Has Brightpearl notes">✨</span>
                              )}
                              {invoice.brightpearlNotes?.some(note => note.fileId) && (
                                <span className="attachment-indicator" title="Has file attachments">📎</span>
                              )}
                            </button>
                          </td>
                          <td>
                            {invoice.hasPaymentLink ? (
                              <a 
                                href={invoice.paymentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="payment-link-button"
                                title="Open payment link in new tab"
                              >
                                💳 Pay Now
                              </a>
                            ) : (
                              <button 
                                className="generate-payment-link-button"
                                onClick={() => generatePaymentLink(invoice.id)}
                                title="Generate payment link"
                              >
                                🔗 Generate Link
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="email-actions">
                              {userEmailSettings?.google_app_password ? (
                                <>
                                  <button 
                                    className="email-button invoice-btn"
                                    onClick={() => openEmailModal(invoice, 'invoice')}
                                    title="Send invoice email"
                                  >
                                    📧 Invoice
                                  </button>
                                  <button 
                                    className="email-button reminder-btn"
                                    onClick={() => openEmailModal(invoice, 'reminder')}
                                    title="Send reminder email"
                                  >
                                    ⚠️ Reminder
                                  </button>
                                </>
                              ) : (
                                <div className="email-not-configured">
                                  <small>Email not configured</small>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                <div className="table-summary">
                  <p>
                    Showing {unpaidInvoices.length} of {pagination?.total_count?.toLocaleString() || 0} unpaid invoices. 
                    Total outstanding: <strong>
                      {formatCurrency(unpaidInvoices.reduce((sum, inv) => sum + (inv.outstandingAmount || inv.totalAmount), 0))}
                    </strong>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        
        {renderPagination()}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="action-buttons">
          <button 
            onClick={() => loadUnpaidInvoices(currentPage, sortConfig)}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? '🔄 Refreshing...' : '🔄 Refresh Invoices'}
          </button>
          
          <button 
            onClick={() => {
              setDateRange({
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              });
            }}
            className="btn-secondary"
          >
            📅 Last 30 Days
          </button>
          
          <button 
            onClick={() => {
              setDateRange({
                start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0]
              });
            }}
            className="btn-secondary"
          >
            📅 Last 90 Days
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="connection-status">
        <h3>🔗 System Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-icon">✅</span>
            <div>
              <strong>Database Connection</strong>
              <br />
              <small>Connected to Supabase</small>
            </div>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <div>
              <strong>Brightpearl Data</strong>
              <br />
              <small>Real-time invoice data</small>
            </div>
          </div>
          <div className="status-item">
            <span className="status-icon">✅</span>
            <div>
              <strong>API Service</strong>
              <br />
              <small>All systems operational</small>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Modal */}
      {notesModal.isOpen && (
        <div className="modal-overlay" onClick={closeNotesModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 Notes for Order #{notesModal.invoice?.id}</h3>
              <button className="modal-close" onClick={closeNotesModal}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Add new note */}
              <div className="add-note-section">
                <textarea
                  value={notesModal.newNote}
                  onChange={(e) => setNotesModal(prev => ({ ...prev, newNote: e.target.value }))}
                  placeholder="Add a note for this order..."
                  className="note-textarea"
                  rows="3"
                />
                <button 
                  onClick={addNote}
                  className="btn-primary add-note-btn"
                  disabled={!notesModal.newNote.trim()}
                >
                  Add Note
                </button>
              </div>

              {/* Notes sections */}
              {notesModal.isLoading ? (
                <div className="loading">Loading notes...</div>
              ) : (
                <>
                  {/* Brightpearl Notes Section */}
                  {notesModal.brightpearlNotes && notesModal.brightpearlNotes.length > 0 && (
                    <div className="notes-section">
                      <h4 className="notes-section-title">
                        ✨ Brightpearl Notes ({notesModal.brightpearlNotes.length})
                        <small>From Brightpearl system</small>
                      </h4>
                      <div className="notes-list brightpearl-notes">
                        {notesModal.brightpearlNotes.map((note) => (
                          <div key={`bp-${note.id}`} className="note-item brightpearl-note">
                            <div className="note-content">
                              {note.text}
                              {note.fileId && (
                                <div className="note-attachment">
                                  <a 
                                    href={`https://use1.brightpearlapp.com/filestore.php?id=${note.fileId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="attachment-link"
                                    title="View attached file"
                                  >
                                    📎 File Attachment (ID: {note.fileId})
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="note-meta">
                              <span className="note-author">
                                Contact ID: {note.contactId} | Added by: {note.addedBy}
                              </span>
                              <span className="note-date">
                                {note.formattedDate}
                              </span>
                              <span className="note-visibility">
                                {note.isPublic ? '🌐 Public' : '🔒 Private'}
                              </span>
                              {note.orderStatusId && (
                                <span className="note-status">
                                  Status: {note.orderStatusId}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Notes Section */}
                  <div className="notes-section">
                    <h4 className="notes-section-title">
                      👤 Your Notes ({notesModal.userNotes.length})
                      <small>Added by portal users</small>
                    </h4>
                    <div className="notes-list user-notes">
                      {notesModal.userNotes.length === 0 ? (
                        <div className="no-notes">No user notes yet for this order.</div>
                      ) : (
                        notesModal.userNotes.map((note) => (
                          <div key={`user-${note.id}`} className="note-item user-note">
                            <div className="note-content">{note.note}</div>
                            <div className="note-meta">
                              <span className="note-author">
                                by {note.app_users?.first_name && note.app_users?.last_name 
                                    ? `${note.app_users.first_name} ${note.app_users.last_name}` 
                                    : note.app_users?.email || 'Unknown'}
                              </span>
                              <span className="note-date">
                                {new Date(note.created_at).toLocaleString()}
                              </span>
                              <button 
                                onClick={() => deleteNote(note.id)}
                                className="delete-note-btn"
                                title="Delete note"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Show message if no notes at all */}
                  {(!notesModal.userNotes || notesModal.userNotes.length === 0) && 
                   (!notesModal.brightpearlNotes || notesModal.brightpearlNotes.length === 0) && (
                    <div className="no-notes">
                      <p>No notes found for this order.</p>
                      <small>Add your first note using the form above.</small>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {emailModal.isOpen && (
        <EmailModal
          isOpen={emailModal.isOpen}
          invoice={emailModal.invoice}
          emailType={emailModal.emailType}
          onClose={closeEmailModal}
          onSend={handleSendEmail}
          token={token}
        />
      )}
    </div>
  );
}

export default InvoiceDashboard;