import React, { useState, useEffect } from 'react';
import './AutomatedEmailReports.css';

const API_BASE = '/texon-invoicing-portal/api';

const AutomatedEmailReports = ({ token }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
        end: new Date().toISOString().split('T')[0] // Today
    });
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        stats: null,
        logs: [],
        scheduled: [],
        optOuts: []
    });

    useEffect(() => {
        loadReportData();
    }, [dateRange]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const days = Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));

            await Promise.all([
                loadStats(days),
                loadLogs(),
                loadScheduledEmails(),
                loadOptOuts()
            ]);
        } catch (error) {
            console.error('Error loading report data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async (days) => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/stats?days=${days}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(prev => ({ ...prev, stats: result.stats }));
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const loadLogs = async () => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/logs?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(prev => ({ ...prev, logs: result.logs || [] }));
            }
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    };

    const loadScheduledEmails = async () => {
        try {
            const days = Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));
            const response = await fetch(`${API_BASE}/automated-emails/scheduled?limit=100&days=${days}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(prev => ({ ...prev, scheduled: result.scheduledEmails || [] }));
            }
        } catch (error) {
            console.error('Error loading scheduled emails:', error);
        }
    };

    const loadOptOuts = async () => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/opt-outs?limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(prev => ({ ...prev, optOuts: result.optOuts || [] }));
            }
        } catch (error) {
            console.error('Error loading opt-outs:', error);
        }
    };

    if (loading) {
        return (
            <div className="automated-email-reports">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading automated email reports...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="automated-email-reports">
            <div className="reports-header">
                <h1>📊 Automated Email Reports</h1>
                <div className="date-range-selector">
                    <div className="date-inputs">
                        <div className="date-input-group">
                            <label>From</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                        </div>
                        <div className="date-input-group">
                            <label>To</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                        <button className="btn-refresh" onClick={loadReportData}>
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="reports-tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    📈 Overview
                </button>
                <button
                    className={activeTab === 'activity' ? 'active' : ''}
                    onClick={() => setActiveTab('activity')}
                >
                    📋 Activity Log
                </button>
                <button
                    className={activeTab === 'emails' ? 'active' : ''}
                    onClick={() => setActiveTab('emails')}
                >
                    📧 Email Schedule
                </button>
                <button
                    className={activeTab === 'preferences' ? 'active' : ''}
                    onClick={() => setActiveTab('preferences')}
                >
                    🚫 Opt-outs
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'overview' && (
                    <OverviewReport
                        stats={data.stats}
                        dateRange={dateRange}
                        logs={data.logs}
                    />
                )}

                {activeTab === 'activity' && (
                    <ActivityReport
                        logs={data.logs}
                        onReload={loadLogs}
                    />
                )}

                {activeTab === 'emails' && (
                    <EmailScheduleReport
                        scheduled={data.scheduled}
                        dateRange={dateRange}
                        onReload={loadScheduledEmails}
                    />
                )}

                {activeTab === 'preferences' && (
                    <OptOutsReport
                        optOuts={data.optOuts}
                        onReload={loadOptOuts}
                        token={token}
                    />
                )}
            </div>
        </div>
    );
};

// Overview Report Component
const OverviewReport = ({ stats, dateRange, logs }) => {
    const formatDuration = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return `${days} day${days === 1 ? '' : 's'}`;
    };

    const getRecentActivity = () => {
        if (!logs || logs.length === 0) return [];
        return logs.slice(0, 5); // Last 5 runs
    };

    return (
        <div className="overview-report">
            <div className="period-summary">
                <h3>📅 Report Period: {formatDuration(dateRange.start, dateRange.end)}</h3>
                <p>From {new Date(dateRange.start).toLocaleDateString()} to {new Date(dateRange.end).toLocaleDateString()}</p>
            </div>

            {/* Key Metrics */}
            <div className="metrics-grid">
                <div className="metric-card primary">
                    <div className="metric-icon">📧</div>
                    <div className="metric-value">{stats?.totalEmailsSent || 0}</div>
                    <div className="metric-label">Total Emails Sent</div>
                </div>

                <div className="metric-card success">
                    <div className="metric-icon">✅</div>
                    <div className="metric-value">{stats?.successfulEmails || 0}</div>
                    <div className="metric-label">Successful Deliveries</div>
                </div>

                <div className="metric-card warning">
                    <div className="metric-icon">⚠️</div>
                    <div className="metric-value">{stats?.failedEmails || 0}</div>
                    <div className="metric-label">Failed Emails</div>
                </div>

                <div className="metric-card info">
                    <div className="metric-icon">🔄</div>
                    <div className="metric-value">{stats?.automationRuns || 0}</div>
                    <div className="metric-label">Automation Runs</div>
                </div>

                <div className="metric-card secondary">
                    <div className="metric-icon">👥</div>
                    <div className="metric-value">{stats?.uniqueCustomers || 0}</div>
                    <div className="metric-label">Unique Customers</div>
                </div>

                <div className="metric-card accent">
                    <div className="metric-icon">📄</div>
                    <div className="metric-value">{stats?.uniqueInvoices || 0}</div>
                    <div className="metric-label">Invoices Processed</div>
                </div>
            </div>

            {/* Campaign Performance */}
            <div className="campaign-performance">
                <h3>🎯 Campaign Performance</h3>
                {stats?.campaignStats && stats.campaignStats.length > 0 ? (
                    <div className="campaign-stats-grid">
                        {stats.campaignStats.map((campaign, index) => (
                            <div key={index} className="campaign-stat-card">
                                <div className="campaign-stat-header">
                                    <h4>{campaign.name}</h4>
                                    <span className="campaign-type">{campaign.type}</span>
                                </div>
                                <div className="campaign-stat-metrics">
                                    <div className="stat-item">
                                        <span className="stat-value">{campaign.emailsSent || 0}</span>
                                        <span className="stat-label">Emails Sent</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{campaign.successRate || 0}%</span>
                                        <span className="stat-label">Success Rate</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-data">
                        <p>No campaign data available for the selected period.</p>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div className="recent-activity">
                <h3>🕒 Recent Automation Runs</h3>
                {getRecentActivity().length > 0 ? (
                    <div className="activity-list">
                        {getRecentActivity().map((log, index) => (
                            <div key={index} className={`activity-item ${log.status}`}>
                                <div className="activity-icon">
                                    {log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '⏳'}
                                </div>
                                <div className="activity-details">
                                    <div className="activity-title">
                                        Automation Run #{log.id}
                                    </div>
                                    <div className="activity-meta">
                                        {new Date(log.run_started_at).toLocaleString()} •{' '}
                                        {log.emails_sent || 0} emails sent •{' '}
                                        Status: {log.status}
                                    </div>
                                    {log.error_message && (
                                        <div className="activity-error">
                                            Error: {log.error_message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-data">
                        <p>No recent automation runs found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Activity Report Component
const ActivityReport = ({ logs, onReload }) => {
    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'failed': return '❌';
            case 'running': return '⏳';
            default: return '❓';
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'running': return 'warning';
            default: return 'neutral';
        }
    };

    return (
        <div className="activity-report">
            <div className="report-header">
                <h3>📋 Automation Activity Log</h3>
                <button className="btn-secondary" onClick={onReload}>
                    🔄 Refresh Logs
                </button>
            </div>

            {logs.length > 0 ? (
                <div className="logs-table">
                    <div className="table-header">
                        <div className="col-status">Status</div>
                        <div className="col-date">Started</div>
                        <div className="col-duration">Duration</div>
                        <div className="col-emails">Emails</div>
                        <div className="col-trigger">Trigger</div>
                        <div className="col-details">Details</div>
                    </div>
                    <div className="table-body">
                        {logs.map((log, index) => (
                            <div key={index} className={`table-row ${getStatusClass(log.status)}`}>
                                <div className="col-status">
                                    <span className="status-badge">
                                        {getStatusIcon(log.status)} {log.status}
                                    </span>
                                </div>
                                <div className="col-date">
                                    {new Date(log.run_started_at).toLocaleString()}
                                </div>
                                <div className="col-duration">
                                    {log.run_completed_at ? (
                                        `${Math.round((new Date(log.run_completed_at) - new Date(log.run_started_at)) / 1000)}s`
                                    ) : (
                                        'N/A'
                                    )}
                                </div>
                                <div className="col-emails">
                                    {log.emails_sent || 0}
                                </div>
                                <div className="col-trigger">
                                    {log.triggered_by || 'Unknown'}
                                </div>
                                <div className="col-details">
                                    {log.error_message ? (
                                        <span className="error-message">{log.error_message}</span>
                                    ) : log.summary ? (
                                        <span className="summary">{log.summary}</span>
                                    ) : (
                                        'No details'
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="no-data">
                    <h4>No activity logs found</h4>
                    <p>Automation activity will appear here once the system starts running.</p>
                </div>
            )}
        </div>
    );
};

// Email Schedule Report Component
const EmailScheduleReport = ({ scheduled, dateRange, onReload }) => {
    const [filter, setFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'sent_at', direction: 'desc' });

    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortedAndFilteredEmails = () => {
        // First filter
        let filtered = scheduled.filter(email => {
            if (filter === 'all') return true;
            return email.status === filter;
        });

        // Then sort
        return filtered.sort((a, b) => {
            let aValue, bValue;

            switch (sortConfig.key) {
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                case 'customer':
                    aValue = a.cached_invoices?.billing_contact_name || '';
                    bValue = b.cached_invoices?.billing_contact_name || '';
                    break;
                case 'campaign':
                    aValue = a.automated_email_campaigns?.campaign_name || '';
                    bValue = b.automated_email_campaigns?.campaign_name || '';
                    break;
                case 'invoice':
                    aValue = a.cached_invoices?.invoice_number || '';
                    bValue = b.cached_invoices?.invoice_number || '';
                    break;
                case 'scheduled_for':
                    aValue = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
                    bValue = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
                    break;
                case 'sent_at':
                    // Default: sort by sent_at, with most recent first, nulls last
                    aValue = a.sent_at ? new Date(a.sent_at).getTime() : 0;
                    bValue = b.sent_at ? new Date(b.sent_at).getTime() : 0;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    };

    const sortedEmails = getSortedAndFilteredEmails();

    const getStatusIcon = (status) => {
        switch (status) {
            case 'scheduled': return '⏰';
            case 'sent': return '✅';
            case 'failed': return '❌';
            case 'cancelled': return '🚫';
            case 'pending': return '⏳';
            default: return '❓';
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'scheduled': return 'warning';
            case 'sent': return 'success';
            case 'failed': return 'error';
            case 'cancelled': return 'neutral';
            case 'pending': return 'warning';
            default: return 'neutral';
        }
    };

    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return '⇅';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    return (
        <div className="email-schedule-report">
            <div className="report-header">
                <h3>📧 Email Schedule</h3>
                <div className="report-controls">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="status-filter"
                    >
                        <option value="all">All Statuses</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <button className="btn-secondary" onClick={onReload}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {sortedEmails.length > 0 ? (
                <div className="emails-table">
                    <div className="table-header">
                        <div className="col-status sortable" onClick={() => handleSort('status')}>
                            Status {getSortIcon('status')}
                        </div>
                        <div className="col-customer sortable" onClick={() => handleSort('customer')}>
                            Customer {getSortIcon('customer')}
                        </div>
                        <div className="col-campaign sortable" onClick={() => handleSort('campaign')}>
                            Campaign {getSortIcon('campaign')}
                        </div>
                        <div className="col-invoice sortable" onClick={() => handleSort('invoice')}>
                            Invoice {getSortIcon('invoice')}
                        </div>
                        <div className="col-scheduled sortable" onClick={() => handleSort('scheduled_for')}>
                            Scheduled For {getSortIcon('scheduled_for')}
                        </div>
                        <div className="col-sent sortable" onClick={() => handleSort('sent_at')}>
                            Sent At {getSortIcon('sent_at')}
                        </div>
                        <div className="col-error">Error</div>
                    </div>
                    <div className="table-body">
                        {sortedEmails.map((email, index) => (
                            <div key={index} className={`table-row ${getStatusClass(email.status)}`}>
                                <div className="col-status">
                                    <span className="status-badge">
                                        {getStatusIcon(email.status)} {email.status}
                                    </span>
                                </div>
                                <div className="col-customer">
                                    <div className="customer-info">
                                        <div className="customer-name">{email.cached_invoices?.billing_contact_name || 'Unknown'}</div>
                                        <div className="customer-email">{email.recipient_email || email.cached_invoices?.billing_contact_email || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="col-campaign">
                                    {email.automated_email_campaigns?.campaign_name || 'Unknown'}
                                </div>
                                <div className="col-invoice">
                                    <div className="invoice-info">
                                        <div className="invoice-number">{email.cached_invoices?.invoice_number || 'N/A'}</div>
                                        <div className="order-reference">Order #{email.order_id || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="col-scheduled">
                                    {email.scheduled_for ? new Date(email.scheduled_for).toLocaleString() : 'N/A'}
                                </div>
                                <div className="col-sent">
                                    {email.sent_at ? new Date(email.sent_at).toLocaleString() : 'Not sent'}
                                </div>
                                <div className="col-error">
                                    {email.status === 'failed' && email.error_message ? (
                                        <span className="error-text" title={email.error_message}>
                                            {email.error_message.length > 50
                                                ? email.error_message.substring(0, 50) + '...'
                                                : email.error_message}
                                        </span>
                                    ) : (
                                        '-'
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="no-data">
                    <h4>No scheduled emails found</h4>
                    <p>
                        {filter === 'all'
                            ? 'No emails scheduled for the selected date range.'
                            : `No emails with status "${filter}" found.`
                        }
                    </p>
                </div>
            )}
        </div>
    );
};

// Opt-outs Report Component
const OptOutsReport = ({ optOuts, onReload, token }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newOptOut, setNewOptOut] = useState({
        email: '',
        type: 'reminders',
        reason: ''
    });

    const addOptOut = async () => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/opt-out`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email_address: newOptOut.email,
                    opt_out_type: newOptOut.type,
                    reason: newOptOut.reason
                })
            });

            if (response.ok) {
                setNewOptOut({ email: '', type: 'reminders', reason: '' });
                setShowAddForm(false);
                onReload();
            }
        } catch (error) {
            console.error('Error adding opt-out:', error);
        }
    };

    const removeOptOut = async (email) => {
        if (!window.confirm(`Remove ${email} from opt-out list?`)) return;

        try {
            const response = await fetch(`${API_BASE}/automated-emails/opt-out`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email_address: email })
            });

            if (response.ok) {
                onReload();
            }
        } catch (error) {
            console.error('Error removing opt-out:', error);
        }
    };

    const getOptOutTypes = (optOut) => {
        const types = [];
        if (optOut.opted_out_all) types.push('All emails');
        else {
            if (optOut.opted_out_reminders) types.push('Reminders');
            if (optOut.opted_out_collections) types.push('Collections');
        }
        return types.join(', ') || 'None';
    };

    return (
        <div className="opt-outs-report">
            <div className="report-header">
                <h3>🚫 Customer Opt-outs</h3>
                <div className="report-controls">
                    <button
                        className="btn-primary"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? '❌ Cancel' : '➕ Add Opt-out'}
                    </button>
                    <button className="btn-secondary" onClick={onReload}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {showAddForm && (
                <div className="add-opt-out-form">
                    <h4>Add Customer Opt-out</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={newOptOut.email}
                                onChange={(e) => setNewOptOut({...newOptOut, email: e.target.value})}
                                placeholder="customer@example.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>Opt-out Type</label>
                            <select
                                value={newOptOut.type}
                                onChange={(e) => setNewOptOut({...newOptOut, type: e.target.value})}
                            >
                                <option value="reminders">Payment Reminders</option>
                                <option value="collections">Collections Notices</option>
                                <option value="all">All Automated Emails</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Reason (Optional)</label>
                        <input
                            type="text"
                            value={newOptOut.reason}
                            onChange={(e) => setNewOptOut({...newOptOut, reason: e.target.value})}
                            placeholder="Customer request, complaint, etc."
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            className="btn-primary"
                            onClick={addOptOut}
                            disabled={!newOptOut.email}
                        >
                            Add Opt-out
                        </button>
                    </div>
                </div>
            )}

            {optOuts.length > 0 ? (
                <div className="opt-outs-table">
                    <div className="table-header">
                        <div className="col-email">Email Address</div>
                        <div className="col-types">Opt-out Types</div>
                        <div className="col-date">Date Added</div>
                        <div className="col-reason">Reason</div>
                        <div className="col-actions">Actions</div>
                    </div>
                    <div className="table-body">
                        {optOuts.map((optOut, index) => (
                            <div key={index} className="table-row">
                                <div className="col-email">
                                    {optOut.email_address}
                                </div>
                                <div className="col-types">
                                    <span className="opt-out-types">
                                        {getOptOutTypes(optOut)}
                                    </span>
                                </div>
                                <div className="col-date">
                                    {new Date(optOut.opt_out_date).toLocaleDateString()}
                                </div>
                                <div className="col-reason">
                                    {optOut.opt_out_reason || 'No reason provided'}
                                </div>
                                <div className="col-actions">
                                    <button
                                        className="btn-remove"
                                        onClick={() => removeOptOut(optOut.email_address)}
                                        title="Remove from opt-out list"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="no-data">
                    <h4>No opt-outs found</h4>
                    <p>Customers who opt out of automated emails will appear here.</p>
                </div>
            )}
        </div>
    );
};

export default AutomatedEmailReports;