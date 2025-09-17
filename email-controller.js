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

            // 2. Generate/get payment link
            let paymentLink = null;
            const paymentLinkResult = await this.paymentLinksService.generatePaymentLink(orderId);
            if (paymentLinkResult.success) {
                paymentLink = paymentLinkResult.data.paymentLink;
            }

            // 3. Prepare order data for PDF
            const pdfOrderData = {
                ...orderData,
                paymentLink: paymentLink,
                customerName: orderData.billingContact?.name || orderData.customer?.name || orderData.customerName,
                invoiceNumber: orderData.invoiceReference || `ORDER-${orderId}`,
                totalAmount: orderData.totalAmount || orderData.total,
                orderDate: orderData.orderDate,
                orderRef: orderData.orderRef
            };

            // 4. Generate PDF using Enhanced PDF Service with Brightpearl template
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
            const emailResult = await this.emailService.sendEmail({
                userId: userId,
                orderId: orderId,
                recipientEmail: to,
                emailType: emailType,
                customSubject: subject,
                customBody: body,
                attachments: attachments,
                orderData: {
                    ...pdfOrderData,
                    paymentLink: paymentLink
                },
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