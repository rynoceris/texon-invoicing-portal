-- Add Brightpearl notes caching to the database
-- Run this in your Supabase SQL Editor

-- Create table for cached Brightpearl notes
CREATE TABLE IF NOT EXISTS cached_brightpearl_notes (
    id SERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    note_id VARCHAR(50),
    note_text TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at_brightpearl TIMESTAMPTZ,
    note_type VARCHAR(50) DEFAULT 'order',
    -- Our metadata
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cached_brightpearl_notes_order_id ON cached_brightpearl_notes (order_id);
CREATE INDEX IF NOT EXISTS idx_cached_brightpearl_notes_created_at ON cached_brightpearl_notes (created_at_brightpearl);

-- Enable RLS on the new table
ALTER TABLE cached_brightpearl_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for service role access
CREATE POLICY "Service role can read cached_brightpearl_notes" 
ON cached_brightpearl_notes FOR SELECT 
TO service_role 
USING (true);

CREATE POLICY "Service role can insert cached_brightpearl_notes" 
ON cached_brightpearl_notes FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update cached_brightpearl_notes" 
ON cached_brightpearl_notes FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role can delete cached_brightpearl_notes" 
ON cached_brightpearl_notes FOR DELETE 
TO service_role 
USING (true);

-- Grant permissions
GRANT ALL ON cached_brightpearl_notes TO service_role;
GRANT ALL ON SEQUENCE cached_brightpearl_notes_id_seq TO service_role;