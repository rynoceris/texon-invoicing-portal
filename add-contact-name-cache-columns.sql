-- Add contact name caching columns to cached_brightpearl_notes table
ALTER TABLE cached_brightpearl_notes 
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_company VARCHAR(255),
ADD COLUMN IF NOT EXISTS added_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS added_by_email VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cached_brightpearl_notes_contact_name 
ON cached_brightpearl_notes(contact_name);

CREATE INDEX IF NOT EXISTS idx_cached_brightpearl_notes_added_by_name 
ON cached_brightpearl_notes(added_by_name);

-- Add comment for documentation
COMMENT ON COLUMN cached_brightpearl_notes.contact_name IS 'Cached contact name from Brightpearl Contact API';
COMMENT ON COLUMN cached_brightpearl_notes.contact_email IS 'Cached contact email from Brightpearl Contact API';
COMMENT ON COLUMN cached_brightpearl_notes.contact_company IS 'Cached contact company from Brightpearl Contact API';
COMMENT ON COLUMN cached_brightpearl_notes.added_by_name IS 'Cached staff name from Brightpearl Contact API';
COMMENT ON COLUMN cached_brightpearl_notes.added_by_email IS 'Cached staff email from Brightpearl Contact API';