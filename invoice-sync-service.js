/**
 * Invoice Data Sync Service
 * Fetches all unpaid invoice data from Brightpearl/Supabase and caches in our app database
 * Designed to run every 15 minutes via cron
 */

const { createClient } = require('@supabase/supabase-js');
const SupabaseBrightpearlService = require('./supabase-brightpearl-service');
const PaymentLinksService = require('./payment-links-service');
require('dotenv').config();

class InvoiceSyncService {
    constructor() {
        // App database for cached data
        this.appSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        
        // Brightpearl data service
        this.brightpearlService = new SupabaseBrightpearlService();
        
        // Payment links service
        this.paymentLinksService = new PaymentLinksService();
        
        console.log('✅ Invoice Sync Service initialized');
    }

    /**
     * Main sync function - fetches all unpaid invoices and updates cache
     */
    async syncInvoiceData() {
        const syncId = await this.startSyncLog();
        
        try {
            console.log('🔄 Starting invoice data sync...');
            
            // Fetch all unpaid invoices (no pagination - get everything)
            const result = await this.brightpearlService.getUnpaidInvoices(
                '2024-01-01', 
                new Date().toISOString().split('T')[0],
                1, 
                10000, // Large limit to get all records
                'id', 
                'asc',
                {} // No filters
            );
            
            if (!result.success) {
                throw new Error(`Failed to fetch invoices: ${result.error}`);
            }
            
            console.log(`📊 Fetched ${result.data.length} unpaid invoices`);
            
            // Process and cache the data
            const processed = await this.processInvoiceData(result.data);
            
            // Update sync log
            await this.completeSyncLog(syncId, processed);
            
            console.log('✅ Invoice sync completed successfully');
            console.log(`📝 Processed: ${processed.inserted} new, ${processed.updated} updated, ${processed.deleted} deleted`);
            
            return {
                success: true,
                ...processed
            };
            
        } catch (error) {
            console.error('❌ Invoice sync failed:', error);
            await this.failSyncLog(syncId, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process invoice data and update the cache table
     */
    async processInvoiceData(invoices) {
        console.log('💾 Processing invoice data for cache...');
        
        let inserted = 0, updated = 0, deleted = 0;
        
        // Get current invoice IDs in cache
        const { data: existingIds } = await this.appSupabase
            .from('cached_invoices')
            .select('id');
        
        const existingSet = new Set(existingIds?.map(row => row.id) || []);
        const currentSet = new Set(invoices.map(invoice => invoice.id));
        
        // Find invoices to delete (no longer unpaid)
        const toDelete = [...existingSet].filter(id => !currentSet.has(id));
        
        if (toDelete.length > 0) {
            const { error: deleteError } = await this.appSupabase
                .from('cached_invoices')
                .delete()
                .in('id', toDelete);
                
            if (deleteError) {
                console.error('❌ Error deleting invoices:', deleteError);
            } else {
                deleted = toDelete.length;
                console.log(`🗑️  Deleted ${deleted} paid/cancelled invoices`);
            }
        }
        
        // Process invoices in batches to avoid overwhelming the database
        const BATCH_SIZE = 50;
        for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
            const batch = invoices.slice(i, i + BATCH_SIZE);
            console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(invoices.length/BATCH_SIZE)}`);
            
            for (const invoice of batch) {
                const cacheData = this.transformInvoiceForCache(invoice);
                
                // Upsert (insert or update)
                const { error } = await this.appSupabase
                    .from('cached_invoices')
                    .upsert(cacheData, { onConflict: 'id' });
                
                if (error) {
                    console.error(`❌ Error upserting invoice ${invoice.id}:`, error);
                } else {
                    if (existingSet.has(invoice.id)) {
                        updated++;
                    } else {
                        inserted++;
                    }
                }
            }
        }
        
        // Cache Brightpearl notes for all current invoices (configurable)
        const ENABLE_NOTES_CACHING = process.env.ENABLE_BRIGHTPEARL_NOTES_CACHING !== 'false';
        if (ENABLE_NOTES_CACHING) {
            console.log('📝 Caching Brightpearl notes for invoices...');
            const allOrderIds = invoices.map(inv => inv.id);
            await this.cacheBrightpearlNotesForOrders(allOrderIds);
        } else {
            console.log('⏭️ Brightpearl notes caching disabled (ENABLE_BRIGHTPEARL_NOTES_CACHING=false)');
        }
        
        // Auto-generate payment links for orders without them (configurable)
        const ENABLE_PAYMENT_LINKS = process.env.ENABLE_AUTO_PAYMENT_LINKS !== 'false';
        if (ENABLE_PAYMENT_LINKS) {
            console.log('💳 Auto-generating payment links for invoices without them...');
            const allOrderIds = invoices.map(inv => inv.id);
            await this.generateMissingPaymentLinks(allOrderIds);
        } else {
            console.log('⏭️ Auto payment link generation disabled (ENABLE_AUTO_PAYMENT_LINKS=false)');
        }
        
        return { inserted, updated, deleted, total: invoices.length };
    }

    /**
     * Transform invoice data from Brightpearl format to cache table format
     */
    transformInvoiceForCache(invoice) {
        // Calculate days outstanding based on tax date or order date
        const baseDate = invoice.taxDate ? new Date(invoice.taxDate) : new Date(invoice.orderDate);
        const daysOutstanding = Math.floor((new Date() - baseDate) / (1000 * 60 * 60 * 24));
        
        return {
            id: invoice.id,
            order_reference: invoice.orderRef,
            invoice_number: invoice.invoiceNumber,
            order_date: invoice.orderDate,
            tax_date: invoice.taxDate,
            total_amount: invoice.totalAmount,
            paid_amount: invoice.paidAmount || 0,
            outstanding_amount: invoice.outstandingAmount,
            payment_status: invoice.paymentStatus || 'UNPAID',
            order_status_name: invoice.orderStatus,
            order_status_color: invoice.orderStatusColor,
            shipping_status_name: invoice.shippingStatus,
            shipping_status_color: invoice.shippingStatusColor,
            stock_status_name: invoice.stockStatus,
            stock_status_color: invoice.stockStatusColor,
            billing_contact_id: invoice.billingContact?.id,
            billing_contact_name: invoice.billingContact?.name,
            billing_contact_email: invoice.billingContact?.email,
            billing_company_name: invoice.billingContact?.companyName || invoice.company?.name,
            delivery_contact_name: invoice.deliveryContact?.name,
            delivery_contact_email: invoice.deliveryContact?.email,
            delivery_company_name: invoice.deliveryContact?.companyName,
            days_outstanding: daysOutstanding,
            user_notes_count: invoice.notesCount || 0,
            brightpearl_notes_count: invoice.brightpearlNotesCount || 0,
            payment_link_url: invoice.paymentLink,
            last_updated: new Date().toISOString()
        };
    }

    /**
     * Cache Brightpearl notes for orders with intelligent incremental sync
     */
    async cacheBrightpearlNotesForOrders(orderIds) {
        try {
            console.log(`📝 Intelligently caching Brightpearl notes for ${orderIds.length} orders...`);
            
            // Get orders that already have cached notes
            const { data: existingNotes } = await this.appSupabase
                .from('cached_brightpearl_notes')
                .select('order_id, cached_at')
                .in('order_id', orderIds);
            
            const existingOrderIds = new Set((existingNotes || []).map(note => note.order_id));
            
            // Only process orders that don't have cached notes yet
            // Or orders where notes were cached more than 24 hours ago (in case new notes were added)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const ordersToProcess = orderIds.filter(orderId => {
                if (!existingOrderIds.has(orderId)) {
                    return true; // No cached notes yet
                }
                
                // Check if cached notes are old (>24 hours)
                const cachedNote = existingNotes.find(note => note.order_id === orderId);
                if (cachedNote && new Date(cachedNote.cached_at) < oneDayAgo) {
                    return true; // Notes are old, refresh them
                }
                
                return false; // Skip - already have recent notes
            });
            
            const skippedCount = orderIds.length - ordersToProcess.length;
            console.log(`📊 Processing ${ordersToProcess.length} orders, skipping ${skippedCount} with recent cached notes`);
            
            if (ordersToProcess.length === 0) {
                console.log('✅ All orders already have recent cached notes - skipping API calls');
                return;
            }
            
            // Using upsert now, so no need to delete existing notes - they'll be updated automatically
            
            let notesProcessed = 0;
            let notesCount = 0;
            let errors = 0;
            let rateLimitHits = 0;
            
            // Enhanced rate limiting configuration
            const BATCH_SIZE = 5; // Smaller batches for better rate limiting
            const DELAY_BETWEEN_REQUESTS = 200; // 200ms between requests (max 5 req/sec)
            const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
            const MAX_RETRIES = 3;
            const BASE_RETRY_DELAY = 1000; // Start with 1 second
            
            for (let i = 0; i < ordersToProcess.length; i += BATCH_SIZE) {
                const batch = ordersToProcess.slice(i, i + BATCH_SIZE);
                console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(ordersToProcess.length/BATCH_SIZE)} (orders ${i + 1}-${Math.min(i + BATCH_SIZE, ordersToProcess.length)})`);
                
                for (const orderId of batch) {
                    let retryCount = 0;
                    let success = false;
                    
                    while (retryCount <= MAX_RETRIES && !success) {
                        try {
                            // Get notes from Brightpearl API with enhanced error handling
                            const result = await this.brightpearlService.brightpearlApi.getOrderNotes(orderId);
                            
                            if (result.success && result.data && result.data.length > 0) {
                                console.log(`🔍 Enriching ${result.data.length} notes with contact information for order ${orderId}...`);
                                
                                // Enrich notes with contact information before caching
                                const enrichedNotes = await this.brightpearlService.brightpearlApi.enrichNotesWithContactInfo(result.data);
                                
                                // Batch insert notes with cached contact information
                                const notesToInsert = enrichedNotes.map(note => {
                                    const noteData = {
                                        order_id: orderId,
                                        note_id: note.id.toString(), // Brightpearl API client returns id as number
                                        note_text: note.text || '', // Brightpearl API client returns text field
                                        created_by: note.addedBy ? note.addedBy.toString() : 'Unknown', // addedBy is user ID number
                                        contact_id: note.contactId || null, // contactId from Brightpearl API
                                        created_at_brightpearl: note.addedOn || new Date().toISOString(),
                                        note_type: 'order',
                                        cached_at: new Date().toISOString()
                                    };
                                    
                                    // Add cached contact information if enrichment was successful
                                    // These fields will be ignored if columns don't exist yet (backwards compatible)
                                    if (note.contactName) noteData.contact_name = note.contactName;
                                    if (note.contactEmail) noteData.contact_email = note.contactEmail;
                                    if (note.contactCompany) noteData.contact_company = note.contactCompany;
                                    if (note.addedByName) noteData.added_by_name = note.addedByName;
                                    if (note.addedByEmail) noteData.added_by_email = note.addedByEmail;
                                    
                                    return noteData;
                                });
                                
                                const { error: upsertError } = await this.appSupabase
                                    .from('cached_brightpearl_notes')
                                    .upsert(notesToInsert, { 
                                        onConflict: 'order_id,note_id',
                                        ignoreDuplicates: false 
                                    });
                                
                                if (upsertError) {
                                    console.error(`❌ Error batch upserting notes for order ${orderId}:`, upsertError);
                                } else {
                                    notesCount += result.data.length;
                                }
                            }
                            
                            success = true;
                            notesProcessed++;
                            
                        } catch (error) {
                            retryCount++;
                            
                            // Check if it's a rate limiting error
                            if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('503')) {
                                rateLimitHits++;
                                const retryDelay = BASE_RETRY_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
                                console.log(`🛑 Rate limit hit for order ${orderId} (attempt ${retryCount}/${MAX_RETRIES + 1}). Waiting ${retryDelay}ms...`);
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                                
                                // If we've hit rate limits multiple times, increase delays
                                if (rateLimitHits > 5) {
                                    console.log('🔄 Multiple rate limits detected, slowing down requests...');
                                    await new Promise(resolve => setTimeout(resolve, 5000)); // Extra 5 second delay
                                }
                            } else {
                                errors++;
                                if (retryCount <= MAX_RETRIES) {
                                    const retryDelay = BASE_RETRY_DELAY * retryCount;
                                    console.log(`⚠️ Error getting notes for order ${orderId} (attempt ${retryCount}/${MAX_RETRIES + 1}): ${error.message}. Retrying in ${retryDelay}ms...`);
                                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                                } else {
                                    console.error(`❌ Failed to get notes for order ${orderId} after ${MAX_RETRIES} retries: ${error.message}`);
                                    notesProcessed++;
                                    success = true; // Stop retrying
                                }
                            }
                        }
                        
                        // Rate limiting delay between requests
                        if (!success && retryCount <= MAX_RETRIES) {
                            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
                        }
                    }
                    
                    // Delay between requests in the same batch
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
                }
                
                // Log progress with more details
                console.log(`📊 Progress: ${Math.min(i + BATCH_SIZE, ordersToProcess.length)}/${ordersToProcess.length} orders | ${notesCount} notes cached | ${errors} errors | ${rateLimitHits} rate limits`);
                
                // Longer delay between batches, extended if we've hit rate limits
                const batchDelay = rateLimitHits > 3 ? DELAY_BETWEEN_BATCHES * 2 : DELAY_BETWEEN_BATCHES;
                if (i + BATCH_SIZE < ordersToProcess.length) {
                    console.log(`⏸️ Waiting ${batchDelay}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, batchDelay));
                }
            }
            
            console.log(`✅ Intelligent notes caching completed:`);
            console.log(`   📊 Orders processed: ${notesProcessed}/${ordersToProcess.length}`);
            console.log(`   ⏭️ Orders skipped (already cached): ${skippedCount}`);
            console.log(`   📊 Total orders: ${orderIds.length}`);
            console.log(`   📝 Notes cached: ${notesCount}`);
            console.log(`   ❌ Errors encountered: ${errors}`);
            console.log(`   🛑 Rate limit hits: ${rateLimitHits}`);
            
        } catch (error) {
            console.error('❌ Error caching Brightpearl notes:', error);
            throw error; // Re-throw to be handled by the main sync process
        }
    }

    /**
     * Generate payment links for orders that don't have them yet
     */
    async generateMissingPaymentLinks(orderIds) {
        try {
            console.log(`💳 Checking payment links for ${orderIds.length} orders...`);
            
            // Get orders that already have payment links from cached_invoices
            const { data: existingLinks } = await this.appSupabase
                .from('cached_invoices')
                .select('id, payment_link_url')
                .in('id', orderIds)
                .not('payment_link_url', 'is', null)
                .neq('payment_link_url', '');
            
            const existingLinkOrderIds = new Set((existingLinks || []).map(invoice => invoice.id));
            
            // Only generate links for orders that don't have them
            const ordersNeedingLinks = orderIds.filter(orderId => !existingLinkOrderIds.has(orderId));
            
            const skippedCount = orderIds.length - ordersNeedingLinks.length;
            console.log(`📊 Generating links for ${ordersNeedingLinks.length} orders, skipping ${skippedCount} with existing links`);
            
            if (ordersNeedingLinks.length === 0) {
                console.log('✅ All orders already have payment links - skipping generation');
                return;
            }
            
            // Generate payment links in batches to avoid overwhelming the system
            const BATCH_SIZE = 10;
            let linksGenerated = 0;
            let errors = 0;
            
            for (let i = 0; i < ordersNeedingLinks.length; i += BATCH_SIZE) {
                const batch = ordersNeedingLinks.slice(i, i + BATCH_SIZE);
                console.log(`💳 Processing payment link batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(ordersNeedingLinks.length/BATCH_SIZE)} (orders ${i + 1}-${Math.min(i + BATCH_SIZE, ordersNeedingLinks.length)})`);
                
                const batchResults = await Promise.allSettled(
                    batch.map(async (orderId) => {
                        try {
                            const result = await this.paymentLinksService.generatePaymentLink(orderId);
                            if (result.success) {
                                // Update the cached invoice with the payment link
                                await this.appSupabase
                                    .from('cached_invoices')
                                    .update({ 
                                        payment_link_url: result.paymentLink,
                                        last_updated: new Date().toISOString()
                                    })
                                    .eq('id', orderId);
                                
                                return { success: true, orderId };
                            } else {
                                return { success: false, orderId, error: result.error };
                            }
                        } catch (error) {
                            return { success: false, orderId, error: error.message };
                        }
                    })
                );
                
                // Count results
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        linksGenerated++;
                    } else {
                        errors++;
                    }
                });
                
                console.log(`💳 Progress: ${Math.min(i + BATCH_SIZE, ordersNeedingLinks.length)}/${ordersNeedingLinks.length} orders | ${linksGenerated} links generated | ${errors} errors`);
                
                // Delay between batches to be gentle on the system
                if (i + BATCH_SIZE < ordersNeedingLinks.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`✅ Payment link generation completed:`);
            console.log(`   📊 Orders processed: ${ordersNeedingLinks.length}`);
            console.log(`   ⏭️ Orders skipped (already had links): ${skippedCount}`);
            console.log(`   💳 Links generated: ${linksGenerated}`);
            console.log(`   ❌ Errors encountered: ${errors}`);
            
        } catch (error) {
            console.error('❌ Error generating payment links:', error);
            // Don't throw - payment link generation shouldn't fail the entire sync
        }
    }

    /**
     * Start a sync log entry
     */
    async startSyncLog() {
        const { data, error } = await this.appSupabase
            .from('sync_logs')
            .insert([{
                sync_started_at: new Date().toISOString(),
                status: 'running'
            }])
            .select('id')
            .single();
            
        if (error) {
            console.error('❌ Error creating sync log:', error);
            return null;
        }
        
        return data.id;
    }

    /**
     * Complete a sync log entry
     */
    async completeSyncLog(syncId, stats) {
        if (!syncId) return;
        
        await this.appSupabase
            .from('sync_logs')
            .update({
                sync_completed_at: new Date().toISOString(),
                records_processed: stats.total,
                records_updated: stats.updated,
                records_inserted: stats.inserted,
                records_deleted: stats.deleted,
                status: 'completed'
            })
            .eq('id', syncId);
    }

    /**
     * Fail a sync log entry
     */
    async failSyncLog(syncId, error) {
        if (!syncId) return;
        
        await this.appSupabase
            .from('sync_logs')
            .update({
                sync_completed_at: new Date().toISOString(),
                error_details: error.message,
                errors_encountered: 1,
                status: 'failed'
            })
            .eq('id', syncId);
    }
}

// CLI execution
if (require.main === module) {
    const syncService = new InvoiceSyncService();
    
    syncService.syncInvoiceData()
        .then(result => {
            console.log('🏁 Sync process completed:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Sync process crashed:', error);
            process.exit(1);
        });
}

module.exports = InvoiceSyncService;