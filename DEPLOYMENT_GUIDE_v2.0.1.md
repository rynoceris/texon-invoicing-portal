# Deployment Guide - Version 2.0.1

## Pre-Deployment Checklist

Before deploying v2.0.1 to production, ensure you have:
- [ ] Tested all opt-out functionality locally
- [ ] Verified sender email configuration works
- [ ] Confirmed test mode opt-out checking works correctly
- [ ] **ALL DATABASE MIGRATIONS COMPLETE** (local testing has already updated the shared database)
- [ ] Access to production server SSH
- [ ] Access to production Supabase dashboard

## ⚠️ Important: Shared Database Architecture

**Your development (local) and production environments share the same Supabase database.**

**This means:**
- ✅ Database migrations are already complete from local testing
- ✅ Email templates already have opt-out links
- ✅ Automation sender email is already configured
- ✅ All database tables and columns exist
- ⚠️ Database rollbacks affect BOTH environments
- ⚠️ Any opt-outs created during local testing are production data

**This deployment guide focuses on:**
1. Merging code to main branch
2. Backing up production server files
3. Verifying database state (not changing it)
4. Deploying updated application code to production server
5. Testing production deployment

---

## Step 1: Merge feature/automated-email-system into main

### 1.1 Switch to main branch locally
```bash
cd "/Users/ryanours/Local Sites/texon-invoicing-portal"
git checkout main
```

### 1.2 Pull latest main branch changes
```bash
git pull origin main
```

### 1.3 Merge feature/automated-email-system into main
```bash
git merge feature/automated-email-system
```

### 1.4 Verify the merge
```bash
git log --oneline -5
# Should show v2.0.1 commit at the top
```

### 1.5 Push merged changes to GitHub
```bash
git push origin main
```

---

## Step 2: Backup Production Server

### 2.1 SSH into production server
```bash
ssh your-production-server
# Replace with your actual server address
```

### 2.2 Navigate to application directory
```bash
cd /path/to/texon-invoicing-portal
# Replace with your actual production path
```

### 2.3 Create backup directory
```bash
mkdir -p ~/backups/texon-portal
cd ~/backups/texon-portal
```

### 2.4 Create timestamped backup
```bash
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
tar -czf "texon-portal-backup-${BACKUP_DATE}.tar.gz" -C /path/to/texon-invoicing-portal .
```

### 2.5 Verify backup was created
```bash
ls -lh texon-portal-backup-*.tar.gz
# Should show your backup file with size
```

### 2.6 Backup Shared Supabase Database (FREE METHOD)

**⚠️ IMPORTANT: Your development and production environments share the same Supabase database!**

**This database is already being used by your local development, so handle with care.**

**Free Backup Method - Export to Local SQL File:**

Run this command from your **local machine** to export the entire database:

```bash
# Create backup directory if it doesn't exist
mkdir -p ~/backups/texon-portal

# Set backup timestamp
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")

# Export entire database to SQL file
PGPASSWORD='d!43iSI3PbP2' pg_dump \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -F p \
  -f ~/backups/texon-portal/supabase-full-backup-${BACKUP_DATE}.sql

# Verify backup was created
ls -lh ~/backups/texon-portal/supabase-full-backup-${BACKUP_DATE}.sql
```

**If `pg_dump` is not installed on your Mac:**
```bash
# Install PostgreSQL tools via Homebrew
brew install postgresql

# Then run the backup command above
```

**Alternative: Export Specific Tables (Faster, Smaller File):**

If you only want to backup application-critical tables:

```bash
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")

PGPASSWORD='d!43iSI3PbP2' pg_dump \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -F p \
  -t public.app_users \
  -t public.user_email_settings \
  -t public.email_templates \
  -t public.automated_email_campaigns \
  -t public.automated_email_schedule \
  -t public.email_automation_logs \
  -t public.customer_email_preferences \
  -t public.app_settings \
  -t public.cached_invoices \
  -f ~/backups/texon-portal/supabase-app-backup-${BACKUP_DATE}.sql

ls -lh ~/backups/texon-portal/supabase-app-backup-${BACKUP_DATE}.sql
```

**To restore from backup (if needed):**
```bash
# Restore full database
PGPASSWORD='d!43iSI3PbP2' psql \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -f ~/backups/texon-portal/supabase-full-backup-TIMESTAMP.sql
```

**Note:** Since dev and production share this database, database changes made during local testing are already live in production. This deployment only updates the **application code** on the production server.

---

## Step 3: Verify Database (Shared Between Dev and Production)

**⚠️ IMPORTANT: Your development and production environments share the same live Supabase database.**

**This means all database migrations should already be complete from your local testing!**

### 3.1 Verify Database Tables Exist (Optional Check)

Access Supabase SQL Editor to verify migrations are in place:
1. Go to https://app.supabase.com
2. Select your project: `ysepuzgdgjhkpmhcbmlr`
3. Navigate to SQL Editor

**Run verification queries:**
```sql
-- Verify customer_email_preferences table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'customer_email_preferences'
) as customer_prefs_exists;

-- Verify app_settings table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'app_settings'
) as app_settings_exists;

-- Verify is_test column exists in automated_email_schedule
SELECT EXISTS (
   SELECT FROM information_schema.columns
   WHERE table_schema = 'public'
   AND table_name = 'automated_email_schedule'
   AND column_name = 'is_test'
) as is_test_column_exists;

-- Verify email templates have opt-out links
SELECT
    id,
    template_type,
    body_template LIKE '%OPT_OUT_LINK%' as has_opt_out_link
FROM email_templates
WHERE is_active = true;

-- Verify automation sender email is configured
SELECT * FROM app_settings WHERE key = 'automation_sender_email';
```

### 3.2 Expected Results

All queries should return `true` or show existing data because:
- ✅ `customer_email_preferences` table was created during local testing
- ✅ `app_settings` table was created during local testing
- ✅ `is_test` column was added during local testing
- ✅ Email templates were updated with `{OPT_OUT_LINK}` placeholders
- ✅ Automation sender email was configured via the UI

**If any verification fails, the database is out of sync. Contact support before proceeding.**

---

## Step 4: Deploy Code to Production Server

**⚠️ Remember: This step only updates application code. The database is already up-to-date from local testing.**

### 4.1 SSH into production server
```bash
ssh your-production-server
```

### 4.2 Navigate to application directory
```bash
cd /path/to/texon-invoicing-portal
```

### 4.3 Stop the application (PM2)
```bash
pm2 stop texon-invoicing-portal
```

### 4.4 Pull latest code from GitHub
```bash
# Make sure you're on main branch
git checkout main

# Pull latest changes
git pull origin main

# Verify you're on v2.0.1
git log --oneline -1
# Should show: 26c85db8 Release v2.0.1: Opt-out System & Sender Configuration
```

### 4.5 Install/Update Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 4.6 Update Environment Variables

**Check your production .env file has these values:**
```bash
nano .env
```

**Required variables for v2.0.1:**
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ryan@texontowel.com
SMTP_PASS=your-google-app-password
FROM_EMAIL=ryan@texontowel.com

# Email Encryption Key
EMAIL_ENCRYPTION_KEY=your-encryption-key

# Base URL (important for opt-out links!)
BASE_URL=https://collegesportsdirectory.com
NODE_ENV=production

# Email Rate Limiting
DAILY_EMAIL_LIMIT=500
HOURLY_EMAIL_LIMIT=50
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### 4.7 Build Frontend
```bash
cd client
npm run build
cd ..
```

### 4.8 Restart Application (PM2)
```bash
pm2 restart texon-invoicing-portal
```

### 4.9 Verify Application is Running
```bash
pm2 status
pm2 logs texon-invoicing-portal --lines 50
```

---

## Step 5: Post-Deployment Verification

### 5.1 Check Application Health
```bash
# From your local machine or browser
curl https://collegesportsdirectory.com/texon-invoicing-portal/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T...",
  "services": {
    "database": "connected",
    "brightpearl": "connected",
    "email": "configured"
  }
}
```

### 5.2 Verify Version Number
1. Open the application in your browser
2. Scroll to the footer
3. Verify it shows: **v2.0.1**

### 5.3 Test New Features

**Test 1: Automation Sender Email Configuration**
1. Log into the application
2. Navigate to "Automated Emails" → "Settings" tab
3. Look for "Automation Sender Email" field
4. Verify it shows the configured email (ryan@texontowel.com)
5. Try changing it to another user's email (if you have multiple users)
6. Verify auto-save works

**Test 2: Opt-out Link in Emails**
1. Navigate to "Automated Emails" → "Email Campaigns" tab
2. Click "Test This Campaign" on any campaign
3. Enter a test email address
4. Send test email
5. Check received email has opt-out link at the bottom
6. Verify opt-out link URL is correct: `https://collegesportsdirectory.com/texon-invoicing-portal/api/public/opt-out?token=...`

**Test 3: Opt-out Functionality**
1. Click the opt-out link in a test email
2. Verify you see confirmation message
3. Navigate to "Email Reports" → "Opt-outs" tab
4. Verify the email appears in opt-outs list
5. Try sending another test email to the same address
6. Verify email is NOT sent (check Reports tab shows "skipped")

**Test 4: Test Mode Opt-out Respect**
1. Navigate to "Automated Emails" → "Settings" tab
2. Enable "Global Test Mode"
3. Set "Global Test Email" to your opted-out email
4. Try running "Test Automation" on Email Campaigns tab
5. Verify no emails are sent (should be skipped due to opt-out)

---

## Step 6: Monitor Production

### 6.1 Monitor PM2 Logs
```bash
# On production server
pm2 logs texon-invoicing-portal --lines 100

# Look for any errors or warnings
# Watch for successful startup messages
```

### 6.2 Monitor Email Automation
```bash
# Check if email scheduler is running
pm2 logs texon-invoicing-portal | grep "scheduler"
```

Expected log entries:
```
📧 Email scheduler initialized - daily at 6:00 AM
```

### 6.3 Monitor Database Connections
Check Supabase dashboard for connection activity:
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to "Database" → "Connection pooling"
4. Verify connections are active and within limits

---

## Rollback Plan (If Something Goes Wrong)

### Rollback Code
```bash
# SSH into production server
ssh your-production-server
cd /path/to/texon-invoicing-portal

# Stop application
pm2 stop texon-invoicing-portal

# Restore from backup
BACKUP_DATE=20250101_120000  # Use your actual backup timestamp
cd ~/backups/texon-portal
tar -xzf "texon-portal-backup-${BACKUP_DATE}.tar.gz" -C /path/to/texon-invoicing-portal

# Restart application
cd /path/to/texon-invoicing-portal
pm2 restart texon-invoicing-portal
```

### Rollback Database (Use with Extreme Caution!)

**⚠️ CRITICAL WARNING: Your dev and production environments share the same database!**

**Rolling back the database will affect BOTH your local development AND production.**

**Only rollback the database if:**
- You have a critical database corruption issue
- You've verified the backup is from the correct time
- You understand this will affect both environments
- No one is currently using either environment

**To rollback from your local SQL backup:**

```bash
# Find your backup file
ls -lh ~/backups/texon-portal/

# IMPORTANT: This will DROP and recreate all tables!
# Make absolutely sure you want to do this!

# Method 1: Drop existing schema and restore (DESTRUCTIVE!)
PGPASSWORD='d!43iSI3PbP2' psql \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then restore from backup
PGPASSWORD='d!43iSI3PbP2' psql \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -f ~/backups/texon-portal/supabase-full-backup-TIMESTAMP.sql
```

**Method 2: Selective Table Restore (Safer)**

If you only need to restore specific tables:

```bash
# Extract specific table from backup
grep -A 10000 "CREATE TABLE public.customer_email_preferences" \
  ~/backups/texon-portal/supabase-full-backup-TIMESTAMP.sql \
  > ~/backups/texon-portal/restore-single-table.sql

# Review the extracted SQL before running
cat ~/backups/texon-portal/restore-single-table.sql

# Drop and recreate specific table
PGPASSWORD='d!43iSI3PbP2' psql \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -c "DROP TABLE IF EXISTS public.customer_email_preferences CASCADE;"

# Restore the table
PGPASSWORD='d!43iSI3PbP2' psql \
  -h aws-0-us-east-2.pooler.supabase.com \
  -p 5432 \
  -U postgres.hkuzfrmszsarydwjcpyu \
  -d postgres \
  -f ~/backups/texon-portal/restore-single-table.sql
```

**Recommendation:** Before any database rollback, coordinate with your team to ensure no one is using the application.

---

## Troubleshooting Common Issues

### Issue 1: Opt-out links going to wrong URL
**Solution:** Check `BASE_URL` in production .env file
```bash
nano /path/to/texon-invoicing-portal/.env
# Ensure: BASE_URL=https://collegesportsdirectory.com
```

### Issue 2: Automation sender email not working
**Solution:** Verify user has email settings configured
```sql
-- Check if user has email settings
SELECT u.email, es.email_address, es.google_app_password
FROM app_users u
LEFT JOIN user_email_settings es ON u.id = es.user_id
WHERE u.email = 'ryan@texontowel.com';
```

### Issue 3: PM2 won't start after deployment
**Solution:** Check logs and verify dependencies
```bash
pm2 logs texon-invoicing-portal --err
npm install --production
pm2 restart texon-invoicing-portal
```

### Issue 4: Opt-out not working
**Solution:** Verify database table exists and has data (should already exist from local testing)
```sql
-- Check if table exists and has data
SELECT * FROM customer_email_preferences LIMIT 5;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'customer_email_preferences';

-- Verify opt-out links in templates
SELECT template_type, body_template LIKE '%OPT_OUT_LINK%' as has_opt_out
FROM email_templates
WHERE is_active = true;
```

**Note:** Since dev and production share the database, opt-outs created during local testing will already exist in production.

---

## Success Criteria

✅ All tests pass in Step 5
✅ No errors in PM2 logs
✅ Application accessible at production URL
✅ Footer shows v2.0.1
✅ Opt-out functionality working correctly
✅ Automation sender email configuration working
✅ Test mode respecting opt-outs
✅ Database backups completed
✅ Code backups completed

---

## Support & Contact

If you encounter any issues during deployment:
1. Check the PM2 logs: `pm2 logs texon-invoicing-portal --lines 200`
2. Check Supabase logs in the dashboard
3. Review this deployment guide's troubleshooting section
4. Create an issue on GitHub: https://github.com/rynoceris/texon-invoicing-portal/issues

---

**Deployment prepared by:** Claude Code
**Version:** 2.0.1
**Date:** October 2025
**Branch:** feature/automated-email-system → main
**Commit:** 26c85db8
