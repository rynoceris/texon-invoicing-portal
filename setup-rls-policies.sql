-- Set up Row Level Security (RLS) policies for cached invoice tables
-- Run this in your Supabase SQL Editor after creating the tables

-- Enable RLS on both tables
ALTER TABLE cached_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for cached_invoices table
-- Allow service role (backend API) full access
CREATE POLICY "Service role can read cached_invoices" 
ON cached_invoices FOR SELECT 
TO service_role 
USING (true);

CREATE POLICY "Service role can insert cached_invoices" 
ON cached_invoices FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update cached_invoices" 
ON cached_invoices FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role can delete cached_invoices" 
ON cached_invoices FOR DELETE 
TO service_role 
USING (true);

-- Create policies for sync_logs table  
-- Allow service role (backend API) full access
CREATE POLICY "Service role can read sync_logs" 
ON sync_logs FOR SELECT 
TO service_role 
USING (true);

CREATE POLICY "Service role can insert sync_logs" 
ON sync_logs FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update sync_logs" 
ON sync_logs FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role can delete sync_logs" 
ON sync_logs FOR DELETE 
TO service_role 
USING (true);

-- Optional: If you want authenticated users (logged in users) to be able to read the cached invoices
-- Uncomment these policies if needed:

-- CREATE POLICY "Authenticated users can read cached_invoices" 
-- ON cached_invoices FOR SELECT 
-- TO authenticated 
-- USING (true);

-- CREATE POLICY "Authenticated users can read sync_logs" 
-- ON sync_logs FOR SELECT 
-- TO authenticated 
-- USING (true);

-- Grant explicit permissions to service role (backup measure)
GRANT ALL ON cached_invoices TO service_role;
GRANT ALL ON sync_logs TO service_role;
GRANT ALL ON SEQUENCE sync_logs_id_seq TO service_role;