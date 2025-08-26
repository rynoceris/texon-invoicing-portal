const { createClient } = require('@supabase/supabase-js');

class BrightpearlService {
    constructor() {
        this.client = createClient(
            process.env.BRIGHTPEARL_DATA_SUPABASE_URL,
            process.env.BRIGHTPEARL_DATA_SUPABASE_SERVICE_KEY
        );
        
        // Define the table names we'll use for invoice data
        this.tables = {
            sales_orders: 'sales_orders',
            invoices: 'invoices', 
            orders: 'orders',
            schema_sales_orders: 'brightpearl_texonbrightpearl_12537_2_sales_orders',
            schema_invoices: 'brightpearl_texonbrightpearl_12537_2_invoices'
        };
    }
    
    /**
     * Get sample data from a table to understand its structure
     */
    async exploreBrightpearlTable(tableName, limit = 5) {
        try {
            const { data, error } = await this.client
                .from(tableName)
                .select('*')
                .limit(limit);
                
            if (error) {
                console.error(`Error exploring ${tableName}:`, error.message);
                return null;
            }
            
            return data;
        } catch (error) {
            console.error(`Exception exploring ${tableName}:`, error.message);
            return null;
        }
    }
    
    /**
     * Find the best table for invoice/order data
     */
    async findBestInvoiceTable() {
        console.log('🔍 Finding best table for invoice data...');
        
        const tablesToTest = [
            this.tables.invoices,
            this.tables.sales_orders,
            this.tables.orders,
            this.tables.schema_invoices,
            this.tables.schema_sales_orders
        ];
        
        for (const tableName of tablesToTest) {
            console.log(`Testing ${tableName}...`);
            const sampleData = await this.exploreBrightpearlTable(tableName, 2);
            
            if (sampleData && sampleData.length > 0) {
                const columns = Object.keys(sampleData[0]);
                
                // Score table based on relevant fields
                let score = 0;
                const relevantFields = {
                    order: ['order_id', 'order_number', 'order_ref', 'id'],
                    date: ['date', 'created', 'placed', 'invoice_date', 'order_date'],
                    status: ['status', 'paid', 'payment_status', 'outstanding'],
                    amount: ['total', 'amount', 'value', 'outstanding_value']
                };
                
                Object.values(relevantFields).flat().forEach(field => {
                    if (columns.some(col => col.toLowerCase().includes(field.toLowerCase()))) {
                        score++;
                    }
                });
                
                console.log(`  ${tableName}: ${columns.length} columns, relevance score: ${score}`);
                console.log(`  Sample columns: ${columns.slice(0, 10).join(', ')}`);
                
                if (score >= 3) { // If table has at least 3 relevant field types
                    console.log(`✅ Selected ${tableName} as primary invoice table`);
                    return {
                        tableName,
                        columns,
                        sampleData,
                        score
                    };
                }
            }
        }
        
        console.log('❌ No suitable invoice table found');
        return null;
    }
    
    /**
     * Get unpaid invoices by date range
     */
    async getUnpaidInvoices(startDate, endDate, tableName = null) {
        if (!tableName) {
            const bestTable = await this.findBestInvoiceTable();
            if (!bestTable) {
                throw new Error('No suitable invoice table found');
            }
            tableName = bestTable.tableName;
        }
        
        try {
            // First, let's explore the table structure to understand the field names
            const sampleData = await this.exploreBrightpearlTable(tableName, 1);
            if (!sampleData || sampleData.length === 0) {
                throw new Error(`No data found in ${tableName}`);
            }
            
            const columns = Object.keys(sampleData[0]);
            
            // Try to identify key fields
            const dateField = this.findDateField(columns);
            const statusField = this.findStatusField(columns);
            const orderField = this.findOrderField(columns);
            
            console.log(`Using fields: date=${dateField}, status=${statusField}, order=${orderField}`);
            
            // Build query
            let query = this.client.from(tableName).select('*');
            
            // Add date filter if we found a date field
            if (dateField && startDate && endDate) {
                query = query.gte(dateField, startDate).lte(dateField, endDate);
            }
            
            // Add status filter if we found a status field
            if (statusField) {
                // Try different unpaid status values
                const unpaidValues = ['unpaid', 'outstanding', 'pending', 'false', '0'];
                // For now, let's get all records and filter manually
            }
            
            const { data, error } = await query.limit(100);
            
            if (error) {
                throw new Error(`Query error: ${error.message}`);
            }
            
            // Filter for unpaid invoices manually if needed
            let unpaidInvoices = data;
            if (statusField && data.length > 0) {
                unpaidInvoices = data.filter(record => {
                    const statusValue = record[statusField];
                    if (statusValue === null || statusValue === undefined) return false;
                    
                    const statusStr = String(statusValue).toLowerCase();
                    return statusStr.includes('unpaid') || 
                           statusStr.includes('outstanding') || 
                           statusStr.includes('pending') ||
                           statusStr === 'false' ||
                           statusStr === '0';
                });
            }
            
            return {
                tableName,
                totalRecords: data.length,
                unpaidRecords: unpaidInvoices.length,
                data: unpaidInvoices,
                fields: {
                    dateField,
                    statusField, 
                    orderField
                }
            };
            
        } catch (error) {
            console.error('Error getting unpaid invoices:', error);
            throw error;
        }
    }
    
    /**
     * Helper method to find date field
     */
    findDateField(columns) {
        const datePatterns = ['date', 'created', 'placed', 'invoice_date', 'order_date', 'time'];
        for (const pattern of datePatterns) {
            const field = columns.find(col => col.toLowerCase().includes(pattern));
            if (field) return field;
        }
        return null;
    }
    
    /**
     * Helper method to find status field
     */
    findStatusField(columns) {
        const statusPatterns = ['status', 'paid', 'payment', 'outstanding', 'state'];
        for (const pattern of statusPatterns) {
            const field = columns.find(col => col.toLowerCase().includes(pattern));
            if (field) return field;
        }
        return null;
    }
    
    /**
     * Helper method to find order field
     */
    findOrderField(columns) {
        const orderPatterns = ['order_id', 'order_number', 'order_ref', 'id', 'number'];
        for (const pattern of orderPatterns) {
            const field = columns.find(col => col.toLowerCase().includes(pattern));
            if (field) return field;
        }
        return null;
    }
}

module.exports = BrightpearlService;