-- Create cached invoice tables for Texon Invoicing Portal
-- Run this in your Supabase SQL Editor (Fixed Version)

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
-- Note: We'll calculate this in the application instead of using GENERATED column
-- since Supabase may not support all PostgreSQL features
ALTER TABLE cached_invoices 
ADD COLUMN IF NOT EXISTS days_outstanding INTEGER;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_cached_invoices_tax_date ON cached_invoices (tax_date);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_order_date ON cached_invoices (order_date);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_days_outstanding ON cached_invoices (days_outstanding);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_payment_status ON cached_invoices (payment_status);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_total_amount ON cached_invoices (total_amount);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_order_reference ON cached_invoices (order_reference);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_invoice_number ON cached_invoices (invoice_number);

-- Create text search indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_cached_invoices_billing_name ON cached_invoices (billing_contact_name);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_billing_company ON cached_invoices (billing_company_name);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_billing_email ON cached_invoices (billing_contact_email);

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

-- Create index on sync_logs for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs (sync_started_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs (status);