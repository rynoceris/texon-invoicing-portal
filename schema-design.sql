-- Cached Invoice Data Schema for Texon Invoicing Portal
-- This table will store a denormalized view of all unpaid invoice data

CREATE TABLE IF NOT EXISTS cached_invoices (
    -- Primary identifiers
    id BIGINT PRIMARY KEY,  -- Brightpearl order ID
    order_reference VARCHAR(50),
    invoice_number VARCHAR(50),
    
    -- Date information
    order_date TIMESTAMPTZ NOT NULL,
    tax_date TIMESTAMPTZ,
    
    -- Financial data
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    outstanding_amount DECIMAL(10,2) NOT NULL,
    
    -- Status information
    payment_status VARCHAR(20) DEFAULT 'UNPAID',
    order_status_id INTEGER,
    order_status_name VARCHAR(100),
    order_status_color VARCHAR(7) DEFAULT '#6c757d',
    shipping_status_code VARCHAR(10),
    shipping_status_name VARCHAR(100),
    shipping_status_color VARCHAR(7) DEFAULT '#6c757d',
    stock_status_code VARCHAR(10),
    stock_status_name VARCHAR(100),
    stock_status_color VARCHAR(7) DEFAULT '#6c757d',
    
    -- Customer information
    billing_contact_id INTEGER,
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_company_name VARCHAR(255),
    delivery_contact_name VARCHAR(255),
    delivery_contact_email VARCHAR(255),
    delivery_company_name VARCHAR(255),
    
    -- Computed fields
    days_outstanding INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAYS FROM (NOW() - COALESCE(tax_date, order_date)))
    ) STORED,
    
    -- Notes and links
    user_notes_count INTEGER DEFAULT 0,
    brightpearl_notes_count INTEGER DEFAULT 0,
    payment_link_url TEXT,
    
    -- Metadata
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_cached_invoices_tax_date (tax_date),
    INDEX idx_cached_invoices_order_date (order_date),
    INDEX idx_cached_invoices_days_outstanding (days_outstanding),
    INDEX idx_cached_invoices_payment_status (payment_status),
    INDEX idx_cached_invoices_total_amount (total_amount),
    INDEX idx_cached_invoices_customer_search (billing_contact_name, billing_company_name, billing_contact_email),
    INDEX idx_cached_invoices_order_reference (order_reference),
    INDEX idx_cached_invoices_invoice_number (invoice_number)
);

-- Create a sync log table to track updates
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
    status VARCHAR(20) DEFAULT 'running' -- 'running', 'completed', 'failed'
);