/**
 * Brightpearl Direct API Client
 * Provides direct access to Brightpearl API endpoints
 * Based on working implementation from texon-inventory-comparison
 */
class BrightpearlApiClient {
    constructor() {
        // Use the public API endpoint (same as working project)
        this.baseUrl = 'https://use1.brightpearlconnect.com/public-api';
        this.account = process.env.BRIGHTPEARL_ACCOUNT;
        this.appRef = process.env.BRIGHTPEARL_APP_REF;
        this.token = process.env.BRIGHTPEARL_TOKEN;
        
        if (!this.account || !this.token) {
            throw new Error('Missing Brightpearl API credentials. Check BRIGHTPEARL_ACCOUNT and BRIGHTPEARL_TOKEN in .env');
        }
        
        console.log('✅ Brightpearl API Client initialized');
        console.log(`🔧 Base URL: ${this.baseUrl}`);
        console.log(`🔧 Account: ${this.account}`);
        console.log(`🔧 App Ref: ${this.appRef ? '✅ Set' : '❌ Missing'}`);
        console.log(`🔧 Token: ${this.token ? '✅ Set' : '❌ Missing'}`);
    }
    
    /**
     * Helper function for fetch with timeout (matching working project)
     */
    async fetchWithTimeout(url, options = {}) {
        const timeoutMs = 60 * 1000; // 60 second timeout
        
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Request timeout after 60s`)), timeoutMs)
            )
        ]);
    }
    
    /**
     * Make authenticated API request to Brightpearl (matching working implementation)
     */
    async makeRequest(endpoint, retries = 2) {
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                const url = `${this.baseUrl}/${this.account}/${endpoint}`;
                console.log(`🔄 Brightpearl API Request (attempt ${attempt}): ${url}`);
                
                const response = await this.fetchWithTimeout(url, {
                    headers: {
                        'brightpearl-app-ref': this.appRef,
                        'brightpearl-staff-token': this.token,  // Correct header name from working project
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`📊 Response: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`❌ Brightpearl API Error: ${errorText}`);
                    
                    // If it's a server error (5xx), retry
                    if (response.status >= 500 && attempt <= retries) {
                        console.log(`⏳ Server error, retrying in ${attempt * 2} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                        continue;
                    }
                    
                    return {
                        success: false,
                        error: errorText,
                        status: response.status
                    };
                }

                const data = await response.json();
                console.log(`✅ Brightpearl request successful`);
                
                return {
                    success: true,
                    data: data.response || data,
                    metadata: data.metadata || null
                };
                
            } catch (error) {
                if (attempt <= retries && (error.name === 'TypeError' || error.message.includes('fetch'))) {
                    console.log(`⏳ Network error, retrying in ${attempt * 2} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                    continue;
                }
                
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }
    
    /**
     * Get order notes for a specific order
     * @param {number} orderId - Brightpearl order ID
     * @param {string|null} noteIdSet - Optional specific note ID(s), comma-separated
     */
    async getOrderNotes(orderId, noteIdSet = null) {
        if (!orderId) {
            return {
                success: false,
                error: 'Order ID is required'
            };
        }
        
        let endpoint = `order-service/order/${orderId}/note`;
        
        if (noteIdSet) {
            endpoint += `/${noteIdSet}`;
        }
        
        console.log(`📝 Fetching order notes for order ${orderId}`);
        
        const result = await this.makeRequest(endpoint);
        
        if (result.success && result.data) {
            // Format the notes data for easier consumption
            const notes = Array.isArray(result.data) ? result.data : [result.data];
            
            const formattedNotes = notes.map(note => ({
                id: note.noteId,
                orderId: orderId,
                contactId: note.contactId,
                text: note.text,
                isPublic: note.isPublic,
                addedOn: note.addedOn,
                addedBy: note.addedBy,
                orderStatusId: note.orderStatusId,
                fileId: note.fileId,
                // Add formatted date for easier display
                formattedDate: note.addedOn ? new Date(note.addedOn).toLocaleString() : null
            }));
            
            console.log(`📝 Retrieved ${formattedNotes.length} notes for order ${orderId}`);
            
            return {
                success: true,
                data: formattedNotes,
                count: formattedNotes.length
            };
        }
        
        return result;
    }
    
    /**
     * Get order notes for multiple orders (batch processing)
     * @param {number[]} orderIds - Array of Brightpearl order IDs
     */
    async getOrderNotesForMultipleOrders(orderIds) {
        if (!orderIds || orderIds.length === 0) {
            return {
                success: true,
                data: {},
                count: 0
            };
        }
        
        console.log(`📝 Fetching order notes for ${orderIds.length} orders...`);
        
        const notesByOrder = {};
        const batchSize = 10; // Process in smaller batches to avoid rate limiting
        
        for (let i = 0; i < orderIds.length; i += batchSize) {
            const batch = orderIds.slice(i, i + batchSize);
            
            console.log(`📝 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orderIds.length/batchSize)} (${batch.length} orders)`);
            
            // Process batch requests in parallel
            const batchPromises = batch.map(async (orderId) => {
                const result = await this.getOrderNotes(orderId);
                return {
                    orderId,
                    result
                };
            });
            
            const batchResults = await Promise.all(batchPromises);
            
            // Collect results
            batchResults.forEach(({ orderId, result }) => {
                if (result.success) {
                    notesByOrder[orderId] = result.data || [];
                } else {
                    console.warn(`⚠️ Failed to get notes for order ${orderId}:`, result.error);
                    notesByOrder[orderId] = [];
                }
            });
            
            // Add small delay between batches to be respectful to API
            if (i + batchSize < orderIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        const totalNotes = Object.values(notesByOrder).reduce((sum, notes) => sum + notes.length, 0);
        const ordersWithNotes = Object.keys(notesByOrder).filter(orderId => notesByOrder[orderId].length > 0);
        
        console.log(`📝 Retrieved ${totalNotes} total notes across ${ordersWithNotes.length}/${orderIds.length} orders`);
        
        return {
            success: true,
            data: notesByOrder,
            count: totalNotes,
            ordersWithNotes: ordersWithNotes.length
        };
    }
    
    /**
     * Test the API connection
     */
    async testConnection() {
        console.log('🔍 Testing Brightpearl API connection...');
        
        // Try to get order statuses as a simple test
        const result = await this.makeRequest('order-service/order-status');
        
        if (result.success) {
            console.log('✅ Brightpearl API connection successful');
            return {
                success: true,
                message: 'Successfully connected to Brightpearl API',
                account: this.account
            };
        } else {
            console.error('❌ Brightpearl API connection failed');
            return {
                success: false,
                error: result.error,
                message: 'Failed to connect to Brightpearl API'
            };
        }
    }
}

module.exports = BrightpearlApiClient;