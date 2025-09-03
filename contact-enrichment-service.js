const { createClient } = require('@supabase/supabase-js');
const BrightpearlApiClient = require('./brightpearl-api-client.js');

class ContactEnrichmentService {
    constructor() {
        // Initialize Supabase client for app database (where cached notes are stored)
        this.appSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Initialize Brightpearl API client
        this.brightpearlApi = new BrightpearlApiClient();
        
        console.log('✅ Contact Enrichment Service initialized');
    }

    /**
     * Enrich cached notes that are missing contact information
     */
    async enrichCachedNotes() {
        try {
            console.log('🔍 Starting contact enrichment for cached Brightpearl notes...');

            // Find notes that need contact enrichment (missing contact_name or added_by_name)
            const { data: notesNeedingEnrichment, error: fetchError } = await this.appSupabase
                .from('cached_brightpearl_notes')
                .select('id, order_id, note_id, created_by, contact_id')
                .or('contact_name.is.null,added_by_name.is.null')
                .order('order_id');

            if (fetchError) {
                console.error('❌ Error fetching notes needing enrichment:', fetchError);
                return;
            }

            if (!notesNeedingEnrichment || notesNeedingEnrichment.length === 0) {
                console.log('✅ All cached notes already have contact information');
                return;
            }

            console.log(`📝 Found ${notesNeedingEnrichment.length} notes needing contact enrichment`);

            // Group notes by unique contact_id and created_by values to minimize API calls
            const uniqueContacts = new Set();
            const uniqueStaff = new Set();

            notesNeedingEnrichment.forEach(note => {
                // Add valid contact IDs (numeric values, not null)
                if (note.contact_id && 
                    typeof note.contact_id === 'number' && 
                    !uniqueContacts.has(note.contact_id)) {
                    uniqueContacts.add(note.contact_id);
                }
                // Add valid staff IDs (not null, not 'Unknown', not 'null' string, must be numeric)
                if (note.created_by && 
                    note.created_by !== 'null' && 
                    note.created_by !== 'Unknown' && 
                    !isNaN(note.created_by) &&
                    !uniqueStaff.has(note.created_by)) {
                    uniqueStaff.add(note.created_by);
                }
            });

            console.log(`👥 Need to fetch info for ${uniqueContacts.size} contacts and ${uniqueStaff.size} staff members`);

            // Fetch contact information
            const contactsData = new Map();
            const staffData = new Map();

            // Rate limiting configuration
            const RATE_LIMIT_DELAY = 200; // 200ms between requests (max 5 req/sec)

            // Fetch contact data
            if (uniqueContacts.size > 0) {
                console.log('👤 Fetching contact information...');
                let contactCount = 0;
                for (const contactId of uniqueContacts) {
                    try {
                        const response = await this.brightpearlApi.getContact(contactId);
                        if (response && response.success && response.data && response.data.firstName) {
                            const contactInfo = response.data;
                            contactsData.set(String(contactId), {
                                name: `${contactInfo.firstName} ${contactInfo.lastName || ''}`.trim(),
                                email: contactInfo.communication?.emails?.PRI?.email || null,
                                company: contactInfo.organisation?.name || null
                            });
                        }
                        contactCount++;
                        
                        if (contactCount % 10 === 0) {
                            console.log(`   Fetched ${contactCount}/${uniqueContacts.size} contacts`);
                        }
                        
                        // Rate limiting delay
                        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                    } catch (error) {
                        console.warn(`⚠️ Failed to fetch contact ${contactId}:`, error.message);
                    }
                }
                console.log(`✅ Fetched info for ${contactsData.size} contacts`);
            }

            // Fetch staff data
            if (uniqueStaff.size > 0) {
                console.log('👨‍💼 Fetching staff information...');
                let staffCount = 0;
                for (const staffId of uniqueStaff) {
                    try {
                        // Staff are also stored as contacts in Brightpearl
                        const response = await this.brightpearlApi.getContact(staffId);
                        if (response && response.success && response.data && response.data.firstName) {
                            const staffInfo = response.data;
                            staffData.set(String(staffId), {
                                name: `${staffInfo.firstName} ${staffInfo.lastName || ''}`.trim(),
                                email: staffInfo.communication?.emails?.PRI?.email || null
                            });
                        }
                        staffCount++;
                        
                        if (staffCount % 10 === 0) {
                            console.log(`   Fetched ${staffCount}/${uniqueStaff.size} staff`);
                        }
                        
                        // Rate limiting delay
                        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                    } catch (error) {
                        console.warn(`⚠️ Failed to fetch staff ${staffId}:`, error.message);
                    }
                }
                console.log(`✅ Fetched info for ${staffData.size} staff members`);
            }

            // Update notes in batches
            console.log('📝 Updating cached notes with contact information...');
            const BATCH_SIZE = 100;
            let updatedCount = 0;

            for (let i = 0; i < notesNeedingEnrichment.length; i += BATCH_SIZE) {
                const batch = notesNeedingEnrichment.slice(i, i + BATCH_SIZE);
                
                // Process each note in the batch
                for (const note of batch) {
                    const updates = {};
                    
                    // Add contact information if available
                    if (note.contact_id && 
                        typeof note.contact_id === 'number' && 
                        contactsData.has(String(note.contact_id))) {
                        const contact = contactsData.get(String(note.contact_id));
                        updates.contact_name = contact.name;
                        updates.contact_email = contact.email;
                        updates.contact_company = contact.company;
                    }
                    
                    // Add staff information if available
                    if (note.created_by && staffData.has(String(note.created_by))) {
                        const staff = staffData.get(String(note.created_by));
                        updates.added_by_name = staff.name;
                        updates.added_by_email = staff.email;
                    }
                    
                    // Only update if we have new information
                    if (Object.keys(updates).length > 0) {
                        updates.last_updated = new Date().toISOString();
                        
                        const { error: updateError } = await this.appSupabase
                            .from('cached_brightpearl_notes')
                            .update(updates)
                            .eq('id', note.id);
                        
                        if (updateError) {
                            console.error(`❌ Error updating note ${note.id}:`, updateError);
                        } else {
                            updatedCount++;
                        }
                    }
                }
                
                console.log(`📝 Processed batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(notesNeedingEnrichment.length/BATCH_SIZE)} - Updated ${updatedCount} notes so far`);
            }

            console.log(`✅ Contact enrichment completed! Updated ${updatedCount} notes with contact information`);
            
        } catch (error) {
            console.error('❌ Contact enrichment failed:', error);
            throw error;
        }
    }
}

module.exports = ContactEnrichmentService;