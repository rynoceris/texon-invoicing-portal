const AutomatedEmailService = require('./automated-email-service');

/**
 * Automated Email Controller - Handles API endpoints for automated email system
 */
class AutomatedEmailController {
    constructor() {
        this.automatedEmailService = new AutomatedEmailService();
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

            const campaigns = await this.automatedEmailService.getActiveCampaigns();

            res.json({
                success: true,
                campaigns: campaigns
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
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // This is a dry-run version of the automation that doesn't actually schedule emails
            const campaigns = await this.automatedEmailService.getActiveCampaigns();
            const preview = [];

            for (const campaign of campaigns) {
                // Calculate cutoff date for this campaign
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - campaign.trigger_days);

                // Find eligible overdue invoices
                const { data: overdueInvoices, error } = await this.automatedEmailService.supabaseBrightpearl
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
                    .lte('tax_date', cutoffDate.toISOString())
                    .gt('outstanding_amount', 0)
                    .not('billing_contact_email', 'is', null)
                    .order('tax_date', { ascending: true })
                    .limit(100); // Limit for preview

                if (error) throw error;

                const eligibleInvoices = [];

                for (const invoice of overdueInvoices || []) {
                    const taxDate = new Date(invoice.tax_date);
                    const today = new Date();
                    const daysOutstanding = Math.floor((today - taxDate) / (1000 * 60 * 60 * 24));

                    const isEligible = this.automatedEmailService.isInvoiceEligibleForCampaign(daysOutstanding, campaign);

                    if (isEligible) {
                        const alreadyScheduled = await this.automatedEmailService.isEmailAlreadyScheduled(
                            campaign.id,
                            invoice.id,
                            campaign.send_frequency === 'recurring' ? daysOutstanding : null
                        );

                        const isOptedOut = await this.automatedEmailService.isCustomerOptedOut(invoice.billing_contact_email);

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
}

module.exports = AutomatedEmailController;