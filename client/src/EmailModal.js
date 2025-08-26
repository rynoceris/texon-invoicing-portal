import React, { useState, useEffect } from 'react';
import './EmailModal.css';

const API_BASE = '/texon-invoicing-portal/api';

const EmailModal = ({ isOpen, invoice, emailType, onClose, onSend, token }) => {
    const [emailData, setEmailData] = useState({
        to: '',
        subject: '',
        body: '',
        emailType: emailType
    });
    const [isLoading, setIsLoading] = useState(false);
    const [lastSent, setLastSent] = useState(null);
    const [emailHistory, setEmailHistory] = useState([]);
    const [expandedEmail, setExpandedEmail] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    const orderData = invoice || {};
    
    // Debug logging to see what data we're receiving
    useEffect(() => {
        if (isOpen) {
            console.log('EmailModal orderData:', orderData);
        }
    }, [isOpen, orderData]);
    
    useEffect(() => {
        if (isOpen && orderData.id) {
            loadEmailTemplate();
            loadLastSentInfo();
            setSuccessMessage(null); // Clear success message when modal opens
        }
    }, [isOpen, orderData, emailType]);

    const loadEmailTemplate = async () => {
        // Get recipient email
        const recipientEmail = orderData.billingContact?.email || orderData.customer?.email || orderData.deliveryContact?.email || '';
        
        try {
            // Get template from backend
            const response = await fetch(`${API_BASE}/email-template/${emailType}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const template = await response.json();
                
                // Replace template variables
                const templateVars = {
                    ORDER_ID: orderData.id,
                    CUSTOMER_NAME: orderData.billingContact?.name || orderData.customer?.name || 'Valued Customer',
                    COMPANY_NAME: 'Texon Towel',
                    ORDER_REFERENCE: orderData.orderRef || orderData.reference || '',
                    INVOICE_NUMBER: orderData.invoiceNumber || '',
                    TOTAL_AMOUNT: orderData.totalAmount ? `$${orderData.totalAmount}` : '',
                    DAYS_OUTSTANDING: orderData.days_outstanding || '',
                    PAYMENT_LINK: orderData.paymentLink || ''
                };

                const subject = replaceTemplateVars(template.subject_template, templateVars);
                const body = replaceTemplateVars(template.body_template, templateVars);

                setEmailData({
                    to: recipientEmail,
                    subject: subject,
                    body: body,
                    emailType: emailType
                });
            } else {
                // Fallback default template
                setDefaultTemplate(recipientEmail);
            }
        } catch (error) {
            console.error('Error loading email template:', error);
            setDefaultTemplate(recipientEmail);
        }
    };

    const setDefaultTemplate = (recipientEmail) => {
        const isReminder = emailType === 'reminder';
        
        setEmailData({
            to: recipientEmail,
            subject: isReminder 
                ? `Payment Reminder - Order #${orderData.id}` 
                : `Invoice - Order #${orderData.id}`,
            body: isReminder 
                ? `Dear ${orderData.billingaddressfullname || 'Valued Customer'},\n\nThis is a friendly reminder that payment is due for Order #${orderData.id}.\n\nOrder Total: $${orderData.total || orderData.totalvalue || '0.00'}\nOrder Date: ${new Date(orderData.placedon).toLocaleDateString()}\n\nPlease submit payment at your earliest convenience.\n\nBest regards,\nTexon Towel` 
                : `Dear ${orderData.billingaddressfullname || 'Valued Customer'},\n\nThank you for your order. Please find your invoice attached.\n\nOrder #: ${orderData.id}\nTotal Amount: $${orderData.total || orderData.totalvalue || '0.00'}\n\nBest regards,\nTexon Towel`,
            emailType: emailType
        });
    };

    const replaceTemplateVars = (template, variables) => {
        let result = template || '';
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{${key}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value || '');
        }
        return result;
    };

    const loadLastSentInfo = async () => {
        try {
            const response = await fetch(`${API_BASE}/email-logs/order/${orderData.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const logs = await response.json();
                if (logs && logs.length > 0) {
                    // Find the most recent email of this type
                    const recentEmail = logs.find(log => log.email_type === emailType);
                    if (recentEmail) {
                        setLastSent({
                            date: new Date(recentEmail.created_at).toLocaleString(),
                            status: recentEmail.send_status,
                            recipient: recentEmail.recipient_email
                        });
                    }
                    setEmailHistory(logs.filter(log => log.email_type === emailType).slice(0, 5));
                }
            }
        } catch (error) {
            console.error('Error loading email history:', error);
        }
    };

    const handleSend = async () => {
        if (!emailData.to || !emailData.subject || !emailData.body) {
            alert('Please fill in all required fields.');
            return;
        }

        setIsLoading(true);
        setSuccessMessage(null); // Clear any previous success message
        
        try {
            const success = await onSend({
                orderId: orderData.id,
                to: emailData.to,
                subject: emailData.subject,
                body: emailData.body,
                emailType: emailType
            });
            
            if (success) {
                // Show success message
                setSuccessMessage(`✅ ${emailType === 'reminder' ? 'Reminder' : 'Invoice'} sent successfully to ${emailData.to}!`);
                
                // Scroll modal to top so user sees the success message
                const modalContent = document.querySelector('.email-modal');
                if (modalContent) {
                    modalContent.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
                
                // Refresh email logs to show the new email
                await loadLastSentInfo();
                
                // Clear form but keep modal open
                setEmailData({
                    to: emailData.to, // Keep recipient for potential follow-ups
                    subject: '',
                    body: '',
                    emailType: emailType
                });
                
                // Auto-hide success message after 5 seconds
                setTimeout(() => {
                    setSuccessMessage(null);
                }, 5000);
                
                // Don't close modal - let user decide when to close
            }
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Failed to send email: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setEmailData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    if (!isOpen) return null;

    const isReminder = emailType === 'reminder';

    return (
        <div className="email-modal-overlay" onClick={onClose}>
            <div className="email-modal" onClick={(e) => e.stopPropagation()}>
                <div className="email-modal-header">
                    <h2>
                        {isReminder ? '⚠️ Send Payment Reminder' : '📧 Send Invoice'} - Order #{orderData.id}
                    </h2>
                    <button className="email-modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="email-modal-content">
                    {/* Order Info */}
                    <div className="order-info">
                        <h4>Order Details</h4>
                        <div className="order-details">
                            <div className="order-detail-item">
                                <strong>Customer:</strong> {
                                    orderData.billingContact?.name || 
                                    orderData.customer?.name || 
                                    orderData.billingaddressfullname || 
                                    orderData.customerName || 
                                    'N/A'
                                }
                            </div>
                            <div className="order-detail-item">
                                <strong>Amount:</strong> ${
                                    orderData.totalAmount || 
                                    orderData.total || 
                                    orderData.totalvalue || 
                                    orderData.amount ||
                                    '0.00'
                                }
                            </div>
                            <div className="order-detail-item">
                                <strong>Date:</strong> {
                                    orderData.orderDate ? 
                                        new Date(orderData.orderDate).toLocaleDateString() :
                                    orderData.placedon ? 
                                        new Date(orderData.placedon).toLocaleDateString() :
                                    orderData.invoiceDate ? 
                                        new Date(orderData.invoiceDate).toLocaleDateString() :
                                        'Invalid Date'
                                }
                            </div>
                            <div className="order-detail-item">
                                <strong>Days Outstanding:</strong> {
                                    orderData.days_outstanding || 
                                    orderData.daysOutstanding || 
                                    orderData.outstanding_days || 
                                    'N/A'
                                }
                            </div>
                        </div>
                    </div>

                    {/* Success Message */}
                    {successMessage && (
                        <div className="success-message">
                            {successMessage}
                        </div>
                    )}

                    {/* Last Sent Info */}
                    {lastSent && (
                        <div className="last-sent-info">
                            <h4>Last {isReminder ? 'Reminder' : 'Invoice'} Sent</h4>
                            <p>
                                <strong>Date:</strong> {lastSent.date} | 
                                <strong> Status:</strong> {lastSent.status} | 
                                <strong> To:</strong> {lastSent.recipient}
                            </p>
                        </div>
                    )}

                    {/* Email Form */}
                    <div className="email-form">
                        <div className="form-group">
                            <label>To: *</label>
                            <input
                                type="email"
                                value={emailData.to}
                                onChange={(e) => handleInputChange('to', e.target.value)}
                                placeholder="customer@example.com"
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Subject: *</label>
                            <input
                                type="text"
                                value={emailData.subject}
                                onChange={(e) => handleInputChange('subject', e.target.value)}
                                placeholder="Email subject..."
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Message: *</label>
                            <textarea
                                value={emailData.body}
                                onChange={(e) => handleInputChange('body', e.target.value)}
                                placeholder="Email message..."
                                rows="8"
                                required
                            />
                        </div>
                    </div>

                    {/* Email History */}
                    {emailHistory.length > 0 && (
                        <div className="email-history">
                            <h4>Recent {isReminder ? 'Reminders' : 'Invoices'}</h4>
                            <div className="history-list">
                                {emailHistory.map((log, index) => (
                                    <div key={index} className="history-item">
                                        <div className="history-main-info">
                                            <div className="history-date-status">
                                                <span className="history-date">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </span>
                                                <span className={`history-status status-${log.send_status?.toLowerCase()}`}>
                                                    {log.send_status}
                                                </span>
                                            </div>
                                            <div className="history-details">
                                                <span className="history-sender">
                                                    <strong>Sent by:</strong> {
                                                        log.app_users?.first_name && log.app_users?.last_name 
                                                            ? `${log.app_users.first_name} ${log.app_users.last_name}`
                                                            : log.app_users?.email || log.sender_email || 'Unknown'
                                                    }
                                                </span>
                                                <span className="history-recipient">
                                                    <strong>To:</strong> {log.recipient_email}
                                                </span>
                                            </div>
                                            <div className="history-subject">
                                                <strong>Subject:</strong> {log.subject || 'No subject'}
                                            </div>
                                        </div>
                                        <button 
                                            className="view-email-btn"
                                            onClick={() => setExpandedEmail(expandedEmail === index ? null : index)}
                                            title="View email content"
                                        >
                                            {expandedEmail === index ? '▼' : '▶'} View
                                        </button>
                                        {expandedEmail === index && (
                                            <div className="email-content-preview">
                                                <div className="email-body">
                                                    {log.body ? (
                                                        <pre>{log.body}</pre>
                                                    ) : (
                                                        <em>No content available</em>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="email-modal-footer">
                    <div className="modal-buttons">
                        <button
                            className="btn-secondary"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleSend}
                            disabled={isLoading || !emailData.to || !emailData.subject || !emailData.body}
                        >
                            {isLoading 
                                ? (isReminder ? 'Sending Reminder...' : 'Sending Invoice...') 
                                : (isReminder ? '⚠️ Send Reminder' : '📧 Send Invoice')
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailModal;