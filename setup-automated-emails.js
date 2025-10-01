const AutomatedEmailService = require('./automated-email-service');
const EmailScheduler = require('./email-scheduler');
const SafetyMechanisms = require('./safety-mechanisms');

/**
 * Setup script for automated email system
 * Run this to initialize and test the automated email functionality
 */
class AutomatedEmailSetup {
    constructor() {
        this.automatedEmailService = new AutomatedEmailService();
        this.emailScheduler = new EmailScheduler();
        this.safetyMechanisms = new SafetyMechanisms();
        console.log('✅ Automated Email Setup initialized');
    }

    /**
     * Run complete setup and verification
     */
    async runSetup() {
        console.log('\n🚀 AUTOMATED EMAIL SYSTEM SETUP');
        console.log('=====================================\n');

        const results = {
            databaseSetup: false,
            systemHealth: false,
            testAutomation: false,
            schedulerStatus: false,
            overallSuccess: false
        };

        try {
            // Step 1: Verify database setup
            console.log('📊 Step 1: Verifying database setup...');
            results.databaseSetup = await this.verifyDatabaseSetup();

            if (!results.databaseSetup) {
                console.error('❌ Database setup failed. Please run the SQL schema first.');
                return results;
            }

            // Step 2: Check system health
            console.log('\n🏥 Step 2: Checking system health...');
            results.systemHealth = await this.checkSystemHealth();

            // Step 3: Test automation (dry run)
            console.log('\n🧪 Step 3: Testing automation workflow...');
            results.testAutomation = await this.testAutomationWorkflow();

            // Step 4: Verify scheduler
            console.log('\n⏰ Step 4: Verifying scheduler...');
            results.schedulerStatus = this.verifyScheduler();

            // Calculate overall success
            results.overallSuccess = results.databaseSetup && results.systemHealth && results.testAutomation;

            // Print summary
            this.printSetupSummary(results);

            return results;

        } catch (error) {
            console.error('\n❌ Setup failed with error:', error);
            return results;
        }
    }

    /**
     * Verify database tables and data exist
     */
    async verifyDatabaseSetup() {
        try {
            console.log('   🔍 Checking database tables...');

            // Check if automated email tables exist
            const tables = [
                'automated_email_campaigns',
                'automated_email_schedule',
                'customer_email_preferences',
                'email_automation_logs'
            ];

            for (const table of tables) {
                try {
                    const { data, error } = await this.automatedEmailService.supabase
                        .from(table)
                        .select('count(*)')
                        .limit(1);

                    if (error) {
                        console.error(`   ❌ Table '${table}' not accessible: ${error.message}`);
                        return false;
                    }
                    console.log(`   ✅ Table '${table}' exists and accessible`);
                } catch (tableError) {
                    console.error(`   ❌ Table '${table}' check failed:`, tableError.message);
                    return false;
                }
            }

            // Check if email templates exist
            console.log('   🔍 Checking email templates...');
            const templateTypes = ['overdue_31_60', 'overdue_61_90', 'overdue_91_plus'];

            for (const templateType of templateTypes) {
                const { data, error } = await this.automatedEmailService.supabase
                    .from('email_templates')
                    .select('id')
                    .eq('template_type', templateType)
                    .limit(1);

                if (error || !data || data.length === 0) {
                    console.error(`   ❌ Email template '${templateType}' not found`);
                    return false;
                }
                console.log(`   ✅ Email template '${templateType}' exists`);
            }

            // Check if campaigns exist
            console.log('   🔍 Checking default campaigns...');
            const { data: campaigns, error: campaignError } = await this.automatedEmailService.supabase
                .from('automated_email_campaigns')
                .select('id, campaign_name, is_active');

            if (campaignError) {
                console.error('   ❌ Cannot access campaigns:', campaignError.message);
                return false;
            }

            if (!campaigns || campaigns.length === 0) {
                console.error('   ❌ No campaigns found');
                return false;
            }

            console.log(`   ✅ Found ${campaigns.length} campaigns:`);
            campaigns.forEach(campaign => {
                console.log(`      - ${campaign.campaign_name} (${campaign.is_active ? 'Active' : 'Inactive'})`);
            });

            return true;

        } catch (error) {
            console.error('   ❌ Database verification failed:', error);
            return false;
        }
    }

    /**
     * Check system health and prerequisites
     */
    async checkSystemHealth() {
        try {
            const health = await this.safetyMechanisms.getSafetyMetrics();

            console.log(`   📊 Safety Metrics:`);
            console.log(`      - Daily email limit: ${health.emailLimits?.dailyLimit || 'Unknown'}`);
            console.log(`      - Daily emails used: ${health.emailLimits?.dailyUsed || 0}`);
            console.log(`      - Hourly email limit: ${health.emailLimits?.hourlyLimit || 'Unknown'}`);
            console.log(`      - Active campaigns: ${health.campaigns?.active || 0}`);
            console.log(`      - Database health: ${health.systemHealth?.database ? '✅ Good' : '❌ Issues'}`);
            console.log(`      - Email config: ${health.systemHealth?.email ? '✅ Configured' : '⚠️ Not configured'}`);

            const validation = await this.safetyMechanisms.validateAutomationRun(true);

            if (validation.issues.length > 0) {
                console.log('   ⚠️ Issues found:');
                validation.issues.forEach(issue => console.log(`      - ${issue}`));
            }

            if (validation.warnings.length > 0) {
                console.log('   ⚠️ Warnings:');
                validation.warnings.forEach(warning => console.log(`      - ${warning}`));
            }

            if (validation.isValid || validation.issues.length === 0) {
                console.log('   ✅ System health check passed');
                return true;
            } else {
                console.log('   ❌ System health check failed');
                return false;
            }

        } catch (error) {
            console.error('   ❌ Health check failed:', error);
            return false;
        }
    }

    /**
     * Test automation workflow
     */
    async testAutomationWorkflow() {
        try {
            console.log('   🧪 Running test automation (preview mode)...');

            // Get preview of what would be sent
            const campaigns = await this.automatedEmailService.getActiveCampaigns();

            if (campaigns.length === 0) {
                console.log('   ⚠️ No active campaigns to test');
                return true; // Not a failure, just no campaigns
            }

            let totalEligible = 0;

            for (const campaign of campaigns) {
                console.log(`   📧 Testing campaign: ${campaign.campaign_name}`);

                // Calculate cutoff date for this campaign
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - campaign.trigger_days);

                // Find eligible overdue invoices (limit to 5 for testing)
                const { data: overdueInvoices, error } = await this.automatedEmailService.supabaseBrightpearl
                    .from('cached_invoices')
                    .select(`
                        id,
                        order_reference,
                        tax_date,
                        outstanding_amount,
                        billing_contact_email,
                        billing_contact_name
                    `)
                    .lte('tax_date', cutoffDate.toISOString())
                    .gt('outstanding_amount', 0)
                    .not('billing_contact_email', 'is', null)
                    .order('tax_date', { ascending: true })
                    .limit(5);

                if (error) {
                    console.error(`   ❌ Error checking invoices for ${campaign.campaign_name}:`, error.message);
                    continue;
                }

                const eligible = overdueInvoices?.length || 0;
                totalEligible += eligible;

                console.log(`      - Found ${eligible} potentially eligible invoices`);

                if (eligible > 0) {
                    overdueInvoices.slice(0, 3).forEach(invoice => {
                        const taxDate = new Date(invoice.tax_date);
                        const daysOut = Math.floor((new Date() - taxDate) / (1000 * 60 * 60 * 24));
                        console.log(`        * Order ${invoice.order_reference}: ${daysOut} days, $${invoice.outstanding_amount}`);
                    });
                }
            }

            console.log(`   📊 Test Summary: ${totalEligible} total eligible invoices across all campaigns`);

            if (totalEligible > 0) {
                console.log('   ✅ Test automation workflow passed - eligible invoices found');
            } else {
                console.log('   ⚠️ Test automation workflow - no eligible invoices (this is normal for new setups)');
            }

            return true;

        } catch (error) {
            console.error('   ❌ Test automation failed:', error);
            return false;
        }
    }

    /**
     * Verify scheduler configuration
     */
    verifyScheduler() {
        try {
            const status = this.emailScheduler.getStatus();

            console.log(`   📅 Scheduler Status: ${status.isRunning ? '✅ Running' : '⏹️ Stopped'}`);

            if (status.isRunning) {
                console.log(`   📅 Active Jobs: ${status.activeJobs.join(', ')}`);
                if (status.nextRun) {
                    console.log(`   ⏰ Next Run: ${status.nextRun.toLocaleString()}`);
                }
            } else {
                console.log('   ℹ️ Scheduler is not running. Use emailScheduler.start() to enable automated runs.');
            }

            return true;

        } catch (error) {
            console.error('   ❌ Scheduler verification failed:', error);
            return false;
        }
    }

    /**
     * Print setup summary
     */
    printSetupSummary(results) {
        console.log('\n📋 SETUP SUMMARY');
        console.log('=================');
        console.log(`Database Setup: ${results.databaseSetup ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`System Health: ${results.systemHealth ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Test Automation: ${results.testAutomation ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Scheduler Status: ${results.schedulerStatus ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Overall Success: ${results.overallSuccess ? '✅ READY FOR USE' : '❌ NEEDS ATTENTION'}`);

        if (results.overallSuccess) {
            console.log('\n🎉 AUTOMATED EMAIL SYSTEM IS READY!');
            console.log('\n📚 Next Steps:');
            console.log('1. Run the database schema: automated-email-schema.sql');
            console.log('2. Configure user email settings in the app');
            console.log('3. Start the scheduler: emailScheduler.start()');
            console.log('4. Monitor with: /api/automated-emails/stats');
            console.log('5. Test manually: POST /api/automated-emails/run (with testMode: true)');
        } else {
            console.log('\n⚠️ SETUP INCOMPLETE - Please address the failed items above');
        }
    }

    /**
     * Run a quick manual test
     */
    async runManualTest() {
        console.log('\n🧪 RUNNING MANUAL TEST');
        console.log('======================\n');

        try {
            const result = await this.automatedEmailService.runAutomation('manual_test', true);

            if (result.success) {
                console.log('✅ Manual test completed successfully!');
                console.log('📊 Test Results:');
                console.log(`   Orders processed: ${result.summary.ordersProcessed}`);
                console.log(`   Emails scheduled: ${result.summary.emailsScheduled}`);
                console.log(`   Emails sent: ${result.summary.emailsSent}`);
                console.log(`   Emails failed: ${result.summary.emailsFailed}`);
                console.log(`   Emails skipped: ${result.summary.emailsSkipped}`);
            } else {
                console.error('❌ Manual test failed:', result.error);
                if (result.issues) {
                    result.issues.forEach(issue => console.error(`   - ${issue}`));
                }
            }

            return result.success;

        } catch (error) {
            console.error('❌ Manual test error:', error);
            return false;
        }
    }
}

// Export for use in other scripts
module.exports = AutomatedEmailSetup;

// If run directly, execute setup
if (require.main === module) {
    const setup = new AutomatedEmailSetup();

    setup.runSetup()
        .then(results => {
            console.log('\n🏁 Setup completed');
            process.exit(results.overallSuccess ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Setup crashed:', error);
            process.exit(1);
        });
}