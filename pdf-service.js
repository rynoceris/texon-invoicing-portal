const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * PDF Generation Service for creating invoice PDFs
 */
class PDFService {
    constructor() {
        this.browser = null;
        console.log('✅ PDF Service initialized');
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
     * Generate invoice PDF from order data
     */
    async generateInvoicePDF(orderData, options = {}) {
        let page = null;
        
        try {
            console.log(`📄 Generating PDF for order ${orderData.id}...`);

            const browser = await this.initBrowser();
            page = await browser.newPage();

            // Generate HTML content
            const htmlContent = this.generateInvoiceHTML(orderData, options);

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

            console.log(`✅ PDF generated successfully for order ${orderData.id}`);
            
            return {
                success: true,
                buffer: pdfBuffer,
                filename: `invoice-${orderData.id}-${orderData.invoiceNumber || 'draft'}.pdf`
            };

        } catch (error) {
            console.error('❌ Error generating PDF:', error);
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
     * Generate HTML content for invoice
     * This is a basic template - you can customize this with your provided template
     */
    generateInvoiceHTML(orderData, options = {}) {
        const currentDate = new Date().toLocaleDateString();
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Invoice - Order #${orderData.id}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                
                .company-logo {
                    font-size: 28px;
                    font-weight: bold;
                    color: #2563eb;
                }
                
                .invoice-title {
                    font-size: 24px;
                    color: #1f2937;
                }
                
                .invoice-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                }
                
                .bill-to, .invoice-details {
                    width: 48%;
                }
                
                .section-title {
                    font-weight: bold;
                    font-size: 16px;
                    color: #1f2937;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 5px;
                }
                
                .order-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                
                .order-table th,
                .order-table td {
                    border: 1px solid #e5e7eb;
                    padding: 12px;
                    text-align: left;
                }
                
                .order-table th {
                    background-color: #f3f4f6;
                    font-weight: bold;
                }
                
                .total-row {
                    background-color: #fef3c7;
                    font-weight: bold;
                }
                
                .payment-section {
                    background-color: #eff6ff;
                    border: 2px solid #2563eb;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 30px 0;
                }
                
                .payment-link {
                    display: inline-block;
                    background-color: #2563eb;
                    color: white !important;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: bold;
                    margin-top: 10px;
                }
                
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 14px;
                }
                
                .contact-info {
                    margin-top: 20px;
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
            <div class="header">
                <div class="company-logo">TEXON TOWEL</div>
                <div class="invoice-title">INVOICE</div>
            </div>

            <div class="invoice-info">
                <div class="bill-to">
                    <div class="section-title">BILL TO</div>
                    <strong>${orderData.customerName || orderData.billingaddressfullname || 'Customer'}</strong><br>
                    ${orderData.billingcompanyname ? orderData.billingcompanyname + '<br>' : ''}
                    ${orderData.billingemail || ''}<br>
                    ${orderData.billingaddress1 || ''}<br>
                    ${orderData.billingaddress2 ? orderData.billingaddress2 + '<br>' : ''}
                    ${orderData.billingcity || ''} ${orderData.billingstate || ''} ${orderData.billingzip || ''}
                </div>
                
                <div class="invoice-details">
                    <div class="section-title">INVOICE DETAILS</div>
                    <strong>Invoice #:</strong> ${orderData.invoiceNumber || 'DRAFT'}<br>
                    <strong>Order #:</strong> ${orderData.id}<br>
                    <strong>Order Reference:</strong> ${orderData.reference || 'N/A'}<br>
                    <strong>Date:</strong> ${currentDate}<br>
                    <strong>Order Date:</strong> ${orderData.placedon ? new Date(orderData.placedon).toLocaleDateString() : 'N/A'}
                </div>
            </div>

            <table class="order-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generateOrderItemsHTML(orderData.items || [])}
                    <tr class="total-row">
                        <td colspan="3"><strong>Total Amount</strong></td>
                        <td><strong>$${orderData.totalAmount || orderData.total || '0.00'}</strong></td>
                    </tr>
                </tbody>
            </table>

            ${orderData.paymentLink ? `
            <div class="payment-section">
                <div class="section-title">SECURE ONLINE PAYMENT</div>
                <p>You can pay this invoice securely online using the button below:</p>
                <a href="${orderData.paymentLink}" class="payment-link">PAY INVOICE ONLINE</a>
                <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
                    Click the button above or copy this link to your browser:<br>
                    <span style="word-break: break-all; font-family: monospace;">${orderData.paymentLink}</span>
                </p>
            </div>
            ` : ''}

            <div class="footer">
                <div class="contact-info">
                    <strong>Texon Towel</strong><br>
                    Email: info@texontowel.com<br>
                    Phone: (555) 123-4567<br>
                    Website: www.texontowel.com
                </div>
                
                <p style="margin-top: 20px;">
                    Thank you for your business! If you have any questions about this invoice, 
                    please contact us at the information above.
                </p>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Generate HTML for order items
     */
    generateOrderItemsHTML(items) {
        if (!items || items.length === 0) {
            return `
                <tr>
                    <td>Order Details</td>
                    <td>1</td>
                    <td>-</td>
                    <td>See Total</td>
                </tr>
            `;
        }

        return items.map(item => `
            <tr>
                <td>${item.description || item.name || 'Item'}</td>
                <td>${item.quantity || 1}</td>
                <td>$${item.unitPrice || item.price || '0.00'}</td>
                <td>$${item.total || (item.quantity * item.unitPrice) || '0.00'}</td>
            </tr>
        `).join('');
    }

    /**
     * Save PDF to file system (optional - for testing/backup)
     */
    async savePDFToFile(pdfBuffer, filename, directory = './temp') {
        try {
            // Ensure directory exists
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            const filePath = path.join(directory, filename);
            fs.writeFileSync(filePath, pdfBuffer);
            
            console.log(`✅ PDF saved to: ${filePath}`);
            return { success: true, filePath };
        } catch (error) {
            console.error('❌ Error saving PDF to file:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate PDF attachment object for nodemailer
     */
    createEmailAttachment(pdfBuffer, filename) {
        return {
            filename: filename,
            content: pdfBuffer,
            contentType: 'application/pdf'
        };
    }
}

module.exports = PDFService;