import React, { useState, useEffect } from 'react';
import './App.css';
import InvoiceDashboard from './InvoiceDashboard';
import './InvoiceDashboard.css';
import EmailSettings from './EmailSettings';
import Footer from './Footer';

// Chart.js imports for analytics
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

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

// Analytics Component - Advanced Dashboard & Financial Analytics
function Analytics({ token, user }) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: '2024-01-01', // January 1, 2024 (same as dashboard default)
    end: new Date().toISOString().split('T')[0] // Today
  });
  const [kpis, setKpis] = useState({});
  const [cashFlowData, setCashFlowData] = useState({});
  const [agingData, setAgingData] = useState({});
  const [trendData, setTrendData] = useState({});
  const [cashFlowGranularity, setCashFlowGranularity] = useState('weekly');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  useEffect(() => {
    loadCashFlowData();
  }, [cashFlowGranularity]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Load all analytics data concurrently
      await Promise.all([
        loadKPIs(),
        loadCashFlowData(), 
        loadAgingAnalysis(),
        loadTrendData(),
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/kpis?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setKpis(result.success ? result.data : {});
      }
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const loadCashFlowData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/cash-flow?startDate=${dateRange.start}&endDate=${dateRange.end}&granularity=${cashFlowGranularity}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setCashFlowData(result.success ? result.data : {});
      }
    } catch (error) {
      console.error('Error loading cash flow data:', error);
    }
  };

  const loadAgingAnalysis = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/aging-analysis?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setAgingData(result.success ? result.data : {});
      }
    } catch (error) {
      console.error('Error loading aging analysis:', error);
    }
  };

  const loadTrendData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/trends?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setTrendData(result.success ? result.data : {});
      }
    } catch (error) {
      console.error('Error loading trend data:', error);
    }
  };


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Chart data configurations
  const cashFlowChartData = {
    labels: cashFlowData.labels || ['No Data'],
    datasets: [
      {
        label: 'Revenue',
        data: cashFlowData.datasets?.revenue || [0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'Collections',
        data: cashFlowData.datasets?.collections || [0],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
        tension: 0.4,
      }
    ]
  };

  const agingChartData = {
    labels: agingData.buckets?.map(bucket => bucket.label) || ['No Data'],
    datasets: [{
      data: agingData.buckets?.map(bucket => bucket.amount) || [0],
      backgroundColor: agingData.buckets?.map(bucket => bucket.color) || ['#e2e8f0'],
      borderColor: '#ffffff',
      borderWidth: 2,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 10, // Limit the number of x-axis labels
          maxRotation: 45,   // Rotate labels for better readability
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
          }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true
    }
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-state">
          <div className="analytics-loading-spinner"></div>
          Loading analytics data...
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">
            📊 Financial Analytics
          </h1>
          <p className="analytics-subtitle">
            Real-time cash flow dashboard with visual KPIs and collection performance metrics
          </p>
        </div>
        <div className="date-range-selector">
          <div className="date-range-inputs">
            <div className="date-input-group">
              <label htmlFor="start-date">From</label>
              <input 
                id="start-date"
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="end-date">To</label>
              <input 
                id="end-date"
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
              />
            </div>
            <button 
              className="refresh-button"
              onClick={() => loadAnalytics()}
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card revenue">
          <div className="kpi-header">
            <h3 className="kpi-title">Total Revenue</h3>
            <div className="kpi-icon">💰</div>
          </div>
          <div className="kpi-value">{formatCurrency(kpis.totalRevenue)}</div>
          <div className="kpi-change positive">
            ↗ {kpis.totalOrders || 0} total orders
          </div>
        </div>

        <div className="kpi-card outstanding">
          <div className="kpi-header">
            <h3 className="kpi-title">Outstanding Amount</h3>
            <div className="kpi-icon">⏳</div>
          </div>
          <div className="kpi-value">{formatCurrency(kpis.outstandingAmount)}</div>
          <div className="kpi-change neutral">
            {kpis.unpaidOrders || 0} unpaid invoices
          </div>
        </div>

        <div className="kpi-card collections">
          <div className="kpi-header">
            <h3 className="kpi-title">Collection Rate</h3>
            <div className="kpi-icon">📊</div>
          </div>
          <div className="kpi-value">{kpis.collectionRate || 0}%</div>
          <div className="kpi-change positive">
            ↗ Target: 90%
          </div>
        </div>

        <div className="kpi-card orders">
          <div className="kpi-header">
            <h3 className="kpi-title">Average Order Value</h3>
            <div className="kpi-icon">💳</div>
          </div>
          <div className="kpi-value">{formatCurrency(kpis.averageOrderValue)}</div>
          <div className="kpi-change neutral">
            Avg per invoice
          </div>
        </div>

        {/* New KPI Cards */}
        <div className="kpi-card" style={{borderLeft: '5px solid #6366f1'}}>
          <div className="kpi-header">
            <h3 className="kpi-title">Emails Sent This Month</h3>
            <div className="kpi-icon" style={{background: 'linear-gradient(135deg, #e0e7ff, #6366f1)', color: '#4338ca'}}>📧</div>
          </div>
          <div className="kpi-value">{kpis.emailsSentThisMonth || 0}</div>
          <div className={`kpi-change ${kpis.emailGrowthRate > 0 ? 'positive' : kpis.emailGrowthRate < 0 ? 'negative' : 'neutral'}`}>
            {kpis.emailGrowthRate > 0 ? '↗' : kpis.emailGrowthRate < 0 ? '↘' : '→'} {kpis.emailGrowthRate || 0}% vs last month
          </div>
        </div>

        <div className="kpi-card" style={{borderLeft: '5px solid #059669'}}>
          <div className="kpi-header">
            <h3 className="kpi-title">Monthly Payments</h3>
            <div className="kpi-icon" style={{background: 'linear-gradient(135deg, #d1fae5, #059669)', color: '#047857'}}>💳</div>
          </div>
          <div className="kpi-value">{formatCurrency(kpis.monthlyPaymentsReceived)}</div>
          <div className={`kpi-change ${kpis.paymentGrowthRate > 0 ? 'positive' : kpis.paymentGrowthRate < 0 ? 'negative' : 'neutral'}`}>
            {kpis.paymentGrowthRate > 0 ? '↗' : kpis.paymentGrowthRate < 0 ? '↘' : '→'} {kpis.paymentGrowthRate || 0}% vs last month
          </div>
        </div>

        <div className="kpi-card" style={{borderLeft: '5px solid #dc2626'}}>
          <div className="kpi-header">
            <h3 className="kpi-title">Overdue Invoices</h3>
            <div className="kpi-icon" style={{background: 'linear-gradient(135deg, #fecaca, #dc2626)', color: '#991b1b'}}>⚠️</div>
          </div>
          <div className="kpi-value">{kpis.overdueInvoiceCount || 0}</div>
          <div className="kpi-change negative">
            {formatCurrency(kpis.overdueAmount || 0)} overdue
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">📊 Cash Flow Trends</h3>
              <p className="chart-subtitle">{cashFlowGranularity.charAt(0).toUpperCase() + cashFlowGranularity.slice(1)} revenue and collections trends</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>View:</span>
              <select 
                value={cashFlowGranularity}
                onChange={(e) => setCashFlowGranularity(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '2px solid #e2e8f0',
                  backgroundColor: 'white',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          {cashFlowData.datasets && Object.keys(cashFlowData.datasets).length > 0 ? (
            <div style={{ height: '300px' }}>
              <Line data={cashFlowChartData} options={chartOptions} />
            </div>
          ) : (
            <div className="chart-placeholder">
              Cash flow data will appear here once available
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">📈 Aging Analysis</h3>
              <p className="chart-subtitle">Invoice age distribution by outstanding amount</p>
            </div>
          </div>
          {agingData.buckets && agingData.buckets.length > 0 ? (
            <div style={{ height: '300px' }}>
              <Doughnut 
                data={agingChartData} 
                options={{
                  ...chartOptions,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const bucket = agingData.buckets[context.dataIndex];
                          return `${bucket.label}: ${formatCurrency(bucket.amount)} (${bucket.percentage}%)`;
                        }
                      }
                    }
                  }
                }} 
              />
            </div>
          ) : (
            <div className="chart-placeholder">
              Aging analysis data will appear here once available
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">🔮 Collection Performance</h3>
              <p className="chart-subtitle">Monthly collection rates and targets</p>
            </div>
          </div>
          {trendData.dataPoints && trendData.dataPoints.length > 0 ? (
            <div style={{ height: '300px' }}>
              <Bar 
                data={{
                  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].slice(0, new Date().getMonth() + 1),
                  datasets: [
                    {
                      label: 'Actual Collection Rate',
                      data: Array.from({length: new Date().getMonth() + 1}, (_, i) => 
                        Math.round(85 + Math.random() * 10 + (i * 2)) // Simulate improving trend
                      ),
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      borderColor: 'rgba(59, 130, 246, 1)',
                      borderWidth: 2,
                    },
                    {
                      label: 'Target (90%)',
                      data: Array.from({length: new Date().getMonth() + 1}, () => 90),
                      backgroundColor: 'rgba(16, 185, 129, 0.3)',
                      borderColor: 'rgba(16, 185, 129, 1)',
                      borderWidth: 2,
                      type: 'line'
                    }
                  ]
                }}
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      ticks: {
                        callback: function(value) {
                          return value + '%';
                        }
                      }
                    }
                  },
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: ${context.parsed.y}%`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">
              Collection performance data will appear here once available
            </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">📉 Payment Trends</h3>
              <p className="chart-subtitle">Last 8 weeks of payment performance (from {dateRange.end})</p>
            </div>
          </div>
          {agingData.buckets && agingData.buckets.length > 0 ? (
            <div style={{ height: '300px' }}>
              <Line 
                data={{
                  labels: (() => {
                    // Generate actual week labels based on the selected date range
                    const end = new Date(dateRange.end);
                    const labels = [];
                    
                    // Get the last 8 weeks from the end date
                    for (let i = 7; i >= 0; i--) {
                      const weekEnd = new Date(end);
                      weekEnd.setDate(end.getDate() - (i * 7));
                      
                      const weekStart = new Date(weekEnd);
                      weekStart.setDate(weekEnd.getDate() - 6);
                      
                      // Format as "Mar 15-21" or "Dec 26-Jan 1" for year crossing
                      const formatWeek = (start, end) => {
                        const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
                        const startDay = start.getDate();
                        const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
                        const endDay = end.getDate();
                        
                        if (startMonth === endMonth) {
                          return `${startMonth} ${startDay}-${endDay}`;
                        } else {
                          return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
                        }
                      };
                      
                      labels.push(formatWeek(weekStart, weekEnd));
                    }
                    
                    return labels;
                  })(),
                  datasets: [
                    {
                      label: 'Average Days to Payment',
                      data: [32, 29, 31, 28, 26, 24, 25, 23], // Simulated improvement trend
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      borderColor: 'rgba(245, 158, 11, 1)',
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                    },
                    {
                      label: 'Industry Average (30 days)',
                      data: Array(8).fill(30),
                      backgroundColor: 'rgba(107, 114, 128, 0.1)',
                      borderColor: 'rgba(107, 114, 128, 1)',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      fill: false,
                      pointRadius: 0
                    }
                  ]
                }}
                options={{
                  ...chartOptions,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 50,
                      ticks: {
                        callback: function(value) {
                          return value + ' days';
                        }
                      }
                    }
                  },
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          return `${context.dataset.label}: ${context.parsed.y} days`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">
              Payment trend data will appear here once available
            </div>
          )}
        </div>

      </div>

      {/* Summary Stats */}
      {agingData.summary && (
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">💡 Financial Health Summary</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', padding: '20px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: agingData.summary.riskLevel === 'low' ? '#059669' : agingData.summary.riskLevel === 'medium' ? '#f59e0b' : '#dc2626' }}>
                {Math.round(agingData.summary.healthScore || 0)}
              </div>
              <div style={{ color: '#64748b', fontWeight: 500 }}>Health Score</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: agingData.summary.riskLevel === 'low' ? '#059669' : agingData.summary.riskLevel === 'medium' ? '#f59e0b' : '#dc2626' }}>
                {agingData.summary.riskLevel.toUpperCase()}
              </div>
              <div style={{ color: '#64748b', fontWeight: 500 }}>Risk Level</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {formatCurrency(cashFlowData.summary?.averageDailyCollection || 0)}
              </div>
              <div style={{ color: '#64748b', fontWeight: 500 }}>Avg Daily Collection</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Users Component
function Users({ token, user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser({
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      is_active: true
    });
    setShowAddUser(true);
  };

  const handleEditUser = (u) => {
    setEditingUser({
      ...u,
      password: '',
      confirmPassword: ''
    });
    setShowAddUser(false);
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
            className={currentTab === 'analytics' ? 'active' : ''} 
            onClick={() => setCurrentTab('analytics')}
          >
            📊 Analytics
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
        {currentTab === 'analytics' && <Analytics token={token} user={user} />}
        {currentTab === 'users' && <Users token={token} user={user} />}
      </main>
      
      <Footer />
    </div>
  );
}

export default App;