# Agent Documentation

This file contains documentation for AI agents and automated processes used in the Texon Invoicing Portal.

## Contact Enrichment Agent

The contact enrichment agent automatically retrieves and caches contact information from Brightpearl to improve performance and provide complete customer data.

### Features
- Automatic contact lookup from Brightpearl API
- Intelligent caching to reduce API calls
- Batch processing for multiple contacts
- Real-time name resolution for invoices

### Implementation
- `contact-enrichment-service.js` - Main service
- `cached-brightpearl-contacts` table - Contact cache storage
- Background processing via cron jobs

## Invoice Sync Agent

Automated background service that synchronizes invoice data between Brightpearl and the local database.

### Features
- Scheduled invoice data updates
- Incremental sync capabilities
- Error handling and retry logic
- Performance monitoring

### Implementation
- `invoice-sync-service.js` - Sync service
- Cron-based scheduling
- Database caching for performance

## Email Automation Agent

Handles automated email processing, template generation, and delivery tracking.

### Features
- Template-based email generation
- Contact name resolution
- Delivery status tracking
- Test mode capabilities

### Implementation
- `integrated-email-service.js` - Email processing
- `email-logs` table - Delivery tracking
- Gmail SMTP integration

## PDF Generation Agent

Enhanced PDF generation with Brightpearl format compatibility and intelligent data processing.

### Features
- Brightpearl-compatible formatting
- Amount Due calculations for partial payments
- Logo integration and proper sizing
- Dual database data aggregation

### Implementation
- `enhanced-pdf-service.js` - Enhanced PDF service
- Puppeteer-based generation
- Template-driven layout
- Automatic payment calculation

## Future Agents

### Payment Processing Agent
- Automated payment link generation
- Payment status monitoring
- Reconciliation automation

### Analytics Agent
- Real-time KPI calculation
- Trend analysis
- Predictive modeling

### Notification Agent
- Overdue invoice alerts
- Payment confirmations
- System health monitoring