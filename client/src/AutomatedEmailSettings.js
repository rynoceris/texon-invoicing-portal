import React, { useState, useEffect } from 'react';
import './AutomatedEmailSettings.css';

const API_BASE = '/texon-invoicing-portal/api';

const AutomatedEmailSettings = ({ token, user, setCurrentTab }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [systemStatus, setSystemStatus] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [globalTestEmail, setGlobalTestEmail] = useState('');
    const [automationSenderEmail, setAutomationSenderEmail] = useState('');
    const [campaignToEdit, setCampaignToEdit] = useState(null);
    const [testRunning, setTestRunning] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadSystemStatus(),
                loadCampaigns()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            setMessage({ text: 'Error loading automated email data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadSystemStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/system-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSystemStatus(data.status);
                setGlobalTestEmail(data.status.globalTestEmail || '');
                setAutomationSenderEmail(data.status.automationSenderEmail || '');
            } else {
                console.error('Error loading system status:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error loading system status:', error);
        }
    };

    const loadCampaigns = async () => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setCampaigns(data.campaigns || []);
            } else {
                console.error('Error loading campaigns:', response.status, response.statusText);
                setCampaigns([]); // Set empty array as fallback
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
            setCampaigns([]); // Set empty array as fallback
        }
    };

    const toggleSystem = async (enabled) => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/system/toggle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });

            if (response.ok) {
                const data = await response.json();
                setMessage({
                    text: `System ${enabled ? 'enabled' : 'disabled'} successfully (${data.campaignsAffected} campaigns affected)`,
                    type: 'success'
                });
                await loadData();
            } else {
                throw new Error('Failed to toggle system');
            }
        } catch (error) {
            console.error('Error toggling system:', error);
            setMessage({ text: `Error ${enabled ? 'enabling' : 'disabling'} system`, type: 'error' });
        }
    };

    const toggleCampaign = async (campaignId, enabled) => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: enabled })
            });

            if (response.ok) {
                setMessage({
                    text: `Campaign ${enabled ? 'enabled' : 'disabled'} successfully`,
                    type: 'success'
                });
                await loadCampaigns();
            } else {
                throw new Error('Failed to toggle campaign');
            }
        } catch (error) {
            console.error('Error toggling campaign:', error);
            setMessage({ text: `Error ${enabled ? 'enabling' : 'disabling'} campaign`, type: 'error' });
        }
    };

    const runManualTest = async () => {
        if (testRunning) return; // Prevent multiple clicks

        setTestRunning(true);
        setMessage({ text: 'Running test automation... This may take up to 30 seconds.', type: 'info' });

        try {
            const response = await fetch(`${API_BASE}/automated-emails/run`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ testMode: true })
            });

            if (response.ok) {
                const data = await response.json();
                setMessage({
                    text: `Test automation completed successfully. ${data.summary?.emailsScheduled || 0} emails would be sent.`,
                    type: 'success'
                });
            } else {
                throw new Error('Failed to run test automation');
            }
        } catch (error) {
            console.error('Error running test automation:', error);
            setMessage({ text: 'Error running test automation', type: 'error' });
        } finally {
            setTestRunning(false);
        }
    };

    if (user.role !== 'admin') {
        return (
            <div className="automated-email-settings">
                <div className="access-denied">
                    <h2>🔒 Admin Access Required</h2>
                    <p>You need administrator privileges to manage automated email settings.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="automated-email-settings">
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading automated email settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="automated-email-settings">
            <div className="settings-header">
                <h1>🤖 Automated Email System</h1>
                <p className="header-description">
                    Manage automated email campaigns for overdue invoice notifications
                </p>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* System Status Overview */}
            <div className="system-status-card">
                <div className="status-header">
                    <h2>🚀 System Status</h2>
                    <div className="status-actions">
                        <button
                            className={`btn-toggle ${systemStatus?.systemActive ? 'active' : ''}`}
                            onClick={() => toggleSystem(!systemStatus?.systemActive)}
                        >
                            {systemStatus?.systemActive ? '🟢 System Enabled' : '🔴 System Disabled'}
                        </button>
                    </div>
                </div>

                <div className="status-grid">
                    <div className="status-item">
                        <div className="status-label">Active Campaigns</div>
                        <div className="status-value">{systemStatus?.activeCampaigns || 0}</div>
                    </div>
                    <div className="status-item">
                        <div className="status-label">Last Run</div>
                        <div className="status-value">
                            {systemStatus?.lastRunAt ?
                                new Date(systemStatus.lastRunAt).toLocaleString() :
                                'Never'
                            }
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-label">Last Run Status</div>
                        <div className={`status-value status-${systemStatus?.lastRunStatus}`}>
                            {systemStatus?.lastRunStatus || 'Unknown'}
                        </div>
                    </div>
                    <div className="status-item">
                        <div className="status-label">Mode</div>
                        <div className="status-value">
                            {!systemStatus?.systemActive ? '🔒 Disabled' :
                             systemStatus?.testMode ? '🧪 Test Mode' : '🚀 Live Mode'}
                        </div>
                    </div>
                </div>

                <div className="quick-actions">
                    <button
                        className="btn-secondary"
                        onClick={runManualTest}
                        disabled={testRunning}
                        style={{ opacity: testRunning ? 0.6 : 1, cursor: testRunning ? 'wait' : 'pointer' }}
                    >
                        {testRunning ? '⏳ Processing...' : '🧪 Run Test Automation'}
                    </button>
                    <button className="btn-secondary" onClick={() => setActiveTab('reports')}>
                        📊 View Reports
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="settings-tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    📋 Overview
                </button>
                <button
                    className={activeTab === 'campaigns' ? 'active' : ''}
                    onClick={() => setActiveTab('campaigns')}
                >
                    📧 Email Campaigns
                </button>
                <button
                    className={activeTab === 'templates' ? 'active' : ''}
                    onClick={() => setActiveTab('templates')}
                >
                    📝 Templates
                </button>
                <button
                    className={activeTab === 'reports' ? 'active' : ''}
                    onClick={() => setActiveTab('reports')}
                >
                    📊 Reports
                </button>
                <button
                    className={activeTab === 'settings' ? 'active' : ''}
                    onClick={() => setActiveTab('settings')}
                >
                    ⚙️ Settings
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'overview' && (
                    <OverviewTab
                        campaigns={campaigns}
                        systemStatus={systemStatus}
                        onToggleCampaign={toggleCampaign}
                        token={token}
                    />
                )}

                {activeTab === 'campaigns' && (
                    <CampaignsTab
                        campaigns={campaigns}
                        onToggleCampaign={toggleCampaign}
                        onReload={loadCampaigns}
                        token={token}
                        setMessage={setMessage}
                        onEditTemplate={(campaign) => {
                            setCampaignToEdit(campaign);
                            setActiveTab('templates');
                        }}
                    />
                )}

                {activeTab === 'templates' && (
                    <TemplatesTab
                        campaigns={campaigns}
                        onReload={loadCampaigns}
                        token={token}
                        setMessage={setMessage}
                        user={user}
                        initialCampaign={campaignToEdit}
                        onCampaignSelected={() => setCampaignToEdit(null)}
                    />
                )}

                {activeTab === 'reports' && (
                    <ReportsTab
                        token={token}
                        setMessage={setMessage}
                    />
                )}

                {activeTab === 'settings' && (
                    <SettingsTab
                        systemStatus={systemStatus}
                        onReload={loadData}
                        token={token}
                        setMessage={setMessage}
                        globalTestEmail={globalTestEmail}
                        setGlobalTestEmail={setGlobalTestEmail}
                        automationSenderEmail={automationSenderEmail}
                        setAutomationSenderEmail={setAutomationSenderEmail}
                        setSystemStatus={setSystemStatus}
                        setCurrentTab={setCurrentTab}
                    />
                )}
            </div>
        </div>
    );
};

// Overview Tab Component
const OverviewTab = ({ campaigns, systemStatus, onToggleCampaign, token }) => {
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const loadPreview = async () => {
        // Prevent multiple simultaneous calls
        if (loadingPreview) return;

        setLoadingPreview(true);
        try {
            const response = await fetch(`${API_BASE}/automated-emails/preview`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPreview(data.preview);
            }
        } catch (error) {
            console.error('Error loading preview:', error);
        } finally {
            setLoadingPreview(false);
        }
    };

    useEffect(() => {
        if (systemStatus && !loadingPreview) {
            loadPreview();
        }
    }, [systemStatus]);

    return (
        <div className="overview-tab">
            <div className="overview-grid">
                {/* Campaigns Quick View */}
                <div className="overview-section">
                    <h3>📧 Email Campaigns</h3>
                    <div className="campaign-list">
                        {campaigns.map(campaign => (
                            <div key={campaign.id} className="campaign-card">
                                <div className="campaign-info">
                                    <div className="campaign-name">{campaign.campaign_name}</div>
                                    <div className="campaign-details">
                                        {campaign.trigger_days} days overdue • {campaign.template_type}
                                    </div>
                                </div>
                                <div className="campaign-toggle">
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={campaign.is_active}
                                            onChange={(e) => onToggleCampaign(campaign.id, e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Automation Preview */}
                <div className="overview-section">
                    <h3>🔍 Next Automation Run Preview</h3>
                    <div className="preview-section">
                        {!systemStatus?.systemActive && (
                            <div className="system-disabled-notice">
                                <p style={{color: '#ff9800', fontSize: '14px', marginBottom: '10px'}}>
                                    ⚠️ System is currently disabled. Preview shows what would happen if enabled.
                                </p>
                            </div>
                        )}
                        {loadingPreview ? (
                            <p>Loading preview...</p>
                        ) : preview ? (
                            <div className="preview-summary">
                                {preview.map((previewItem, index) => (
                                    <div key={index} className="preview-item">
                                        <div className="preview-campaign">{previewItem.campaign.campaign_name}</div>
                                        <div className="preview-stats">
                                            <span className="stat-item">
                                                {previewItem.wouldSend} emails would be sent
                                            </span>
                                            <span className="stat-item">
                                                {previewItem.totalEligible} eligible invoices
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>No preview data available</p>
                        )}
                        <button className="btn-secondary" onClick={loadPreview}>
                            🔄 Refresh Preview
                        </button>
                    </div>
                </div>
            </div>

            {/* Key Features */}
            <div className="features-section">
                <h3>✨ Key Features</h3>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">📅</div>
                        <div className="feature-title">Tiered Notifications</div>
                        <div className="feature-description">
                            Automatically send payment reminders, collections notices, and final notices based on invoice age.
                        </div>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🎯</div>
                        <div className="feature-title">Smart Targeting</div>
                        <div className="feature-description">
                            Only sends emails to customers who haven't received recent notifications for the same invoice.
                        </div>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🔒</div>
                        <div className="feature-title">Opt-out Management</div>
                        <div className="feature-description">
                            Automatically respects customer opt-out preferences and provides easy unsubscribe options.
                        </div>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📊</div>
                        <div className="feature-title">Detailed Analytics</div>
                        <div className="feature-description">
                            Track email performance, response rates, and payment collection improvements.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Campaigns Tab Component
const CampaignsTab = ({ campaigns, onToggleCampaign, onReload, token, setMessage, onEditTemplate }) => {
    const formatDays = (days) => {
        if (days === 31) return "31-60 days";
        if (days === 61) return "61-90 days";
        if (days === 91) return "91+ days";
        return `${days} days`;
    };

    const getCampaignTypeLabel = (type) => {
        switch (type) {
            case 'payment_reminder': return '💳 Payment Reminder';
            case 'collections_notice': return '⚠️ Collections Notice';
            case 'final_notice': return '🚨 Final Notice';
            default: return type;
        }
    };

    return (
        <div className="campaigns-tab">
            <div className="tab-header">
                <h3>📧 Email Campaigns</h3>
                <button className="btn-primary" onClick={onReload}>
                    🔄 Refresh Campaigns
                </button>
            </div>

            <div className="campaigns-grid">
                {campaigns.map(campaign => (
                    <div key={campaign.id} className={`campaign-detail-card ${campaign.is_active ? 'active' : 'inactive'}`}>
                        <div className="campaign-header">
                            <div className="campaign-title">
                                <h4>{campaign.campaign_name}</h4>
                                <span className="campaign-type">{getCampaignTypeLabel(campaign.campaign_type)}</span>
                            </div>
                            <div className="campaign-toggle">
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={campaign.is_active}
                                        onChange={(e) => onToggleCampaign(campaign.id, e.target.checked)}
                                    />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div className="campaign-details">
                            <div className="detail-row">
                                <span className="detail-label">Trigger:</span>
                                <span className="detail-value">{formatDays(campaign.trigger_days)} overdue</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Frequency:</span>
                                <span className="detail-value">
                                    {campaign.send_frequency === 'once' ? 'Send once' : `Every ${campaign.recurring_interval_days} days`}
                                </span>
                            </div>
                            {campaign.max_reminders && (
                                <div className="detail-row">
                                    <span className="detail-label">Max reminders:</span>
                                    <span className="detail-value">{campaign.max_reminders}</span>
                                </div>
                            )}
                            <div className="detail-row">
                                <span className="detail-label">Template:</span>
                                <span className="detail-value">{campaign.template_type}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Last updated:</span>
                                <span className="detail-value">
                                    {new Date(campaign.updated_at || campaign.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>

                        <div className="campaign-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => onEditTemplate(campaign)}
                            >
                                📝 Edit Template
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {campaigns.length === 0 && (
                <div className="empty-state">
                    <h4>No campaigns found</h4>
                    <p>Email campaigns will appear here once the system is configured.</p>
                </div>
            )}
        </div>
    );
};

// Templates Tab Component
const TemplatesTab = ({ campaigns, onReload, token, setMessage, user, initialCampaign, onCampaignSelected }) => {
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(false);
    const [templateData, setTemplateData] = useState({ subject: '', body: '' });
    const [testEmail, setTestEmail] = useState('');
    const [sending, setSending] = useState(false);

    // Load email settings to get test_mode_recipient
    useEffect(() => {
        const loadEmailSettings = async () => {
            try {
                const response = await fetch(`${API_BASE}/email-settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const settings = await response.json();
                    setTestEmail(settings.test_mode_recipient || user?.email || '');
                }
            } catch (error) {
                console.error('Error loading email settings:', error);
                setTestEmail(user?.email || '');
            }
        };
        loadEmailSettings();
    }, [token, user]);

    // Handle initial campaign selection from "Edit Template" button
    useEffect(() => {
        if (initialCampaign) {
            selectCampaign(initialCampaign);
            if (onCampaignSelected) {
                onCampaignSelected();
            }
        }
    }, [initialCampaign]);

    const selectCampaign = async (campaign) => {
        setSelectedCampaign(campaign);

        // Fetch the actual template data from email_templates table
        try {
            const response = await fetch(`${API_BASE}/email-template/${campaign.template_type}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const templateData = await response.json();
                setTemplateData({
                    subject: templateData.subject_template || '',
                    body: templateData.body_template || ''
                });
            } else {
                // Fallback to empty template
                setTemplateData({ subject: '', body: '' });
            }
        } catch (error) {
            console.error('Error loading template:', error);
            setTemplateData({ subject: '', body: '' });
        }

        setEditingTemplate(false);
    };

    const saveTemplate = async () => {
        if (!selectedCampaign) return;

        try {
            const response = await fetch(`${API_BASE}/automated-emails/campaigns/${selectedCampaign.id}/template`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subject_template: templateData.subject,
                    body_template: templateData.body
                })
            });

            if (response.ok) {
                setMessage({ text: 'Template saved successfully!', type: 'success' });
                setEditingTemplate(false);
                onReload();
            } else {
                throw new Error('Failed to save template');
            }
        } catch (error) {
            console.error('Error saving template:', error);
            setMessage({ text: 'Error saving template', type: 'error' });
        }
    };

    const sendTestEmail = async () => {
        if (!selectedCampaign || !testEmail) return;

        setSending(true);
        try {
            const response = await fetch(`${API_BASE}/automated-emails/campaigns/${selectedCampaign.id}/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ test_email_address: testEmail })
            });

            if (response.ok) {
                const data = await response.json();
                setMessage({
                    text: `Test email sent successfully to ${testEmail}!`,
                    type: 'success'
                });
            } else {
                throw new Error('Failed to send test email');
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            setMessage({ text: 'Error sending test email', type: 'error' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="templates-tab">
            <div className="templates-layout">
                {/* Campaign Selection */}
                <div className="campaign-selector">
                    <h3>📧 Select Campaign</h3>
                    <div className="campaign-list">
                        {campaigns.map(campaign => (
                            <div
                                key={campaign.id}
                                className={`campaign-option ${selectedCampaign?.id === campaign.id ? 'selected' : ''}`}
                                onClick={() => selectCampaign(campaign)}
                            >
                                <div className="campaign-name">{campaign.campaign_name}</div>
                                <div className="campaign-type">{campaign.campaign_type}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Template Editor */}
                <div className="template-editor">
                    {selectedCampaign ? (
                        <>
                            <div className="editor-header">
                                <h3>📝 Template Editor - {selectedCampaign.campaign_name}</h3>
                                <div className="editor-actions">
                                    {!editingTemplate ? (
                                        <button
                                            className="btn-primary"
                                            onClick={() => setEditingTemplate(true)}
                                        >
                                            ✏️ Edit Template
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    setEditingTemplate(false);
                                                    // Reload the original template data
                                                    selectCampaign(selectedCampaign);
                                                }}
                                            >
                                                ❌ Cancel
                                            </button>
                                            <button
                                                className="btn-primary"
                                                onClick={saveTemplate}
                                            >
                                                💾 Save Template
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="template-fields">
                                <div className="field-group">
                                    <label>Email Subject</label>
                                    {editingTemplate ? (
                                        <input
                                            type="text"
                                            value={templateData.subject}
                                            onChange={(e) => setTemplateData({...templateData, subject: e.target.value})}
                                            placeholder="Enter email subject template..."
                                        />
                                    ) : (
                                        <div className="template-preview">
                                            {templateData.subject || 'No subject template set'}
                                        </div>
                                    )}
                                </div>

                                <div className="field-group">
                                    <label>Email Body</label>
                                    {editingTemplate ? (
                                        <textarea
                                            value={templateData.body}
                                            onChange={(e) => setTemplateData({...templateData, body: e.target.value})}
                                            placeholder="Enter email body template..."
                                            rows={15}
                                        />
                                    ) : (
                                        <div className="template-preview body-preview">
                                            {templateData.body ? (
                                                <pre>{templateData.body}</pre>
                                            ) : (
                                                'No body template set'
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Test Email */}
                            <div className="test-email-section">
                                <h4>🧪 Test Email</h4>
                                <div className="test-email-form">
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        placeholder="Enter test email address..."
                                    />
                                    <button
                                        className="btn-secondary"
                                        onClick={sendTestEmail}
                                        disabled={!testEmail || sending}
                                    >
                                        {sending ? 'Sending...' : '📤 Send Test'}
                                    </button>
                                </div>
                                <p className="test-note">
                                    Test emails use sample data and are marked as test emails.
                                </p>
                            </div>

                            {/* Template Variables */}
                            <div className="template-variables">
                                <h4>📋 Available Template Variables</h4>
                                <div className="variables-grid">
                                    <div className="variable-item">
                                        <code>{'{CUSTOMER_NAME}'}</code>
                                        <span>Customer's name</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{ORDER_REFERENCE}'}</code>
                                        <span>Order reference number</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{INVOICE_NUMBER}'}</code>
                                        <span>Invoice number</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{TOTAL_AMOUNT}'}</code>
                                        <span>Total invoice amount</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{TOTAL_PAID}'}</code>
                                        <span>Amount already paid</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{AMOUNT_DUE}'}</code>
                                        <span>Amount due</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{DAYS_OUTSTANDING}'}</code>
                                        <span>Days overdue</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{TAX_DATE}'}</code>
                                        <span>Invoice date</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{PAYMENT_LINK}'}</code>
                                        <span>Payment link URL</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{SENDER_NAME}'}</code>
                                        <span>Your name</span>
                                    </div>
                                    <div className="variable-item">
                                        <code>{'{COMPANY_NAME}'}</code>
                                        <span>Company name</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="no-campaign-selected">
                            <h4>Select a campaign to edit its template</h4>
                            <p>Choose a campaign from the list on the left to view and edit its email template.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Reports Tab Component (Placeholder)
const ReportsTab = ({ token, setMessage }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const response = await fetch(`${API_BASE}/automated-emails/stats?days=30`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            setMessage({ text: 'Error loading statistics', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading-state">Loading reports...</div>;
    }

    return (
        <div className="reports-tab">
            <h3>📊 Automated Email Reports</h3>
            <p>Detailed reporting dashboard coming soon...</p>

            {stats && (
                <div className="stats-preview">
                    <h4>Last 30 Days Summary</h4>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <div className="stat-value">{stats.totalEmailsSent || 0}</div>
                            <div className="stat-label">Total Emails Sent</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats.automationRuns || 0}</div>
                            <div className="stat-label">Automation Runs</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Settings Tab Component
const SettingsTab = ({ systemStatus, onReload, token, setMessage, globalTestEmail, setGlobalTestEmail, automationSenderEmail, setAutomationSenderEmail, setSystemStatus, setCurrentTab }) => {
    return (
        <div className="settings-tab">
            <h3>⚙️ System Settings</h3>

            <div className="settings-section">
                <h4>🔧 Automation Schedule</h4>
                <p>The automated email system runs twice daily:</p>
                <ul>
                    <li>9:00 AM (weekdays)</li>
                    <li>2:00 PM (weekdays)</li>
                </ul>
                <p>Weekend runs are disabled to avoid sending emails outside business hours.</p>
            </div>

            <div className="settings-section">
                <h4>🛡️ Safety Settings</h4>
                <div className="safety-info">
                    <div className="safety-item">
                        <strong>Rate Limiting:</strong> Maximum 500 emails per day, 50 per hour
                    </div>
                    <div className="safety-item">
                        <strong>User Test Mode:</strong> {systemStatus?.testMode ? 'Enabled' : 'Disabled'}
                        <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                            Your personal email settings test mode (managed in Email Settings)
                        </small>
                    </div>
                    <div className="safety-item">
                        <strong>Global Automation Test Mode:</strong>
                        <label className="toggle-switch" style={{ marginLeft: '10px' }}>
                            <input
                                type="checkbox"
                                checked={systemStatus?.globalTestMode || false}
                                onChange={async (e) => {
                                    const enabled = e.target.checked;
                                    try {
                                        const response = await fetch(`${API_BASE}/automated-emails/global-test-mode`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ enabled })
                                        });

                                        if (response.ok) {
                                            setMessage({
                                                text: `Global automation test mode ${enabled ? 'enabled' : 'disabled'} successfully`,
                                                type: 'success'
                                            });
                                            // Update system status state
                                            setSystemStatus(prev => ({
                                                ...prev,
                                                globalTestMode: enabled
                                            }));
                                        } else {
                                            throw new Error('Failed to toggle global test mode');
                                        }
                                    } catch (error) {
                                        console.error('Error toggling global test mode:', error);
                                        setMessage({ text: `Error ${enabled ? 'enabling' : 'disabling'} global test mode`, type: 'error' });
                                    }
                                }}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                        <span style={{ marginLeft: '10px' }}>
                            {systemStatus?.globalTestMode ? 'Enabled' : 'Disabled'}
                        </span>
                        <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                            Forces all automated runs into test mode (overrides individual settings)
                        </small>
                    </div>
                    <div className="safety-item">
                        <strong>Global Test Email:</strong>
                        <input
                            type="email"
                            value={globalTestEmail}
                            onChange={(e) => setGlobalTestEmail(e.target.value)}
                            onBlur={async () => {
                                if (globalTestEmail && globalTestEmail !== systemStatus?.globalTestEmail) {
                                    try {
                                        const response = await fetch(`${API_BASE}/automated-emails/global-test-email`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ email: globalTestEmail })
                                        });
                                        if (response.ok) {
                                            setMessage({
                                                text: 'Global test email updated successfully',
                                                type: 'success'
                                            });
                                            setSystemStatus(prev => ({
                                                ...prev,
                                                globalTestEmail: globalTestEmail
                                            }));
                                        } else {
                                            throw new Error('Failed to update global test email');
                                        }
                                    } catch (error) {
                                        console.error('Error updating global test email:', error);
                                        setMessage({ text: 'Error updating global test email', type: 'error' });
                                        setGlobalTestEmail(systemStatus?.globalTestEmail || '');
                                    }
                                }
                            }}
                            placeholder="test@example.com"
                            style={{
                                marginLeft: '10px',
                                padding: '4px 8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px',
                                width: '200px'
                            }}
                        />
                        <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                            Email address used when global test mode is enabled
                        </small>
                    </div>
                    <div className="safety-item">
                        <strong>Automation Sender Email:</strong>
                        <input
                            type="email"
                            value={automationSenderEmail}
                            onChange={(e) => setAutomationSenderEmail(e.target.value)}
                            onBlur={async () => {
                                if (automationSenderEmail && automationSenderEmail !== systemStatus?.automationSenderEmail) {
                                    try {
                                        const response = await fetch(`${API_BASE}/automated-emails/sender-email`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ email: automationSenderEmail })
                                        });
                                        if (response.ok) {
                                            setMessage({
                                                text: 'Automation sender email updated successfully',
                                                type: 'success'
                                            });
                                            setSystemStatus(prev => ({
                                                ...prev,
                                                automationSenderEmail: automationSenderEmail
                                            }));
                                        } else {
                                            throw new Error('Failed to update automation sender email');
                                        }
                                    } catch (error) {
                                        console.error('Error updating automation sender email:', error);
                                        setMessage({ text: 'Error updating automation sender email', type: 'error' });
                                        setAutomationSenderEmail(systemStatus?.automationSenderEmail || '');
                                    }
                                }
                            }}
                            placeholder="sender@example.com"
                            style={{
                                marginLeft: '10px',
                                padding: '4px 8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px',
                                width: '200px'
                            }}
                        />
                        <small style={{ display: 'block', color: '#666', marginTop: '4px' }}>
                            Email address used as sender for all automated emails (must have configured email settings)
                        </small>
                    </div>
                    <div className="safety-item">
                        <strong>Opt-out Respect:</strong> Automatically honors customer preferences
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h4>📧 Email Configuration</h4>
                <p>Email templates and SMTP settings are managed through the main Email Settings page.</p>
                <button
                    className="btn-secondary"
                    onClick={() => setCurrentTab('email-settings')}
                >
                    📧 Go to Email Settings
                </button>
            </div>
        </div>
    );
};

export default AutomatedEmailSettings;