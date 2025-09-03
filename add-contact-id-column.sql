-- Add contact_id column to cached_brightpearl_notes table
ALTER TABLE cached_brightpearl_notes 
ADD COLUMN IF NOT EXISTS contact_id BIGINT;

-- Create index on contact_id for performance
CREATE INDEX IF NOT EXISTS idx_cached_brightpearl_notes_contact_id 
ON cached_brightpearl_notes(contact_id);