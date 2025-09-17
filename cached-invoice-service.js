/**
 * Cached Invoice Service
 * Provides fast, efficient invoice data access using the cached_invoices table
 * Replaces the slow Brightpearl API calls with instant database queries
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class CachedInvoiceService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        
        console.log('✅ Cached Invoice Service initialized');
    }

    /**
     * Get unpaid invoices with advanced pagination, sorting, and filtering
     */
    async getUnpaidInvoices(startDate, endDate, page = 1, limit = 25, sortBy = 'tax_date', sortOrder = 'asc', filterOptions = {}) {
        try {
            console.log(`🔍 Fetching cached invoices: ${startDate} to ${endDate}, page ${page}, sort: ${sortBy} ${sortOrder}`, filterOptions);
            
            const offset = (page - 1) * limit;
            
            // Build base query - we'll fetch notes separately to avoid join complexity
            let query = this.supabase
                .from('cached_invoices')
                .select('*', { count: 'exact' })
                .gte('order_date', startDate)
                .lte('order_date', endDate);
            
            // Apply search filters
            if (filterOptions.searchTerm && filterOptions.searchTerm.trim()) {
                const searchTerm = filterOptions.searchTerm.trim();
                console.log(`🔍 Applying search filter: "${searchTerm}" in ${filterOptions.searchType}`);
                
                switch (filterOptions.searchType) {
                    case 'order_number':
                        if (!isNaN(searchTerm)) {
                            query = query.or(`id.eq.${searchTerm},order_reference.ilike.%${searchTerm}%`);
                        } else {
                            query = query.ilike('order_reference', `%${searchTerm}%`);
                        }
                        break;
                    case 'invoice_number':
                        query = query.ilike('invoice_number', `%${searchTerm}%`);
                        break;
                    case 'customer':
                        query = query.or(`billing_contact_name.ilike.%${searchTerm}%,billing_company_name.ilike.%${searchTerm}%,delivery_contact_name.ilike.%${searchTerm}%,delivery_company_name.ilike.%${searchTerm}%,billing_contact_email.ilike.%${searchTerm}%,delivery_contact_email.ilike.%${searchTerm}%`);
                        break;
                    case 'all':
                    default:
                        let searchConditions = [];
                        if (!isNaN(searchTerm)) {
                            searchConditions.push(`id.eq.${searchTerm}`);
                        }
                        searchConditions.push(`order_reference.ilike.%${searchTerm}%`);
                        searchConditions.push(`invoice_number.ilike.%${searchTerm}%`);
                        searchConditions.push(`billing_contact_name.ilike.%${searchTerm}%`);
                        searchConditions.push(`billing_company_name.ilike.%${searchTerm}%`);
                        searchConditions.push(`delivery_contact_name.ilike.%${searchTerm}%`);
                        searchConditions.push(`delivery_company_name.ilike.%${searchTerm}%`);
                        searchConditions.push(`billing_contact_email.ilike.%${searchTerm}%`);
                        searchConditions.push(`delivery_contact_email.ilike.%${searchTerm}%`);
                        query = query.or(searchConditions.join(','));
                        break;
                }
            }
            
            // Apply Days Outstanding filter using the computed column
            if (filterOptions.daysOutstandingFilter) {
                console.log(`🔍 Applying days outstanding filter: ${filterOptions.daysOutstandingFilter}`);
                
                switch (filterOptions.daysOutstandingFilter) {
                    case 'over90':
                        query = query.gt('days_outstanding', 90);
                        break;
                    case '60to90':
                        query = query.gte('days_outstanding', 60).lte('days_outstanding', 90);
                        break;
                    case 'over30':
                        query = query.gt('days_outstanding', 30);
                        break;
                    case '30to60':
                        query = query.gte('days_outstanding', 30).lt('days_outstanding', 60);
                        break;
                    case 'under30':
                        query = query.lt('days_outstanding', 30);
                        break;
                }
            }
            
            // Apply sorting - all database-level now!
            const ascending = sortOrder.toLowerCase() === 'asc';
            const sortColumn = this.mapSortColumn(sortBy);
            query = query.order(sortColumn, { ascending, nullsFirst: !ascending });
            
            // Apply pagination
            query = query.range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) {
                console.error('❌ Error fetching cached invoices:', error);
                return {
                    success: false,
                    error: error.message,
                    data: [],
                    count: 0,
                    total_count: 0
                };
            }
            
            console.log(`✅ Fetched ${data.length} cached invoices (page ${page})`);
            
            // Fetch cached notes for these invoices
            const orderIds = data.map(invoice => invoice.id);
            let notesMap = {};
            
            if (orderIds.length > 0) {
                const { data: notesData } = await this.supabase
                    .from('cached_brightpearl_notes')
                    .select('order_id, note_id, note_text, created_by, contact_id, created_at_brightpearl, contact_name, contact_email, contact_company, added_by_name, added_by_email')
                    .in('order_id', orderIds);
                
                // Group notes by order_id
                if (notesData) {
                    notesData.forEach(note => {
                        if (!notesMap[note.order_id]) {
                            notesMap[note.order_id] = [];
                        }
                        notesMap[note.order_id].push(note);
                    });
                }
            }
            
            // Transform data to match frontend expectations
            const formattedData = data.map(invoice => {
                const rawNotes = notesMap[invoice.id] || [];
                // Transform cached notes to frontend format
                const transformedNotes = rawNotes.map(note => {
                    // Use cached contact names or fall back to original logic
                    let addedBy = note.added_by_name || note.created_by;
                    if (addedBy === 'Unknown' && note.note_text) {
                        // Try to extract creator from note text patterns like "Created by John Doe..."
                        const createdByMatch = note.note_text.match(/^Created by ([^<.]+)/i);
                        if (createdByMatch) {
                            addedBy = createdByMatch[1].trim();
                        }
                    }
                    
                    return {
                        id: note.note_id,
                        text: note.note_text,
                        addedBy: addedBy || 'Unknown', 
                        contactId: note.contact_id || null,
                        contactName: note.contact_name || null, // Add cached contact name
                        contactEmail: note.contact_email || null, // Add cached contact email
                        contactCompany: note.contact_company || null, // Add cached contact company
                        createdOn: note.created_at_brightpearl,
                        isPrivate: false,
                        formattedDate: note.created_at_brightpearl ? new Date(note.created_at_brightpearl).toLocaleString() : null
                    };
                });
                return this.transformCacheToFrontend(invoice, transformedNotes);
            });
            
            return {
                success: true,
                data: formattedData,
                count: data.length,
                total_count: count,
                pagination: {
                    current_page: page,
                    total_pages: Math.ceil(count / limit),
                    total_count: count,
                    per_page: limit,
                    has_next_page: offset + limit < count,
                    has_prev_page: page > 1
                },
                sort: {
                    column: sortBy,
                    order: sortOrder
                },
                query_info: {
                    source: 'cached_invoices',
                    cache_age: 'Updated every 15 minutes'
                }
            };
            
        } catch (error) {
            console.error('❌ Error in getUnpaidInvoices:', error);
            return {
                success: false,
                error: error.message,
                data: [],
                count: 0,
                total_count: 0
            };
        }
    }

    /**
     * Get invoice statistics - use original Brightpearl service for accurate financial data
     */
    async getOrderStatistics(startDate, endDate) {
        try {
            console.log(`📊 Calculating statistics from cached data + Brightpearl: ${startDate} to ${endDate}`);
            
            // Get unpaid orders count from cache (fast)
            const { count: unpaid_orders } = await this.supabase
                .from('cached_invoices')
                .select('*', { count: 'exact', head: true })
                .gte('order_date', startDate)
                .lte('order_date', endDate);
            
            // Use original Brightpearl service for complete financial calculations
            // This ensures accurate totals including all paid orders
            const SupabaseBrightpearlService = require('./supabase-brightpearl-service');
            const brightpearlService = new SupabaseBrightpearlService();
            
            const fullStats = await brightpearlService.getOrderStatistics(startDate, endDate);
            
            if (!fullStats.success) {
                // Fallback to cache-only calculation if Brightpearl fails
                console.log('⚠️ Brightpearl stats failed, using cache estimates');
                
                const { data: unpaidStats } = await this.supabase
                    .from('cached_invoices')
                    .select('total_amount, paid_amount, outstanding_amount')
                    .gte('order_date', startDate)
                    .lte('order_date', endDate);
                
                const unpaid_amount = unpaidStats?.reduce((sum, inv) => sum + parseFloat(inv.outstanding_amount || 0), 0) || 0;
                const estimated_total_orders = unpaid_orders > 0 ? Math.round(unpaid_orders / 0.141) : unpaid_orders;
                const estimated_paid_orders = Math.max(0, estimated_total_orders - unpaid_orders);
                
                return {
                    success: true,
                    statistics: {
                        total_orders: estimated_total_orders,
                        paid_orders: estimated_paid_orders,
                        unpaid_orders: unpaid_orders || 0,
                        total_amount: unpaid_amount * 2, // Rough estimate
                        paid_amount: unpaid_amount, // Rough estimate  
                        unpaid_amount: unpaid_amount,
                        earliest_order: null,
                        latest_order: null
                    },
                    date_range: {
                        start_date: startDate,
                        end_date: endDate
                    }
                };
            }
            
            // Use Brightpearl's accurate financial totals but override unpaid count with cache
            const statistics = {
                ...fullStats.statistics,
                unpaid_orders: unpaid_orders || 0 // Use accurate cache count
            };
            
            console.log('✅ Hybrid statistics calculated (cache + Brightpearl)');
            
            return {
                success: true,
                statistics: statistics,
                date_range: fullStats.date_range
            };
            
        } catch (error) {
            console.error('❌ Error calculating statistics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Map frontend sort columns to database columns
     */
    mapSortColumn(sortBy) {
        const columnMap = {
            'id': 'id',
            'reference': 'order_reference', 
            'invoicenumber': 'invoice_number',
            'totalvalue': 'total_amount',
            'customercontact_id': 'billing_contact_name',
            'deliverycontact_id': 'delivery_contact_name', 
            'company_name': 'billing_company_name',
            'payment_status': 'payment_status',
            'days_outstanding': 'days_outstanding',
            'order_status': 'order_status_name',
            'shipping_status': 'shipping_status_name',
            'stock_status': 'stock_status_name',
            'taxdate': 'tax_date',
            'placedon': 'order_date'
        };
        
        return columnMap[sortBy] || 'tax_date';
    }

    /**
     * Transform cached data to frontend format
     */
    transformCacheToFrontend(invoice, brightpearlNotes = []) {
        return {
            id: invoice.id,
            orderNumber: `#${invoice.id}`,
            orderRef: invoice.order_reference,
            invoiceNumber: invoice.invoice_number,
            orderDate: invoice.order_date,
            invoiceDate: invoice.order_date,
            taxDate: invoice.tax_date,
            totalAmount: parseFloat(invoice.total_amount),
            paidAmount: parseFloat(invoice.paid_amount || 0),
            outstandingAmount: parseFloat(invoice.outstanding_amount),
            paymentStatus: invoice.payment_status,
            paymentStatusColor: invoice.payment_status === 'PAID' ? '#28a745' : '#dc3545',
            orderStatus: invoice.order_status_name,
            orderStatusColor: invoice.order_status_color,
            shippingStatus: invoice.shipping_status_name,
            shippingStatusColor: invoice.shipping_status_color,
            stockStatus: invoice.stock_status_name,
            stockStatusColor: invoice.stock_status_color,
            statusColor: invoice.payment_status === 'PAID' ? '#28a745' : '#dc3545',
            days_outstanding: invoice.days_outstanding,
            companyName: invoice.billing_company_name,
            billingContact: {
                id: invoice.billing_contact_id,
                name: invoice.billing_contact_name,
                email: invoice.billing_contact_email,
                firstName: (invoice.billing_contact_name || '').split(' ')[0] || 'Billing',
                lastName: (invoice.billing_contact_name || '').split(' ').slice(1).join(' ') || 'Contact'
            },
            deliveryContact: {
                name: invoice.delivery_contact_name,
                email: invoice.delivery_contact_email,
                firstName: (invoice.delivery_contact_name || '').split(' ')[0] || 'Delivery', 
                lastName: (invoice.delivery_contact_name || '').split(' ').slice(1).join(' ') || 'Contact'
            },
            // Add customer object for backward compatibility
            customer: {
                name: invoice.billing_contact_name,
                email: invoice.billing_contact_email
            },
            // Add company object for backward compatibility
            company: {
                name: invoice.billing_company_name || 'N/A'
            },
            notesCount: invoice.user_notes_count || 0,
            brightpearlNotesCount: brightpearlNotes.length, // Use actual count of cached notes
            paymentLink: invoice.payment_link_url,
            hasPaymentLink: !!(invoice.payment_link_url && invoice.payment_link_url.trim()),
            // Add cached Brightpearl notes
            brightpearlNotes: brightpearlNotes
        };
    }

    /**
     * Get sync status information
     */
    async getSyncStatus() {
        try {
            const { data: latestSync } = await this.supabase
                .from('sync_logs')
                .select('*')
                .order('sync_started_at', { ascending: false })
                .limit(1)
                .single();
                
            const { count: totalCached } = await this.supabase
                .from('cached_invoices')
                .select('*', { count: 'exact', head: true });
            
            return {
                success: true,
                sync_status: latestSync,
                total_cached_invoices: totalCached,
                last_sync: latestSync?.sync_completed_at
            };
            
        } catch (error) {
            console.error('❌ Error getting sync status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = CachedInvoiceService;