import React, { useState, useEffect } from 'react';
import './EmailSettings.css';

const API_BASE = '/texon-invoicing-portal/api';

const EmailSettings = () => {
    const [emailSettings, setEmailSettings] = useState({
        email_address: '',
        google_app_password: '',
        test_mode: true,
        test_mode_recipient: ''
    });
    
    const [currentSettings, setCurrentSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        loadEmailSettings();
    }, []);

    const loadEmailSettings = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/user/email-settings`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCurrentSettings(data.settings);
                    setEmailSettings({
                        email_address: data.settings.email_address || '',
                        google_app_password: data.settings.google_app_password || '', // Load the actual password for editing
                        test_mode: data.settings.test_mode !== false, // Default to true if not set
                        test_mode_recipient: data.settings.test_mode_recipient || ''
                    });
                }
            } else if (response.status === 404) {
                // No settings found - this is normal for first-time setup
                console.log('No email settings found - ready for initial setup');
            } else {
                throw new Error('Failed to load email settings');
            }
        } catch (error) {
            console.error('Error loading email settings:', error);
            setMessage({ text: 'Error loading email settings', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setEmailSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTestModeToggle = (enabled) => {
        setEmailSettings(prev => ({
            ...prev,
            test_mode: enabled,
            test_mode_recipient: enabled ? (prev.test_mode_recipient || prev.email_address) : ''
        }));
    };

    const handleSave = async () => {
        if (!emailSettings.email_address || !emailSettings.google_app_password) {
            setMessage({ text: 'Please fill in email address and Google App Password', type: 'error' });
            return;
        }

        if (emailSettings.test_mode && !emailSettings.test_mode_recipient) {
            setMessage({ text: 'Please specify a test email recipient or disable test mode', type: 'error' });
            return;
        }

        setIsSaving(true);
        setMessage({ text: '', type: '' });

        try {
            const response = await fetch(`${API_BASE}/user/email-settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(emailSettings)
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                setMessage({ text: 'Email settings saved successfully!', type: 'success' });
                await loadEmailSettings(); // Reload to get updated settings
            } else {
                throw new Error(data.error || 'Failed to save email settings');
            }
        } catch (error) {
            console.error('Error saving email settings:', error);
            setMessage({ text: `Error: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        setIsLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const response = await fetch(`${API_BASE}/test-email`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            
            if (response.ok && data.success) {
                setMessage({ text: `Test email sent successfully to ${emailSettings.test_mode ? emailSettings.test_mode_recipient : emailSettings.email_address}!`, type: 'success' });
            } else {
                throw new Error(data.error || 'Failed to send test email');
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            setMessage({ text: `Test email failed: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !currentSettings) {
        return (
            <div className="email-settings-container">
                <div className="loading-spinner">Loading email settings...</div>
            </div>
        );
    }

    return (
        <div className="email-settings-container">
            <div className="email-settings-header">
                <h2>📧 Email Settings</h2>
                <p className="settings-description">
                    Configure your Gmail settings to send invoice and reminder emails directly from your account.
                </p>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="email-settings-form">
                {/* Gmail Configuration Section */}
                <div className="settings-section">
                    <h3>Gmail Configuration</h3>
                    <div className="form-group">
                        <label>Gmail Address: *</label>
                        <input
                            type="email"
                            value={emailSettings.email_address}
                            onChange={(e) => handleInputChange('email_address', e.target.value)}
                            placeholder="your.email@gmail.com"
                            required
                        />
                        <small>This will be used as the "From" address for all emails</small>
                    </div>

                    <div className="form-group">
                        <label>Google App Password: *</label>
                        <div className="password-input-group">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={emailSettings.google_app_password}
                                onChange={(e) => handleInputChange('google_app_password', e.target.value)}
                                placeholder="16-character app password"
                                required={!emailSettings.google_app_password}
                            />
                            <button 
                                type="button" 
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '👁️' : '🔒'}
                            </button>
                        </div>
                        <small>
                            Generate this in your Google Account → Security → App Passwords. 
                            <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer">
                                Learn more
                            </a>
                        </small>
                    </div>
                </div>

                {/* Test Mode Section */}
                <div className="settings-section">
                    <h3>🧪 Test Mode</h3>
                    <div className="test-mode-controls">
                        <div className="test-mode-toggle">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={emailSettings.test_mode}
                                    onChange={(e) => handleTestModeToggle(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                                <span className="toggle-label">
                                    {emailSettings.test_mode ? 'Test Mode Enabled' : 'Live Mode (sends to customers)'}
                                </span>
                            </label>
                        </div>

                        {emailSettings.test_mode ? (
                            <div className="test-mode-info">
                                <div className="form-group">
                                    <label>Test Email Recipient: *</label>
                                    <input
                                        type="email"
                                        value={emailSettings.test_mode_recipient}
                                        onChange={(e) => handleInputChange('test_mode_recipient', e.target.value)}
                                        placeholder="your.test.email@gmail.com"
                                        required
                                    />
                                    <small>All emails will be sent to this address instead of customers</small>
                                </div>
                                <div className="test-mode-warning">
                                    ⚠️ <strong>Test Mode is ON:</strong> Emails will NOT be sent to customers. 
                                    They will be redirected to your test email address.
                                </div>
                            </div>
                        ) : (
                            <div className="live-mode-warning">
                                🚨 <strong>Live Mode is ON:</strong> Emails will be sent directly to customers. 
                                Make sure your email templates are ready!
                            </div>
                        )}
                    </div>
                </div>

                {/* Current Settings Display */}
                {currentSettings && (
                    <div className="settings-section current-settings">
                        <h3>Current Settings</h3>
                        <div className="settings-summary">
                            <div className="setting-item">
                                <span className="setting-label">Email Address:</span>
                                <span className="setting-value">{currentSettings.email_address}</span>
                            </div>
                            <div className="setting-item">
                                <span className="setting-label">Password:</span>
                                <span className="setting-value">
                                    {currentSettings.google_app_password ? '✅ Configured' : '❌ Not set'}
                                </span>
                            </div>
                            <div className="setting-item">
                                <span className="setting-label">Mode:</span>
                                <span className={`setting-value mode-badge ${currentSettings.test_mode ? 'test' : 'live'}`}>
                                    {currentSettings.test_mode ? '🧪 Test Mode' : '🚀 Live Mode'}
                                </span>
                            </div>
                            {currentSettings.test_mode && currentSettings.test_mode_recipient && (
                                <div className="setting-item">
                                    <span className="setting-label">Test Recipient:</span>
                                    <span className="setting-value">{currentSettings.test_mode_recipient}</span>
                                </div>
                            )}
                            <div className="setting-item">
                                <span className="setting-label">Last Updated:</span>
                                <span className="setting-value">
                                    {new Date(currentSettings.updated_at || currentSettings.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="settings-actions">
                    <button 
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : '💾 Save Email Settings'}
                    </button>
                    
                    {currentSettings?.google_app_password && (
                        <button 
                            className="btn-secondary"
                            onClick={handleTestEmail}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : '🧪 Send Test Email'}
                        </button>
                    )}
                </div>
            </div>

            {/* Setup Instructions - Only show if email not configured */}
            {!currentSettings?.google_app_password && (
                <div className="setup-instructions">
                <h3>📋 Setup Instructions</h3>
                <ol>
                    <li><strong>Enable 2-Factor Authentication</strong> on your Gmail account</li>
                    <li><strong>Generate App Password:</strong>
                        <ul>
                            <li>Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Google Account Security</a></li>
                            <li>Under "Signing in to Google", select "App passwords"</li>
                            <li>Generate a new app password for "Mail"</li>
                            <li>Copy the 16-character password</li>
                        </ul>
                    </li>
                    <li><strong>Test Mode:</strong> Keep test mode enabled until you're ready to go live</li>
                    <li><strong>Send Test Email</strong> to verify your configuration works</li>
                    <li><strong>Go Live:</strong> Disable test mode when ready to send real customer emails</li>
                </ol>
                </div>
            )}
        </div>
    );
};

export default EmailSettings;