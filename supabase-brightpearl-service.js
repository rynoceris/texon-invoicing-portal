const { createClient } = require('@supabase/supabase-js');
const BrightpearlApiClient = require('./brightpearl-api-client');
const PaymentLinksService = require('./payment-links-service');

class SupabaseBrightpearlService {
    constructor() {
        // Use the Brightpearl data Supabase instance
        this.supabaseUrl = process.env.BRIGHTPEARL_DATA_SUPABASE_URL;
        this.supabaseServiceKey = process.env.BRIGHTPEARL_DATA_SUPABASE_SERVICE_KEY;
        
        if (!this.supabaseUrl || !this.supabaseServiceKey) {
            throw new Error('Missing Brightpearl Supabase configuration');
        }
        
        this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            db: {
                schema: 'brightpearl_texonbrightpearl_12537_2'
            }
        });
        
        // App settings Supabase instance (for accessing ignored order statuses setting)
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
        
        // Initialize lookup tables
        this.orderStatusLookup = new Map();
        this.shippingStatusLookup = new Map();
        this.stockStatusLookup = new Map();
        
        // Initialize Brightpearl API client for direct API access
        this.brightpearlApi = new BrightpearlApiClient();
        
        // Initialize Payment Links service
        this.paymentLinksService = new PaymentLinksService();
        
        console.log('✅ Supabase Brightpearl service initialized');
        console.log('🔧 Supabase URL:', this.supabaseUrl);
        console.log('🔧 Using schema: brightpearl_texonbrightpearl_12537_2');
        
        // Load lookup tables on initialization
        this.loadLookupTables();
    }
    
    /**
     * Load status lookup tables from database
     */
    async loadLookupTables() {
        try {
            // Load order status lookup
            const { data: orderStatuses } = await this.supabase
                .from('orderstatus')
                .select('name, statusid, color, ordertypecode')
                .eq('ordertypecode', 'SO'); // Only sales order statuses
                
            if (orderStatuses) {
                orderStatuses.forEach(status => {
                    this.orderStatusLookup.set(status.statusid, {
                        name: status.name,
                        color: status.color || '#6c757d'
                    });
                });
                console.log(`📋 Loaded ${orderStatuses.length} order status mappings`);
            }
            
            // Load shipping status lookup
            const { data: shippingStatuses } = await this.supabase
                .from('ordershippingstatus')
                .select('id, description, code');
                
            if (shippingStatuses) {
                shippingStatuses.forEach(status => {
                    this.shippingStatusLookup.set(status.code, {
                        name: status.description,
                        color: '#6c757d' // Default color since table doesn't have color
                    });
                });
                console.log(`🚚 Loaded ${shippingStatuses.length} shipping status mappings`);
            }
            
            // Load stock status lookup  
            const { data: stockStatuses } = await this.supabase
                .from('orderstockstatus')
                .select('id, description, code');
                
            if (stockStatuses) {
                stockStatuses.forEach(status => {
                    this.stockStatusLookup.set(status.code, {
                        name: status.description,
                        color: '#6c757d' // Default color since table doesn't have color
                    });
                });
                console.log(`📦 Loaded ${stockStatuses.length} stock status mappings`);
            }
            
        } catch (error) {
            console.error('❌ Error loading lookup tables:', error);
        }
    }

    /**
     * Test the connection to the Brightpearl schema
     */
    async testConnection() {
        try {
            // Try to access the order table with a simple count query
            const { data, error, count } = await this.supabase
                .from('order')
                .select('*', { count: 'exact', head: true })
                .limit(1);

            if (error) {
                console.error('❌ Supabase connection test failed:', error);
                return {
                    success: false,
                    error: error.message,
                    details: error
                };
            }

            console.log('✅ Supabase connection test successful');
            return {
                success: true,
                message: 'Successfully connected to Brightpearl data',
                record_count: count,
                connection_time: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Supabase connection test error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get unpaid invoices with pagination and sorting
     */
    async getUnpaidInvoices(startDate = '2024-01-01', endDate = '2025-12-31', page = 1, limit = 25, sortBy = 'taxdate', sortOrder = 'asc', filterOptions = {}) {
        try {
            const offset = (page - 1) * limit;
            
            // Get ignored order statuses
            const ignoredStatusIds = await this.getIgnoredOrderStatuses();
            
            // Build the base query 
            let query = this.supabase
                .from('order')
                .select(`
                    id,
                    reference,
                    placedon,
                    total,
                    orderpaymentstatus,
                    billingcontactid,
                    stockstatuscode,
                    shippingstatuscode,
                    orderstatusid,
                    billingaddressfullname,
                    billingcompanyname,
                    deliveryaddressfullname,
                    deliverycompanyname,
                    billingemail,
                    deliveryemail
                `, { count: 'exact' })
            
            // Apply common filters to both query types
            query = query
                .eq('isdeleted', false)
                .eq('ordertypecode', 'SO')
                .gte('placedon', startDate)
                .lte('placedon', endDate)
                .not('total', 'is', null)
                .gt('total', 0)
                .or('orderpaymentstatus.neq.PAID,orderpaymentstatus.is.null');

            // Exclude ignored order statuses if any are configured
            if (ignoredStatusIds.length > 0) {
                query = query.not('orderstatusid', 'in', `(${ignoredStatusIds.join(',')})`);
                console.log(`🔍 Excluding orders with status IDs: [${ignoredStatusIds.join(', ')}]`);
            }

            // Note: Days Outstanding filtering is now handled after data fetching
            // since we need to consider tax dates which come from a separate table
            // The filter is applied in post-processing after formatInvoiceData()

            // Apply search filter
            if (filterOptions.searchTerm && filterOptions.searchTerm.trim()) {
                const searchTerm = filterOptions.searchTerm.trim();
                console.log(`🔍 Applying search filter: "${searchTerm}" in ${filterOptions.searchType}`);
                
                // Check if we need to search invoice numbers and get matching order IDs
                let invoiceOrderIds = [];
                if (filterOptions.searchType === 'all' || filterOptions.searchType === 'invoice_number') {
                    invoiceOrderIds = await this.searchInvoiceNumbers(searchTerm);
                    console.log(`🧾 Found ${invoiceOrderIds.length} orders matching invoice number search`);
                }
                
                switch (filterOptions.searchType) {
                    case 'order_number':
                        // Search in order ID and reference - need to handle numeric ID search carefully
                        if (!isNaN(searchTerm)) {
                            query = query.or(`id.eq.${searchTerm},reference.ilike.%${searchTerm}%`);
                        } else {
                            query = query.ilike('reference', `%${searchTerm}%`);
                        }
                        break;
                    case 'invoice_number':
                        // Search only in invoice references
                        if (invoiceOrderIds.length > 0) {
                            query = query.in('id', invoiceOrderIds);
                        } else {
                            // No matching invoices found, return no results
                            query = query.eq('id', -1);
                        }
                        break;
                    case 'customer':
                        // Search in customer name and email fields
                        query = query.or(`billingaddressfullname.ilike.%${searchTerm}%,billingcompanyname.ilike.%${searchTerm}%,deliveryaddressfullname.ilike.%${searchTerm}%,deliverycompanyname.ilike.%${searchTerm}%,billingemail.ilike.%${searchTerm}%,deliveryemail.ilike.%${searchTerm}%`);
                        break;
                    case 'all':
                    default:
                        // Search in all relevant fields including invoice numbers
                        let searchConditions = [];
                        
                        // Add order fields
                        if (!isNaN(searchTerm)) {
                            searchConditions.push(`id.eq.${searchTerm}`);
                        }
                        searchConditions.push(`reference.ilike.%${searchTerm}%`);
                        searchConditions.push(`billingaddressfullname.ilike.%${searchTerm}%`);
                        searchConditions.push(`billingcompanyname.ilike.%${searchTerm}%`);
                        searchConditions.push(`deliveryaddressfullname.ilike.%${searchTerm}%`);
                        searchConditions.push(`deliverycompanyname.ilike.%${searchTerm}%`);
                        searchConditions.push(`billingemail.ilike.%${searchTerm}%`);
                        searchConditions.push(`deliveryemail.ilike.%${searchTerm}%`);
                        
                        // If invoice search found matches, add those order IDs to the search
                        if (invoiceOrderIds.length > 0) {
                            query = query.or(`${searchConditions.join(',')},id.in.(${invoiceOrderIds.join(',')})`);
                        } else {
                            query = query.or(searchConditions.join(','));
                        }
                        break;
                }
            }

            // Apply sorting
            const ascending = sortOrder.toLowerCase() === 'asc';
            switch (sortBy) {
                case 'id':
                    query = query.order('id', { ascending });
                    break;
                case 'reference':
                    query = query.order('reference', { ascending });
                    break;
                case 'invoicenumber':
                    // Note: Cannot sort by invoice number since it requires separate lookup
                    query = query.order('id', { ascending });
                    break;
                case 'totalvalue':
                    query = query.order('total', { ascending });
                    break;
                case 'customercontact_id':
                    query = query.order('billingcontactid', { ascending });
                    break;
                case 'deliverycontact_id':
                    query = query.order('deliveryaddressfullname', { ascending });
                    break;
                case 'company_name':
                    query = query.order('billingcompanyname', { ascending });
                    break;
                case 'payment_status':
                    query = query.order('orderpaymentstatus', { ascending });
                    break;
                case 'order_status':
                    query = query.order('orderstatusid', { ascending });
                    break;
                case 'shipping_status':
                    query = query.order('shippingstatuscode', { ascending });
                    break;
                case 'stock_status':
                    query = query.order('stockstatuscode', { ascending });
                    break;
                case 'taxdate':
                    // For taxdate sorting, we need to fetch all data and sort in memory
                    // Don't apply any ordering here - will be handled in post-processing
                    query = query.order('id', { ascending: true }); // Consistent base ordering
                    break;
                case 'days_outstanding':
                case 'placedon':
                default:
                    query = query.order('placedon', { ascending });
                    break;
            }

            // Apply pagination (same for all sorts to avoid rate limiting)
            query = query.range(offset, offset + limit - 1);
            const { data, error, count } = await query;

            if (error) {
                console.error('❌ Error fetching unpaid invoices:', error);
                return {
                    success: false,
                    error: error.message,
                    data: [],
                    count: 0,
                    total_count: 0
                };
            }

            console.log(`✅ Fetched ${data.length} unpaid invoices (page ${page})`);
            
            // Get payment data for these orders to calculate outstanding balances
            const orderIds = data.map(order => order.id);
            const paymentData = await this.getPaymentDataForOrders(orderIds);
            
            // Get invoice references for these orders
            const invoiceData = await this.getInvoiceReferencesForOrders(orderIds);
            
            // Get notes count for these orders (user notes)
            const notesData = await this.getNotesCountForOrders(orderIds);
            
            // Temporarily disable Brightpearl notes to reduce API load during rate limiting
            // const brightpearlNotesData = await this.getBrightpearlNotesForOrders(orderIds);
            const brightpearlNotesData = {};
            
            // Get payment links for these orders
            const paymentLinksData = await this.paymentLinksService.getPaymentLinksForOrders(orderIds);
            
            // Get tax date data for these orders
            const taxDateData = await this.getTaxDateForOrders(orderIds);
            
            // Format the data
            let formattedData = this.formatInvoiceData(data, paymentData, notesData, invoiceData, brightpearlNotesData, paymentLinksData, taxDateData);
            
            // Apply Days Outstanding filter based on tax date (post-processing)
            if (filterOptions.daysOutstandingFilter) {
                const now = new Date();
                formattedData = formattedData.filter(invoice => {
                    const daysOutstanding = invoice.days_outstanding;
                    
                    switch (filterOptions.daysOutstandingFilter) {
                        case 'over90':
                            return daysOutstanding > 90;
                        case '60to90':
                            return daysOutstanding >= 60 && daysOutstanding <= 90;
                        case '30to60':
                            return daysOutstanding >= 30 && daysOutstanding < 60;
                        case 'under30':
                            return daysOutstanding < 30;
                        default:
                            return true;
                    }
                });
                console.log(`🔍 Applied days outstanding filter (${filterOptions.daysOutstandingFilter}): ${formattedData.length} invoices remaining`);
            }
            
            // Handle special sorting cases that require post-fetch processing
            if (sortBy === 'taxdate') {
                const ascending = sortOrder.toLowerCase() === 'asc';
                formattedData.sort((a, b) => {
                    const dateA = a.taxDate ? new Date(a.taxDate) : new Date(0); // Orders without tax date go to beginning/end
                    const dateB = b.taxDate ? new Date(b.taxDate) : new Date(0);
                    
                    if (ascending) {
                        return dateA - dateB;
                    } else {
                        return dateB - dateA;
                    }
                });
            }
            
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
     * Get details for a single order by ID
     */
    async getOrderDetails(orderId) {
        try {
            console.log(`🔍 Fetching order details for order ${orderId}...`);
            
            // Get the single order with customer data (same fields as main dashboard)
            const { data: orderData, error: orderError } = await this.supabase
                .from('order')
                .select(`
                    id,
                    reference,
                    placedon,
                    total,
                    orderpaymentstatus,
                    billingcontactid,
                    stockstatuscode,
                    shippingstatuscode,
                    orderstatusid,
                    billingaddressfullname,
                    billingcompanyname,
                    deliveryaddressfullname,
                    deliverycompanyname,
                    billingemail,
                    deliveryemail
                `)
                .eq('id', orderId)
                .single();

            if (orderError) {
                console.error('❌ Error fetching order:', orderError);
                return { success: false, error: orderError.message };
            }

            if (!orderData) {
                return { success: false, error: 'Order not found' };
            }

            // Format the order data using direct fields (same approach as main dashboard)
            const customerName = orderData.billingaddressfullname || orderData.deliveryaddressfullname || 'Valued Customer';
            const customerEmail = orderData.billingemail || orderData.deliveryemail || '';
            
            console.log('✅ Customer data from order:', { customerName, customerEmail });
            
            // Get invoice reference for this order (same as payment links service)
            let invoiceReference = null;
            try {
                const { data: invoiceData, error: invoiceError } = await this.supabase
                    .from('orderinvoice')
                    .select('invoicereference')
                    .eq('orderid', orderId)
                    .not('invoicereference', 'is', null)
                    .neq('invoicereference', '')
                    .limit(1);
                
                if (!invoiceError && invoiceData && invoiceData.length > 0) {
                    invoiceReference = invoiceData[0].invoicereference;
                    console.log('🧾 Found invoice reference:', invoiceReference);
                }
            } catch (invoiceErr) {
                console.warn(`⚠️ Could not fetch invoice reference for order ${orderId}:`, invoiceErr);
            }
            
            const formattedOrder = {
                id: orderData.id,
                orderRef: orderData.reference,
                orderDate: orderData.placedon,
                totalAmount: orderData.total,
                paymentStatus: orderData.orderpaymentstatus || 'UNPAID',
                orderStatus: this.getOrderStatusFromId(orderData.orderstatusid).name,
                orderStatusColor: this.getOrderStatusFromId(orderData.orderstatusid).color,
                invoiceReference: invoiceReference,  // Add invoice reference for email templates
                billingContact: {
                    id: orderData.billingcontactid,
                    name: customerName,
                    email: customerEmail
                },
                customer: {
                    id: orderData.billingcontactid,
                    name: customerName,
                    email: customerEmail
                }
            };

            console.log('✅ Order details fetched successfully');
            return { success: true, data: formattedOrder };

        } catch (error) {
            console.error('❌ Error in getOrderDetails:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get order statistics for a date range using batched processing
     */
    async getOrderStatistics(startDate = '2024-01-01', endDate = '2025-12-31') {
        try {
            const batchSize = 1000;
            let offset = 0;
            let hasMoreData = true;
            
            // Get ignored order statuses
            const ignoredStatusIds = await this.getIgnoredOrderStatuses();
            
            // Initialize counters
            let totalOrders = 0;
            let paidOrders = 0;
            let unpaidOrders = 0;
            let totalAmount = 0;
            let paidAmount = 0;
            let unpaidAmount = 0;

            console.log('📊 Calculating statistics in batches...');
            if (ignoredStatusIds.length > 0) {
                console.log(`🔍 Excluding orders with status IDs: [${ignoredStatusIds.join(', ')}] from statistics`);
            }

            while (hasMoreData) {
                // Fetch batch of data
                let query = this.supabase
                    .from('order')
                    .select('orderpaymentstatus, total, orderstatusid')
                    .eq('isdeleted', false)
                    .eq('ordertypecode', 'SO')
                    .gte('placedon', startDate)
                    .lte('placedon', endDate)
                    .not('total', 'is', null)
                    .gt('total', 0);

                // Exclude ignored order statuses if any are configured
                if (ignoredStatusIds.length > 0) {
                    query = query.not('orderstatusid', 'in', `(${ignoredStatusIds.join(',')})`);
                }

                const { data: batchData, error: batchError } = await query
                    .range(offset, offset + batchSize - 1);

                if (batchError) {
                    console.error('❌ Error fetching batch statistics:', batchError);
                    return {
                        success: false,
                        error: batchError.message
                    };
                }

                // Process this batch
                if (batchData && batchData.length > 0) {
                    batchData.forEach(order => {
                        const amount = parseFloat(order.total) || 0;
                        totalAmount += amount;
                        totalOrders++;

                        if (order.orderpaymentstatus === 'PAID') {
                            paidOrders++;
                            paidAmount += amount;
                        } else {
                            unpaidOrders++;
                            unpaidAmount += amount;
                        }
                    });

                    console.log(`📊 Processed batch: ${offset + 1}-${offset + batchData.length} (${batchData.length} records)`);
                    
                    // Check if we have more data
                    hasMoreData = batchData.length === batchSize;
                    offset += batchSize;
                } else {
                    hasMoreData = false;
                }
            }

            const statistics = {
                total_orders: totalOrders,
                paid_orders: paidOrders,
                unpaid_orders: unpaidOrders,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                unpaid_amount: unpaidAmount
            };

            console.log('✅ Complete statistics calculated:', statistics);
            console.log(`📊 Processed ${totalOrders} total orders in batches`);
            
            return {
                success: true,
                statistics: statistics
            };

        } catch (error) {
            console.error('❌ Error in getOrderStatistics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get payment data for a list of order IDs
     */
    async getPaymentDataForOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {};
        }

        try {
            const paymentsByOrder = {};
            const batchSize = 1000; // Process in batches to handle large datasets
            let offset = 0;
            let hasMoreData = true;
            let totalPaymentsProcessed = 0;

            console.log(`💰 Loading customer payment data for ${orderIds.length} orders...`);

            while (hasMoreData) {
                const { data, error } = await this.supabase
                    .from('customerpayment')
                    .select('orderid, amountpaid')
                    .in('orderid', orderIds)
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error('❌ Error fetching payment data batch:', error);
                    return {};
                }

                // Process this batch
                if (data && data.length > 0) {
                    data.forEach(payment => {
                        const orderId = payment.orderid;
                        if (!paymentsByOrder[orderId]) {
                            paymentsByOrder[orderId] = 0;
                        }
                        paymentsByOrder[orderId] += parseFloat(payment.amountpaid || 0);
                    });

                    totalPaymentsProcessed += data.length;
                    // Reduced logging - only log if significant batch size
                    if (data.length > 50) {
                        console.log(`💰 Processed customer payment batch: ${offset + 1}-${offset + data.length} (${data.length} payments)`);
                    }
                    
                    // Check if we have more data
                    hasMoreData = data.length === batchSize;
                    offset += batchSize;
                } else {
                    hasMoreData = false;
                }
            }

            const ordersWithPayments = Object.keys(paymentsByOrder);
            console.log(`💰 Loaded customer payment data for ${ordersWithPayments.length} orders (${totalPaymentsProcessed} total payments processed)`);
            
            if (ordersWithPayments.length > 0) {
                const nonZeroPayments = ordersWithPayments.filter(orderId => paymentsByOrder[orderId] > 0);
                console.log(`💰 Found ${nonZeroPayments.length} orders with actual payments`);
                
                // Show a few examples of non-zero payments for verification
                if (nonZeroPayments.length > 0) {
                    nonZeroPayments.slice(0, 2).forEach(orderId => {
                        console.log(`   Order ${orderId}: $${paymentsByOrder[orderId].toFixed(2)} paid`);
                    });
                }
            }
            
            return paymentsByOrder;

        } catch (error) {
            console.error('❌ Error in getPaymentDataForOrders:', error);
            return {};
        }
    }

    /**
     * Search for order IDs that have matching invoice numbers
     */
    async searchInvoiceNumbers(searchTerm) {
        try {
            const { data, error } = await this.supabase
                .from('orderinvoice')
                .select('orderid')
                .ilike('invoicereference', `%${searchTerm}%`);

            if (error) {
                console.error('❌ Error searching invoice numbers:', error);
                return [];
            }

            if (data && data.length > 0) {
                return data.map(invoice => invoice.orderid);
            }

            return [];

        } catch (error) {
            console.error('❌ Error in searchInvoiceNumbers:', error);
            return [];
        }
    }

    /**
     * Get invoice references for a list of order IDs
     */
    async getInvoiceReferencesForOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {};
        }

        try {
            const invoicesByOrder = {};
            
            console.log(`🧾 Loading invoice references for ${orderIds.length} orders...`);

            const { data, error } = await this.supabase
                .from('orderinvoice')
                .select('orderid, invoicereference')
                .in('orderid', orderIds)
                .not('invoicereference', 'is', null)
                .neq('invoicereference', '');

            if (error) {
                console.error('❌ Error fetching invoice references:', error);
                return {};
            }

            // Map invoice references by order_id
            if (data && data.length > 0) {
                data.forEach(invoice => {
                    const orderId = invoice.orderid;
                    invoicesByOrder[orderId] = invoice.invoicereference;
                });
            }

            const ordersWithInvoices = Object.keys(invoicesByOrder);
            console.log(`🧾 Found invoice references for ${ordersWithInvoices.length} orders`);
            
            return invoicesByOrder;

        } catch (error) {
            console.error('❌ Error in getInvoiceReferencesForOrders:', error);
            return {};
        }
    }

    /**
     * Get notes count for a list of order IDs
     */
    async getNotesCountForOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {};
        }

        try {
            const notesByOrder = {};
            
            console.log(`📝 Loading notes count for ${orderIds.length} orders...`);

            const { data, error } = await this.appSupabase
                .from('order_notes')
                .select('order_id')
                .in('order_id', orderIds);

            if (error) {
                console.error('❌ Error fetching notes count:', error);
                return {};
            }

            // Count notes by order_id
            if (data && data.length > 0) {
                data.forEach(note => {
                    const orderId = note.order_id;
                    if (!notesByOrder[orderId]) {
                        notesByOrder[orderId] = 0;
                    }
                    notesByOrder[orderId]++;
                });
            }

            const ordersWithNotes = Object.keys(notesByOrder);
            console.log(`📝 Found notes for ${ordersWithNotes.length} orders`);
            
            return notesByOrder;

        } catch (error) {
            console.error('❌ Error in getNotesCountForOrders:', error);
            return {};
        }
    }

    /**
     * Get Brightpearl order notes for a list of order IDs
     */
    async getBrightpearlNotesForOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {};
        }

        try {
            console.log(`📝 Loading Brightpearl order notes for ${orderIds.length} orders...`);
            
            const result = await this.brightpearlApi.getOrderNotesForMultipleOrders(orderIds);
            
            if (result.success) {
                console.log(`📝 Retrieved ${result.count} Brightpearl notes for ${result.ordersWithNotes}/${orderIds.length} orders`);
                return result.data;
            } else {
                console.error('❌ Error fetching Brightpearl notes:', result.error);
                return {};
            }

        } catch (error) {
            console.error('❌ Error in getBrightpearlNotesForOrders:', error);
            return {};
        }
    }

    /**
     * Get tax date data for a list of order IDs from orderinvoice table
     */
    async getTaxDateForOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {};
        }

        try {
            const taxDatesByOrder = {};
            
            console.log(`📅 Loading tax date data for ${orderIds.length} orders...`);

            const { data, error } = await this.supabase
                .from('orderinvoice')
                .select('orderid, taxdate')
                .in('orderid', orderIds)
                .eq('isdeleted', false)
                .not('taxdate', 'is', null);

            if (error) {
                console.error('❌ Error fetching tax date data:', error);
                return {};
            }

            // Map tax dates by order_id
            if (data && data.length > 0) {
                data.forEach(invoice => {
                    const orderId = invoice.orderid;
                    taxDatesByOrder[orderId] = invoice.taxdate;
                });
            }

            const ordersWithTaxDate = Object.keys(taxDatesByOrder);
            console.log(`📅 Found tax dates for ${ordersWithTaxDate.length} orders`);
            
            return taxDatesByOrder;

        } catch (error) {
            console.error('❌ Error in getTaxDateForOrders:', error);
            return {};
        }
    }

    /**
     * Format invoice data for the frontend
     */
    formatInvoiceData(invoices, paymentData = {}, notesData = {}, invoiceData = {}, brightpearlNotesData = {}, paymentLinksData = {}, taxDateData = {}) {
        return invoices.map(invoice => {
            const orderDate = new Date(invoice.placedon);
            // Calculate days outstanding based on tax date if available, otherwise fall back to order date
            const taxDate = taxDateData[invoice.id] ? new Date(taxDateData[invoice.id]) : null;
            const baseDate = taxDate || orderDate; // Use tax date if available, otherwise order date
            const daysOutstanding = Math.floor((new Date() - baseDate) / (1000 * 60 * 60 * 24));
            
            const totalAmount = parseFloat(invoice.total || 0);
            const paidAmount = paymentData[invoice.id] || 0;
            const outstandingAmount = totalAmount - paidAmount;
            
            return {
                id: invoice.id,
                orderNumber: `#${invoice.id}`, // Always use actual Brightpearl order ID
                orderRef: invoice.reference,
                invoiceNumber: invoiceData[invoice.id] || null,
                orderDate: invoice.placedon,
                invoiceDate: invoice.placedon, // Using placedon as invoice date
                taxDate: taxDateData[invoice.id] || null, // Tax date from orderinvoice table
                totalAmount: totalAmount,
                paidAmount: paidAmount,
                outstandingAmount: outstandingAmount,
                paymentStatus: invoice.orderpaymentstatus || 'UNKNOWN',
                paymentStatusColor: this.getPaymentStatusColor(invoice.orderpaymentstatus),
                
                // Use lookup tables for status information
                orderStatus: this.getOrderStatusFromId(invoice.orderstatusid).name,
                orderStatusColor: this.getOrderStatusFromId(invoice.orderstatusid).color,
                
                stockStatus: this.getStockStatusFromCode(invoice.stockstatuscode).name,
                stockStatusColor: this.getStockStatusFromCode(invoice.stockstatuscode).color,
                
                shippingStatus: this.getShippingStatusFromCode(invoice.shippingstatuscode).name,
                shippingStatusColor: this.getShippingStatusFromCode(invoice.shippingstatuscode).color,
                
                // Keep legacy statusColor for backward compatibility
                statusColor: this.getPaymentStatusColor(invoice.orderpaymentstatus),
                days_outstanding: daysOutstanding,
                // Billing Contact Information
                billingContact: {
                    id: invoice.billingcontactid,
                    name: invoice.billingaddressfullname || `Billing Contact ${invoice.billingcontactid || 'Unknown'}`,
                    email: invoice.billingemail || `billing${invoice.billingcontactid || 'unknown'}@example.com`,
                    firstName: (invoice.billingaddressfullname || '').split(' ')[0] || 'Billing',
                    lastName: (invoice.billingaddressfullname || '').split(' ').slice(1).join(' ') || (invoice.billingcontactid || 'Unknown')
                },
                // Delivery Contact Information
                deliveryContact: {
                    id: invoice.billingcontactid, // Use billing contact ID since delivery contact ID doesn't exist
                    name: invoice.deliveryaddressfullname || invoice.billingaddressfullname || `Delivery Contact ${invoice.billingcontactid || 'Unknown'}`,
                    email: invoice.deliveryemail || invoice.billingemail || `delivery${invoice.billingcontactid || 'unknown'}@example.com`,
                    firstName: (invoice.deliveryaddressfullname || invoice.billingaddressfullname || '').split(' ')[0] || 'Delivery',
                    lastName: (invoice.deliveryaddressfullname || invoice.billingaddressfullname || '').split(' ').slice(1).join(' ') || (invoice.billingcontactid || 'Unknown')
                },
                // Keep legacy customer object for backward compatibility
                customer: {
                    id: invoice.billingcontactid,
                    name: invoice.billingaddressfullname || invoice.deliveryaddressfullname || `Customer ${invoice.billingcontactid || 'Unknown'}`,
                    email: invoice.billingemail || invoice.deliveryemail || `customer${invoice.billingcontactid || 'unknown'}@example.com`,
                    firstName: (invoice.billingaddressfullname || '').split(' ')[0] || 'Customer',
                    lastName: (invoice.billingaddressfullname || '').split(' ').slice(1).join(' ') || (invoice.billingcontactid || 'Unknown')
                },
                company: {
                    id: invoice.billingcontactid,
                    name: invoice.billingcompanyname || invoice.deliverycompanyname || `Company ${invoice.billingcontactid || 'Unknown'}`
                },
                // Notes information (user notes)
                notesCount: notesData[invoice.id] || 0,
                hasNotes: (notesData[invoice.id] || 0) > 0,
                
                // Brightpearl order notes
                brightpearlNotes: brightpearlNotesData[invoice.id] || [],
                brightpearlNotesCount: (brightpearlNotesData[invoice.id] || []).length,
                hasBrightpearlNotes: (brightpearlNotesData[invoice.id] || []).length > 0,
                
                // Payment link
                paymentLink: paymentLinksData[invoice.id]?.payment_link || null,
                hasPaymentLink: !!paymentLinksData[invoice.id]?.payment_link
            };
        });
    }

    /**
     * Get ignored order status IDs from app settings
     */
    async getIgnoredOrderStatuses() {
        try {
            const { data: setting, error } = await this.appSupabase
                .from('app_settings')
                .select('value')
                .eq('key', 'ignored_order_statuses')
                .single();

            if (error || !setting || !setting.value) {
                return [];
            }

            // Parse the comma-separated list of status IDs
            const statusIds = setting.value
                .split(',')
                .map(id => parseInt(id.trim()))
                .filter(id => !isNaN(id));

            console.log(`🔍 Ignored order statuses: [${statusIds.join(', ')}]`);
            return statusIds;
            
        } catch (error) {
            console.error('❌ Error fetching ignored order statuses:', error);
            return [];
        }
    }

    /**
     * Helper methods for status formatting using lookup tables
     */
    getOrderStatusFromId(orderStatusId) {
        const status = this.orderStatusLookup.get(orderStatusId);
        return {
            name: status?.name || `Status ${orderStatusId}` || 'Unknown',
            color: status?.color || '#6c757d'
        };
    }

    getStockStatusFromCode(stockStatusCode) {
        const status = this.stockStatusLookup.get(stockStatusCode);
        return {
            name: status?.name || stockStatusCode || 'Unknown',
            color: status?.color || '#6c757d'
        };
    }

    getShippingStatusFromCode(shippingStatusCode) {
        const status = this.shippingStatusLookup.get(shippingStatusCode);
        return {
            name: status?.name || shippingStatusCode || 'Unknown',
            color: status?.color || '#6c757d'
        };
    }

    getPaymentStatusColor(paymentStatus) {
        const colorMap = {
            'PAID': '#28a745',
            'UNPAID': '#dc3545',
            'PENDING': '#ffc107',
            'OVERDUE': '#dc3545',
            'NOT_APPLICABLE': '#6c757d'
        };
        return colorMap[paymentStatus] || '#6c757d';
    }

}

module.exports = SupabaseBrightpearlService;