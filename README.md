# Texon Invoicing Portal

A comprehensive invoice management and email automation system built for Texon Towel. This portal integrates with Brightpearl ERP to manage unpaid invoices, generate payment links, and automate customer communications.

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

### 📊 Dashboard & Invoice Management
- **Real-time invoice tracking** with Brightpearl ERP integration
- **Advanced filtering and sorting** by date, amount, status, customer
- **Pagination support** for large invoice datasets
- **Detailed order information** with customer contact details
- **Payment status tracking** with visual status indicators
- **Outstanding days calculation** for aging reports

### 📧 Email System
- **Automated invoice and reminder emails** with customizable templates
- **Gmail SMTP integration** with App Password authentication
- **Test mode** for safe email testing before going live
- **Email history tracking** with sender information and timestamps
- **Template variable substitution** (customer name, amounts, dates, etc.)
- **PDF invoice attachments** automatically generated and attached

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
- **Brightpearl API** integration for ERP data
- **Nodemailer** for email sending via Gmail SMTP
- **PDFKit** for PDF generation (no browser dependencies)
- **JWT** for authentication and authorization
- **Crypto** module for password encryption

### Frontend
- **React 18** with functional components and hooks
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
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │    │   Express API    │    │   Supabase DB   │
│                 │◄──►│                  │◄──►│                 │
│ • Dashboard     │    │ • Authentication │    │ • Users         │
│ • Email Modal   │    │ • Invoice API    │    │ • Email Logs    │
│ • Settings      │    │ • Email Service  │    │ • Settings      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ External Services│
                       │                  │
                       │ • Brightpearl    │
                       │ • Gmail SMTP     │
                       │ • Payment Links  │
                       └──────────────────┘
```

### Key Components

#### Backend Services
- **`server.js`** - Main Express application and routing
- **`email-controller.js`** - Email-related API endpoints
- **`email-service.js`** - Core email functionality and SMTP management
- **`supabase-brightpearl-service.js`** - Brightpearl API integration
- **`payment-links-service.js`** - Payment link generation and management
- **`pdf-service-pdfkit.js`** - PDF generation using PDFKit
- **`brightpearl-api-client.js`** - Low-level Brightpearl API client

#### Frontend Components
- **`InvoiceDashboard.js`** - Main dashboard with invoice table
- **`EmailModal.js`** - Email composition and sending interface
- **`EmailSettings.js`** - User email configuration management
- **`App.js`** - Main application component with routing

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

#### Invoices
- `GET /api/invoices` - Get unpaid invoices with pagination
- `GET /api/invoices/:id` - Get specific invoice details
- `GET /api/statistics` - Get dashboard statistics

#### Email
- `GET /api/user/email-settings` - Get user email configuration
- `POST /api/user/email-settings` - Save email configuration
- `POST /api/send-email` - Send invoice/reminder email
- `POST /api/test-email` - Send test email
- `GET /api/email-logs/order/:orderId` - Get email history for order
- `GET /api/email-logs/recent` - Get recent email logs

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
│   │   ├── App.js        # Main component
│   │   ├── InvoiceDashboard.js
│   │   ├── EmailModal.js
│   │   └── EmailSettings.js
│   └── package.json
├── middleware/            # Express middleware
├── scripts/              # Database and setup scripts
├── server.js             # Main server file
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

- **Brightpearl** for ERP integration capabilities
- **Supabase** for database and authentication services
- **React** and **Node.js** communities for excellent documentation
- **PDFKit** for reliable PDF generation
- **Nodemailer** for robust email functionality

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation and FAQ
- Contact the development team

---

**Built with ❤️ for Texon Towel**