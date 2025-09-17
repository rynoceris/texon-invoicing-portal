-- Automated Email Notification System Schema - SAFE VERSION
-- This version works with existing tables and handles constraints properly
-- Run this in your Supabase SQL Editor

-- Create automated email campaigns table
CREATE TABLE IF NOT EXISTS automated_email_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(100) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL,
    trigger_days INTEGER NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    send_frequency VARCHAR(20) DEFAULT 'once',
    recurring_interval_days INTEGER DEFAULT NULL,
    max_reminders INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'automated_email_campaigns_campaign_type_key'
    ) THEN
        ALTER TABLE automated_email_campaigns ADD CONSTRAINT automated_email_campaigns_campaign_type_key UNIQUE (campaign_type);
    END IF;
END $$;

-- Create automated email schedule table
CREATE TABLE IF NOT EXISTS automated_email_schedule (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES automated_email_campaigns(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    scheduled_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    email_log_id BIGINT,
    error_message TEXT,
    skip_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create customer email preferences table
CREATE TABLE IF NOT EXISTS customer_email_preferences (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL,
    opted_out_all BOOLEAN DEFAULT false,
    opted_out_reminders BOOLEAN DEFAULT false,
    opted_out_collections BOOLEAN DEFAULT false,
    opt_out_date TIMESTAMPTZ,
    opt_out_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to customer_email_preferences if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'customer_email_preferences_email_address_key'
    ) THEN
        ALTER TABLE customer_email_preferences ADD CONSTRAINT customer_email_preferences_email_address_key UNIQUE (email_address);
    END IF;
END $$;

-- Create email automation logs table
CREATE TABLE IF NOT EXISTS email_automation_logs (
    id SERIAL PRIMARY KEY,
    run_started_at TIMESTAMPTZ DEFAULT NOW(),
    run_completed_at TIMESTAMPTZ,
    total_orders_processed INTEGER DEFAULT 0,
    emails_scheduled INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    emails_skipped INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    error_details TEXT,
    status VARCHAR(20) DEFAULT 'running',
    triggered_by VARCHAR(50) DEFAULT 'scheduler'
);

-- Handle email_templates table - add columns if they don't exist
DO $$
BEGIN
    -- Add template_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_templates' AND column_name='template_type') THEN
        ALTER TABLE email_templates ADD COLUMN template_type VARCHAR(50);
    END IF;

    -- Add template_name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_templates' AND column_name='template_name') THEN
        ALTER TABLE email_templates ADD COLUMN template_name VARCHAR(100);
    END IF;

    -- Add is_default column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_templates' AND column_name='is_default') THEN
        ALTER TABLE email_templates ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_templates' AND column_name='updated_at') THEN
        ALTER TABLE email_templates ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add unique constraint to email_templates template_type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'email_templates_template_type_key'
    ) THEN
        -- First, remove any duplicate template_types that might exist
        DELETE FROM email_templates a USING email_templates b
        WHERE a.id > b.id AND a.template_type = b.template_type AND a.template_type IS NOT NULL;

        -- Add the unique constraint
        ALTER TABLE email_templates ADD CONSTRAINT email_templates_template_type_key UNIQUE (template_type);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automated_email_campaigns_type ON automated_email_campaigns (campaign_type);
CREATE INDEX IF NOT EXISTS idx_automated_email_campaigns_active ON automated_email_campaigns (is_active);
CREATE INDEX IF NOT EXISTS idx_automated_email_campaigns_trigger_days ON automated_email_campaigns (trigger_days);

CREATE INDEX IF NOT EXISTS idx_automated_email_schedule_campaign_id ON automated_email_schedule (campaign_id);
CREATE INDEX IF NOT EXISTS idx_automated_email_schedule_order_id ON automated_email_schedule (order_id);
CREATE INDEX IF NOT EXISTS idx_automated_email_schedule_scheduled_date ON automated_email_schedule (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_automated_email_schedule_status ON automated_email_schedule (status);
CREATE INDEX IF NOT EXISTS idx_automated_email_schedule_recipient ON automated_email_schedule (recipient_email);

CREATE INDEX IF NOT EXISTS idx_customer_email_preferences_email ON customer_email_preferences (email_address);
CREATE INDEX IF NOT EXISTS idx_customer_email_preferences_opted_out ON customer_email_preferences (opted_out_all, opted_out_reminders);

CREATE INDEX IF NOT EXISTS idx_email_automation_logs_started_at ON email_automation_logs (run_started_at);
CREATE INDEX IF NOT EXISTS idx_email_automation_logs_status ON email_automation_logs (status);

-- Insert email templates safely (checking for existing records first)
DO $$
BEGIN
    -- 31-60 day overdue template
    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE template_type = 'overdue_31_60') THEN
        INSERT INTO email_templates (template_type, template_name, subject_template, body_template, is_active, is_default, created_at)
        VALUES (
            'overdue_31_60',
            '31-60 Day Overdue Invoice Reminder',
            'Payment Reminder: Invoice #{INVOICE_NUMBER} - ${AMOUNT_DUE} Outstanding',
            'Dear {CUSTOMER_NAME},

We hope this message finds you well. We wanted to reach out regarding an outstanding balance on your account.

=== PAYMENT REMINDER ===
Invoice Number: {INVOICE_NUMBER}
Order Reference: {ORDER_REFERENCE}
Original Amount: ${TOTAL_AMOUNT}
Amount Paid: ${TOTAL_PAID}
Outstanding Balance: ${AMOUNT_DUE}
Days Outstanding: {DAYS_OUTSTANDING}
Original Invoice Date: {TAX_DATE}

We understand that sometimes invoices can be overlooked in busy schedules. If you have already sent payment, please disregard this message and we apologize for any inconvenience.

=== PAYMENT HISTORY ===
{PAYMENT_HISTORY}

=== NEXT STEPS ===
To settle this outstanding balance, please:
1. Use our secure payment link: {PAYMENT_LINK}
2. Or remit payment using your preferred method
3. Contact us if you need to arrange alternative payment terms

We value your business relationship and want to work with you to resolve this matter promptly.

Best regards,
{SENDER_NAME}
{COMPANY_NAME}

If you have questions about this invoice, please contact us immediately.',
            true,
            true,
            NOW()
        );
    END IF;

    -- 61-90 day overdue template
    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE template_type = 'overdue_61_90') THEN
        INSERT INTO email_templates (template_type, template_name, subject_template, body_template, is_active, is_default, created_at)
        VALUES (
            'overdue_61_90',
            '61-90 Day Overdue Collections Notice',
            'URGENT: Collections Notice for Invoice #{INVOICE_NUMBER} - ${AMOUNT_DUE} Past Due',
            'Dear {CUSTOMER_NAME},

This is an urgent notice regarding a significantly past due balance on your account that requires immediate attention.

=== COLLECTIONS NOTICE ===
Invoice Number: {INVOICE_NUMBER}
Order Reference: {ORDER_REFERENCE}
Original Amount: ${TOTAL_AMOUNT}
Amount Paid: ${TOTAL_PAID}
PAST DUE BALANCE: ${AMOUNT_DUE}
Days Past Due: {DAYS_OUTSTANDING}
Original Invoice Date: {TAX_DATE}

Despite previous reminders, this invoice remains unpaid and is now seriously past due. Immediate payment is required to avoid further collection actions.

=== PAYMENT HISTORY ===
{PAYMENT_HISTORY}

=== IMMEDIATE ACTION REQUIRED ===
To avoid additional collection measures:
1. Pay immediately using: {PAYMENT_LINK}
2. Contact us within 5 business days to arrange payment
3. Provide written explanation if payment has been sent

Failure to respond to this notice may result in:
- Account suspension
- Transfer to external collections
- Additional fees and interest charges
- Impact on credit rating

We prefer to resolve this matter directly with you. Please contact us immediately.

Urgent Contact Required,
{SENDER_NAME}
{COMPANY_NAME}

IMPORTANT: If payment has been sent, contact us immediately with payment details.',
            true,
            true,
            NOW()
        );
    END IF;

    -- 91+ day overdue template
    IF NOT EXISTS (SELECT 1 FROM email_templates WHERE template_type = 'overdue_91_plus') THEN
        INSERT INTO email_templates (template_type, template_name, subject_template, body_template, is_active, is_default, created_at)
        VALUES (
            'overdue_91_plus',
            '91+ Day Final Collections Notice',
            'FINAL NOTICE: Invoice #{INVOICE_NUMBER} - ${AMOUNT_DUE} - Legal Action Pending',
            'Dear {CUSTOMER_NAME},

This is a FINAL NOTICE regarding your seriously delinquent account. This invoice is now over 90 days past due and requires immediate resolution.

=== FINAL COLLECTIONS NOTICE ===
Invoice Number: {INVOICE_NUMBER}
Order Reference: {ORDER_REFERENCE}
Original Amount: ${TOTAL_AMOUNT}
Amount Paid: ${TOTAL_PAID}
DELINQUENT BALANCE: ${AMOUNT_DUE}
Days Delinquent: {DAYS_OUTSTANDING}
Original Invoice Date: {TAX_DATE}

This account is now classified as seriously delinquent and is being considered for legal action and external collections.

=== PAYMENT HISTORY ===
{PAYMENT_HISTORY}

=== FINAL OPPORTUNITY ===
This is your final opportunity to resolve this matter before we pursue:
- Legal action to collect the full amount owed
- Transfer to external collection agency
- Filing of liens or judgments
- Recovery of all legal fees and costs
- Reporting to credit agencies

IMMEDIATE PAYMENT REQUIRED: {PAYMENT_LINK}

=== CONTACT US IMMEDIATELY ===
You have 72 hours from the date of this notice to:
1. Pay the full balance due
2. Contact us to arrange an acceptable payment plan
3. Provide proof of payment if already sent

Failure to respond within 72 hours will result in immediate transfer to our legal department for collection proceedings.

Final Notice,
{SENDER_NAME}
{COMPANY_NAME}

URGENT: Contact us immediately to avoid legal action.',
            true,
            true,
            NOW()
        );
    END IF;
END $$;

-- Insert default automation campaigns safely
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM automated_email_campaigns WHERE campaign_type = 'overdue_31_60') THEN
        INSERT INTO automated_email_campaigns (campaign_name, campaign_type, trigger_days, template_type, send_frequency, is_active)
        VALUES ('31-60 Day Overdue Reminder', 'overdue_31_60', 31, 'overdue_31_60', 'once', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM automated_email_campaigns WHERE campaign_type = 'overdue_61_90') THEN
        INSERT INTO automated_email_campaigns (campaign_name, campaign_type, trigger_days, template_type, send_frequency, is_active)
        VALUES ('61-90 Day Collections Notice', 'overdue_61_90', 61, 'overdue_61_90', 'once', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM automated_email_campaigns WHERE campaign_type = 'overdue_91_plus') THEN
        INSERT INTO automated_email_campaigns (campaign_name, campaign_type, trigger_days, template_type, send_frequency, is_active)
        VALUES ('91+ Day Final Notice', 'overdue_91_plus', 91, 'overdue_91_plus', 'once', true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM automated_email_campaigns WHERE campaign_type = 'overdue_91_plus_recurring') THEN
        INSERT INTO automated_email_campaigns (campaign_name, campaign_type, trigger_days, template_type, send_frequency, is_active, recurring_interval_days, max_reminders)
        VALUES ('91+ Day Follow-up Reminders', 'overdue_91_plus_recurring', 101, 'overdue_91_plus', 'recurring', true, 10, 5);
    END IF;
END $$;

-- Add table comments
COMMENT ON TABLE automated_email_campaigns IS 'Defines automated email campaigns for overdue invoices with trigger conditions';
COMMENT ON TABLE automated_email_schedule IS 'Tracks scheduled emails to be sent, populated by automation script';
COMMENT ON TABLE customer_email_preferences IS 'Manages customer opt-out preferences for automated emails';
COMMENT ON TABLE email_automation_logs IS 'Logs each run of the email automation system for monitoring and debugging';

-- Verify installation
SELECT
    'Automated Email System schema installed successfully!' as message,
    (SELECT COUNT(*) FROM automated_email_campaigns) as campaigns_created,
    (SELECT COUNT(*) FROM email_templates WHERE template_type LIKE 'overdue%') as templates_created;