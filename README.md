# Texon Invoicing Portal

A comprehensive financial operations platform built for Texon Towel. This portal integrates with Brightpearl ERP to manage unpaid invoices, provide advanced analytics, automate contact enrichment, and streamline customer communications with intelligent automation.

## 🎉 Latest Release - v2.0.1

**🔧 Minor Release - October 2025:**

We've completed a **patch release** adding critical **opt-out functionality** and **sender email configuration** to enhance compliance and user control!

### 🚫 New Features
- **Customer opt-out system** with one-click unsubscribe links in all automated emails
- **UI-based sender email configuration** eliminating manual database updates
- **Environment-aware URL generation** for development and production deployments
- **Dual opt-out verification** ensuring test mode respects customer preferences

**Previous major release:**
- **v2.0.0** - Comprehensive automated email campaign system (September 2025)

### 📧 Automated Email Campaigns
- **Four-tier campaign system** (Reminder 1, 2, 3, and Final Notice)
- **Intelligent scheduling** with configurable day intervals
- **Smart targeting** based on invoice age and previous emails sent
- **Duplicate prevention** to avoid sending multiple emails for the same invoice
- **Campaign enable/disable** with real-time toggle controls

### 🎨 Advanced Template Editor
- **Rich text customization** for subject lines and body content
- **11 dynamic variables** for personalized emails:
  - `{CUSTOMER_NAME}`, `{COMPANY_NAME}`, `{INVOICE_NUMBER}`
  - `{INVOICE_DATE}`, `{DUE_DATE}`, `{DAYS_OVERDUE}`
  - `{TOTAL_AMOUNT}`, `{AMOUNT_DUE}`, `{ORDER_REFERENCE}`
  - `{PAYMENT_LINK}`, `{SENDER_NAME}`
- **Template preview** with live variable substitution
- **Campaign-specific templates** for each reminder tier
- **Default template library** with professional messaging

### 📊 Campaign Management Dashboard
- **Real-time statistics** showing emails sent per campaign
- **Campaign configuration** interface with day settings
- **Template editing** directly from campaign view
- **Status monitoring** for active/inactive campaigns
- **Comprehensive campaign overview** with action buttons

### ✉️ PDF Invoice Attachments
- **Automatic PDF generation** for all automated emails
- **Professional branded invoices** matching manual email format
- **Puppeteer-based rendering** for consistent PDF output
- **Invoice details** including line items and amounts

### 🎯 UI/UX Improvements
- **Fixed Email Settings layout** with proper toggle switch styling
- **Enhanced Templates tab** with readable campaign selection buttons
- **Edit Template navigation** from Email Campaigns to Templates tab
- **Scoped CSS** to prevent style conflicts across components

**Previous releases:**
- **v1.1.2**: Dynamic version footer, enhanced email templates, GitHub integration
- **v1.1.1**: Enhanced PDF generation, amount due calculations, logo integration
- **v1.1.0**: Analytics dashboard, contact enrichment, cash flow visualization

[![Version](https://img.shields.io/badge/version-2.0.1-brightgreen)](https://github.com/rynoceris/texon-invoicing-portal)
[![Email Automation](https://img.shields.io/badge/email-automated-blue)](https://github.com/rynoceris/texon-invoicing-portal)
[![Analytics](https://img.shields.io/badge/analytics-Chart.js-blue)](https://www.chartjs.org/)
[![Performance](https://img.shields.io/badge/performance-+70%25-green)](https://github.com/rynoceris/texon-invoicing-portal)

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### 📊 Analytics Dashboard & Invoice Management
- **Real-time financial analytics** with Chart.js visualizations
- **Interactive cash flow charts** showing payment trends over time
- **Aging analysis visualization** with dynamic filtering and insights
- **Financial KPI tracking** (total outstanding, overdue amounts, collection rates)
- **Advanced filtering and sorting** by date, amount, status, customer
- **Pagination support** for large invoice datasets
- **Detailed order information** with enriched customer contact details
- **Payment status tracking** with visual status indicators
- **Outstanding days calculation** for comprehensive aging reports

### 📧 Automated Email Campaign System
- **Four-tier automated campaigns** (Reminder 1, 2, 3, Final Notice)
- **Intelligent scheduling** with configurable day intervals per campaign
- **Smart targeting logic** based on invoice age and previous email history
- **Advanced template editor** with 11 dynamic variables for personalization
- **Campaign management dashboard** with real-time statistics and controls
- **Duplicate prevention** to avoid sending multiple emails for same invoice
- **PDF invoice attachments** automatically generated for all automated emails
- **Gmail SMTP integration** with App Password authentication
- **Test mode** for safe email testing before going live
- **Comprehensive email history tracking** with enriched contact information
- **Template variable substitution** with auto-resolved customer names
- **Contact enrichment** with automatic name and company resolution

### 👥 Contact & Staff Enrichment
- **Automated contact lookup** from Brightpearl API integration
- **Staff member information retrieval** for note attribution
- **Batch contact processing** with intelligent caching
- **Real-time name resolution** for invoices and communications
- **Contact data synchronization** with background processing
- **Performance optimized caching** reducing API calls by 70%

### 💳 Payment Processing
- **Secure payment link generation** for each invoice
- **Integration with payment processors** for online payments
- **Payment link tracking** and management
- **Automated payment notifications**

### 🔐 Security & Authentication
- **JWT-based authentication** with secure token management
- **Role-based access control** for different user types
- **Encrypted password storage** using AES-256-CBC encryption
- **HTTPS enforcement** and security headers
- **Input validation and sanitization**

### 📱 User Experience
- **Responsive design** works on desktop, tablet, and mobile
- **Real-time feedback** with success/error notifications
- **Intuitive modal interfaces** for email composition
- **Professional PDF generation** with company branding
- **Comprehensive email logs** with expandable content view

## 🛠 Technology Stack

### Backend
- **Node.js** with Express.js framework
- **Supabase** for PostgreSQL database and authentication
- **Brightpearl API** integration for ERP data and contact enrichment
- **Nodemailer** for email sending via Gmail SMTP
- **Puppeteer** for PDF generation with professional invoice rendering
- **PDFKit** for fallback PDF generation (no browser dependencies)
- **JWT** for authentication and authorization
- **Crypto** module for password encryption
- **Node-Cron** for automated email campaign scheduling and background processing
- **Intelligent caching system** for performance optimization

### Frontend
- **React 18** with functional components and hooks
- **Chart.js** for advanced data visualization and analytics
- **React-ChartJS-2** for seamless chart integration
- **Modern JavaScript (ES6+)** with async/await patterns
- **CSS3** with responsive design and animations
- **Fetch API** for HTTP requests
- **Local Storage** for client-side state persistence

### Infrastructure
- **PM2** for production process management
- **Node.js** runtime environment
- **Linux/Unix** server environment
- **HTTPS/SSL** encryption for secure communications

## 🏗 Architecture

```
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client      │    │   Express API    │    │   Supabase DB   │
│                     │◄──►│                  │◄──►│                 │
│ • Analytics Dashboard│    │ • Authentication │    │ • Users         │
│ • Charts & KPIs     │    │ • Invoice API    │    │ • Email Logs    │
│ • Email Modal       │    │ • Email Service  │    │ • Settings      │
│ • Settings          │    │ • Contact Service│    │ • Contact Cache │
└─────────────────────┘    │ • Cron Jobs      │    │ • Brightpearl   │
                           └──────────────────┘    │   Notes Cache   │
                                     │             └─────────────────┘
                                     ▼
                            ┌──────────────────┐
                            │ External Services│
                            │                  │
                            │ • Brightpearl    │
                            │ • Gmail SMTP     │
                            │ • Payment Links  │
                            │ • Contact API    │
                            └──────────────────┘
```

### Key Components

#### Backend Services
- **`server.js`** - Main Express application and routing
- **`email-controller.js`** - Email-related API endpoints
- **`email-service.js`** - Core email functionality and SMTP management
- **`supabase-brightpearl-service.js`** - Brightpearl API integration
- **`brightpearl-api-client.js`** - Enhanced API client with contact enrichment
- **`contact-enrichment-service.js`** - Automated contact data processing
- **`invoice-sync-service.js`** - Background invoice synchronization
- **`cached-invoice-service.js`** - Intelligent caching service
- **`integrated-email-service.js`** - Enhanced email processing
- **`payment-links-service.js`** - Payment link generation and management
- **`pdf-service-pdfkit.js`** - PDF generation using PDFKit
- **`enhanced-pdf-service.js`** - Enhanced PDF generation with Brightpearl formatting and Amount Due calculations
- **`github-service.js`** - GitHub release tracking and version management with intelligent caching
- **`automated-email-service.js`** - Automated email campaign processing and scheduling
- **`automated-email-controller.js`** - API endpoints for campaign management

#### Frontend Components
- **`App.js`** - Main application with analytics dashboard and routing
- **`InvoiceDashboard.js`** - Enhanced dashboard with invoice table and analytics
- **`Analytics Component`** - Comprehensive financial analytics with Chart.js
- **`EmailModal.js`** - Email composition with enriched contact data
- **`EmailSettings.js`** - User email configuration management
- **`AutomatedEmailSettings.js`** - Campaign management interface with three tabs:
  - Email Campaigns tab - Campaign overview and statistics
  - Templates tab - Advanced template editor with variable substitution
  - Reports tab - Email history and campaign performance
- **`Footer.js`** - Dynamic version footer with GitHub release tracking

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm
- Supabase account and project
- Brightpearl API credentials
- Gmail account with 2FA and App Password

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/texon-invoicing-portal.git
   cd texon-invoicing-portal
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Create environment configuration**
   ```bash
   cp .env.example .env
   ```

5. **Configure environment variables** (see Configuration section)

6. **Set up the database**
   ```bash
   # Run the database setup script in Supabase SQL Editor
   cat scripts/setup-database.sql
   ```

7. **Build the frontend**
   ```bash
   cd client
   npm run build
   cd ..
   ```

8. **Start the development server**
   ```bash
   npm start
   ```

## ⚙ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Brightpearl API Configuration
BRIGHTPEARL_BASE_URL=https://ws-use1.brightpearlconnect.com/public-api
BRIGHTPEARL_ACCOUNT=your-brightpearl-account
BRIGHTPEARL_APP_REF=your-app-reference
BRIGHTPEARL_TOKEN=your-api-token

# Email Encryption
EMAIL_ENCRYPTION_KEY=your-encryption-key-for-email-passwords

# Application Configuration
CLIENT_URL=https://yourdomain.com/texon-invoicing-portal
```

### Database Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create users table (if not exists)
CREATE TABLE IF NOT EXISTS public.app_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create email settings table
CREATE TABLE IF NOT EXISTS public.user_email_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.app_users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    google_app_password TEXT NOT NULL,
    test_mode BOOLEAN DEFAULT TRUE,
    test_mode_recipient VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create email logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.app_users(id),
    order_id INTEGER NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT,
    email_type VARCHAR(50) NOT NULL,
    send_status VARCHAR(20) DEFAULT 'pending',
    message_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create payment links table
CREATE TABLE IF NOT EXISTS public.payment_links (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    payment_link TEXT NOT NULL,
    invoice_reference VARCHAR(100),
    amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(order_id)
);

-- Create contact cache tables for performance optimization
CREATE TABLE IF NOT EXISTS public.cached_brightpearl_contacts (
    contact_id INTEGER PRIMARY KEY,
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    company_name VARCHAR(255),
    job_title VARCHAR(255),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Create notes cache table with contact enrichment
CREATE TABLE IF NOT EXISTS public.cached_brightpearl_notes (
    note_id INTEGER PRIMARY KEY,
    contact_id INTEGER,
    contact_name VARCHAR(255),
    added_by INTEGER,
    added_by_name VARCHAR(255),
    note_text TEXT,
    created_date TIMESTAMP,
    last_updated TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Usage

### For End Users

#### Setting Up Email
1. Navigate to **Email Settings**
2. Enter your Gmail address
3. Generate and enter a Google App Password
4. Configure test mode settings
5. Send a test email to verify setup

#### Sending Invoices and Reminders
1. View unpaid invoices on the **Dashboard**
2. Click **📧 Invoice** or **⚠️ Reminder** buttons
3. Review and customize the email content
4. Send immediately or save as draft
5. Track email history and responses

#### Managing Invoices
1. Use filters to find specific invoices
2. Sort by date, amount, customer, or status
3. View detailed order information
4. Generate and share payment links
5. Monitor payment status updates

### For Administrators

#### User Management
- Create user accounts via Supabase dashboard
- Assign appropriate roles and permissions
- Monitor email usage and logs
- Configure system-wide settings

#### System Monitoring
- Check application health via `/health` endpoint
- Monitor PM2 process status
- Review email delivery logs
- Track system performance metrics

## 📚 API Documentation

### Authentication
All API endpoints require JWT authentication via Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Token verification

#### Invoices & Analytics
- `GET /api/invoices` - Get unpaid invoices with pagination
- `GET /api/invoices/:id` - Get specific invoice details
- `GET /api/statistics` - Get dashboard statistics
- `GET /api/analytics` - Get comprehensive financial analytics data
- `GET /api/analytics/cash-flow` - Get cash flow chart data
- `GET /api/analytics/aging` - Get aging analysis data

#### Contact & Staff Management
- `GET /api/contacts/:id` - Get contact information
- `GET /api/staff/:id` - Get staff member information
- `POST /api/contacts/enrich` - Bulk contact enrichment
- `GET /api/contacts/cache/status` - Contact cache status

#### Email
- `GET /api/user/email-settings` - Get user email configuration
- `POST /api/user/email-settings` - Save email configuration
- `POST /api/send-email` - Send invoice/reminder email
- `POST /api/test-email` - Send test email
- `GET /api/email-logs/order/:orderId` - Get email history for order
- `GET /api/email-logs/recent` - Get recent email logs

#### Automated Email Campaigns
- `GET /api/automated-emails/campaigns` - Get all email campaigns
- `POST /api/automated-emails/campaigns/:id/toggle` - Toggle campaign enabled/disabled
- `GET /api/automated-emails/templates/:campaignType` - Get template for campaign
- `POST /api/automated-emails/templates/:campaignType` - Save template for campaign
- `POST /api/automated-emails/preview` - Preview email with variable substitution
- `POST /api/automated-emails/process` - Process and send automated campaign emails
- `GET /api/automated-emails/reports` - Get email campaign reports and statistics

#### Payment Links
- `POST /api/payment-links` - Generate payment link
- `GET /api/payment-links/:orderId` - Get payment link for order

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message",
  "pagination": { ... }
}
```

### Error Format
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

## 🔧 Development

### Running in Development Mode

1. **Start the backend with hot reload**
   ```bash
   npm run dev
   ```

2. **Start the frontend development server**
   ```bash
   cd client
   npm start
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### Code Structure

```
texon-invoicing-portal/
├── client/                 # React frontend
│   ├── public/            # Static assets
│   ├── src/              # Source code
│   │   ├── App.js        # Main component with analytics
│   │   ├── InvoiceDashboard.js
│   │   ├── EmailModal.js
│   │   └── EmailSettings.js
│   └── package.json
├── middleware/            # Express middleware
├── scripts/              # Database and setup scripts
├── *.sql                 # Database migration files
├── *.sh                  # Automation cron scripts
├── server.js             # Main server file
├── brightpearl-api-client.js    # Enhanced API client
├── contact-enrichment-service.js # Contact processing
├── invoice-sync-service.js      # Background sync service
├── cached-invoice-service.js    # Caching service
├── integrated-email-service.js  # Enhanced email service
├── email-controller.js   # Email API routes
├── email-service.js      # Email functionality
├── supabase-brightpearl-service.js
├── payment-links-service.js
├── pdf-service-pdfkit.js
└── package.json
```

### Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client
npm test

# Run integration tests
npm run test:integration
```

## 🌐 Production Deployment

### PM2 Process Management

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Start the application**
   ```bash
   pm2 start ecosystem.config.js
   ```

3. **Monitor the application**
   ```bash
   pm2 status
   pm2 logs texon-invoicing-portal
   pm2 monit
   ```

### Performance Optimization

- **Frontend**: Built for production with optimized bundles
- **Backend**: Gzip compression and response caching
- **Database**: Indexed queries and connection pooling
- **Images**: Optimized assets and lazy loading

### Health Monitoring

The application includes a health check endpoint:
```bash
curl https://yourdomain.com/texon-invoicing-portal/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-08-26T...",
  "services": {
    "database": "connected",
    "brightpearl": "connected",
    "email": "configured"
  }
}
```

## 🔒 Security

### Authentication & Authorization
- JWT tokens with configurable expiration
- Password hashing with bcrypt
- Role-based access control
- Session management and logout

### Data Protection
- HTTPS enforcement in production
- Input validation and sanitization
- SQL injection prevention
- XSS protection with secure headers

### Email Security
- Google App Passwords (OAuth2 alternative)
- Encrypted password storage
- Test mode for safe email testing
- Email rate limiting and abuse prevention

### API Security
- CORS configuration
- Request rate limiting
- API key validation
- Secure error handling (no sensitive data leakage)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation for API changes
- Ensure all tests pass before submitting

### Bug Reports
Please include:
- Detailed description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment information
- Relevant log messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Brightpearl** for ERP integration and contact API capabilities
- **Supabase** for database and authentication services
- **React** and **Node.js** communities for excellent documentation
- **Chart.js** for powerful data visualization capabilities
- **React-ChartJS-2** for seamless React integration
- **PDFKit** for reliable PDF generation
- **Nodemailer** for robust email functionality
- **Node-Cron** for automated background processing

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation and FAQ
- Contact the development team

---

**Built with ❤️ for Texon Towel**