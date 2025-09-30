const AutomatedEmailService = require('./automated-email-service');
const EnhancedPDFService = require('./enhanced-pdf-service');

/**
 * Automated Email Controller - Handles API endpoints for automated email system
 */
class AutomatedEmailController {
    constructor() {
        this.automatedEmailService = new AutomatedEmailService();
        this.enhancedPdfService = new EnhancedPDFService();
        console.log('✅ Automated Email Controller initialized');
    }

    /**
     * Run email automation manually
     * POST /api/automated-emails/run
     */
    async runAutomation(req, res) {
        try {
            const { testMode = false } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            console.log(`🚀 Manual automation run triggered by user ${userId}${testMode ? ' [TEST MODE]' : ''}`);

            const result = await this.automatedEmailService.runAutomation('manual', testMode);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Automation completed successfully',
                    summary: result.summary
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Error in manual automation run:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get automation statistics
     * GET /api/automated-emails/stats
     */
    async getAutomationStats(req, res) {
        try {
            const { days = 30 } = req.query;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const stats = await this.automatedEmailService.getAutomationStats(parseInt(days));

            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            console.error('❌ Error getting automation stats:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get active email campaigns
     * GET /api/automated-emails/campaigns
     */
    async getCampaigns(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Get all campaigns for settings management
            const { data: campaigns, error } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .select('*')
                .order('trigger_days', { ascending: true });

            if (error) throw error;

            res.json({
                success: true,
                campaigns: campaigns || []
            });
        } catch (error) {
            console.error('❌ Error getting campaigns:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get scheduled emails
     * GET /api/automated-emails/scheduled
     */
    async getScheduledEmails(req, res) {
        try {
            const { limit = 50, status = 'all', days = 7 } = req.query;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            let query = this.automatedEmailService.supabase
                .from('automated_email_schedule')
                .select(`
                    *,
                    automated_email_campaigns!inner (
                        campaign_name,
                        campaign_type,
                        template_type
                    )
                `)
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false })
                .limit(parseInt(limit));

            if (status !== 'all') {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json({
                success: true,
                scheduledEmails: data || []
            });
        } catch (error) {
            console.error('❌ Error getting scheduled emails:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get automation logs
     * GET /api/automated-emails/logs
     */
    async getAutomationLogs(req, res) {
        try {
            const { limit = 20 } = req.query;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { data, error } = await this.automatedEmailService.supabase
                .from('email_automation_logs')
                .select('*')
                .order('run_started_at', { ascending: false })
                .limit(parseInt(limit));

            if (error) throw error;

            res.json({
                success: true,
                logs: data || []
            });
        } catch (error) {
            console.error('❌ Error getting automation logs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Update campaign status (enable/disable)
     * PUT /api/automated-emails/campaigns/:id
     */
    async updateCampaign(req, res) {
        try {
            const { id } = req.params;
            const { is_active } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (typeof is_active !== 'boolean') {
                return res.status(400).json({ error: 'is_active must be a boolean' });
            }

            const { data, error } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .update({
                    is_active: is_active,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            console.log(`📧 Campaign "${data.campaign_name}" ${is_active ? 'enabled' : 'disabled'} by user ${userId}`);

            res.json({
                success: true,
                message: `Campaign ${is_active ? 'enabled' : 'disabled'} successfully`,
                campaign: data
            });
        } catch (error) {
            console.error('❌ Error updating campaign:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Add customer to opt-out list
     * POST /api/automated-emails/opt-out
     */
    async addOptOut(req, res) {
        try {
            const { email_address, opt_out_type = 'reminders', reason } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!email_address) {
                return res.status(400).json({ error: 'Email address is required' });
            }

            const updateData = {
                email_address: email_address.toLowerCase(),
                opt_out_date: new Date().toISOString(),
                opt_out_reason: reason || 'Manual opt-out'
            };

            // Set the appropriate opt-out flags
            if (opt_out_type === 'all') {
                updateData.opted_out_all = true;
                updateData.opted_out_reminders = true;
                updateData.opted_out_collections = true;
            } else if (opt_out_type === 'reminders') {
                updateData.opted_out_reminders = true;
            } else if (opt_out_type === 'collections') {
                updateData.opted_out_collections = true;
            }

            const { data, error } = await this.automatedEmailService.supabase
                .from('customer_email_preferences')
                .upsert(updateData, { onConflict: 'email_address' })
                .select()
                .single();

            if (error) throw error;

            console.log(`🚫 Customer ${email_address} opted out of ${opt_out_type} emails by user ${userId}`);

            res.json({
                success: true,
                message: 'Customer opted out successfully',
                preferences: data
            });
        } catch (error) {
            console.error('❌ Error adding opt-out:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Remove customer from opt-out list
     * DELETE /api/automated-emails/opt-out
     */
    async removeOptOut(req, res) {
        try {
            const { email_address } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!email_address) {
                return res.status(400).json({ error: 'Email address is required' });
            }

            const { error } = await this.automatedEmailService.supabase
                .from('customer_email_preferences')
                .delete()
                .eq('email_address', email_address.toLowerCase());

            if (error) throw error;

            console.log(`✅ Customer ${email_address} removed from opt-out list by user ${userId}`);

            res.json({
                success: true,
                message: 'Customer removed from opt-out list successfully'
            });
        } catch (error) {
            console.error('❌ Error removing opt-out:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get opt-out list
     * GET /api/automated-emails/opt-outs
     */
    async getOptOuts(req, res) {
        try {
            const { limit = 50 } = req.query;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { data, error } = await this.automatedEmailService.supabase
                .from('customer_email_preferences')
                .select('*')
                .order('opt_out_date', { ascending: false })
                .limit(parseInt(limit));

            if (error) throw error;

            res.json({
                success: true,
                optOuts: data || []
            });
        } catch (error) {
            console.error('❌ Error getting opt-outs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Preview what emails would be sent by automation
     * GET /api/automated-emails/preview
     */
    async previewAutomation(req, res) {
        try {
            console.log('🔍 Preview automation called');
            const userId = req.user?.userId;

            if (!userId) {
                console.log('❌ Preview: Unauthorized user');
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // This is a dry-run version of the automation that doesn't actually schedule emails
            // For preview, get ALL campaigns regardless of system status (preview shows what WOULD happen)
            const { data: campaigns, error: campaignsError } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .select('*')
                .order('trigger_days', { ascending: true });

            if (campaignsError) throw campaignsError;
            console.log(`📋 Preview: Found ${campaigns?.length || 0} campaigns (regardless of active status)`);
            const preview = [];

            // OPTIMIZATION: Instead of querying for each campaign, get all data once and process in memory
            // Get all overdue invoices (30+ days) in a single query
            const { data: allOverdueInvoices, error: invoiceError } = await this.automatedEmailService.supabase
                .from('cached_invoices')
                .select(`
                    id,
                    order_reference,
                    invoice_number,
                    tax_date,
                    total_amount,
                    outstanding_amount,
                    billing_contact_email,
                    billing_contact_name,
                    days_outstanding
                `)
                .gte('days_outstanding', 30) // Only overdue invoices (30+ days)
                .gt('outstanding_amount', 0)
                .not('billing_contact_email', 'is', null)
                .order('days_outstanding', { ascending: true });

            if (invoiceError) throw invoiceError;

            // Get all scheduled emails in one query (for all campaigns)
            const campaignIds = campaigns.map(c => c.id);
            const { data: scheduledEmails, error: schedError } = await this.automatedEmailService.supabase
                .from('automated_email_schedule')
                .select('campaign_id, order_id, status')
                .in('campaign_id', campaignIds)
                .in('status', ['pending', 'sent']); // Already scheduled or sent

            if (schedError) throw schedError;

            // Get all opted-out customers in one query
            const uniqueEmails = [...new Set(allOverdueInvoices?.map(inv => inv.billing_contact_email) || [])];
            const { data: optedOutCustomers, error: optError } = await this.automatedEmailService.supabase
                .from('customer_email_preferences')
                .select('email_address')
                .in('email_address', uniqueEmails)
                .or('opted_out_all.eq.true,opted_out_reminders.eq.true');

            if (optError) throw optError;

            // Create lookup sets for fast checking
            const scheduledLookup = new Set(
                scheduledEmails?.map(s => `${s.campaign_id}-${s.order_id}`) || []
            );
            const optedOutLookup = new Set(
                optedOutCustomers?.map(c => c.email_address) || []
            );

            // Now process each campaign using the cached data
            for (const campaign of campaigns || []) {
                const eligibleInvoices = [];

                for (const invoice of allOverdueInvoices || []) {
                    const daysOutstanding = invoice.days_outstanding;
                    const isEligible = this.automatedEmailService.isInvoiceEligibleForCampaign(daysOutstanding, campaign);

                    if (isEligible) {
                        const alreadyScheduled = scheduledLookup.has(`${campaign.id}-${invoice.id}`);
                        const isOptedOut = optedOutLookup.has(invoice.billing_contact_email);

                        eligibleInvoices.push({
                            orderId: invoice.id,
                            orderReference: invoice.order_reference,
                            invoiceNumber: invoice.invoice_number,
                            customerName: invoice.billing_contact_name,
                            customerEmail: invoice.billing_contact_email,
                            amountDue: invoice.outstanding_amount,
                            daysOutstanding: daysOutstanding,
                            alreadyScheduled: alreadyScheduled,
                            customerOptedOut: isOptedOut,
                            wouldSend: !alreadyScheduled && !isOptedOut
                        });
                    }
                }

                preview.push({
                    campaign: campaign,
                    eligibleInvoices: eligibleInvoices,
                    totalEligible: eligibleInvoices.length,
                    wouldSend: eligibleInvoices.filter(inv => inv.wouldSend).length
                });
            }

            res.json({
                success: true,
                preview: preview
            });
        } catch (error) {
            console.error('❌ Error generating automation preview:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Update email template for a campaign
     * PUT /api/automated-emails/campaigns/:id/template
     */
    async updateTemplate(req, res) {
        try {
            const { id } = req.params;
            const { subject_template, body_template } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!subject_template || !body_template) {
                return res.status(400).json({ error: 'Subject and body templates are required' });
            }

            const { data, error } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .update({
                    subject_template: subject_template,
                    body_template: body_template,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            console.log(`📝 Template updated for campaign "${data.campaign_name}" by user ${userId}`);

            res.json({
                success: true,
                message: 'Template updated successfully',
                campaign: data
            });
        } catch (error) {
            console.error('❌ Error updating template:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Send test email using campaign template
     * POST /api/automated-emails/campaigns/:id/test
     */
    async sendTestEmail(req, res) {
        try {
            const { id } = req.params;
            const { test_email_address } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!test_email_address) {
                return res.status(400).json({ error: 'Test email address is required' });
            }

            // Get the campaign
            const { data: campaign, error: singleCampaignError } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .select('*')
                .eq('id', id)
                .single();

            if (singleCampaignError) throw singleCampaignError;

            // Find a real invoice that matches this campaign's criteria
            let sampleInvoice;

            // Determine the day range for this campaign
            let minDays, maxDays;
            switch (campaign.campaign_type) {
                case 'overdue_31_60':
                    minDays = 30;
                    maxDays = 60;
                    break;
                case 'overdue_61_90':
                    minDays = 61;
                    maxDays = 90;
                    break;
                case 'overdue_91_plus':
                case 'overdue_91_plus_recurring':
                    minDays = 91;
                    maxDays = 999;
                    break;
                default:
                    minDays = 30;
                    maxDays = 999;
            }

            console.log(`🔍 Test email: Looking for invoice in ${minDays}-${maxDays} day range for campaign "${campaign.campaign_type}"`);

            // First, try to find an invoice in the specific day range for this campaign
            const { data: campaignInvoices, error: invoicesError } = await this.automatedEmailService.supabase
                .from('cached_invoices')
                .select(`
                    id,
                    order_reference,
                    invoice_number,
                    tax_date,
                    total_amount,
                    outstanding_amount,
                    billing_contact_name,
                    billing_contact_email,
                    billing_contact_id,
                    days_outstanding,
                    payment_link_url
                `)
                .gt('outstanding_amount', 0)
                .gte('days_outstanding', minDays)
                .lte('days_outstanding', maxDays)
                .order('days_outstanding', { ascending: true })
                .limit(10);

            if (invoicesError) {
                console.log(`❌ Test email: Error fetching campaign-specific invoices:`, invoicesError);
            }

            console.log(`🔍 Test email: Found ${campaignInvoices?.length || 0} invoices in ${minDays}-${maxDays} day range`);

            if (campaignInvoices && campaignInvoices.length > 0) {
                sampleInvoice = campaignInvoices[0];
                console.log(`🔍 Test email: Using campaign-appropriate invoice ${sampleInvoice.id} (${sampleInvoice.days_outstanding} days) for ${sampleInvoice.billing_contact_name}`);
            } else {
                // Fallback: get any overdue invoice if none in the specific range
                console.log(`🔍 Test email: No invoices in target range, looking for any overdue invoice`);
                const { data: fallbackInvoices, error: fallbackError } = await this.automatedEmailService.supabase
                    .from('cached_invoices')
                    .select(`
                        id,
                        order_reference,
                        invoice_number,
                        tax_date,
                        total_amount,
                        outstanding_amount,
                        billing_contact_name,
                        billing_contact_email,
                        billing_contact_id,
                        days_outstanding,
                        payment_link_url
                    `)
                    .gt('outstanding_amount', 0)
                    .order('days_outstanding', { ascending: true })
                    .limit(5);

                if (fallbackError) {
                    console.log(`❌ Test email: Error fetching fallback invoices:`, fallbackError);
                } else if (fallbackInvoices && fallbackInvoices.length > 0) {
                    sampleInvoice = fallbackInvoices[0];
                    console.log(`🔍 Test email: Using fallback invoice ${sampleInvoice.id} (${sampleInvoice.days_outstanding} days) for ${sampleInvoice.billing_contact_name}`);
                } else {
                    console.log(`🔍 Test email: No overdue invoices found, will use dummy data`);
                }
            }

            // Get user information for sender name
            console.log(`🔍 Test email: Looking up user ${userId} for sender name`);
            const { data: userData, error: userError } = await this.automatedEmailService.supabase
                .from('app_users')
                .select('first_name, last_name')
                .eq('id', userId)
                .single();

            if (userError) {
                console.log(`❌ Test email: Error fetching user data:`, userError);
            } else {
                console.log(`✅ Test email: Found user data:`, userData);
            }

            const senderName = userData ? `${userData.first_name} ${userData.last_name}` : 'Support Team';
            console.log(`🔍 Test email: Sender name will be: "${senderName}"`);

            // If we have a real invoice, get its payment history and payment link
            let paymentHistory = 'No payments recorded.';
            let paymentLink = sampleInvoice?.payment_link_url || 'https://payment.texontowel.com/sample-link';

            if (sampleInvoice) {
                // Get payment history for this order
                try {
                    const { data: payments } = await this.automatedEmailService.supabase
                        .from('payments')
                        .select('paymentdate, amountpaid, paymentmethodcode')
                        .eq('orderid', sampleInvoice.id)
                        .order('paymentdate', { ascending: false });

                    if (payments && payments.length > 0) {
                        paymentHistory = payments.map(payment => {
                            const date = new Date(payment.paymentdate).toLocaleDateString();
                            const amount = parseFloat(payment.amountpaid || 0).toFixed(2);
                            const method = payment.paymentmethodcode || 'Other';
                            return `• ${date}: $${amount} (${method})`;
                        }).join('\n');
                    }

                    // Use the existing payment link from the cached_invoices table
                    paymentLink = sampleInvoice.payment_link_url || `https://payment.texontowel.com/pay/${sampleInvoice.id}`;
                } catch (error) {
                    console.log('Could not fetch payment data for test email, using defaults');
                }
            }

            // Create complete template variables using real invoice data
            const templateVars = {
                CUSTOMER_NAME: sampleInvoice?.billing_contact_name || 'Sample Customer',
                ORDER_REFERENCE: sampleInvoice?.id?.toString() || 'ORD-12345', // Use the actual order ID from the invoice
                INVOICE_NUMBER: sampleInvoice?.invoice_number || 'INV-67890',
                TOTAL_AMOUNT: (sampleInvoice?.total_amount || 200.00).toFixed(2),
                TOTAL_PAID: ((sampleInvoice?.total_amount || 200.00) - (sampleInvoice?.outstanding_amount || 150.00)).toFixed(2),
                AMOUNT_DUE: (sampleInvoice?.outstanding_amount || 150.00).toFixed(2),
                DAYS_OUTSTANDING: sampleInvoice?.days_outstanding?.toString() || '45',
                TAX_DATE: sampleInvoice?.tax_date || new Date().toISOString().split('T')[0],
                PAYMENT_HISTORY: paymentHistory,
                PAYMENT_LINK: paymentLink,
                SENDER_NAME: senderName,
                COMPANY_NAME: 'Texon Towel'
            };

            // Get the actual email template
            const { data: emailTemplate, error: templateError } = await this.automatedEmailService.supabase
                .from('email_templates')
                .select('subject_template, body_template')
                .eq('template_type', campaign.template_type)
                .single();

            if (templateError) throw templateError;

            // Replace template variables manually using our updated method
            const processedSubject = this.automatedEmailService.replaceTemplateVariables(
                emailTemplate.subject_template,
                templateVars
            );
            const processedBody = this.automatedEmailService.replaceTemplateVariables(
                emailTemplate.body_template,
                templateVars
            );

            // Generate PDF attachment for test email
            console.log(`📄 Generating PDF invoice for test email...`);
            let attachments = [];
            if (sampleInvoice) {
                try {
                    const pdfOrderData = {
                        id: sampleInvoice.id,
                        customerName: templateVars.CUSTOMER_NAME,
                        reference: templateVars.ORDER_REFERENCE,
                        invoiceNumber: templateVars.INVOICE_NUMBER,
                        totalAmount: parseFloat(templateVars.TOTAL_AMOUNT.replace('$', '').replace(',', '')),
                        totalPaid: parseFloat(templateVars.TOTAL_PAID.replace('$', '').replace(',', '')),
                        amountDue: parseFloat(templateVars.AMOUNT_DUE.replace('$', '').replace(',', '')),
                        daysOutstanding: parseInt(templateVars.DAYS_OUTSTANDING),
                        taxDate: templateVars.TAX_DATE,
                        payments: [],
                        paymentLink: templateVars.PAYMENT_LINK || ''
                    };

                    const pdfResult = await this.enhancedPdfService.generateInvoicePDF(pdfOrderData);
                    if (pdfResult.success) {
                        attachments = [
                            this.enhancedPdfService.createEmailAttachment(pdfResult.buffer, pdfResult.filename)
                        ];
                        console.log(`✅ Test PDF generated successfully: ${pdfResult.filename}`);
                    } else {
                        console.log(`⚠️ Test PDF generation failed: ${pdfResult.error}`);
                        // Continue without attachment if PDF generation fails
                    }
                } catch (pdfError) {
                    console.log(`❌ Test PDF generation error:`, pdfError);
                    // Continue without attachment if PDF generation fails
                }
            }

            // Send test email using custom subject and body
            const result = await this.automatedEmailService.emailService.sendEmail({
                userId: userId,
                orderId: sampleInvoice?.id || 99999, // Use sample invoice ID or dummy numeric ID for test emails
                recipientEmail: test_email_address,
                emailType: 'invoice', // Use 'invoice' type so it doesn't try to load another template
                customSubject: processedSubject,
                customBody: processedBody,
                attachments: attachments,
                senderName: senderName
            });

            console.log(`🧪 Test email sent for campaign "${campaign.campaign_name}" to ${test_email_address} by user ${userId}`);

            res.json({
                success: true,
                message: `Test email sent successfully to ${test_email_address}`,
                templateVariables: templateVars
            });
        } catch (error) {
            console.error('❌ Error sending test email:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    }

    /**
     * Get automation system status
     * GET /api/automated-emails/status
     */
    async getSystemStatus(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Check if scheduler is running (basic status for now)
            const schedulerStatus = { running: false }; // Default to false for safety

            // Get active campaigns count
            const { data: campaigns, error: campaignsError } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .select('id')
                .eq('is_active', true);

            if (campaignsError) throw campaignsError;

            // Get recent automation run stats
            const { data: recentRuns, error: runsError } = await this.automatedEmailService.supabase
                .from('email_automation_logs')
                .select('*')
                .order('run_started_at', { ascending: false })
                .limit(1);

            if (runsError) throw runsError;

            // Get actual email settings to check test mode
            const { data: emailSettings, error: emailError } = await this.automatedEmailService.supabase
                .from('user_email_settings')
                .select('test_mode')
                .eq('user_id', userId)
                .single();

            if (emailError && emailError.code !== 'PGRST116') throw emailError;

            // Get global test mode setting and email
            const globalTestMode = await this.automatedEmailService.getGlobalTestMode();
            const globalTestEmail = await this.automatedEmailService.getGlobalTestEmail();

            const status = {
                systemActive: (campaigns?.length || 0) > 0,
                schedulerRunning: schedulerStatus.running,
                activeCampaigns: campaigns?.length || 0,
                testMode: emailSettings?.test_mode || false,
                globalTestMode: globalTestMode,
                globalTestEmail: globalTestEmail,
                lastRunAt: recentRuns?.[0]?.run_started_at || null,
                lastRunStatus: recentRuns?.[0]?.status || 'unknown',
                lastRunEmailsSent: recentRuns?.[0]?.emails_sent || 0
            };

            res.json({
                success: true,
                status: status
            });
        } catch (error) {
            console.error('❌ Error getting system status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Enable/disable all automated email campaigns
     * POST /api/automated-emails/system/toggle
     */
    async toggleSystem(req, res) {
        try {
            const { enabled } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (typeof enabled !== 'boolean') {
                return res.status(400).json({ error: 'enabled must be a boolean' });
            }

            // Update all campaigns
            const { data, error } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .update({
                    is_active: enabled,
                    updated_at: new Date().toISOString()
                })
                .neq('id', 0) // WHERE clause to update all campaigns (id is never 0)
                .select();

            if (error) throw error;

            console.log(`🔄 Automated email system ${enabled ? 'enabled' : 'disabled'} by user ${userId} (${data?.length || 0} campaigns affected)`);

            res.json({
                success: true,
                message: `Automated email system ${enabled ? 'enabled' : 'disabled'} successfully`,
                campaignsAffected: data?.length || 0
            });
        } catch (error) {
            console.error('❌ Error toggling system:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get global automation test mode
     * GET /api/automated-emails/global-test-mode
     */
    async getGlobalTestMode(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const isTestMode = await this.automatedEmailService.getGlobalTestMode();

            res.json({
                success: true,
                globalTestMode: isTestMode
            });
        } catch (error) {
            console.error('❌ Error getting global test mode:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Set global automation test mode
     * POST /api/automated-emails/global-test-mode
     */
    async setGlobalTestMode(req, res) {
        try {
            const { enabled } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (typeof enabled !== 'boolean') {
                return res.status(400).json({ error: 'enabled must be a boolean' });
            }

            const success = await this.automatedEmailService.setGlobalTestMode(enabled);

            if (!success) {
                return res.status(500).json({ error: 'Failed to update global test mode' });
            }

            console.log(`🔄 Global automation test mode ${enabled ? 'enabled' : 'disabled'} by user ${userId}`);

            res.json({
                success: true,
                message: `Global automation test mode ${enabled ? 'enabled' : 'disabled'} successfully`,
                globalTestMode: enabled
            });
        } catch (error) {
            console.error('❌ Error setting global test mode:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getGlobalTestEmail(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const testEmail = await this.automatedEmailService.getGlobalTestEmail();

            res.json({
                success: true,
                globalTestEmail: testEmail
            });
        } catch (error) {
            console.error('❌ Error getting global test email:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async setGlobalTestEmail(req, res) {
        try {
            const { email } = req.body;
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!email || typeof email !== 'string') {
                return res.status(400).json({ error: 'Valid email address is required' });
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            const success = await this.automatedEmailService.setGlobalTestEmail(email);

            if (!success) {
                return res.status(500).json({ error: 'Failed to update global test email' });
            }

            console.log(`📧 Global test email set to ${email} by user ${userId}`);

            res.json({
                success: true,
                message: 'Global test email updated successfully',
                globalTestEmail: email
            });
        } catch (error) {
            console.error('❌ Error setting global test email:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AutomatedEmailController;