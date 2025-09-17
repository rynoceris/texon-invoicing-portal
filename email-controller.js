const EmailService = require('./email-service');
const PDFKitService = require('./pdf-service-pdfkit');
const EnhancedPDFService = require('./enhanced-pdf-service');
const PaymentLinksService = require('./payment-links-service');
const SupabaseBrightpearlService = require('./supabase-brightpearl-service');

/**
 * Email Controller - Handles all email-related API endpoints
 */
class EmailController {
    constructor() {
        this.emailService = new EmailService();
        this.pdfService = new PDFKitService();
        this.enhancedPdfService = new EnhancedPDFService();
        this.paymentLinksService = new PaymentLinksService();
        this.brightpearlService = new SupabaseBrightpearlService();
        console.log('✅ Email Controller initialized with Enhanced PDF Service');
    }

    /**
     * Save user email settings
     * POST /api/user/email-settings
     */
    async saveEmailSettings(req, res) {
        try {
            const { 
                email_address, 
                google_app_password, 
                test_mode = true,
                test_mode_recipient 
            } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!email_address || !google_app_password) {
                return res.status(400).json({ 
                    error: 'Email address and Google App Password are required' 
                });
            }

            const result = await this.emailService.saveUserEmailSettings(
                userId, 
                email_address, 
                google_app_password,
                test_mode,
                test_mode_recipient
            );

            if (result.success) {
                res.json({ success: true, message: 'Email settings saved successfully' });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (error) {
            console.error('❌ Error saving email settings:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get user email settings (without password)
     * GET /api/user/email-settings
     */
    async getEmailSettings(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const result = await this.emailService.getUserEmailSettings(userId);

            if (result.success) {
                // Include the actual password for editing purposes
                // The password is already decrypted by the email service
                res.json({ 
                    success: true, 
                    settings: result.settings
                });
            } else {
                res.status(404).json({ error: result.error });
            }
        } catch (error) {
            console.error('❌ Error getting email settings:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get email template by type
     * GET /api/email-template/:type
     */
    async getEmailTemplate(req, res) {
        try {
            const { type } = req.params;

            const result = await this.emailService.getEmailTemplate(type);

            if (result.success) {
                res.json(result.template);
            } else {
                res.status(404).json({ error: result.error });
            }
        } catch (error) {
            console.error('❌ Error getting email template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Send invoice/reminder email
     * POST /api/send-email
     */
    async sendEmail(req, res) {
        try {
            const { 
                orderId, 
                to, 
                subject, 
                body, 
                emailType = 'invoice' 
            } = req.body;
            
            const userId = req.user?.userId;
            const userName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'Texon User';

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!orderId || !to || !subject || !body) {
                return res.status(400).json({ 
                    error: 'Order ID, recipient email, subject, and body are required' 
                });
            }

            console.log(`📧 Processing ${emailType} email for order ${orderId}...`);
            

            // 1. Get order data
            const orderDetails = await this.brightpearlService.getOrderDetails(orderId);
            if (!orderDetails.success) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const orderData = orderDetails.data;

            // 2. Get payment data using Enhanced PDF Service method
            const paymentData = await this.enhancedPdfService.getPaymentData(orderId);
            
            // 3. Generate/get payment link
            let paymentLink = null;
            const paymentLinkResult = await this.paymentLinksService.generatePaymentLink(orderId);
            if (paymentLinkResult.success) {
                paymentLink = paymentLinkResult.data.paymentLink;
            }

            // 4. Calculate payment totals and amount due
            const totalAmount = parseFloat(orderData.totalAmount || orderData.total || 0);
            const totalPaid = paymentData.totalPaid || 0;
            const amountDue = Math.max(0, totalAmount - totalPaid);

            // 5. Prepare order data for PDF and email
            const pdfOrderData = {
                ...orderData,
                paymentLink: paymentLink,
                customerName: orderData.billingContact?.name || orderData.customer?.name || orderData.customerName,
                invoiceNumber: orderData.invoiceReference || `ORDER-${orderId}`,
                totalAmount: totalAmount,
                totalPaid: totalPaid,
                amountDue: amountDue,
                payments: paymentData.payments || [],
                orderDate: orderData.orderDate,
                orderRef: orderData.orderRef
            };

            // 6. Generate PDF using Enhanced PDF Service with Brightpearl template
            console.log('📄 Generating PDF invoice with Enhanced PDF Service...');
            console.log('📊 PDF Order Data:', JSON.stringify(pdfOrderData, null, 2));
            const pdfResult = await this.enhancedPdfService.generateInvoicePDF(pdfOrderData);
            if (!pdfResult.success) {
                return res.status(500).json({ error: 'Failed to generate PDF: ' + pdfResult.error });
            }

            // 5. Prepare email attachments
            const attachments = [
                this.enhancedPdfService.createEmailAttachment(pdfResult.buffer, pdfResult.filename)
            ];

            // 6. Send email
            const emailOrderData = {
                ...pdfOrderData,
                paymentLink: paymentLink
            };

            // Debug: Log what we're sending to email service
            console.log('🔍 Email Controller Debug - Email Order Data:');
            console.log('  totalAmount:', emailOrderData.totalAmount);
            console.log('  totalPaid:', emailOrderData.totalPaid);
            console.log('  amountDue:', emailOrderData.amountDue);
            console.log('  payments:', emailOrderData.payments ? `${emailOrderData.payments.length} payments` : 'undefined');

            // Apply template replacement to custom subject and body
            const formatPaymentHistory = (payments) => {
                if (!payments || payments.length === 0) {
                    return 'No payments recorded.';
                }
                return payments.map(payment => {
                    const date = new Date(payment.paymentdate).toLocaleDateString();
                    const amount = parseFloat(payment.amountpaid || 0).toFixed(2);
                    const method = payment.paymentmethodcode || 'Other';
                    return `• ${date}: $${amount} (${method})`;
                }).join('\n');
            };

            const templateVars = {
                ORDER_ID: orderId.toString(),
                CUSTOMER_NAME: emailOrderData.customerName || 'Valued Customer',
                COMPANY_NAME: 'Texon Towel',
                SENDER_NAME: userName,
                ORDER_REFERENCE: emailOrderData.reference || '',
                INVOICE_NUMBER: emailOrderData.invoiceNumber || '',
                TOTAL_AMOUNT: '$' + (emailOrderData.totalAmount || 0).toFixed(2),
                TOTAL_PAID: '$' + (emailOrderData.totalPaid || 0).toFixed(2),
                AMOUNT_DUE: '$' + (emailOrderData.amountDue || 0).toFixed(2),
                PAYMENT_STATUS: emailOrderData.amountDue > 0 ? 'PARTIALLY PAID' : 'PAID IN FULL',
                PAYMENT_HISTORY: formatPaymentHistory(emailOrderData.payments),
                DAYS_OUTSTANDING: emailOrderData.daysOutstanding || '',
                PAYMENT_LINK: emailOrderData.paymentLink || ''
            };

            // Replace variables in custom subject and body
            const processedSubject = this.emailService.replaceTemplateVariables(subject, templateVars);
            const processedBody = this.emailService.replaceTemplateVariables(body, templateVars);

            console.log('🔍 Email Controller Debug - Template Variables Applied:');
            console.log('  Original Subject:', subject);
            console.log('  Processed Subject:', processedSubject);

            const emailResult = await this.emailService.sendEmail({
                userId: userId,
                orderId: orderId,
                recipientEmail: to,
                emailType: emailType,
                customSubject: processedSubject,
                customBody: processedBody,
                attachments: attachments,
                orderData: emailOrderData,
                senderName: userName
            });

            if (emailResult.success) {
                res.json({ 
                    success: true, 
                    message: 'Email sent successfully',
                    messageId: emailResult.messageId,
                    logId: emailResult.logId
                });
            } else {
                res.status(500).json({ error: emailResult.error });
            }

        } catch (error) {
            console.error('❌ Error sending email:', error);
            res.status(500).json({ error: 'Internal server error' });
        } finally {
            // Clean up PDF services
            await this.enhancedPdfService.closeBrowser();
        }
    }

    /**
     * Get email logs for an order
     * GET /api/email-logs/order/:orderId
     */
    async getEmailLogsForOrder(req, res) {
        try {
            const { orderId } = req.params;

            const result = await this.emailService.getEmailLogsForOrder(parseInt(orderId));

            if (result.success) {
                res.json(result.logs);
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (error) {
            console.error('❌ Error getting email logs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get recent email logs for current user
     * GET /api/email-logs/recent
     */
    async getRecentEmailLogs(req, res) {
        try {
            const userId = req.user?.userId;
            const limit = parseInt(req.query.limit) || 50;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const result = await this.emailService.getRecentEmailLogs(userId, limit);

            if (result.success) {
                res.json(result.logs);
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (error) {
            console.error('❌ Error getting recent email logs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get email preview with processed template variables
     * GET /api/email-preview/:orderId/:emailType
     */
    async getEmailPreview(req, res) {
        try {
            const { orderId, emailType = 'reminder' } = req.params;
            const userId = req.user?.userId;
            const userName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'Texon User';

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            

            // Get order data with payment information
            const orderDetails = await this.brightpearlService.getOrderDetails(orderId);
            if (!orderDetails.success) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const orderData = orderDetails.data;
            const paymentData = await this.enhancedPdfService.getPaymentData(orderId);
            
            // Generate payment link
            let paymentLink = null;
            const paymentLinkResult = await this.paymentLinksService.generatePaymentLink(orderId);
            if (paymentLinkResult.success) {
                paymentLink = paymentLinkResult.data.paymentLink;
            }

            // Calculate payment totals
            const totalAmount = parseFloat(orderData.totalAmount || orderData.total || 0);
            const totalPaid = paymentData.totalPaid || 0;
            const amountDue = Math.max(0, totalAmount - totalPaid);

            const emailOrderData = {
                ...orderData,
                paymentLink: paymentLink,
                customerName: orderData.billingContact?.name || orderData.customer?.name || orderData.customerName,
                invoiceNumber: orderData.invoiceReference || `ORDER-${orderId}`,
                totalAmount: totalAmount,
                totalPaid: totalPaid,
                amountDue: amountDue,
                payments: paymentData.payments || [],
                orderDate: orderData.orderDate,
                orderRef: orderData.orderRef
            };

            // Get email template
            const templateResult = await this.emailService.getEmailTemplate(emailType);
            if (!templateResult.success) {
                return res.status(500).json({ error: 'Failed to get email template' });
            }

            // Format payment history
            const formatPaymentHistory = (payments) => {
                if (!payments || payments.length === 0) {
                    return 'No payments recorded.';
                }
                return payments.map(payment => {
                    const date = new Date(payment.paymentdate).toLocaleDateString();
                    const amount = parseFloat(payment.amountpaid || 0).toFixed(2);
                    const method = payment.paymentmethodcode || 'Other';
                    return `• ${date}: $${amount} (${method})`;
                }).join('\n');
            };

            // Prepare template variables
            const templateVars = {
                ORDER_ID: orderId.toString(),
                CUSTOMER_NAME: emailOrderData.customerName || 'Valued Customer',
                COMPANY_NAME: 'Texon Towel',
                SENDER_NAME: userName,
                ORDER_REFERENCE: emailOrderData.reference || '',
                INVOICE_NUMBER: emailOrderData.invoiceNumber || '',
                TOTAL_AMOUNT: '$' + (emailOrderData.totalAmount || 0).toFixed(2),
                TOTAL_PAID: '$' + (emailOrderData.totalPaid || 0).toFixed(2),
                AMOUNT_DUE: '$' + (emailOrderData.amountDue || 0).toFixed(2),
                PAYMENT_STATUS: emailOrderData.amountDue > 0 ? 'PARTIALLY PAID' : 'PAID IN FULL',
                PAYMENT_HISTORY: formatPaymentHistory(emailOrderData.payments),
                DAYS_OUTSTANDING: emailOrderData.daysOutstanding || '',
                PAYMENT_LINK: emailOrderData.paymentLink || ''
            };

            // Process templates
            const processedSubject = this.emailService.replaceTemplateVariables(
                templateResult.template.subject_template, 
                templateVars
            );
            const processedBody = this.emailService.replaceTemplateVariables(
                templateResult.template.body_template, 
                templateVars
            );

            res.json({
                success: true,
                subject: processedSubject,
                body: processedBody,
                recipientEmail: orderData.billingContact?.email || orderData.customer?.email || '',
                orderData: emailOrderData
            });

        } catch (error) {
            console.error('❌ Error getting email preview:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to generate email preview',
                details: error.message 
            });
        }
    }

    /**
     * Test email configuration
     * POST /api/test-email
     */
    async testEmailConfig(req, res) {
        try {
            const userId = req.user?.userId;
            const userName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || 'User';

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Get user's email settings
            const settings = await this.emailService.getUserEmailSettings(userId);
            if (!settings.success) {
                return res.status(400).json({ error: 'No email configuration found' });
            }

            const userEmail = settings.settings.email_address;

            // Send a test email
            const emailResult = await this.emailService.sendEmail({
                userId: userId,
                orderId: 0, // Test order
                recipientEmail: userEmail,
                emailType: 'test',
                customSubject: 'Test Email - Texon Invoicing Portal',
                customBody: `Hello ${userName},

This is a test email to verify your email configuration is working correctly.

If you received this email, your Gmail settings are properly configured and you can now send invoice and reminder emails through the Texon Invoicing Portal.

Best regards,
Texon Invoicing Portal`,
                attachments: [],
                orderData: {},
                senderName: userName
            });

            if (emailResult.success) {
                res.json({ 
                    success: true, 
                    message: 'Test email sent successfully to ' + userEmail 
                });
            } else {
                res.status(500).json({ error: emailResult.error });
            }

        } catch (error) {
            console.error('❌ Error sending test email:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get all email templates
     * GET /api/email-templates
     */
    async getAllEmailTemplates(req, res) {
        try {
            const { data, error } = await this.emailService.supabase
                .from('email_templates')
                .select('*')
                .eq('is_active', true)
                .order('template_name');

            if (error) {
                throw error;
            }

            res.json(data);
        } catch (error) {
            console.error('❌ Error getting email templates:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = EmailController;