const { createClient } = require('@supabase/supabase-js');

/**
 * Safety Mechanisms for Automated Email System
 * Provides protection against sending too many emails or other safety issues
 */
class SafetyMechanisms {
    constructor() {
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

        // Safety limits (configurable)
        this.dailyEmailLimit = process.env.DAILY_EMAIL_LIMIT ? parseInt(process.env.DAILY_EMAIL_LIMIT) : 500;
        this.hourlyEmailLimit = process.env.HOURLY_EMAIL_LIMIT ? parseInt(process.env.HOURLY_EMAIL_LIMIT) : 50;
        this.maxRetriesPerEmail = 3;
        this.cooldownPeriodHours = 24; // Hours between attempts to same customer

        console.log('✅ Safety Mechanisms initialized');
        console.log(`   📊 Daily email limit: ${this.dailyEmailLimit}`);
        console.log(`   ⏰ Hourly email limit: ${this.hourlyEmailLimit}`);
    }

    /**
     * Check if we can send emails (respects daily/hourly limits)
     */
    async canSendEmails() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const oneHourAgo = new Date(today.getTime() - (60 * 60 * 1000));

            // Check daily limit
            const { data: dailyEmails, error: dailyError } = await this.supabase
                .from('email_logs')
                .select('id')
                .gte('created_at', startOfDay.toISOString())
                .eq('send_status', 'sent');

            if (dailyError) throw dailyError;

            const dailyCount = dailyEmails?.length || 0;
            if (dailyCount >= this.dailyEmailLimit) {
                return {
                    canSend: false,
                    reason: `Daily email limit reached (${dailyCount}/${this.dailyEmailLimit})`,
                    dailyCount,
                    hourlyCount: 0
                };
            }

            // Check hourly limit
            const { data: hourlyEmails, error: hourlyError } = await this.supabase
                .from('email_logs')
                .select('id')
                .gte('created_at', oneHourAgo.toISOString())
                .eq('send_status', 'sent');

            if (hourlyError) throw hourlyError;

            const hourlyCount = hourlyEmails?.length || 0;
            if (hourlyCount >= this.hourlyEmailLimit) {
                return {
                    canSend: false,
                    reason: `Hourly email limit reached (${hourlyCount}/${this.hourlyEmailLimit})`,
                    dailyCount,
                    hourlyCount
                };
            }

            return {
                canSend: true,
                dailyCount,
                hourlyCount
            };

        } catch (error) {
            console.error('❌ Error checking email limits:', error);
            return {
                canSend: false,
                reason: 'Error checking email limits',
                error: error.message
            };
        }
    }

    /**
     * Check if we can send to a specific customer (cooldown period)
     */
    async canSendToCustomer(customerEmail, campaignType) {
        try {
            const cooldownDate = new Date();
            cooldownDate.setHours(cooldownDate.getHours() - this.cooldownPeriodHours);

            // Check if we sent any email to this customer recently
            const { data: recentEmails, error } = await this.supabase
                .from('email_logs')
                .select('id, created_at, email_type')
                .eq('recipient_email', customerEmail.toLowerCase())
                .gte('created_at', cooldownDate.toISOString())
                .eq('send_status', 'sent')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (recentEmails?.length > 0) {
                const lastEmail = recentEmails[0];
                const lastEmailDate = new Date(lastEmail.created_at);
                const hoursSinceLastEmail = (new Date() - lastEmailDate) / (1000 * 60 * 60);

                return {
                    canSend: false,
                    reason: `Customer contacted recently (${Math.round(hoursSinceLastEmail)} hours ago)`,
                    lastEmailDate: lastEmailDate,
                    lastEmailType: lastEmail.email_type
                };
            }

            return { canSend: true };

        } catch (error) {
            console.error('❌ Error checking customer cooldown:', error);
            return {
                canSend: true, // Fail safe - allow sending if check fails
                warning: 'Could not verify customer cooldown'
            };
        }
    }

    /**
     * Validate email automation run before executing
     */
    async validateAutomationRun(testMode = false) {
        const issues = [];
        const warnings = [];

        try {
            // Check email service configuration
            const emailConfigured = await this.checkEmailConfiguration();
            if (!emailConfigured) {
                issues.push('No email configuration found - no emails can be sent');
            }

            // Check database connectivity
            const dbHealthy = await this.checkDatabaseHealth();
            if (!dbHealthy) {
                issues.push('Database connectivity issues detected');
            }

            // Check email limits
            const emailLimits = await this.canSendEmails();
            if (!emailLimits.canSend) {
                if (testMode) {
                    warnings.push(`Email limits reached but running in test mode: ${emailLimits.reason}`);
                } else {
                    issues.push(`Email limits reached: ${emailLimits.reason}`);
                }
            }

            // Check for active campaigns
            const activeCampaigns = await this.getActiveCampaignCount();
            if (activeCampaigns === 0) {
                warnings.push('No active email campaigns found');
            }

            // Check recent automation failures
            const recentFailures = await this.checkRecentAutomationFailures();
            if (recentFailures.count > 3) {
                warnings.push(`High number of recent automation failures (${recentFailures.count})`);
            }

            return {
                isValid: issues.length === 0,
                issues,
                warnings,
                emailLimits: emailLimits,
                activeCampaigns
            };

        } catch (error) {
            console.error('❌ Error validating automation run:', error);
            return {
                isValid: false,
                issues: ['Validation check failed: ' + error.message],
                warnings: [],
                error: error.message
            };
        }
    }

    /**
     * Check if email service is properly configured
     */
    async checkEmailConfiguration() {
        try {
            // Check if there's at least one user with email settings
            const { data, error } = await this.supabase
                .from('user_email_settings')
                .select('id')
                .eq('is_active', true)
                .limit(1);

            if (error) throw error;
            return data && data.length > 0;

        } catch (error) {
            console.error('❌ Error checking email configuration:', error);
            return false;
        }
    }

    /**
     * Check database health
     */
    async checkDatabaseHealth() {
        try {
            const { data, error } = await this.supabase
                .from('automated_email_campaigns')
                .select('id')
                .limit(1);

            return !error;

        } catch (error) {
            return false;
        }
    }

    /**
     * Get count of active campaigns
     */
    async getActiveCampaignCount() {
        try {
            const { data, error } = await this.supabase
                .from('automated_email_campaigns')
                .select('id')
                .eq('is_active', true);

            if (error) throw error;
            return data?.length || 0;

        } catch (error) {
            return 0;
        }
    }

    /**
     * Check recent automation failures
     */
    async checkRecentAutomationFailures() {
        try {
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

            const { data, error } = await this.supabase
                .from('email_automation_logs')
                .select('id, error_details')
                .eq('status', 'failed')
                .gte('run_started_at', twentyFourHoursAgo.toISOString());

            if (error) throw error;

            return {
                count: data?.length || 0,
                details: data || []
            };

        } catch (error) {
            return { count: 0, details: [] };
        }
    }

    /**
     * Log safety violation
     */
    async logSafetyViolation(type, details) {
        try {
            console.warn(`⚠️ Safety violation detected: ${type}`);
            console.warn(`   Details: ${details}`);

            // You could store this in a safety_logs table if needed
            // For now, just console logging

        } catch (error) {
            console.error('❌ Error logging safety violation:', error);
        }
    }

    /**
     * Apply rate limiting between email sends
     */
    async rateLimitDelay() {
        // Add a small delay between emails to be nice to email servers
        const delayMs = 1000; // 1 second delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    /**
     * Validate email address format and reputation
     */
    isValidEmailAddress(email) {
        if (!email || typeof email !== 'string') return false;

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return false;

        // Check for common problematic domains
        const problematicDomains = [
            'noreply',
            'no-reply',
            'donotreply',
            'mailer-daemon',
            'postmaster'
        ];

        const lowerEmail = email.toLowerCase();
        for (const domain of problematicDomains) {
            if (lowerEmail.includes(domain)) return false;
        }

        return true;
    }

    /**
     * Check if customer is on a global suppression list
     */
    async isCustomerSuppressed(email) {
        try {
            // Check customer email preferences
            const { data, error } = await this.supabase
                .from('customer_email_preferences')
                .select('opted_out_all, opted_out_reminders')
                .eq('email_address', email.toLowerCase())
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (!data) return false;
            return data.opted_out_all || data.opted_out_reminders;

        } catch (error) {
            console.error('❌ Error checking customer suppression:', error);
            return false; // Fail safe - don't suppress if check fails
        }
    }

    /**
     * Emergency stop - disable all automated campaigns
     */
    async emergencyStop(reason) {
        try {
            console.error(`🚨 EMERGENCY STOP TRIGGERED: ${reason}`);

            // Disable all active campaigns
            const { error } = await this.supabase
                .from('automated_email_campaigns')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('is_active', true);

            if (error) throw error;

            // Log the emergency stop
            await this.logSafetyViolation('emergency_stop', reason);

            console.error('🚨 All automated email campaigns have been disabled');
            return true;

        } catch (error) {
            console.error('❌ Error during emergency stop:', error);
            return false;
        }
    }

    /**
     * Get safety metrics for monitoring
     */
    async getSafetyMetrics() {
        try {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const oneHourAgo = new Date(today.getTime() - (60 * 60 * 1000));

            const [emailLimits, activeCampaigns, recentFailures] = await Promise.all([
                this.canSendEmails(),
                this.getActiveCampaignCount(),
                this.checkRecentAutomationFailures()
            ]);

            return {
                timestamp: new Date().toISOString(),
                emailLimits: {
                    dailyLimit: this.dailyEmailLimit,
                    hourlyLimit: this.hourlyEmailLimit,
                    dailyUsed: emailLimits.dailyCount || 0,
                    hourlyUsed: emailLimits.hourlyCount || 0,
                    canSend: emailLimits.canSend
                },
                campaigns: {
                    active: activeCampaigns,
                    total: await this.getTotalCampaignCount()
                },
                recentFailures: recentFailures.count,
                systemHealth: {
                    database: await this.checkDatabaseHealth(),
                    email: await this.checkEmailConfiguration()
                }
            };

        } catch (error) {
            console.error('❌ Error getting safety metrics:', error);
            return {
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async getTotalCampaignCount() {
        try {
            const { data, error } = await this.supabase
                .from('automated_email_campaigns')
                .select('id');

            if (error) throw error;
            return data?.length || 0;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = SafetyMechanisms;