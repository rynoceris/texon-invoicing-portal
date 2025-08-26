const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

/**
 * Email Service for sending invoice and reminder emails
 * Uses Gmail SMTP with user-configured credentials
 */
class EmailService {
    constructor() {
        // App database connection
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        this.encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || 'default-key-change-in-production';
        console.log('✅ Email Service initialized');
    }

    /**
     * Encrypt sensitive data (Google App Passwords)
     */
    encrypt(text) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Combine IV and encrypted data
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('❌ Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            
            // Split IV and encrypted data
            const textParts = encryptedText.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encrypted = textParts.join(':');
            
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('❌ Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Save or update user's email settings
     */
    async saveUserEmailSettings(userId, emailAddress, googleAppPassword, testMode = true, testModeRecipient = null) {
        try {
            console.log(`💾 Saving email settings for user ${userId}...`);

            // Encrypt the Google App Password
            const encryptedPassword = this.encrypt(googleAppPassword);

            // Set test mode recipient to user's email if not specified
            const finalTestRecipient = testModeRecipient || emailAddress;

            // Check if settings already exist
            const { data: existing } = await this.supabase
                .from('user_email_settings')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (existing) {
                // Update existing settings
                const { error } = await this.supabase
                    .from('user_email_settings')
                    .update({
                        email_address: emailAddress,
                        google_app_password: encryptedPassword,
                        test_mode: testMode,
                        test_mode_recipient: finalTestRecipient,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId);

                if (error) throw error;
                console.log('✅ Email settings updated successfully');
            } else {
                // Insert new settings
                const { error } = await this.supabase
                    .from('user_email_settings')
                    .insert({
                        user_id: userId,
                        email_address: emailAddress,
                        google_app_password: encryptedPassword,
                        test_mode: testMode,
                        test_mode_recipient: finalTestRecipient
                    });

                if (error) throw error;
                console.log('✅ Email settings saved successfully');
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Error saving email settings:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user's email settings
     */
    async getUserEmailSettings(userId) {
        try {
            const { data, error } = await this.supabase
                .from('user_email_settings')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (!data) {
                return { success: false, error: 'No email settings found' };
            }

            // Decrypt the password
            const decryptedPassword = this.decrypt(data.google_app_password);

            return {
                success: true,
                settings: {
                    ...data,
                    google_app_password: decryptedPassword
                }
            };
        } catch (error) {
            console.error('❌ Error getting email settings:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create SMTP transporter for a user
     */
    async createTransporter(userId) {
        const settings = await this.getUserEmailSettings(userId);
        
        if (!settings.success) {
            throw new Error(`No email configuration found for user ${userId}`);
        }

        const config = settings.settings;
        
        return nodemailer.createTransport({
            host: config.smtp_host,
            port: config.smtp_port,
            secure: false, // Use STARTTLS
            auth: {
                user: config.email_address,
                pass: config.google_app_password
            }
        });
    }

    /**
     * Get email template by type
     */
    async getEmailTemplate(templateType = 'invoice') {
        try {
            const { data, error } = await this.supabase
                .from('email_templates')
                .select('*')
                .eq('template_type', templateType)
                .eq('is_active', true)
                .eq('is_default', true)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (!data) {
                // Return basic default template if none found
                return {
                    success: true,
                    template: {
                        subject_template: 'Invoice for Order #{ORDER_ID}',
                        body_template: 'Dear {CUSTOMER_NAME},\\n\\nPlease find attached your invoice.\\n\\nPayment Link: {PAYMENT_LINK}\\n\\nBest regards,\\n{SENDER_NAME}'
                    }
                };
            }

            return { success: true, template: data };
        } catch (error) {
            console.error('❌ Error getting email template:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Replace template variables with actual values
     */
    replaceTemplateVariables(template, variables) {
        let result = template;
        
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{${key.toUpperCase()}}`;
            result = result.replace(new RegExp(placeholder, 'g'), value || '');
        }
        
        return result;
    }

    /**
     * Send email with invoice/reminder
     */
    async sendEmail({
        userId,
        orderId,
        recipientEmail,
        emailType = 'invoice',
        customSubject = null,
        customBody = null,
        attachments = [],
        orderData = {},
        senderName = 'Texon Towel'
    }) {
        let logId;
        
        try {
            console.log(`📧 Sending ${emailType} email for order ${orderId} to ${recipientEmail}...`);

            // Get email template
            const templateResult = await this.getEmailTemplate(emailType);
            if (!templateResult.success) {
                throw new Error('Failed to get email template');
            }

            const template = templateResult.template;

            // Prepare template variables
            const templateVars = {
                ORDER_ID: orderId,
                CUSTOMER_NAME: orderData.customerName || 'Valued Customer',
                COMPANY_NAME: 'Texon Towel',
                SENDER_NAME: senderName,
                ORDER_REFERENCE: orderData.reference || '',
                INVOICE_NUMBER: orderData.invoiceNumber || '',
                TOTAL_AMOUNT: orderData.totalAmount || '',
                DAYS_OUTSTANDING: orderData.daysOutstanding || '',
                PAYMENT_LINK: orderData.paymentLink || ''
            };

            // Replace template variables
            const subject = customSubject || this.replaceTemplateVariables(template.subject_template, templateVars);
            const body = customBody || this.replaceTemplateVariables(template.body_template, templateVars);

            // Get user's email settings and create transporter
            const transporter = await this.createTransporter(userId);
            const userSettings = await this.getUserEmailSettings(userId);
            const senderEmail = userSettings.settings.email_address;
            
            // Handle test mode - redirect emails if enabled
            let finalRecipientEmail = recipientEmail;
            let isTestMode = false;
            
            if (userSettings.settings.test_mode && userSettings.settings.test_mode_recipient) {
                finalRecipientEmail = userSettings.settings.test_mode_recipient;
                isTestMode = true;
                console.log(`🧪 TEST MODE: Email for ${recipientEmail} redirected to ${finalRecipientEmail}`);
            }

            // Modify subject and body if in test mode
            let finalSubject = subject;
            let finalBody = body;
            
            if (isTestMode) {
                finalSubject = `[TEST MODE] ${subject}`;
                finalBody = `🧪 THIS IS A TEST EMAIL 🧪
                
Original recipient: ${recipientEmail}
Test mode is enabled - this email was redirected to you for testing.

================================
ORIGINAL EMAIL CONTENT:
================================

${body}

================================
END OF ORIGINAL CONTENT
================================

To disable test mode, go to your Email Settings and toggle off "Test Mode".`;
            }

            // Prepare email options
            const mailOptions = {
                from: senderEmail,
                to: finalRecipientEmail,
                subject: finalSubject,
                text: finalBody,
                attachments: attachments
            };

            // Log email attempt
            logId = await this.logEmailAttempt({
                userId,
                orderId,
                recipientEmail,
                senderEmail,
                subject,
                body,
                emailType,
                hasAttachments: attachments.length > 0,
                paymentLinkIncluded: !!orderData.paymentLink
            });

            // Send the email
            const info = await transporter.sendMail(mailOptions);
            
            // Update log as successful
            await this.updateEmailLog(logId, 'sent', null, new Date());

            console.log(`✅ Email sent successfully: ${info.messageId}`);
            
            return {
                success: true,
                messageId: info.messageId,
                logId: logId
            };

        } catch (error) {
            console.error(`❌ Failed to send ${emailType} email:`, error);
            
            // Update log as failed if we have a logId
            if (logId) {
                await this.updateEmailLog(logId, 'failed', error.message);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Log email attempt
     */
    async logEmailAttempt(emailData) {
        try {
            const { data, error } = await this.supabase
                .from('email_logs')
                .insert({
                    user_id: emailData.userId,
                    order_id: emailData.orderId,
                    recipient_email: emailData.recipientEmail,
                    sender_email: emailData.senderEmail,
                    subject: emailData.subject,
                    body: emailData.body,
                    email_type: emailData.emailType,
                    has_pdf_attachment: emailData.hasAttachments,
                    payment_link_included: emailData.paymentLinkIncluded,
                    payment_link: emailData.paymentLink || null,
                    send_status: 'pending'
                })
                .select('id')
                .single();

            if (error) throw error;
            
            return data.id;
        } catch (error) {
            console.error('❌ Error logging email attempt:', error);
            return null;
        }
    }

    /**
     * Update email log status
     */
    async updateEmailLog(logId, status, errorMessage = null, sentAt = null) {
        try {
            const updateData = {
                send_status: status,
                updated_at: new Date().toISOString()
            };

            if (errorMessage) updateData.error_message = errorMessage;
            if (sentAt) updateData.sent_at = sentAt.toISOString();

            const { error } = await this.supabase
                .from('email_logs')
                .update(updateData)
                .eq('id', logId);

            if (error) throw error;
        } catch (error) {
            console.error('❌ Error updating email log:', error);
        }
    }

    /**
     * Get email logs for an order
     */
    async getEmailLogsForOrder(orderId) {
        try {
            const { data, error } = await this.supabase
                .from('email_logs')
                .select(`
                    *,
                    app_users!inner(first_name, last_name, email)
                `)
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, logs: data };
        } catch (error) {
            console.error('❌ Error getting email logs:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get recent email logs for a user
     */
    async getRecentEmailLogs(userId, limit = 50) {
        try {
            const { data, error } = await this.supabase
                .from('email_logs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return { success: true, logs: data };
        } catch (error) {
            console.error('❌ Error getting recent email logs:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;