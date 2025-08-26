const PDFDocument = require('pdfkit');

/**
 * Lightweight PDF Generation Service using PDFKit
 * No browser dependencies - perfect for server environments
 */
class PDFKitService {
    constructor() {
        console.log('✅ PDFKit Service initialized');
    }

    /**
     * Generate Invoice PDF using PDFKit
     */
    async generateInvoicePDF(orderData) {
        try {
            console.log('📄 Generating PDF invoice using PDFKit...');
            
            // Create a new PDF document
            const doc = new PDFDocument({ 
                size: 'A4',
                margin: 50
            });
            
            // Buffer to collect PDF data
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('error', err => {
                console.error('❌ PDF generation error:', err);
                throw err;
            });
            
            // Generate PDF content
            await this.addInvoiceContent(doc, orderData);
            
            // Finalize the PDF
            doc.end();
            
            // Wait for PDF generation to complete
            const buffer = await new Promise((resolve) => {
                doc.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
            });
            
            const filename = `invoice_${orderData.id}_${Date.now()}.pdf`;
            
            console.log('✅ PDF generated successfully using PDFKit');
            return {
                success: true,
                buffer: buffer,
                filename: filename
            };
            
        } catch (error) {
            console.error('❌ PDF generation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Add invoice content to PDF document
     */
    async addInvoiceContent(doc, orderData) {
        // Company header
        doc.fontSize(20)
           .fillColor('#2563eb')
           .text('Texon Towel', 50, 50);
        
        doc.fontSize(10)
           .fillColor('#666')
           .text('Invoice', 50, 80);
        
        // Invoice details box
        const invoiceDetailsY = 120;
        
        // Draw invoice details
        doc.fontSize(16)
           .fillColor('#000')
           .text('INVOICE', 400, invoiceDetailsY);
        
        doc.fontSize(10)
           .text(`Invoice #: ${orderData.invoiceNumber || `ORDER-${orderData.id}`}`, 400, invoiceDetailsY + 25)
           .text(`Order #: ${orderData.id}`, 400, invoiceDetailsY + 40)
           .text(`Date: ${new Date(orderData.orderDate || Date.now()).toLocaleDateString()}`, 400, invoiceDetailsY + 55)
           .text(`Total: $${parseFloat(orderData.totalAmount || 0).toFixed(2)}`, 400, invoiceDetailsY + 70);
        
        // Customer details
        const customerY = invoiceDetailsY;
        
        doc.fontSize(12)
           .fillColor('#000')
           .text('Bill To:', 50, customerY);
        
        doc.fontSize(10)
           .fillColor('#333')
           .text(orderData.customerName || orderData.billingContact?.name || 'Valued Customer', 50, customerY + 20)
           .text(orderData.billingAddress || '', 50, customerY + 35);
        
        // Order details section
        const detailsY = 250;
        
        doc.fontSize(14)
           .fillColor('#2563eb')
           .text('Order Details', 50, detailsY);
        
        // Order items table header
        const tableY = detailsY + 30;
        
        doc.fontSize(10)
           .fillColor('#666')
           .text('Description', 50, tableY)
           .text('Amount', 450, tableY);
        
        // Draw line under header
        doc.moveTo(50, tableY + 15)
           .lineTo(550, tableY + 15)
           .strokeColor('#ccc')
           .stroke();
        
        // Order line
        doc.fontSize(10)
           .fillColor('#000')
           .text(`Order #${orderData.id} - ${orderData.orderRef || ''}`, 50, tableY + 25)
           .text(`$${parseFloat(orderData.totalAmount || 0).toFixed(2)}`, 450, tableY + 25);
        
        // Total section
        const totalY = tableY + 60;
        
        doc.moveTo(350, totalY)
           .lineTo(550, totalY)
           .strokeColor('#ccc')
           .stroke();
        
        doc.fontSize(12)
           .fillColor('#000')
           .text('Total Amount:', 350, totalY + 10)
           .text(`$${parseFloat(orderData.totalAmount || 0).toFixed(2)}`, 450, totalY + 10);
        
        // Payment information
        if (orderData.paymentLink) {
            const paymentY = totalY + 50;
            
            doc.fontSize(12)
               .fillColor('#2563eb')
               .text('Payment Information', 50, paymentY);
            
            doc.fontSize(10)
               .fillColor('#333')
               .text('Please use the secure payment link below to complete your payment:', 50, paymentY + 20);
            
            // Handle long URLs by wrapping them properly and making them clickable
            const linkOptions = {
                width: 500,
                align: 'left',
                link: orderData.paymentLink
            };
            
            doc.fontSize(9)
               .fillColor('#2563eb')
               .text(orderData.paymentLink, 50, paymentY + 35, linkOptions);
        }
        
        // Outstanding days
        if (orderData.daysOutstanding) {
            const outstandingY = (orderData.paymentLink ? totalY + 110 : totalY + 50);
            
            doc.fontSize(10)
               .fillColor('#dc2626')
               .text(`Days Outstanding: ${orderData.daysOutstanding}`, 50, outstandingY);
        }
        
        // Footer
        const footerY = 700;
        
        doc.fontSize(8)
           .fillColor('#666')
           .text('Thank you for your business!', 50, footerY)
           .text('Texon Towel - Quality towels and linens', 50, footerY + 15);
    }

    /**
     * Create email attachment object
     */
    createEmailAttachment(buffer, filename) {
        return {
            filename: filename,
            content: buffer,
            contentType: 'application/pdf'
        };
    }

    /**
     * No browser to close with PDFKit
     */
    async closeBrowser() {
        // No-op - PDFKit doesn't use a browser
        console.log('📄 PDFKit service cleanup (no browser to close)');
    }
}

module.exports = PDFKitService;