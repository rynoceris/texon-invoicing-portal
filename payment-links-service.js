const { createClient } = require('@supabase/supabase-js');

/**
 * Payment Links Service
 * Generates and manages payment links for orders using Bolt payment system
 */
class PaymentLinksService {
    constructor() {
        // App database connection (for storing payment links)
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

        // Brightpearl data connection (for getting order data)
        this.brightpearlSupabase = createClient(
            process.env.BRIGHTPEARL_DATA_SUPABASE_URL,
            process.env.BRIGHTPEARL_DATA_SUPABASE_SERVICE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                },
                db: {
                    schema: 'brightpearl_texonbrightpearl_12537_2'
                }
            }
        );

        console.log('✅ Payment Links Service initialized');
    }

    /**
     * Generate payment link for a single order
     * @param {number} orderId - Brightpearl order ID
     */
    async generatePaymentLink(orderId) {
        try {
            console.log(`🔗 Generating payment link for order ${orderId}...`);

            // Get order data from Brightpearl database
            const orderData = await this.getOrderData(orderId);
            if (!orderData) {
                return {
                    success: false,
                    error: `Order ${orderId} not found`
                };
            }

            // Look up correct billing contact ID by email address
            let billingContactId = orderData.billingcontactid;
            if (orderData.billingemail) {
                const correctContactId = await this.getContactByEmail(orderData.billingemail);
                if (correctContactId) {
                    billingContactId = correctContactId;
                    if (correctContactId !== orderData.billingcontactid) {
                        console.log(`🔄 Using correct contact ID ${correctContactId} instead of order's billingcontactid ${orderData.billingcontactid} for order ${orderId}`);
                    }
                } else {
                    console.warn(`⚠️ Could not find contact for billing email ${orderData.billingemail}, using original billingcontactid ${orderData.billingcontactid}`);
                }
            } else {
                console.warn(`⚠️ No billing email found for order ${orderId}, using original billingcontactid ${orderData.billingcontactid}`);
            }

            // Get invoice reference
            const invoiceReference = await this.getInvoiceReference(orderId);
            if (!invoiceReference) {
                return {
                    success: false,
                    error: `Invoice reference not found for order ${orderId}`
                };
            }

            // Construct payment link
            const paymentLink = this.constructPaymentLink({
                invoiceReference: invoiceReference,
                billingContactId: billingContactId,
                orderId: orderId
            });

            // Store in app database
            const stored = await this.storePaymentLink({
                orderId: orderId,
                invoiceReference: invoiceReference,
                billingContactId: billingContactId,
                paymentLink: paymentLink
            });

            if (stored.success) {
                console.log(`✅ Payment link generated and stored for order ${orderId}`);
                return {
                    success: true,
                    paymentLink: paymentLink,
                    data: {
                        orderId: orderId,
                        invoiceReference: invoiceReference,
                        billingContactId: billingContactId,
                        paymentLink: paymentLink
                    }
                };
            } else {
                return stored;
            }

        } catch (error) {
            console.error(`❌ Error generating payment link for order ${orderId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate payment links for multiple orders
     * @param {number[]} orderIds - Array of Brightpearl order IDs
     */
    async generatePaymentLinksForOrders(orderIds) {
        console.log(`🔗 Generating payment links for ${orderIds.length} orders...`);
        
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        const batchSize = 10;
        for (let i = 0; i < orderIds.length; i += batchSize) {
            const batch = orderIds.slice(i, i + batchSize);
            console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orderIds.length/batchSize)}`);

            const batchPromises = batch.map(async (orderId) => {
                const result = await this.generatePaymentLink(orderId);
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push({
                        orderId: orderId,
                        error: result.error
                    });
                }
                return result;
            });

            await Promise.all(batchPromises);
            
            // Small delay between batches
            if (i + batchSize < orderIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`✅ Payment link generation complete: ${results.success} success, ${results.failed} failed`);
        return results;
    }

    /**
     * Get existing payment link for an order
     * @param {number} orderId - Brightpearl order ID
     */
    async getPaymentLink(orderId) {
        try {
            const { data, error } = await this.appSupabase
                .from('payment_links')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error(`❌ Error getting payment link for order ${orderId}:`, error);
                return {
                    success: false,
                    error: error.message
                };
            }

            if (!data) {
                return {
                    success: false,
                    error: 'Payment link not found'
                };
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error(`❌ Error getting payment link for order ${orderId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get order data from Brightpearl database
     * @param {number} orderId - Brightpearl order ID
     */
    async getOrderData(orderId) {
        try {
            const { data, error } = await this.brightpearlSupabase
                .from('order')
                .select('id, billingcontactid, reference, billingemail')
                .eq('id', orderId)
                .single();

            if (error) {
                console.error(`❌ Error getting order data for ${orderId}:`, error);
                return null;
            }

            return data;
        } catch (error) {
            console.error(`❌ Error getting order data for ${orderId}:`, error);
            return null;
        }
    }

    /**
     * Look up contact by billing email address to get correct contact ID
     * @param {string} billingEmail - The billing email address to search for
     */
    async getContactByEmail(billingEmail) {
        if (!billingEmail) {
            console.warn('⚠️ No billing email provided for contact lookup');
            return null;
        }

        try {
            const { data, error } = await this.brightpearlSupabase
                .from('contact')
                .select('remoteid, primaryemail')
                .eq('primaryemail', billingEmail)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error(`❌ Error looking up contact by email ${billingEmail}:`, error);
                return null;
            }

            if (!data) {
                console.warn(`⚠️ No contact found with email address: ${billingEmail}`);
                return null;
            }

            console.log(`✅ Found contact with remoteid ${data.remoteid} for email ${billingEmail}`);
            return data.remoteid;
        } catch (error) {
            console.error(`❌ Error looking up contact by email ${billingEmail}:`, error);
            return null;
        }
    }

    /**
     * Get invoice reference for an order
     * @param {number} orderId - Brightpearl order ID
     */
    async getInvoiceReference(orderId) {
        try {
            // Get invoice references that are not null or empty
            const { data, error } = await this.brightpearlSupabase
                .from('orderinvoice')
                .select('invoicereference')
                .eq('orderid', orderId)
                .not('invoicereference', 'is', null)
                .neq('invoicereference', '')
                .limit(1);

            if (error) {
                console.error(`❌ Error getting invoice reference for order ${orderId}:`, error);
                return null;
            }

            if (!data || data.length === 0) {
                console.warn(`⚠️ No valid invoice reference found for order ${orderId}`);
                return null;
            }

            const invoiceRef = data[0]?.invoicereference;
            
            // Check if there are multiple references to inform about it
            const { data: allData } = await this.brightpearlSupabase
                .from('orderinvoice')
                .select('invoicereference')
                .eq('orderid', orderId);
                
            if (allData && allData.length > 1) {
                const validRefs = allData.filter(item => item.invoicereference && item.invoicereference !== '');
                console.log(`ℹ️ Order ${orderId} has ${allData.length} invoice records (${validRefs.length} with valid references), using: ${invoiceRef}`);
            }

            return invoiceRef;
        } catch (error) {
            console.error(`❌ Error getting invoice reference for order ${orderId}:`, error);
            return null;
        }
    }

    /**
     * Construct payment link using Bolt format
     * @param {Object} params - Payment link parameters
     */
    constructPaymentLink({ invoiceReference, billingContactId, orderId }) {
        const baseUrl = 'https://bpp.withbolt.com/c/bpp/s/invoice.html';
        const params = new URLSearchParams({
            accountCode: 'texon',
            channelKey: 'bpp',
            salesInvoiceId: invoiceReference,
            contactId: billingContactId,
            salesOrderId: orderId
        });

        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Store payment link in app database
     * @param {Object} linkData - Payment link data to store
     */
    async storePaymentLink(linkData) {
        try {
            // Check if payment link already exists
            const existing = await this.getPaymentLink(linkData.orderId);
            
            if (existing.success) {
                // Update existing record
                const { error: updateError } = await this.appSupabase
                    .from('payment_links')
                    .update({
                        invoice_reference: linkData.invoiceReference,
                        billing_contact_id: linkData.billingContactId,
                        payment_link: linkData.paymentLink,
                        updated_at: new Date().toISOString()
                    })
                    .eq('order_id', linkData.orderId);

                if (updateError) {
                    console.error(`❌ Error updating payment link for order ${linkData.orderId}:`, updateError);
                    return {
                        success: false,
                        error: updateError.message
                    };
                }

                return { success: true, action: 'updated' };
            } else {
                // Insert new record
                const { error: insertError } = await this.appSupabase
                    .from('payment_links')
                    .insert({
                        order_id: linkData.orderId,
                        invoice_reference: linkData.invoiceReference,
                        billing_contact_id: linkData.billingContactId,
                        payment_link: linkData.paymentLink
                    });

                if (insertError) {
                    console.error(`❌ Error inserting payment link for order ${linkData.orderId}:`, insertError);
                    return {
                        success: false,
                        error: insertError.message
                    };
                }

                return { success: true, action: 'inserted' };
            }

        } catch (error) {
            console.error(`❌ Error storing payment link for order ${linkData.orderId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get payment links for multiple orders
     * @param {number[]} orderIds - Array of order IDs
     */
    async getPaymentLinksForOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {};
        }

        try {
            const { data, error } = await this.appSupabase
                .from('payment_links')
                .select('*')
                .in('order_id', orderIds);

            if (error) {
                console.error('❌ Error getting payment links for orders:', error);
                return {};
            }

            // Convert to object keyed by order_id
            const paymentLinks = {};
            if (data) {
                data.forEach(link => {
                    paymentLinks[link.order_id] = link;
                });
            }

            console.log(`🔗 Retrieved payment links for ${Object.keys(paymentLinks).length}/${orderIds.length} orders`);
            return paymentLinks;

        } catch (error) {
            console.error('❌ Error getting payment links for orders:', error);
            return {};
        }
    }
}

module.exports = PaymentLinksService;