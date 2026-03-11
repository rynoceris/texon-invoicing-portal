## Version 2.0.1 - Opt-out System & Production Deployment (October 2025)

### 🎉 Major Features

#### 🚫 Customer Opt-out System
- **One-click opt-out links** in all automated email communications
- **Public opt-out page** with professional branded interface
- **Permanent opt-out tracking** in database with timestamp records
- **Email suppression logic** automatically excluding opted-out customers
- **Secure token-based system** preventing unauthorized opt-out manipulation
- **User-friendly confirmation pages** with clear messaging and branding

#### 👤 Sender Name Configuration
- **Configurable sender names** per user for personalized email communications
- **Database integration** storing sender preferences in user_email_settings table
- **Professional email signatures** using actual names instead of generic defaults
- **UI controls** for updating sender name in Email Settings interface
- **Real-time updates** reflecting changes immediately in email system

#### 🚀 Production Deployment Infrastructure
- **Comprehensive deployment guide** (DEPLOYMENT_GUIDE_v2.0.1.md) with step-by-step instructions
- **Automated database backup script** (backup-database.js) for pre-deployment safety
- **Environment-specific configuration** for dev and production environments
- **PM2 process management** setup for production server reliability
- **Git-based deployment workflow** ensuring consistency and rollback capability

### 🛠 Technical Improvements

#### Backend Enhancements
- **Opt-out API endpoint** (`/api/public/opt-out`) for handling customer preferences
- **Enhanced email service** checking opt-out status before sending
- **Sender name integration** throughout email controller and service layers
- **Database schema updates** with email_opt_outs table and RLS policies
- **Token generation system** for secure opt-out link creation

#### Frontend Enhancements
- **Sender name input field** in Email Settings UI
- **Opt-out status indicators** showing customer preferences
- **Professional error handling** with user-friendly messages
- **Responsive opt-out pages** mobile-optimized for customer convenience

#### Database Architecture
- **email_opt_outs table** with email, opted_out_at timestamp, and reason fields
- **Row Level Security (RLS)** policies ensuring data protection
- **Indexed email lookups** for efficient opt-out status checks
- **Audit trail** tracking when and why customers opt out

### 🐛 Bug Fixes & Optimizations

#### Email System Fixes
- **Sender name consistency** across all email types and campaigns
- **Opt-out link generation** with proper base URL configuration
- **Template variable replacement** including opt-out link placeholder
- **Email preview accuracy** reflecting actual sender name in UI

#### Deployment Fixes
- **Missing files added to repository** (safety-mechanisms.js, email-scheduler.js, setup-automated-emails.js)
- **PM2 initialization errors** resolved with proper service dependency loading
- **Production environment variables** properly configured and validated
- **Database connection pooling** optimized for production load

#### User Interface Improvements
- **Sender name field validation** ensuring proper input format
- **Settings persistence** saving sender preferences reliably
- **Error message clarity** providing actionable feedback to users
- **Loading states** for async operations in settings UI

### 🔒 Security & Compliance

#### Privacy Features
- **GDPR-compliant opt-out** allowing customers to stop receiving emails
- **Secure token system** preventing opt-out abuse or manipulation
- **Privacy-focused design** respecting customer communication preferences
- **Audit logging** tracking all opt-out requests for compliance

#### Data Protection
- **Encrypted email credentials** stored securely in database
- **Secure API endpoints** with proper authentication checks
- **Input sanitization** preventing injection attacks
- **Token expiration** (optional) for time-limited opt-out links

### 📊 Performance Metrics

#### System Performance
- **Opt-out status caching** reducing database queries
- **Efficient email filtering** checking opt-out before processing
- **Optimized database indexes** on email_opt_outs table
- **Production-ready scaling** with PM2 cluster mode support

#### User Experience Metrics
- **Instant opt-out confirmation** with immediate database update
- **Zero-click opt-out** from email link to confirmation page
- **Professional branding** throughout opt-out flow
- **Mobile-responsive design** for all customer-facing pages

### 🚀 Deployment & Operations

#### Production Deployment Tools
- **backup-database.js**: Automated database backup script with progress reporting
- **DEPLOYMENT_GUIDE_v2.0.1.md**: Comprehensive 130-line deployment checklist
- **Environment configuration**: Dev/staging/production setup documentation
- **Rollback procedures**: Clear instructions for reverting to previous version

#### Monitoring & Debugging
- **PM2 process monitoring** with automatic restarts
- **Comprehensive logging** for opt-out events and email filtering
- **Error tracking** with detailed stack traces and context
- **Health check endpoints** for production monitoring

### 🔮 Version 2.0.0 Features (Included in 2.0.1)

Since v2.0.1 includes all v2.0.0 features, here's a recap of the major v2.0.0 additions:

#### 📧 Automated Email Campaign System
- **Four-tier campaigns**: Reminder 1, 2, 3, and Final Notice
- **Intelligent scheduling** with configurable day intervals
- **Smart targeting** based on invoice age and email history
- **Duplicate prevention** avoiding multiple emails per invoice
- **Real-time campaign controls** with instant enable/disable

#### 🎨 Advanced Template Editor
- **Rich text customization** for subject and body
- **11 dynamic variables** for personalization ({CUSTOMER_NAME}, {AMOUNT_DUE}, etc.)
- **Live template preview** with variable substitution
- **Campaign-specific templates** for each reminder tier
- **Professional default templates** included

#### 📊 Campaign Management Dashboard
- **Real-time statistics** showing emails sent per campaign
- **Comprehensive configuration** interface
- **Direct template editing** from campaign view
- **Status monitoring** for active/inactive campaigns

#### 📄 PDF Invoice Attachments
- **Automatic PDF generation** for all automated emails
- **Professional branded invoices** matching manual format
- **Puppeteer-based rendering** for consistent output
- **Complete invoice details** with line items and amounts

### 📈 Business Impact

#### Customer Experience
- **Respectful communication** honoring opt-out preferences
- **Professional branding** throughout customer interactions
- **Clear sender identification** with actual names instead of generic addresses
- **Easy unsubscribe process** building trust and reducing spam complaints

#### Operational Efficiency
- **Automated compliance** with opt-out management
- **Reduced manual work** through automated email filtering
- **Streamlined deployment** with comprehensive guides and scripts
- **Production reliability** with PM2 and monitoring tools

#### Risk Mitigation
- **Database backups** before every deployment
- **Rollback procedures** for quick recovery
- **Comprehensive testing** checklist in deployment guide
- **Error handling** preventing silent failures

### 🧪 Testing & Validation

#### Opt-out System Testing
- **Token generation** and validation
- **Database opt-out** recording and retrieval
- **Email filtering** respecting opt-out status
- **Public page rendering** with proper branding

#### Sender Name Testing
- **Configuration persistence** across sessions
- **Email integration** showing correct sender names
- **Template variable replacement** including sender name
- **UI validation** enforcing proper name format

#### Deployment Testing
- **Backup script validation** with test database
- **Production deployment** dry-run procedures
- **PM2 process management** startup and restart tests
- **Environment variable** configuration verification

### 🔄 Upgrade Path

#### From v1.1.2 to v2.0.1
1. **Database migrations**: Run email_opt_outs table creation and RLS policies
2. **Environment variables**: Add BASE_URL for opt-out link generation
3. **Code deployment**: Pull latest from GitHub and restart services
4. **User configuration**: Update sender names in Email Settings
5. **Testing**: Verify opt-out links work and emails respect preferences

#### From v2.0.0 to v2.0.1
1. **Database migration**: Add email_opt_outs table if not present
2. **Code update**: Pull v2.0.1 from GitHub
3. **Environment check**: Verify BASE_URL is configured
4. **Service restart**: PM2 restart to load new code
5. **Validation**: Test opt-out links and sender name configuration

### 📝 Known Issues & Limitations

#### Current Limitations
- **Single opt-out scope**: Customers opt out of all automated emails (no per-campaign opt-out)
- **No opt-out expiration**: Opt-outs are permanent unless manually removed
- **Manual opt-in**: No self-service mechanism for customers to opt back in
- **Single sender per user**: Each user can only configure one sender name

#### Planned Improvements (v2.1.0)
- **Per-campaign opt-out**: Allow customers to opt out of specific campaigns
- **Self-service opt-in**: Customer portal for managing email preferences
- **Temporary opt-out**: Time-limited opt-out with automatic expiration
- **Multiple sender profiles**: Support for multiple sender configurations per user

---

## Version 2.0.2 - Payment Data Integrity & Sync Fixes (March 2026)

### 💰 Payment Data Accuracy
- **Fixed incorrect outstanding amounts for orders with payment reversals**: The portal was summing individual payment records from the `customerpayment` table, which double-counted reversed payments as positive amounts. Switched to using the aggregate `payment` table which provides correct net `amountpaid` values that properly account for captures, receipts, and reversals.
- **Fixed PDF and email payment totals**: Updated `enhanced-pdf-service.js` to use the same corrected payment data source, ensuring invoices and payment reminder emails show accurate amounts.

### 📝 Brightpearl Notes Caching
- **Fixed notes caching upsert failures (error 42P10)**: The `cached_brightpearl_notes` table was missing a `UNIQUE` constraint on `(order_id, note_id)` required for the upsert operation. Added the constraint and cleaned up 4,121 duplicate note records that had accumulated.
- **Updated migration SQL** (`add-brightpearl-notes-cache.sql`) to include the unique constraint for future deployments.

### 🛡️ API Rate Limiting
- **Fixed Brightpearl API rate limit errors during notes caching**: The `enrichNotesWithContactInfo()` function was using `Promise.all()` to fire all contact and staff lookups in parallel, causing burst requests that triggered Brightpearl's rate limiter. Converted to sequential processing with 200ms delays between API calls.

### 🔧 SyncHub Configuration (External)
- **Enabled 26-week (6-month) trail on Orders table** in SyncHub to catch `orderpaymentstatus` changes that were missed due to Brightpearl Automation's delayed reactive scheduling and transient Supabase/AWS write failures.
- **Enabled 24-hour trail on Payments table** as a safety net for payment record syncing.

### Files Changed
- `supabase-brightpearl-service.js` - Switched `getPaymentDataForOrders()` from `customerpayment` to `payment` table
- `enhanced-pdf-service.js` - Switched `getPaymentData()` to use `payment` table for `totalPaid`
- `brightpearl-api-client.js` - Sequential contact/staff lookups with rate limiting delays
- `add-brightpearl-notes-cache.sql` - Added `UNIQUE (order_id, note_id)` constraint

---

## Version History

### v2.0.2 (March 2026)
- Fixed payment reversal double-counting by switching to aggregate payment table
- Fixed notes caching upsert failures with missing unique constraint
- Fixed Brightpearl API rate limiting in contact enrichment
- Cleaned up 4,121 duplicate note records

### v2.0.1 (October 2025)
- Customer opt-out system with one-click unsubscribe links
- Configurable sender names for personalized email communications
- Production deployment infrastructure with comprehensive guides and backup scripts
- Missing automated email system files added to repository
- Enhanced email filtering respecting customer preferences

### v2.0.0 (September 2025)
- Comprehensive automated email campaign system with four-tier reminders
- Advanced template editor with 11 dynamic variables
- Campaign management dashboard with real-time statistics
- Automatic PDF invoice generation for all automated emails
- UI/UX improvements fixing toggle switches and button contrast

### v1.1.2 (September 2025)
- Dynamic version footer with automatic GitHub release tracking and intelligent caching
- Enhanced email template system with proper variable replacement for payment information
- Personalized user experience with authenticated user sender names from database
- Backend email preview API ensuring consistent template processing
- Currency formatting with automatic dollar sign addition for monetary amounts

### v1.1.1 (September 2025)
- Enhanced PDF invoice generation with Amount Due calculations for partial payments
- Brightpearl format compatibility with pixel-perfect invoice matching
- Professional logo integration with proper sizing and branding
- Corrected date sources using proper Brightpearl invoice date fields
- SKU display fixes eliminating incorrect placeholder values

### v1.1.0 (January 2025)
- Comprehensive analytics dashboard with Chart.js visualizations
- Advanced contact and staff enrichment with Brightpearl integration
- Performance optimizations with intelligent caching systems
- Background service automation for invoice sync and data enrichment
- Enhanced user interface with real-time financial insights

### v1.0.0 (August 2024)
- Initial release with complete invoice management and email automation
- Full Brightpearl ERP integration with real-time data synchronization
- Professional email system with PDF generation and delivery
- Secure user authentication and role-based access control
- Production-ready deployment with PM2 process management

---

**For technical support or feature requests, please contact the development team or create an issue on GitHub.**

*Built with ❤️ for Texon Towel*
