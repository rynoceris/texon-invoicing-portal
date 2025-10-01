const cron = require('node-cron');
const AutomatedEmailService = require('./automated-email-service');

/**
 * Email Scheduler - Manages automated email cron jobs
 * Runs email automation at scheduled intervals
 */
class EmailScheduler {
    constructor() {
        this.automatedEmailService = new AutomatedEmailService();
        this.jobs = new Map();
        this.isRunning = false;
        console.log('✅ Email Scheduler initialized');
    }

    /**
     * Start all scheduled email jobs
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Email scheduler is already running');
            return;
        }

        console.log('🚀 Starting email scheduler...');

        // Schedule main automation to run twice daily (9 AM and 2 PM)
        // This gives businesses time to process payments and reduces redundant emails
        const mainAutomationJob = cron.schedule('0 9,14 * * 1-5', async () => {
            console.log('\n🕘 Scheduled email automation triggered...');
            try {
                await this.automatedEmailService.runAutomation('scheduler');
            } catch (error) {
                console.error('❌ Scheduled automation failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York' // Adjust timezone as needed
        });

        // Schedule a weekly summary job (Monday mornings)
        const weeklyStatsJob = cron.schedule('0 8 * * 1', async () => {
            console.log('\n📊 Weekly email automation stats...');
            try {
                const stats = await this.automatedEmailService.getAutomationStats(7);
                console.log('📈 Weekly Email Automation Summary:');
                console.log(`   Total Runs: ${stats.totalRuns}`);
                console.log(`   Successful Runs: ${stats.successfulRuns}`);
                console.log(`   Failed Runs: ${stats.failedRuns}`);
                console.log(`   Emails Sent: ${stats.totalEmailsSent}`);
                console.log(`   Emails Failed: ${stats.totalEmailsFailed}`);
                console.log(`   Emails Scheduled: ${stats.totalEmailsScheduled}`);
            } catch (error) {
                console.error('❌ Failed to generate weekly stats:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });

        // Schedule a cleanup job for old logs (monthly)
        const cleanupJob = cron.schedule('0 2 1 * *', async () => {
            console.log('\n🧹 Monthly cleanup of old automation logs...');
            try {
                await this.cleanupOldLogs();
            } catch (error) {
                console.error('❌ Cleanup job failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });

        // Store jobs for management
        this.jobs.set('mainAutomation', mainAutomationJob);
        this.jobs.set('weeklyStats', weeklyStatsJob);
        this.jobs.set('cleanup', cleanupJob);

        // Start all jobs
        mainAutomationJob.start();
        weeklyStatsJob.start();
        cleanupJob.start();

        this.isRunning = true;
        console.log('✅ Email scheduler started successfully');
        console.log('📅 Main automation: 9 AM and 2 PM, Monday-Friday');
        console.log('📊 Weekly stats: Monday 8 AM');
        console.log('🧹 Monthly cleanup: 1st of month, 2 AM');
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Email scheduler is not running');
            return;
        }

        console.log('⏹️ Stopping email scheduler...');

        for (const [name, job] of this.jobs) {
            job.stop();
            console.log(`   ⏹️ Stopped ${name} job`);
        }

        this.jobs.clear();
        this.isRunning = false;
        console.log('✅ Email scheduler stopped');
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeJobs: Array.from(this.jobs.keys()),
            nextRun: this.getNextRunTime()
        };
    }

    /**
     * Get next scheduled run time
     */
    getNextRunTime() {
        if (!this.isRunning || !this.jobs.has('mainAutomation')) {
            return null;
        }

        // Calculate next 9 AM or 2 PM on weekdays
        const now = new Date();
        const nextRun = new Date();

        // Set to today at 9 AM
        nextRun.setHours(9, 0, 0, 0);

        // If it's past 9 AM, try 2 PM today
        if (now > nextRun) {
            nextRun.setHours(14, 0, 0, 0);
        }

        // If it's past 2 PM or weekend, move to next weekday 9 AM
        if (now > nextRun || nextRun.getDay() === 0 || nextRun.getDay() === 6) {
            do {
                nextRun.setDate(nextRun.getDate() + 1);
            } while (nextRun.getDay() === 0 || nextRun.getDay() === 6);

            nextRun.setHours(9, 0, 0, 0);
        }

        return nextRun;
    }

    /**
     * Run automation manually (outside of schedule)
     */
    async runManualAutomation(testMode = false) {
        console.log(`🚀 Manual automation triggered${testMode ? ' [TEST MODE]' : ''}`);

        try {
            const result = await this.automatedEmailService.runAutomation('manual', testMode);
            console.log('✅ Manual automation completed');
            return result;
        } catch (error) {
            console.error('❌ Manual automation failed:', error);
            throw error;
        }
    }

    /**
     * Update schedule (for dynamic configuration)
     */
    updateSchedule(cronExpression, jobName = 'mainAutomation') {
        if (!this.isRunning) {
            throw new Error('Scheduler is not running');
        }

        if (!this.jobs.has(jobName)) {
            throw new Error(`Job ${jobName} not found`);
        }

        // Stop existing job
        this.jobs.get(jobName).stop();

        // Create new job with updated schedule
        const newJob = cron.schedule(cronExpression, async () => {
            console.log(`\n🕘 Scheduled automation triggered (${jobName})...`);
            try {
                await this.automatedEmailService.runAutomation('scheduler');
            } catch (error) {
                console.error('❌ Scheduled automation failed:', error);
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York'
        });

        this.jobs.set(jobName, newJob);
        console.log(`✅ Updated ${jobName} schedule to: ${cronExpression}`);
    }

    /**
     * Cleanup old automation logs (older than 90 days)
     */
    async cleanupOldLogs() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            console.log(`🧹 Cleaning up automation logs older than ${cutoffDate.toISOString().split('T')[0]}`);

            // Delete old automation logs
            const { data: automationResult, error: automationError } = await this.automatedEmailService.supabase
                .from('email_automation_logs')
                .delete()
                .lt('run_started_at', cutoffDate.toISOString());

            if (automationError) throw automationError;

            // Delete old scheduled emails that are completed/failed
            const { data: scheduleResult, error: scheduleError } = await this.automatedEmailService.supabase
                .from('automated_email_schedule')
                .delete()
                .lt('created_at', cutoffDate.toISOString())
                .in('status', ['sent', 'failed', 'skipped']);

            if (scheduleError) throw scheduleError;

            console.log('✅ Cleanup completed successfully');

        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }

    /**
     * Get recent automation activity
     */
    async getRecentActivity(limit = 10) {
        try {
            const { data, error } = await this.automatedEmailService.supabase
                .from('email_automation_logs')
                .select('*')
                .order('run_started_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('❌ Error getting recent activity:', error);
            return [];
        }
    }

    /**
     * Check system health for scheduling
     */
    async checkSystemHealth() {
        try {
            // Check database connectivity
            const { data, error } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .select('count(*)')
                .limit(1);

            if (error) throw error;

            // Check email service configuration
            const emailHealthy = await this.checkEmailConfiguration();

            return {
                healthy: true,
                database: 'connected',
                email: emailHealthy ? 'configured' : 'not_configured',
                scheduler: this.isRunning ? 'running' : 'stopped'
            };

        } catch (error) {
            console.error('❌ System health check failed:', error);
            return {
                healthy: false,
                error: error.message,
                scheduler: this.isRunning ? 'running' : 'stopped'
            };
        }
    }

    /**
     * Check if email configuration is available
     */
    async checkEmailConfiguration() {
        try {
            const defaultUser = await this.automatedEmailService.getDefaultEmailUser();
            if (!defaultUser) return false;

            const emailSettings = await this.automatedEmailService.emailService.getUserEmailSettings(defaultUser.id);
            return emailSettings.success;

        } catch (error) {
            return false;
        }
    }
}

module.exports = EmailScheduler;