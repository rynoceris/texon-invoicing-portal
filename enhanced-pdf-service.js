const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

/**
 * Enhanced PDF Generation Service
 * Uses your original Brightpearl HTML template with complete Supabase data
 */
class EnhancedPDFService {
    constructor() {
        this.browser = null;
        
        // Initialize Supabase client for Brightpearl data
        this.supabase = createClient(
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
        
        // Initialize Supabase client for app data (cached_invoices table)
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
        
        console.log('✅ Enhanced PDF Service initialized with app database connection');
    }

    /**
     * Initialize browser instance
     */
    async initBrowser() {
        if (!this.browser) {
            console.log('🚀 Starting PDF browser...');
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        return this.browser;
    }

    /**
     * Close browser instance
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('🔚 PDF browser closed');
        }
    }

    /**
     * Generate invoice PDF from order data with complete Brightpearl template
     */
    async generateInvoicePDF(orderData) {
        let page = null;
        
        try {
            console.log(`📄 Generating enhanced PDF for order ${orderData.id}...`);

            // Get complete order data from Supabase
            const completeOrderData = await this.getCompleteOrderData(orderData.id);
            if (!completeOrderData.success) {
                throw new Error(completeOrderData.error);
            }

            const browser = await this.initBrowser();
            page = await browser.newPage();

            // Generate HTML content using Brightpearl template
            const htmlContent = this.generateBrightpearlInvoiceHTML(completeOrderData.data);

            // Set HTML content
            await page.setContent(htmlContent, {
                waitUntil: 'networkidle0'
            });

            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            console.log(`✅ Enhanced PDF generated successfully for order ${orderData.id}`);
            
            return {
                success: true,
                buffer: pdfBuffer,
                filename: `invoice-${completeOrderData.data.invoiceReference || orderData.id}-${Date.now()}.pdf`
            };

        } catch (error) {
            console.error('❌ Error generating enhanced PDF:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Get complete order data from Supabase including all necessary fields
     */
    async getCompleteOrderData(orderId) {
        try {
            console.log(`🔍 Fetching complete order data for order ${orderId}...`);

            // Get basic order data
            const { data: orderData, error: orderError } = await this.supabase
                .from('order')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError || !orderData) {
                return {
                    success: false,
                    error: `Order ${orderId} not found: ${orderError?.message || 'Unknown error'}`
                };
            }

            // Get additional data in parallel
            const [
                contactData,
                orderRows,
                invoiceData,
                paymentData,
                cachedInvoiceData
            ] = await Promise.all([
                this.getContactData(orderData.billingcontactid),
                this.getOrderRows(orderId),
                this.getInvoiceData(orderId),
                this.getPaymentData(orderId),
                this.getCachedInvoiceData(orderId)
            ]);

            // Calculate totals
            const subtotal = this.calculateSubtotal(orderRows);
            const taxAmount = this.calculateTaxAmount(orderRows);
            const totalAmount = subtotal + taxAmount;

            // Use Brightpearl orderinvoice data for invoice/due dates, cached data for payment links
            const actualOrderDate = orderData.placedon;
            const actualInvoiceDate = invoiceData.taxdate || orderData.placedon;
            const actualDueDate = invoiceData.duedate || this.calculateDueDate(actualInvoiceDate, contactData.credittermdays || 30);
            const actualPaymentLink = cachedInvoiceData.paymentLink || null;

            // Combine all data
            const completeData = {
                // Basic order info - use Brightpearl orderinvoice for dates
                id: orderData.id,
                reference: orderData.reference,
                orderDate: actualOrderDate,
                invoiceDate: actualInvoiceDate,
                dueDate: actualDueDate,
                invoiceReference: invoiceData.invoicereference || null,
                
                // Financial data
                subtotal: subtotal,
                taxAmount: taxAmount,
                totalAmount: totalAmount,
                paidToDate: paymentData.totalPaid || 0,
                amountDue: Math.max(0, totalAmount - (paymentData.totalPaid || 0)),
                
                // Contact and address data
                contact: contactData,
                billingAddress: this.formatAddress(orderData, 'billing'),
                deliveryAddress: this.formatAddress(orderData, 'delivery'),
                
                // Order items
                orderRows: orderRows,
                
                // Status information
                orderStatus: orderData.orderstatusid,
                paymentStatus: orderData.orderpaymentstatus,
                
                // Payment link from cached data
                paymentLink: actualPaymentLink,
                
                // Original order data for fallback
                originalOrder: orderData
            };

            console.log(`✅ Complete order data fetched for order ${orderId}`);
            return {
                success: true,
                data: completeData
            };

        } catch (error) {
            console.error(`❌ Error fetching complete order data for order ${orderId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get contact data from Supabase
     */
    async getContactData(contactId) {
        try {
            if (!contactId) return {};
            
            const { data, error } = await this.supabase
                .from('contact')
                .select('*')
                .eq('contactid', contactId)
                .single();

            if (error) {
                console.warn(`⚠️ Could not fetch contact data for ID ${contactId}:`, error);
                return {};
            }

            return data || {};
        } catch (error) {
            console.warn(`⚠️ Error fetching contact data:`, error);
            return {};
        }
    }

    /**
     * Get order rows (line items) from Supabase with product details
     */
    async getOrderRows(orderId) {
        try {
            const { data, error } = await this.supabase
                .from('orderrow')
                .select('*')
                .eq('orderid', orderId)
                .order('orderrowsequence');

            if (error) {
                console.warn(`⚠️ Could not fetch order rows for order ${orderId}:`, error);
                return [];
            }

            // Enhance order rows with product details
            const enhancedRows = await Promise.all((data || []).map(async (row) => {
                // Get product details if productid exists
                if (row.productid) {
                    try {
                        const { data: productData } = await this.supabase
                            .from('product')
                            .select('sku, defaultproductname')
                            .eq('id', row.productid)
                            .single();
                        
                        if (productData) {
                            row.actualSku = productData.sku;
                            row.fullProductName = productData.defaultproductname;
                        }
                    } catch (err) {
                        console.warn(`⚠️ Could not fetch product details for product ${row.productid}`);
                    }
                }
                return row;
            }));

            return enhancedRows;
        } catch (error) {
            console.warn(`⚠️ Error fetching order rows:`, error);
            return [];
        }
    }

    /**
     * Get invoice data from Supabase
     */
    async getInvoiceData(orderId) {
        try {
            const { data, error } = await this.supabase
                .from('orderinvoice')
                .select('*')
                .eq('orderid', orderId)
                .order('taxdate', { ascending: false })
                .limit(1);

            if (error) {
                console.warn(`⚠️ Could not fetch invoice data for order ${orderId}:`, error);
                return {};
            }

            return data && data.length > 0 ? data[0] : {};
        } catch (error) {
            console.warn(`⚠️ Error fetching invoice data:`, error);
            return {};
        }
    }

    /**
     * Get payment data from Supabase
     */
    async getPaymentData(orderId) {
        try {
            const { data, error } = await this.supabase
                .from('customerpayment')
                .select('*')
                .eq('orderid', orderId);

            if (error) {
                console.warn(`⚠️ Could not fetch payment data for order ${orderId}:`, error);
                return { payments: [], totalPaid: 0 };
            }

            const totalPaid = (data || []).reduce((sum, payment) => sum + (parseFloat(payment.amountpaid) || 0), 0);

            return {
                payments: data || [],
                totalPaid: totalPaid
            };
        } catch (error) {
            console.warn(`⚠️ Error fetching payment data:`, error);
            return { payments: [], totalPaid: 0 };
        }
    }

    /**
     * Get cached payment link from app database
     */
    async getCachedInvoiceData(orderId) {
        try {
            const { data, error } = await this.appSupabase
                .from('cached_invoices')
                .select('payment_link_url')
                .eq('id', orderId)
                .single();

            if (error) {
                console.warn(`⚠️ Could not fetch cached payment link for order ${orderId}:`, error);
                return {};
            }

            return {
                paymentLink: data?.payment_link_url || null
            };
        } catch (error) {
            console.warn(`⚠️ Error fetching cached payment link:`, error);
            return {};
        }
    }

    /**
     * Calculate subtotal from order rows
     */
    calculateSubtotal(orderRows) {
        return orderRows.reduce((sum, row) => {
            const rowValue = parseFloat(row.netvalue || 0);
            return sum + rowValue;
        }, 0);
    }

    /**
     * Calculate tax amount from order rows
     */
    calculateTaxAmount(orderRows) {
        return orderRows.reduce((sum, row) => {
            const taxValue = parseFloat(row.taxvalue || 0);
            return sum + taxValue;
        }, 0);
    }

    /**
     * Format address for display
     */
    formatAddress(orderData, type) {
        const prefix = type === 'billing' ? 'billing' : 'delivery';
        const parts = [];
        
        // Name and company
        if (orderData[`${prefix}addressfullname`]) {
            parts.push(orderData[`${prefix}addressfullname`]);
        }
        if (orderData[`${prefix}companyname`]) {
            parts.push(orderData[`${prefix}companyname`]);
        }
        
        // Address lines
        if (orderData[`${prefix}addressline1`]) {
            parts.push(orderData[`${prefix}addressline1`]);
        }
        if (orderData[`${prefix}addressline2`]) {
            parts.push(orderData[`${prefix}addressline2`]);
        }
        
        // City, state, zip
        const cityStateZip = [
            orderData[`${prefix}addressline3`], // city
            orderData[`${prefix}addressline4`], // state
            orderData[`${prefix}postalcode`]    // zip
        ].filter(part => part && part.trim()).join(' ');
        
        if (cityStateZip) {
            parts.push(cityStateZip);
        }
        
        // Country (if not US)
        if (orderData[`${prefix}country`] && orderData[`${prefix}country`] !== 'United States') {
            parts.push(orderData[`${prefix}country`]);
        }
        
        return parts.join('<br>');
    }

    /**
     * Calculate due date based on credit terms
     */
    calculateDueDate(orderDate, creditDays) {
        const date = new Date(orderDate);
        date.setDate(date.getDate() + (creditDays || 30));
        return date.toISOString();
    }

    /**
     * Generate HTML content using your original Brightpearl template
     */
    generateBrightpearlInvoiceHTML(orderData) {
        // Format dates
        const invoiceDate = new Date(orderData.invoiceDate).toLocaleDateString();
        const dueDate = new Date(orderData.dueDate).toLocaleDateString();
        
        // Generate product table
        const productTable = this.generateProductTable(orderData.orderRows, orderData);

        // Payment link
        const paymentLink = orderData.paymentLink || 
            `https://bpp.withbolt.com/c/bpp/s/invoice.html?accountCode=texon&channelKey=bpp&salesInvoiceId=${orderData.invoiceReference || orderData.id}&contactId=${orderData.contact.contactid}&salesOrderId=${orderData.id}`;

        // Company information
        const companyAddress = `Texon II Inc/ DBA-Texon Towel and Supply Company<br>
                               15405 Endeavor Dr, Ste 110 Noblesville, IN 46060<br>
                               United States`;

        // Use your original Brightpearl template with placeholders replaced
        const htmlTemplate = `
        <table style="cursor: default; width: 100%;" border="0" cellspacing="0" cellpadding="8">
        <tbody>
        <tr valign="top">
        <td style="color: #000000; font-family: Helvetica; font-size: 12px; margin: 8px;" valign="top" height="130">
        <h1 style="font-size: 24px; background-color: #666666; color: #ffffff; padding: 6px;">Texon Invoice #:&nbsp;&nbsp;<strong>${orderData.invoiceReference || orderData.id}</strong></h1>
        <p><strong>Invoice to:</strong><br />${orderData.billingAddress}</p>
        <div>&nbsp;<strong>Deliver to:</strong></div>
        <div>${orderData.deliveryAddress}</div>
        </td>
        <td style="color: #000000; font-family: Helvetica; font-size: 12px;" width="50%" height="130">
        <div style="text-align: right;">
            ${this.getLogoHTML()}
        </div>
        <p><strong>&nbsp;</strong></p>
        <div>&nbsp;<strong><br /></strong></div>
        </td>
        </tr>
        </tbody>
        </table>
        <table style="width: 100%; height: 52px;" border="0" cellspacing="2" cellpadding="4" bgcolor="#666666">
        <tbody>
        <tr style="color: #ffffff;">
        <td style="color: #ffffff; text-align: center;" width="20%"><strong>Invoice Date</strong></td>
        <td style="color: #ffffff; text-align: center;" width="20%"><strong>&nbsp;Terms</strong></td>
        <td style="color: #ffffff; text-align: center;" width="20%"><strong>Invoice Due Date</strong></td>
        <td style="color: #ffffff; text-align: center;" width="20%"><strong><strong>Purchase Order</strong></strong></td>
        </tr>
        <tr>
        <td style="background-color: #ffffff; text-align: center;" width="20%"><span>${invoiceDate}</span></td>
        <td style="background-color: #ffffff; text-align: center;" width="20%">Net ${orderData.contact.credittermdays || 30}</td>
        <td style="background-color: #ffffff; text-align: center;" width="20%"><span>${dueDate}</span></td>
        <td style="background-color: #ffffff; text-align: center;" width="20%"><span>${orderData.reference || orderData.originalOrder.reference || ''}</span></td>
        </tr>
        </tbody>
        </table>
        <p><br />${productTable}</p>
        <p>&nbsp;</p>
        <table style="width: 100%;" border="0" cellspacing="2" cellpadding="8" bgcolor="#666666">
        <tbody>
        <tr>
        <td style="color: #ffffff;"><strong>Company information</strong></td>
        <td style="color: #ffffff;"><strong>Contact Details</strong></td>
        </tr>
        <tr valign="top">
        <td style="color: #000000; font-family: Helvetica; font-size: 12px; background-color: #ffffff;" valign="top" width="50%">
        <p>${companyAddress}</p>
        <p>&nbsp;<span>ALL INVOICES OVER $5,000 USD, IF PAID BY CREDIT CARD, WILL INCUR A 3% CREDIT CARD FEE. ALL CREDIT CARD CHARGES ARE NET 15 DAYS. THANKS!</span></p>
        <p>Click Here to <a href="${paymentLink}" title="Pay Invoice Online">Pay Invoice Online</a><span><strong><br /></strong></span></p>
        </td>
        <td style="color: #000000; font-family: Helvetica; font-size: 12px; background-color: #ffffff;" align="left" valign="top" width="50%">
        <p><strong>Phone: 800-328-3966</strong><br /><strong>Fax:800-728-4770</strong></p>
        <p><strong>Accounting Email: accounting@texontowel.com</strong></p>
        <p><strong><strong>Thank you for your Business!&nbsp;Federal ID #35-1909428</strong><span>&nbsp;</span></strong></p>
        </td>
        </tr>
        </tbody>
        </table>
        `;

        return this.wrapInHTMLDocument(htmlTemplate);
    }

    /**
     * Generate product table HTML matching Brightpearl format exactly
     */
    generateProductTable(orderRows, orderData) {
        if (!orderRows || orderRows.length === 0) {
            return `
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #f0f0f0;">
                        <th style="border: 1px solid #666; padding: 8px; text-align: center;"><strong>Qty</strong></th>
                        <th style="border: 1px solid #666; padding: 8px;"><strong>Item name</strong></th>
                        <th style="border: 1px solid #666; padding: 8px; text-align: center;"><strong>SKU</strong></th>
                        <th style="border: 1px solid #666; padding: 8px; text-align: right;"><strong>Item net</strong></th>
                        <th style="border: 1px solid #666; padding: 8px; text-align: right;"><strong>Total net</strong></th>
                        <th style="border: 1px solid #666; padding: 8px; text-align: right;"><strong>Row total</strong></th>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #666; padding: 8px; text-align: center;">1</td>
                        <td style="border: 1px solid #666; padding: 8px;">Order items not available</td>
                        <td style="border: 1px solid #666; padding: 8px; text-align: center;">-</td>
                        <td style="border: 1px solid #666; padding: 8px; text-align: right;">-</td>
                        <td style="border: 1px solid #666; padding: 8px; text-align: right;">-</td>
                        <td style="border: 1px solid #666; padding: 8px; text-align: right;">$${orderData.totalAmount.toFixed(2)}</td>
                    </tr>
                </table>
            `;
        }

        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #f0f0f0;">
                    <th style="border: 1px solid #666; padding: 8px; text-align: center;"><strong>Qty</strong></th>
                    <th style="border: 1px solid #666; padding: 8px;"><strong>Item name</strong></th>
                    <th style="border: 1px solid #666; padding: 8px; text-align: center;"><strong>SKU</strong></th>
                    <th style="border: 1px solid #666; padding: 8px; text-align: right;"><strong>Item net</strong></th>
                    <th style="border: 1px solid #666; padding: 8px; text-align: right;"><strong>Total net</strong></th>
                    <th style="border: 1px solid #666; padding: 8px; text-align: right;"><strong>Row total</strong></th>
                </tr>
        `;

        orderRows.forEach(row => {
            const quantity = row.qty || 1;
            const productName = row.productname || 'Item';
            const unitPrice = parseFloat(row.unitprice || 0);
            const netValue = parseFloat(row.netvalue || 0);
            const totalNet = netValue;
            const rowTotal = netValue + parseFloat(row.taxvalue || 0);

            // Use actual SKU from product table if available, otherwise show blank for items without SKU
            const sku = row.actualSku || '';

            // Build item details with product name and any additional specifications
            let itemDetails = productName;
            
            // For FedEx tracking numbers, add the tracking number to the name
            if (productName && productName.toLowerCase().includes('fedex') && row.orderrowsequence) {
                // Try to extract tracking number from the sequence or other fields
                const trackingNumber = this.extractTrackingNumber(row);
                if (trackingNumber) {
                    itemDetails = `${productName} - ${trackingNumber}`;
                }
            }
            
            // Add color/specification details if this looks like a product with variants
            // This would need to be enhanced based on how product variants are stored
            if (row.fullProductName && row.fullProductName !== productName) {
                itemDetails += `<br><em>${row.fullProductName}</em>`;
            }

            tableHTML += `
                <tr>
                    <td style="border: 1px solid #666; padding: 8px; text-align: center;">${quantity}</td>
                    <td style="border: 1px solid #666; padding: 8px;">${itemDetails}</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: center;">${sku}</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right;">$${unitPrice.toFixed(4)}</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right;">$${totalNet.toFixed(2)}</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right;">$${rowTotal.toFixed(2)}</td>
                </tr>
            `;
        });

        // Add totals section exactly like Brightpearl
        tableHTML += `
                <tr style="border-top: 2px solid #666;">
                    <td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">Subtotal</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">$${orderData.subtotal.toFixed(2)}</td>
                </tr>
        `;

        if (orderData.taxAmount > 0) {
            const taxRate = orderRows.length > 0 && orderRows[0].taxrate ? orderRows[0].taxrate : 0;
            tableHTML += `
                <tr>
                    <td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">Tax @ ${taxRate}%</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">$${orderData.taxAmount.toFixed(2)}</td>
                </tr>
            `;
        } else {
            tableHTML += `
                <tr>
                    <td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">Non Taxable @ 0%</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">$0.00</td>
                </tr>
            `;
        }

        tableHTML += `
                <tr style="background-color: #f0f0f0;">
                    <td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;"><strong>Total</strong></td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;"><strong>$${orderData.totalAmount.toFixed(2)}</strong></td>
                </tr>
                <tr>
                    <td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">Paid to date</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold;">$${orderData.paidToDate.toFixed(2)}</td>
                </tr>
                <tr style="background-color: #fff3cd; border: 2px solid #856404;">
                    <td colspan="5" style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold; color: #856404;">Amount Due</td>
                    <td style="border: 1px solid #666; padding: 8px; text-align: right; font-weight: bold; color: #856404; font-size: 14px;">$${orderData.amountDue.toFixed(2)}</td>
                </tr>
            </table>
        `;

        return tableHTML;
    }

    /**
     * Extract tracking number from order row data
     */
    extractTrackingNumber(row) {
        // Try to find tracking number in various fields
        if (row.orderrowsequence && row.orderrowsequence.length > 10) {
            return row.orderrowsequence;
        }
        
        // Could also check other fields like notes or custom fields
        return null;
    }

    /**
     * Get logo HTML - checks for logo file or uses text fallback
     */
    getLogoHTML() {
        const fs = require('fs');
        const path = require('path');
        
        // Check for logo files in assets directory (multiple formats)
        const logoPathPng = path.join(__dirname, 'assets', 'texon-logo.png');
        const logoPathJpg = path.join(__dirname, 'assets', 'texon-logo.jpg');
        const logoPathSvg = path.join(__dirname, 'assets', 'texon-logo.svg');
        
        if (fs.existsSync(logoPathPng)) {
            // Convert PNG to base64 for embedding
            const logoData = fs.readFileSync(logoPathPng);
            const base64Logo = logoData.toString('base64');
            return `<img src="data:image/png;base64,${base64Logo}" style="max-width: 280px; max-height: 120px;" alt="Texon Athletic Logo">`;
        } else if (fs.existsSync(logoPathJpg)) {
            // Convert JPG to base64 for embedding
            const logoData = fs.readFileSync(logoPathJpg);
            const base64Logo = logoData.toString('base64');
            return `<img src="data:image/jpeg;base64,${base64Logo}" style="max-width: 280px; max-height: 120px;" alt="Texon Athletic Logo">`;
        } else if (fs.existsSync(logoPathSvg)) {
            // Use SVG logo
            const logoData = fs.readFileSync(logoPathSvg, 'utf8');
            return logoData;
        } else {
            // Fallback to styled text that matches Brightpearl format
            return `
                <div style="color: #00A0E6; font-family: Arial, sans-serif; font-weight: bold; line-height: 1.2;">
                    <div style="font-size: 20px;">🏢 TEXON ATHLETIC</div>
                    <div style="font-size: 16px;">TOWEL & LAUNDRY SUPPLY</div>
                </div>
            `;
        }
    }

    /**
     * Wrap content in complete HTML document
     */
    wrapInHTMLDocument(content) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Texon Invoice</title>
            <style>
                body {
                    font-family: Helvetica, Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    font-size: 12px;
                    color: #000;
                }
                table {
                    border-collapse: collapse;
                }
                .no-break {
                    page-break-inside: avoid;
                }
                @media print {
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
        `;
    }

    /**
     * Create email attachment object for nodemailer
     */
    createEmailAttachment(pdfBuffer, filename) {
        return {
            filename: filename,
            content: pdfBuffer,
            contentType: 'application/pdf'
        };
    }
}

module.exports = EnhancedPDFService;