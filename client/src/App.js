import React, { useState, useEffect } from 'react';
import './App.css';
import InvoiceDashboard from './InvoiceDashboard';
import './InvoiceDashboard.css';
import EmailSettings from './EmailSettings';

const API_BASE = '/texon-invoicing-portal/api';

// Login Component
function Login({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.user, data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>Texon Invoicing Portal</h1>
        <p>Please log in to access the invoicing management system</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username:</label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              required
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              required
              autoComplete="current-password"
            />
          </div>
          
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="login-help">
          <p><strong>Default Admin Credentials:</strong></p>
          <p>Username: <code>admin</code></p>
          <p>Password: <code>changeme123</code></p>
          <small>⚠️ Change these after first login!</small>
        </div>
      </div>
    </div>
  );
}

// Dashboard Component - Now using InvoiceDashboard
function Dashboard({ token }) {
  return <InvoiceDashboard token={token} />;
}

// Enhanced Settings Component - Replace your existing Settings component with this:

function Settings({ token, user }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderStatuses, setOrderStatuses] = useState([]);
  const [loadingOrderStatuses, setLoadingOrderStatuses] = useState(false);

  // Default settings structure - only what we need for this app
  const defaultSettings = {
    // Order Status Filter Settings
    ignored_order_statuses: '',
    
    // Display Settings
    invoices_per_page: '25'
  };

  useEffect(() => {
    loadSettings();
    loadOrderStatuses();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      // Merge with defaults to ensure all settings exist
      setSettings({ ...defaultSettings, ...data });
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const loadOrderStatuses = async () => {
    if (user.role !== 'admin') return;
    
    setLoadingOrderStatuses(true);
    try {
      const response = await fetch(`${API_BASE}/order-statuses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setOrderStatuses(data.data);
      } else {
        console.error('Error loading order statuses:', data.error);
      }
    } catch (error) {
      console.error('Error loading order statuses:', error);
    } finally {
      setLoadingOrderStatuses(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      console.log('🔧 Saving settings:', settings);
      console.log('🔧 Settings JSON length:', JSON.stringify(settings).length);
      console.log('🔐 Using token:', token ? 'Present' : 'Missing');
      console.log('🌐 API URL:', `${API_BASE}/settings`);
      
      // Only send the settings we actually want to save (not old cached ones)
      const settingsToSave = {
        ignored_order_statuses: settings.ignored_order_statuses || '',
        invoices_per_page: settings.invoices_per_page || '25'
      };
      
      console.log('🔧 Filtered settings to save:', settingsToSave);
      
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToSave)
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      if (!response.ok) {
        console.log('❌ Response not ok, status:', response.status);
      }

      const data = await response.json();
      console.log('📨 Response data:', data);

      if (response.ok && data.success) {
        alert('Settings saved successfully!');
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      console.log('❌ Error type:', error.constructor.name);
      console.log('❌ Error message:', error.message);
      alert(`Error saving settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (user.role !== 'admin') {
    return (
      <div className="settings">
        <h2>Settings</h2>
        <div className="access-denied">
          <p>⚠️ Admin access required to modify system settings.</p>
          <p>Contact your system administrator if you need to change settings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="settings">
        <h2>Settings</h2>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Settings</h2>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary save-settings-btn"
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>
      </div>

      {/* Order Status Filter Settings */}
      <div className="settings-section">
        <h3>📋 Order Status Filtering</h3>
        <div className="setting-group">
          {loadingOrderStatuses ? (
            <p>Loading order statuses...</p>
          ) : (
            <div className="setting-item">
              <label className="setting-label">Ignored Order Statuses</label>
              <div className="order-status-selection">
                {orderStatuses.length > 0 ? (
                  <div className="checkbox-grid" style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                    gap: '10px', 
                    margin: '10px 0'
                  }}>
                    {orderStatuses.map((status) => {
                      const isIgnored = settings.ignored_order_statuses ? 
                        settings.ignored_order_statuses.split(',').map(s => s.trim()).includes(status.statusid.toString()) : 
                        false;
                      
                      return (
                        <label key={status.statusid} className="checkbox-item" style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          backgroundColor: isIgnored ? '#fff3cd' : 'white'
                        }}>
                          <input
                            type="checkbox"
                            checked={isIgnored}
                            onChange={(e) => {
                              const statusIds = settings.ignored_order_statuses ? 
                                settings.ignored_order_statuses.split(',').map(s => s.trim()).filter(s => s) : 
                                [];
                              
                              if (e.target.checked) {
                                statusIds.push(status.statusid.toString());
                              } else {
                                const index = statusIds.indexOf(status.statusid.toString());
                                if (index > -1) statusIds.splice(index, 1);
                              }
                              
                              updateSetting('ignored_order_statuses', statusIds.join(','));
                            }}
                            style={{ marginRight: '8px' }}
                          />
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{status.name}</div>
                            <div style={{ fontSize: '0.9em', color: '#666' }}>ID: {status.statusid}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{color: '#666', fontStyle: 'italic'}}>
                    No order statuses found. Check your Brightpearl connection.
                  </p>
                )}
              </div>
              <p className="setting-description">
                Orders with the selected statuses will be excluded from all dashboard reporting. 
                This is useful to ignore orders in statuses like 'Quote', 'On Hold', or 'Cancelled' 
                that shouldn't be included in revenue calculations.
              </p>
              {settings.ignored_order_statuses && settings.ignored_order_statuses.trim() && (
                <div className="ignored-statuses-preview" style={{
                  background: '#f8f9fa', 
                  padding: '15px', 
                  borderRadius: '6px', 
                  marginTop: '10px'
                }}>
                  <strong>Currently ignored order statuses:</strong>
                  <div style={{marginTop: '8px'}}>
                    {settings.ignored_order_statuses.split(',').map(statusId => {
                      const status = orderStatuses.find(s => s.statusid.toString() === statusId.trim());
                      return status ? (
                        <span key={statusId.trim()} style={{
                          display: 'inline-block',
                          background: '#dc3545',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          margin: '2px',
                          fontSize: '0.85em'
                        }}>
                          {status.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Display Settings */}
      <div className="settings-section">
        <h3>📺 Display Settings</h3>
        <div className="setting-group">
          <div className="setting-item">
            <label className="setting-label">Invoices Per Page</label>
            <select
              value={settings.invoices_per_page || '25'}
              onChange={(e) => updateSetting('invoices_per_page', e.target.value)}
              className="setting-input"
            >
              <option value="25">25 invoices per page</option>
              <option value="50">50 invoices per page</option>
              <option value="100">100 invoices per page</option>
            </select>
            <p className="setting-description">
              Number of invoices to display per page on the dashboard. Higher numbers may load slower.
            </p>
          </div>
        </div>
      </div>

      {/* Save Button at Bottom */}
      <div className="settings-footer">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary save-settings-btn"
        >
          {saving ? 'Saving Settings...' : '💾 Save Settings'}
        </button>
        <p className="save-note">
          Changes take effect immediately when you save.
        </p>
      </div>
    </div>
  );
}

// Replace the Reports component in your client/src/App.js with this enhanced version:

function Reports({ token, user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReports, setExpandedReports] = useState(new Set());
  const [pagination, setPagination] = useState({}); // Track pagination for each report
  const [downloadingReports, setDownloadingReports] = useState(new Set());
  const [deletingReports, setDeletingReports] = useState(new Set());
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      // Parse discrepancies for each report
      const parsedReports = data.map(report => ({
        ...report,
        discrepancies: (() => {
          try {
            if (typeof report.discrepancies === 'string') {
              return JSON.parse(report.discrepancies);
            } else if (Array.isArray(report.discrepancies)) {
              return report.discrepancies;
            } else {
              return [];
            }
          } catch (e) {
            console.error('Error parsing discrepancies for report:', report.id, e);
            return [];
          }
        })()
      }));
      
      setReports(parsedReports);
      
      // Initialize pagination for each report (start with page 1)
      const initialPagination = {};
      parsedReports.forEach(report => {
        initialPagination[report.id] = { currentPage: 1, itemsPerPage: 25 };
      });
      setPagination(initialPagination);
      
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (report) => {
    const confirmMessage = `Are you sure you want to delete the report from ${report.date}?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    const reportId = report.id;
    setDeletingReports(prev => new Set(prev).add(reportId));

    try {
      const response = await fetch(`${API_BASE}/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Remove the report from the local state
        setReports(prev => prev.filter(r => r.id !== reportId));
        
        // Also remove from expanded reports if it was expanded
        setExpandedReports(prev => {
          const newSet = new Set(prev);
          newSet.delete(reportId);
          return newSet;
        });

        alert(`Report from ${report.date} has been deleted successfully.`);
      } else {
        throw new Error(data.error || 'Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert(`Failed to delete report: ${error.message}`);
    } finally {
      setDeletingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const deleteAllReports = async () => {
    if (reports.length === 0) {
      alert('No reports to delete.');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL ${reports.length} reports?\n\nThis will permanently delete all inventory comparison reports and cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Double confirmation for such a destructive action
    const doubleConfirm = window.confirm(`FINAL CONFIRMATION:\n\nThis will delete ALL ${reports.length} reports permanently.\n\nClick OK to proceed with deletion.`);
    
    if (!doubleConfirm) {
      return;
    }

    setDeletingAll(true);

    try {
      let deletedCount = 0;
      let failedCount = 0;
      const totalReports = reports.length;

      // Delete reports one by one to handle any individual failures
      for (const report of reports) {
        try {
          const response = await fetch(`${API_BASE}/reports/${report.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          const data = await response.json();

          if (response.ok && data.success) {
            deletedCount++;
          } else {
            failedCount++;
            console.error(`Failed to delete report ${report.id}:`, data.error);
          }
        } catch (error) {
          failedCount++;
          console.error(`Error deleting report ${report.id}:`, error);
        }
      }

      // Refresh the reports list
      await loadReports();

      // Show results
      if (deletedCount === totalReports) {
        alert(`Successfully deleted all ${deletedCount} reports.`);
      } else if (deletedCount > 0) {
        alert(`Deleted ${deletedCount} reports successfully.\n${failedCount} reports failed to delete.`);
      } else {
        alert(`Failed to delete any reports. Please try again or contact support.`);
      }

    } catch (error) {
      console.error('Error during bulk deletion:', error);
      alert(`Error during deletion: ${error.message}`);
      // Refresh the list to see current state
      await loadReports();
    } finally {
      setDeletingAll(false);
    }
  };

  const toggleReportExpansion = (reportId) => {
    const newExpanded = new Set(expandedReports);
    if (newExpanded.has(reportId)) {
      newExpanded.delete(reportId);
    } else {
      newExpanded.add(reportId);
    }
    setExpandedReports(newExpanded);
  };

  const changePage = (reportId, newPage) => {
    setPagination(prev => ({
      ...prev,
      [reportId]: {
        ...prev[reportId],
        currentPage: newPage
      }
    }));
  };

  const getPaginatedDiscrepancies = (discrepancies, reportId) => {
    const pageInfo = pagination[reportId] || { currentPage: 1, itemsPerPage: 25 };
    const startIndex = (pageInfo.currentPage - 1) * pageInfo.itemsPerPage;
    const endIndex = startIndex + pageInfo.itemsPerPage;
    return discrepancies.slice(startIndex, endIndex);
  };

  const getTotalPages = (discrepancies, reportId) => {
    const pageInfo = pagination[reportId] || { currentPage: 1, itemsPerPage: 25 };
    return Math.ceil(discrepancies.length / pageInfo.itemsPerPage);
  };

  const downloadExcelReport = async (report) => {
    const reportId = report.id;
    setDownloadingReports(prev => new Set(prev).add(reportId));

    try {
      const response = await fetch(`${API_BASE}/reports/${reportId}/excel`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.statusText}`);
      }

      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-report-${report.date}-${reportId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading Excel report:', error);
      alert(`Failed to download report: ${error.message}`);
    } finally {
      setDownloadingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const renderPagination = (discrepancies, reportId) => {
    const totalPages = getTotalPages(discrepancies, reportId);
    const currentPage = pagination[reportId]?.currentPage || 1;

    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return (
      <div className="pagination" style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
        <button 
          onClick={() => changePage(reportId, 1)}
          disabled={currentPage === 1}
          style={{ padding: '8px 12px', border: '1px solid #ddd', background: currentPage === 1 ? '#f5f5f5' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          First
        </button>
        
        <button 
          onClick={() => changePage(reportId, currentPage - 1)}
          disabled={currentPage === 1}
          style={{ padding: '8px 12px', border: '1px solid #ddd', background: currentPage === 1 ? '#f5f5f5' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          Previous
        </button>

        {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => (
          <button
            key={page}
            onClick={() => changePage(reportId, page)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              background: page === currentPage ? '#007bff' : 'white',
              color: page === currentPage ? 'white' : 'black',
              cursor: 'pointer'
            }}
          >
            {page}
          </button>
        ))}

        <button 
          onClick={() => changePage(reportId, currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ padding: '8px 12px', border: '1px solid #ddd', background: currentPage === totalPages ? '#f5f5f5' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
        >
          Next
        </button>
        
        <button 
          onClick={() => changePage(reportId, totalPages)}
          disabled={currentPage === totalPages}
          style={{ padding: '8px 12px', border: '1px solid #ddd', background: currentPage === totalPages ? '#f5f5f5' : 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
        >
          Last
        </button>

        <span style={{ marginLeft: '20px', fontSize: '14px', color: '#666' }}>
          Page {currentPage} of {totalPages} ({discrepancies.length} total discrepancies)
        </span>
      </div>
    );
  };

  if (loading) {
    return <div>Loading reports...</div>;
  }

  return (
    <div className="reports">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Reports History (Last 30 Days)</h2>
        
        {/* Delete All Reports Button - Only show for admin users and when there are reports */}
        {user && user.role === 'admin' && reports.length > 0 && (
          <button
            onClick={deleteAllReports}
            disabled={deletingAll}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: deletingAll ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: deletingAll ? 0.6 : 1
            }}
          >
            {deletingAll ? '🗑️ Deleting All...' : `🗑️ Delete All Reports (${reports.length})`}
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <p>No reports available yet. Run your first comparison!</p>
      ) : (
        <div className="reports-list">
          {reports.map((report, index) => (
            <div key={report.id || index} className="report-card">
              <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span className="report-date">{report.date}</span>
                  <span className={`discrepancies-badge ${report.total_discrepancies > 0 ? 'has-discrepancies' : 'no-discrepancies'}`}>
                    {report.total_discrepancies} discrepancies
                  </span>
                  <span className="report-time">{new Date(report.created_at).toLocaleString()}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => downloadExcelReport(report)}
                    disabled={downloadingReports.has(report.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: downloadingReports.has(report.id) ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      opacity: downloadingReports.has(report.id) ? 0.6 : 1
                    }}
                  >
                    {downloadingReports.has(report.id) ? '📥 Downloading...' : '📊 Download Excel'}
                  </button>
                  
                  {report.total_discrepancies > 0 && (
                    <button
                      onClick={() => toggleReportExpansion(report.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {expandedReports.has(report.id) ? '▼ Hide Details' : '▶ View Details'}
                    </button>
                  )}

                  {/* Delete Individual Report Button - Only show for admin users */}
                  {user && user.role === 'admin' && (
                    <button
                      onClick={() => deleteReport(report)}
                      disabled={deletingReports.has(report.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: deletingReports.has(report.id) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        opacity: deletingReports.has(report.id) ? 0.6 : 1
                      }}
                    >
                      {deletingReports.has(report.id) ? '🗑️ Deleting...' : '🗑️ Delete'}
                    </button>
                  )}
                </div>
              </div>

              {report.total_discrepancies > 0 && expandedReports.has(report.id) && (
                <div className="report-details">
                  <div className="discrepancies-summary">
                    <h4>Inventory Discrepancies</h4>
                    
                    {renderPagination(report.discrepancies, report.id)}
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>SKU</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'left' }}>Product</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'right' }}>Brightpearl</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'right' }}>Infoplus</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'right' }}>Difference</th>
                          <th style={{ border: '1px solid #dee2e6', padding: '12px', textAlign: 'right' }}>% Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPaginatedDiscrepancies(report.discrepancies, report.id).map((item, itemIndex) => (
                          <tr key={itemIndex} style={{ backgroundColor: itemIndex % 2 === 0 ? 'white' : '#f8f9fa' }}>
                            <td style={{ border: '1px solid #dee2e6', padding: '10px', fontWeight: 'bold' }}>{item.sku}</td>
                            <td style={{ border: '1px solid #dee2e6', padding: '10px' }}>{item.productName || 'N/A'}</td>
                            <td style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'right' }}>{item.brightpearl_stock}</td>
                            <td style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'right' }}>{item.infoplus_stock}</td>
                            <td style={{ 
                              border: '1px solid #dee2e6', 
                              padding: '10px', 
                              textAlign: 'right',
                              color: item.difference < 0 ? 'red' : 'green',
                              fontWeight: 'bold'
                            }}>
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </td>
                            <td style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'right' }}>
                              {item.percentage_diff ? `${item.percentage_diff}%` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {renderPagination(report.discrepancies, report.id)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Enhanced Users Component - Replace your existing Users component with this:

function Users({ token, user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user.role === 'admin') {
      loadUsers();
    }
  }, [user.role]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser({
      id: userToEdit.id,
      username: userToEdit.username,
      email: userToEdit.email || '',
      first_name: userToEdit.first_name || '',
      last_name: userToEdit.last_name || '',
      role: userToEdit.role,
      is_active: userToEdit.is_active,
      password: '', // Always start with empty password
      confirmPassword: ''
    });
  };

  const handleAddUser = () => {
    setShowAddUser(true);
    setEditingUser({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      role: 'user',
      is_active: true,
      password: '',
      confirmPassword: ''
    });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!editingUser.username.trim()) {
        alert('Username is required');
        return;
      }

      if (!editingUser.email.trim()) {
        alert('Email is required');
        return;
      }

      if (!editingUser.first_name.trim()) {
        alert('First name is required');
        return;
      }

      if (!editingUser.last_name.trim()) {
        alert('Last name is required');
        return;
      }

      // For new users, password is required
      if (showAddUser && !editingUser.password) {
        alert('Password is required for new users');
        return;
      }

      // If password is being changed, validate it
      if (editingUser.password) {
        if (editingUser.password.length < 6) {
          alert('Password must be at least 6 characters long');
          return;
        }

        if (editingUser.password !== editingUser.confirmPassword) {
          alert('Passwords do not match');
          return;
        }
      }

      const userData = {
        username: editingUser.username.trim(),
        email: editingUser.email.trim(),
        first_name: editingUser.first_name.trim(),
        last_name: editingUser.last_name.trim(),
        role: editingUser.role,
        is_active: editingUser.is_active
      };

      // Only include password if it's being set
      if (editingUser.password) {
        userData.password = editingUser.password;
      }

      const url = showAddUser 
        ? `${API_BASE}/users`
        : `${API_BASE}/users/${editingUser.id}`;
      
      const method = showAddUser ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(showAddUser ? 'User created successfully!' : 'User updated successfully!');
        setEditingUser(null);
        setShowAddUser(false);
        await loadUsers(); // Refresh the list
      } else {
        throw new Error(data.error || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (userToDelete.id === user.id) {
      alert('You cannot delete your own account');
      return;
    }

    const confirmMessage = `Are you sure you want to delete user "${userToDelete.username}"?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('User deleted successfully');
        await loadUsers();
      } else {
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setShowAddUser(false);
  };

  if (user.role !== 'admin') {
    return <div>Access denied. Admin privileges required.</div>;
  }

  if (loading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="users">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>User Management</h2>
        <button
          onClick={handleAddUser}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          ➕ Add New User
        </button>
      </div>

      {/* Edit/Add User Form */}
      {editingUser && (
        <div className="user-form-overlay">
          <div className="user-form">
            <h3>{showAddUser ? 'Add New User' : `Edit User: ${editingUser.username}`}</h3>
            
            <form onSubmit={handleSaveUser}>
              <div className="form-row">
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                    required
                    disabled={!showAddUser} // Username can't be changed for existing users
                  />
                </div>
                
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={editingUser.first_name}
                    onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={editingUser.last_name}
                    onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingUser.is_active}
                    onChange={(e) => setEditingUser({...editingUser, is_active: e.target.value === 'true'})}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{showAddUser ? 'Password *' : 'New Password (leave blank to keep current)'}</label>
                  <input
                    type="password"
                    value={editingUser.password}
                    onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                    required={showAddUser}
                    minLength="6"
                  />
                </div>
                
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={editingUser.confirmPassword}
                    onChange={(e) => setEditingUser({...editingUser, confirmPassword: e.target.value})}
                    required={showAddUser || editingUser.password}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '10px'
                  }}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {isSubmitting ? 'Saving...' : (showAddUser ? 'Create User' : 'Update User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="users-list">
        {users.map(u => (
          <div key={u.id} className="user-card">
            <div className="user-info">
              <div className="user-header">
                <strong>{u.first_name} {u.last_name}</strong>
                <span className={`user-role ${u.role}`}>{u.role}</span>
                {!u.is_active && <span className="user-status inactive">Inactive</span>}
              </div>
              
              <div className="user-details">
                <div><strong>Username:</strong> {u.username}</div>
                <div><strong>Email:</strong> {u.email || 'Not set'}</div>
                <div><strong>Last login:</strong> {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</div>
                <div><strong>Created:</strong> {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            
            <div className="user-actions">
              <button
                onClick={() => handleEditUser(u)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '8px'
                }}
              >
                ✏️ Edit
              </button>
              
              {u.id !== user.id && (
                <button
                  onClick={() => handleDeleteUser(u)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App Component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        // If there's an error parsing the saved user data, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setIsLoading(false);
  }, []);

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setIsAuthenticated(true);
    
    // Update localStorage with the new user data structure
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading">
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>Texon Invoicing Portal</h1>
          <div className="user-info">
            <span>Welcome, {user.first_name || user.username}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
        <nav>
          <button 
            className={currentTab === 'dashboard' ? 'active' : ''} 
            onClick={() => setCurrentTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={currentTab === 'settings' ? 'active' : ''} 
            onClick={() => setCurrentTab('settings')}
          >
            Settings
          </button>
          <button 
            className={currentTab === 'email-settings' ? 'active' : ''} 
            onClick={() => setCurrentTab('email-settings')}
          >
            📧 Email Settings
          </button>
          <button 
            className={currentTab === 'reports' ? 'active' : ''} 
            onClick={() => setCurrentTab('reports')}
          >
            Reports
          </button>
          {user.role === 'admin' && (
            <button 
              className={currentTab === 'users' ? 'active' : ''} 
              onClick={() => setCurrentTab('users')}
            >
              Users
            </button>
          )}
        </nav>
      </header>

      <main className="main-content">
        {currentTab === 'dashboard' && <Dashboard token={token} />}
        {currentTab === 'settings' && <Settings token={token} user={user} />}
        {currentTab === 'email-settings' && <EmailSettings token={token} user={user} />}
        {currentTab === 'reports' && <Reports token={token} user={user} />}
        {currentTab === 'users' && <Users token={token} user={user} />}
      </main>
    </div>
  );
}

export default App;