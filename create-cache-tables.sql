-- Create cached invoice tables for Texon Invoicing Portal
-- Run this in your Supabase SQL Editor

-- Create the main cached invoices table
CREATE TABLE IF NOT EXISTS cached_invoices (
    id BIGINT PRIMARY KEY,
    order_reference VARCHAR(50),
    invoice_number VARCHAR(50),
    order_date TIMESTAMPTZ NOT NULL,
    tax_date TIMESTAMPTZ,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    outstanding_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'UNPAID',
    order_status_name VARCHAR(100),
    order_status_color VARCHAR(7) DEFAULT '#6c757d',
    shipping_status_name VARCHAR(100),
    shipping_status_color VARCHAR(7) DEFAULT '#6c757d',
    stock_status_name VARCHAR(100),
    stock_status_color VARCHAR(7) DEFAULT '#6c757d',
    billing_contact_id INTEGER,
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_company_name VARCHAR(255),
    delivery_contact_name VARCHAR(255),
    delivery_contact_email VARCHAR(255),
    delivery_company_name VARCHAR(255),
    user_notes_count INTEGER DEFAULT 0,
    brightpearl_notes_count INTEGER DEFAULT 0,
    payment_link_url TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add computed column for days outstanding
ALTER TABLE cached_invoices 
ADD COLUMN IF NOT EXISTS days_outstanding INTEGER 
GENERATED ALWAYS AS (
    EXTRACT(DAYS FROM (NOW() - COALESCE(tax_date, order_date)))
) STORED;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_cached_invoices_tax_date ON cached_invoices (tax_date);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_order_date ON cached_invoices (order_date);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_days_outstanding ON cached_invoices (days_outstanding);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_payment_status ON cached_invoices (payment_status);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_total_amount ON cached_invoices (total_amount);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_order_reference ON cached_invoices (order_reference);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_invoice_number ON cached_invoices (invoice_number);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_customer_search ON cached_invoices (billing_contact_name, billing_company_name);

-- Create sync logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_started_at TIMESTAMPTZ DEFAULT NOW(),
    sync_completed_at TIMESTAMPTZ,
    records_processed INTEGER,
    records_updated INTEGER,
    records_inserted INTEGER,
    records_deleted INTEGER,
    errors_encountered INTEGER DEFAULT 0,
    error_details TEXT,
    status VARCHAR(20) DEFAULT 'running'
);

-- Enable Row Level Security (optional - can be removed if not needed)
ALTER TABLE cached_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow service role access
CREATE POLICY IF NOT EXISTS "Service role can access cached_invoices" 
ON cached_invoices FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role can access sync_logs" 
ON sync_logs FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON cached_invoices TO service_role;
GRANT ALL ON sync_logs TO service_role;
GRANT ALL ON SEQUENCE sync_logs_id_seq TO service_role;