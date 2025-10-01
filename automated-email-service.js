const { createClient } = require('@supabase/supabase-js');
const EmailService = require('./email-service');
const SafetyMechanisms = require('./safety-mechanisms');
const EnhancedPDFService = require('./enhanced-pdf-service');

/**
 * Automated Email Service for overdue invoice notifications
 * Handles scheduling and sending of automated reminder emails based on tax_date
 */
class AutomatedEmailService {
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

        // Brightpearl data database connection (using existing env var names)
        this.supabaseBrightpearl = createClient(
            process.env.BRIGHTPEARL_DATA_SUPABASE_URL,
            process.env.BRIGHTPEARL_DATA_SUPABASE_SERVICE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        this.emailService = new EmailService();
        this.safetyMechanisms = new SafetyMechanisms();
        this.enhancedPdfService = new EnhancedPDFService();
        console.log('✅ Automated Email Service initialized');
    }

    /**
     * Main automation runner - analyzes all overdue invoices and schedules emails
     */
    async runAutomation(triggeredBy = 'scheduler', testMode = false) {
        let logId;

        try {
            // Check for global test mode override for automated runs
            if (triggeredBy === 'scheduler' || triggeredBy === 'automatic') {
                const globalTestMode = await this.getGlobalTestMode();
                if (globalTestMode) {
                    testMode = true;
                    console.log('🧪 Global test mode enabled - forcing test mode for automated run');
                }
            }

            console.log(`🚀 Starting automated email run (${triggeredBy})${testMode ? ' [TEST MODE]' : ''}`);

            // Validate automation run with safety checks
            const validation = await this.safetyMechanisms.validateAutomationRun(testMode);

            if (!validation.isValid) {
                console.error('❌ Automation run blocked by safety mechanisms:');
                validation.issues.forEach(issue => console.error(`   - ${issue}`));

                return {
                    success: false,
                    error: 'Automation blocked by safety mechanisms',
                    issues: validation.issues
                };
            }

            if (validation.warnings.length > 0) {
                console.warn('⚠️ Automation warnings:');
                validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
            }

            // Start automation log
            logId = await this.createAutomationLog(triggeredBy);

            // Get active campaigns
            const campaigns = await this.getActiveCampaigns();
            if (!campaigns.length) {
                console.log('⚠️ No active email campaigns found');
                await this.updateAutomationLog(logId, 'completed', 0, 0, 0, 0, 0);
                return { success: true, message: 'No active campaigns' };
            }

            console.log(`📋 Found ${campaigns.length} active campaigns`);

            let totalProcessed = 0;
            let totalScheduled = 0;
            let totalSent = 0;
            let totalFailed = 0;
            let totalSkipped = 0;

            // Process each campaign
            for (const campaign of campaigns) {
                console.log(`\n📧 Processing campaign: ${campaign.campaign_name} (${campaign.trigger_days} days)`);

                const result = await this.processCampaign(campaign, testMode);

                totalProcessed += result.processed;
                totalScheduled += result.scheduled;
                totalSent += result.sent;
                totalFailed += result.failed;
                totalSkipped += result.skipped;
            }

            // Process scheduled emails (send any pending emails due today)
            console.log('\n📬 Processing scheduled emails for today...');
            const scheduleResult = await this.processScheduledEmails(testMode);

            totalSent += scheduleResult.sent;
            totalFailed += scheduleResult.failed;
            totalSkipped += scheduleResult.skipped;

            // Clean up test emails if in test mode
            if (testMode) {
                await this.cleanupTestEmails();
                console.log('🧹 Test emails cleaned up');
            }

            // Complete automation log
            await this.updateAutomationLog(
                logId,
                'completed',
                totalProcessed,
                totalScheduled,
                totalSent,
                totalFailed,
                totalSkipped
            );

            console.log(`\n✅ Automation completed successfully:`);
            console.log(`   Orders processed: ${totalProcessed}`);
            console.log(`   Emails scheduled: ${totalScheduled}`);
            console.log(`   Emails sent: ${totalSent}`);
            console.log(`   Emails failed: ${totalFailed}`);
            console.log(`   Emails skipped: ${totalSkipped}`);

            return {
                success: true,
                summary: {
                    ordersProcessed: totalProcessed,
                    emailsScheduled: totalScheduled,
                    emailsSent: totalSent,
                    emailsFailed: totalFailed,
                    emailsSkipped: totalSkipped
                }
            };

        } catch (error) {
            console.error('❌ Automation run failed:', error);

            if (logId) {
                await this.updateAutomationLog(logId, 'failed', 0, 0, 0, 0, 0, 1, error.message);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process a specific campaign - find eligible invoices and schedule emails
     */
    async processCampaign(campaign, testMode = false) {
        try {
            console.log(`   📅 Looking for invoices eligible for ${campaign.campaign_name}`);

            // Find eligible overdue invoices using days_outstanding filter
            const { data: overdueInvoices, error } = await this.supabase
                .from('cached_invoices')
                .select(`
                    id,
                    order_reference,
                    invoice_number,
                    tax_date,
                    total_amount,
                    paid_amount,
                    outstanding_amount,
                    billing_contact_email,
                    billing_contact_name,
                    billing_company_name,
                    days_outstanding
                `)
                .gte('days_outstanding', 30) // Only overdue invoices (30+ days)
                .gt('outstanding_amount', 0) // Only invoices with outstanding balance
                .not('billing_contact_email', 'is', null) // Must have email
                .order('days_outstanding', { ascending: true });

            if (error) throw error;

            console.log(`   📊 Found ${overdueInvoices?.length || 0} potentially eligible invoices`);

            if (!overdueInvoices?.length) {
                return { processed: 0, scheduled: 0, sent: 0, failed: 0, skipped: 0 };
            }

            let processed = 0;
            let scheduled = 0;
            let skipped = 0;

            for (const invoice of overdueInvoices) {
                processed++;

                // Use the pre-calculated days_outstanding field instead of recalculating
                const daysOutstanding = invoice.days_outstanding;

                // Check if this invoice is in the right range for this campaign
                const isEligible = this.isInvoiceEligibleForCampaign(daysOutstanding, campaign);

                if (!isEligible) {
                    skipped++;
                    continue;
                }

                // Check if email already scheduled/sent for this campaign
                const alreadyScheduled = await this.isEmailAlreadyScheduled(
                    campaign.id,
                    invoice.id,
                    campaign.send_frequency === 'recurring' ? daysOutstanding : null
                );

                if (alreadyScheduled) {
                    console.log(`   ⏭️  Skipping order ${invoice.order_reference} - already scheduled`);
                    skipped++;
                    continue;
                }

                // Check customer opt-out preferences
                const isOptedOut = await this.isCustomerOptedOut(invoice.billing_contact_email);
                if (isOptedOut) {
                    console.log(`   🚫 Skipping order ${invoice.order_reference} - customer opted out`);
                    await this.scheduleEmail({
                        campaignId: campaign.id,
                        orderId: invoice.id,
                        recipientEmail: invoice.billing_contact_email,
                        scheduledDate: new Date(),
                        status: 'skipped',
                        skipReason: 'customer_opted_out',
                        isTest: testMode
                    });
                    skipped++;
                    continue;
                }

                // Schedule the email
                const scheduleDate = new Date(); // Send today
                await this.scheduleEmail({
                    campaignId: campaign.id,
                    orderId: invoice.id,
                    recipientEmail: invoice.billing_contact_email,
                    scheduledDate: scheduleDate,
                    isTest: testMode
                });

                console.log(`   📧 Scheduled email for order ${invoice.order_reference} (${daysOutstanding} days overdue)`);
                scheduled++;

                // If in test mode, limit to 5 emails per campaign
                if (testMode && scheduled >= 5) {
                    console.log(`   🧪 Test mode: limiting to ${scheduled} emails for this campaign`);
                    break;
                }
            }

            return { processed, scheduled, sent: 0, failed: 0, skipped };

        } catch (error) {
            console.error(`❌ Error processing campaign ${campaign.campaign_name}:`, error);
            throw error;
        }
    }

    /**
     * Check if an invoice is eligible for a specific campaign based on days outstanding
     */
    isInvoiceEligibleForCampaign(daysOutstanding, campaign) {
        switch (campaign.campaign_type) {
            case 'overdue_31_60':
                return daysOutstanding >= 30 && daysOutstanding <= 60;

            case 'overdue_61_90':
                return daysOutstanding >= 60 && daysOutstanding <= 90;

            case 'overdue_91_plus':
                return daysOutstanding >= 90 && campaign.send_frequency === 'once';

            case 'overdue_91_plus_recurring':
                // For recurring 91+ day emails, send every 10 days starting at day 101
                if (daysOutstanding < 101) return false;
                const daysSince91 = daysOutstanding - 91;
                return daysSince91 % (campaign.recurring_interval_days || 10) === 0;

            default:
                return false;
        }
    }

    /**
     * Process scheduled emails that are due today
     */
    async processScheduledEmails(testMode = false) {
        try {
            const today = new Date().toISOString().split('T')[0];

            // Get all pending emails scheduled for today (only test emails in test mode, only real emails in production)
            let query = this.supabase
                .from('automated_email_schedule')
                .select(`
                    *,
                    automated_email_campaigns!inner (
                        campaign_name,
                        template_type
                    )
                `)
                .eq('scheduled_date', today)
                .eq('status', 'pending')
                .lt('attempt_count', 3) // Don't retry more than 3 times
                .eq('is_test', testMode) // Only get test emails in test mode, only real emails in production mode
                .order('created_at', { ascending: true });

            const { data: scheduledEmails, error } = await query;

            if (error) throw error;

            console.log(`📬 Found ${scheduledEmails?.length || 0} emails scheduled for today`);

            if (!scheduledEmails?.length) {
                return { sent: 0, failed: 0, skipped: 0 };
            }

            let sent = 0;
            let failed = 0;
            let skipped = 0;

            // Get a default user for sending emails (you may want to make this configurable)
            const defaultUser = await this.getDefaultEmailUser();
            if (!defaultUser) {
                console.error('❌ No default email user configured for automated emails');
                return { sent: 0, failed: scheduledEmails.length, skipped: 0 };
            }

            for (const scheduledEmail of scheduledEmails) {
                try {
                    // Update attempt count
                    await this.updateScheduledEmailAttempt(scheduledEmail.id);

                    // Get invoice data for email variables
                    const invoiceData = await this.getInvoiceData(scheduledEmail.order_id);
                    if (!invoiceData) {
                        console.log(`⚠️ Invoice data not found for order ${scheduledEmail.order_id}`);
                        await this.updateScheduledEmailStatus(scheduledEmail.id, 'skipped', 'invoice_not_found');
                        skipped++;
                        continue;
                    }

                    // Check if invoice is still outstanding
                    if (invoiceData.outstanding_amount <= 0) {
                        console.log(`💰 Invoice ${invoiceData.order_reference} has been paid - skipping email`);
                        await this.updateScheduledEmailStatus(scheduledEmail.id, 'skipped', 'invoice_paid');
                        skipped++;
                        continue;
                    }

                    // Check if customer has opted out (check before sending, not just during scheduling)
                    console.log(`🔍 Checking opt-out status for ${scheduledEmail.recipient_email}...`);
                    const isOptedOut = await this.isCustomerOptedOut(scheduledEmail.recipient_email);
                    console.log(`   Opted out: ${isOptedOut}`);
                    if (isOptedOut) {
                        console.log(`🚫 Skipping order ${invoiceData.order_reference} - customer opted out after scheduling`);
                        await this.updateScheduledEmailStatus(scheduledEmail.id, 'skipped', 'customer_opted_out');
                        skipped++;
                        continue;
                    }

                    // Check if global test mode is enabled and get global test email
                    const globalTestMode = await this.getGlobalTestMode();
                    const globalTestEmail = globalTestMode ? await this.getGlobalTestEmail() : null;

                    // Determine recipient email (use global test email if global test mode is enabled)
                    const recipientEmail = globalTestMode && globalTestEmail ?
                        globalTestEmail :
                        scheduledEmail.recipient_email;

                    // Log if global test mode is redirecting emails
                    if (globalTestMode && globalTestEmail && recipientEmail !== scheduledEmail.recipient_email) {
                        console.log(`🧪 Global test mode: redirecting email from ${scheduledEmail.recipient_email} to ${recipientEmail}`);

                        // ALSO check if the test email recipient has opted out
                        console.log(`🔍 Checking opt-out status for test recipient ${recipientEmail}...`);
                        const testRecipientOptedOut = await this.isCustomerOptedOut(recipientEmail);
                        console.log(`   Test recipient opted out: ${testRecipientOptedOut}`);
                        if (testRecipientOptedOut) {
                            console.log(`🚫 Skipping order ${invoiceData.order_reference} - test recipient opted out`);
                            await this.updateScheduledEmailStatus(scheduledEmail.id, 'skipped', 'test_recipient_opted_out');
                            skipped++;
                            continue;
                        }
                    }

                    // Generate PDF attachment for the invoice
                    console.log(`📄 Generating PDF invoice for automated email...`);
                    const pdfOrderData = {
                        id: scheduledEmail.order_id,
                        customerName: invoiceData.billing_contact_name,
                        reference: invoiceData.order_reference,
                        invoiceNumber: invoiceData.invoice_number,
                        totalAmount: invoiceData.total_amount,
                        totalPaid: invoiceData.paid_amount,
                        amountDue: invoiceData.outstanding_amount,
                        daysOutstanding: invoiceData.days_outstanding,
                        taxDate: new Date(invoiceData.tax_date).toLocaleDateString(),
                        payments: [], // You may want to fetch payment history
                        paymentLink: invoiceData.payment_link_url || ''
                    };

                    let attachments = [];
                    try {
                        const pdfResult = await this.enhancedPdfService.generateInvoicePDF(pdfOrderData);
                        if (pdfResult.success) {
                            attachments = [
                                this.enhancedPdfService.createEmailAttachment(pdfResult.buffer, pdfResult.filename)
                            ];
                            console.log(`✅ PDF generated successfully: ${pdfResult.filename}`);
                        } else {
                            console.log(`⚠️ PDF generation failed: ${pdfResult.error}`);
                            // Continue without attachment if PDF generation fails
                        }
                    } catch (pdfError) {
                        console.log(`❌ PDF generation error:`, pdfError);
                        // Continue without attachment if PDF generation fails
                    }

                    // Send the email (bypass personal test mode if global test mode is active)
                    const emailResult = await this.emailService.sendEmail({
                        userId: defaultUser.id,
                        orderId: scheduledEmail.order_id,
                        recipientEmail: recipientEmail,
                        emailType: scheduledEmail.automated_email_campaigns.template_type,
                        orderData: pdfOrderData,
                        attachments: attachments,
                        senderName: defaultUser.first_name ? `${defaultUser.first_name} ${defaultUser.last_name}` : 'Texon Towel',
                        bypassPersonalTestMode: globalTestMode  // Bypass personal test mode when global test mode is active
                    });

                    if (emailResult.success) {
                        // Update scheduled email as sent
                        await this.updateScheduledEmailStatus(
                            scheduledEmail.id,
                            'sent',
                            null,
                            new Date(),
                            emailResult.logId
                        );

                        console.log(`✅ Sent automated email for order ${invoiceData.order_reference}`);
                        sent++;
                    } else {
                        throw new Error(emailResult.error);
                    }

                    // If in test mode, limit sends
                    if (testMode && sent >= 5) {
                        console.log(`🧪 Test mode: limiting to ${sent} sent emails`);
                        break;
                    }

                } catch (emailError) {
                    console.error(`❌ Failed to send scheduled email ${scheduledEmail.id}:`, emailError);

                    await this.updateScheduledEmailStatus(
                        scheduledEmail.id,
                        'failed',
                        null,
                        null,
                        null,
                        emailError.message
                    );
                    failed++;
                }
            }

            return { sent, failed, skipped };

        } catch (error) {
            console.error('❌ Error processing scheduled emails:', error);
            throw error;
        }
    }

    /**
     * Get active email campaigns
     */
    async getActiveCampaigns() {
        const { data, error } = await this.supabase
            .from('automated_email_campaigns')
            .select('*')
            .eq('is_active', true)
            .order('trigger_days', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Create automation log entry
     */
    async createAutomationLog(triggeredBy) {
        const { data, error } = await this.supabase
            .from('email_automation_logs')
            .insert({
                triggered_by: triggeredBy,
                status: 'running'
            })
            .select('id')
            .single();

        if (error) throw error;
        return data.id;
    }

    /**
     * Update automation log
     */
    async updateAutomationLog(logId, status, processed = 0, scheduled = 0, sent = 0, failed = 0, skipped = 0, errors = 0, errorDetails = null) {
        const { error } = await this.supabase
            .from('email_automation_logs')
            .update({
                run_completed_at: new Date().toISOString(),
                total_orders_processed: processed,
                emails_scheduled: scheduled,
                emails_sent: sent,
                emails_failed: failed,
                emails_skipped: skipped,
                errors_encountered: errors,
                error_details: errorDetails,
                status: status
            })
            .eq('id', logId);

        if (error) throw error;
    }

    /**
     * Check if email is already scheduled for a campaign/order combination
     * Excludes test emails from the check
     */
    async isEmailAlreadyScheduled(campaignId, orderId, daysOutstanding = null) {
        let query = this.supabase
            .from('automated_email_schedule')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('order_id', orderId)
            .in('status', ['pending', 'sent'])
            .eq('is_test', false); // Exclude test emails

        // For recurring campaigns, check if we already sent for this specific day range
        if (daysOutstanding !== null) {
            const scheduledDate = new Date().toISOString().split('T')[0];
            query = query.eq('scheduled_date', scheduledDate);
        }

        const { data, error } = await query.limit(1);

        if (error) throw error;
        return data && data.length > 0;
    }

    /**
     * Check if customer has opted out of automated emails
     */
    async isCustomerOptedOut(email) {
        const { data, error } = await this.supabase
            .from('customer_email_preferences')
            .select('opted_out_all, opted_out_reminders')
            .eq('email_address', email.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data) return false;
        return data.opted_out_all || data.opted_out_reminders;
    }

    /**
     * Schedule an email
     */
    async scheduleEmail({ campaignId, orderId, recipientEmail, scheduledDate, status = 'pending', skipReason = null, isTest = false }) {
        const { error } = await this.supabase
            .from('automated_email_schedule')
            .insert({
                campaign_id: campaignId,
                order_id: orderId,
                recipient_email: recipientEmail.toLowerCase(),
                scheduled_date: scheduledDate.toISOString().split('T')[0],
                status: status,
                skip_reason: skipReason,
                is_test: isTest
            });

        if (error) throw error;
    }

    /**
     * Update scheduled email attempt count
     */
    async updateScheduledEmailAttempt(scheduleId) {
        // First, get the current attempt count
        const { data: currentData, error: fetchError } = await this.supabase
            .from('automated_email_schedule')
            .select('attempt_count')
            .eq('id', scheduleId)
            .single();

        if (fetchError) throw fetchError;

        // Then increment it
        const { error } = await this.supabase
            .from('automated_email_schedule')
            .update({
                attempt_count: (currentData?.attempt_count || 0) + 1,
                last_attempt_at: new Date().toISOString()
            })
            .eq('id', scheduleId);

        if (error) throw error;
    }

    /**
     * Update scheduled email status
     */
    async updateScheduledEmailStatus(scheduleId, status, skipReason = null, sentAt = null, emailLogId = null, errorMessage = null) {
        const updateData = {
            status: status,
            updated_at: new Date().toISOString()
        };

        if (skipReason) updateData.skip_reason = skipReason;
        if (sentAt) updateData.sent_at = sentAt.toISOString();
        if (emailLogId) updateData.email_log_id = emailLogId;
        if (errorMessage) updateData.error_message = errorMessage;

        const { error } = await this.supabase
            .from('automated_email_schedule')
            .update(updateData)
            .eq('id', scheduleId);

        if (error) throw error;
    }

    /**
     * Get invoice data for email variables
     */
    async getInvoiceData(orderId) {
        const { data, error } = await this.supabase
            .from('cached_invoices')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * Get default user for sending automated emails
     * First checks for a configured default sender in app_settings
     * Falls back to the first active user who has email settings configured
     */
    async getDefaultEmailUser() {
        try {
            // Check for configured default sender email
            const { data: settingData, error: settingError } = await this.supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'automation_sender_email')
                .single();

            if (!settingError && settingData?.value) {
                // Find user by email address in their email settings
                const { data: userData, error: userError } = await this.supabase
                    .from('app_users')
                    .select(`
                        id,
                        first_name,
                        last_name,
                        email,
                        user_email_settings!inner(id, email_address, google_app_password)
                    `)
                    .eq('is_active', true)
                    .eq('user_email_settings.email_address', settingData.value)
                    .not('user_email_settings.google_app_password', 'is', null)
                    .limit(1)
                    .single();

                if (!userError && userData) {
                    console.log(`📧 Using configured automation sender: ${settingData.value}`);
                    return userData;
                }
            }

            // Fallback to first active user with email settings
            const { data, error } = await this.supabase
                .from('app_users')
                .select(`
                    id,
                    first_name,
                    last_name,
                    email,
                    user_email_settings!inner(id, email_address, google_app_password)
                `)
                .eq('is_active', true)
                .not('user_email_settings.google_app_password', 'is', null)
                .limit(1)
                .single();

            if (error) {
                console.error('❌ Error getting default email user:', error);
                return null;
            }

            console.log(`📧 Using default automation sender: ${data.user_email_settings[0]?.email_address}`);
            return data;
        } catch (error) {
            console.error('❌ Error in getDefaultEmailUser:', error);
            return null;
        }
    }

    /**
     * Get global automation test mode setting
     */
    async getGlobalTestMode() {
        try {
            const { data, error } = await this.supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'automation_global_test_mode')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.value === 'true';
        } catch (error) {
            console.error('❌ Error getting global test mode:', error);
            return false; // Default to false if can't determine
        }
    }

    /**
     * Set global automation test mode setting
     */
    async setGlobalTestMode(enabled) {
        try {
            const { error } = await this.supabase
                .from('app_settings')
                .upsert({
                    key: 'automation_global_test_mode',
                    value: String(enabled),
                    category: 'automation'
                }, {
                    onConflict: 'key'
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Error setting global test mode:', error);
            return false;
        }
    }

    async getGlobalTestEmail() {
        try {
            const { data, error } = await this.supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'automation_global_test_email')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data?.value || '';
        } catch (error) {
            console.error('❌ Error getting global test email:', error);
            return '';
        }
    }

    async setGlobalTestEmail(email) {
        try {
            const { error } = await this.supabase
                .from('app_settings')
                .upsert({
                    key: 'automation_global_test_email',
                    value: email,
                    category: 'automation'
                }, {
                    onConflict: 'key'
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Error setting global test email:', error);
            return false;
        }
    }

    /**
     * Get automation statistics
     */
    async getAutomationStats(days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from('email_automation_logs')
            .select('*')
            .gte('run_started_at', startDate.toISOString())
            .order('run_started_at', { ascending: false });

        if (error) throw error;

        const stats = {
            totalRuns: data.length,
            successfulRuns: data.filter(log => log.status === 'completed').length,
            failedRuns: data.filter(log => log.status === 'failed').length,
            totalEmailsSent: data.reduce((sum, log) => sum + (log.emails_sent || 0), 0),
            totalEmailsFailed: data.reduce((sum, log) => sum + (log.emails_failed || 0), 0),
            totalEmailsScheduled: data.reduce((sum, log) => sum + (log.emails_scheduled || 0), 0),
            // Add frontend-expected field names
            successfulEmails: data.reduce((sum, log) => sum + (log.emails_sent || 0), 0),
            failedEmails: data.reduce((sum, log) => sum + (log.emails_failed || 0), 0),
            automationRuns: data.length,
            uniqueCustomers: 0, // TODO: Calculate from scheduled emails if needed
            recentLogs: data.slice(0, 10)
        };

        return stats;
    }

    /**
     * Clean up test emails (delete all test emails from the schedule)
     */
    async cleanupTestEmails() {
        const { error } = await this.supabase
            .from('automated_email_schedule')
            .delete()
            .eq('is_test', true);

        if (error) {
            console.error('❌ Error cleaning up test emails:', error);
            throw error;
        }
    }

    /**
     * Replace template variables with actual values
     */
    replaceTemplateVariables(template, variables) {
        if (!template) return '';

        let result = template;
        Object.keys(variables).forEach(key => {
            // Handle both {KEY} and {{KEY}} formats
            const singleBracePlaceholder = `{${key}}`;
            const doubleBracePlaceholder = `{{${key}}}`;
            const value = variables[key] || '';

            result = result.replace(new RegExp(singleBracePlaceholder.replace(/[{}]/g, '\\$&'), 'g'), value);
            result = result.replace(new RegExp(doubleBracePlaceholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        });

        return result;
    }



    /**
     * Check if customer is opted out
     */
    async isCustomerOptedOut(emailAddress) {
        if (!emailAddress) return true;

        const { data, error } = await this.supabase
            .from('customer_email_preferences')
            .select('*')
            .eq('email_address', emailAddress.toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') { // Not found is ok
            throw error;
        }

        if (!data) return false; // No record means not opted out

        // Check if opted out of all emails or relevant type
        return data.opted_out_all || data.opted_out_reminders || data.opted_out_collections;
    }
}

module.exports = AutomatedEmailService;