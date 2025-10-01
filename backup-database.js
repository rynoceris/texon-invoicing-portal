/**
 * Database Backup Script
 *
 * This script connects to Supabase and exports all application tables to a local SQL file.
 * Run with: node backup-database.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Supabase connection details from .env (APP DATABASE)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.error('Please ensure your .env file contains these variables.');
    process.exit(1);
}

// Tables to backup (excluding views: automation_activity, campaign_stats)
const TABLES = [
    'app_settings',
    'app_users',
    'automated_email_campaigns',
    'automated_email_schedule',
    'cached_brightpearl_notes',
    'cached_invoices',
    'customer_email_preferences',
    'email_automation_logs',
    'email_logs',
    'email_templates',
    'invoice_reports',
    'order_notes',
    'payment_links',
    'sync_logs',
    'user_email_settings'
];

async function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(process.env.HOME, 'backups', 'texon-portal');
    const backupFile = path.join(backupDir, `supabase-backup-${timestamp}.sql`);

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('🔄 Starting database backup...');
    console.log(`📁 Backup directory: ${backupDir}`);
    console.log(`📄 Backup file: ${backupFile}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let sqlContent = '';
    sqlContent += `-- Texon Invoicing Portal Database Backup\n`;
    sqlContent += `-- Created: ${new Date().toISOString()}\n`;
    sqlContent += `-- Database: App Database (ysepuzgdgjhkpmhcbmlr)\n`;
    sqlContent += `\n`;
    sqlContent += `-- =============================================\n`;
    sqlContent += `-- WARNING: This backup was created from a shared database\n`;
    sqlContent += `-- used by both development and production environments\n`;
    sqlContent += `-- =============================================\n\n`;

    let totalRows = 0;

    for (const tableName of TABLES) {
        console.log(`\n📊 Backing up table: ${tableName}`);

        try {
            // Get table data
            const { data, error, count } = await supabase
                .from(tableName)
                .select('*', { count: 'exact' });

            if (error) {
                console.error(`❌ Error reading ${tableName}:`, error.message);
                sqlContent += `-- ERROR: Could not read table ${tableName}: ${error.message}\n\n`;
                continue;
            }

            if (!data || data.length === 0) {
                console.log(`   ⚠️  Table ${tableName} is empty`);
                sqlContent += `-- Table ${tableName} is empty\n\n`;
                continue;
            }

            console.log(`   ✅ Found ${data.length} rows`);
            totalRows += data.length;

            // Generate SQL for this table
            sqlContent += `-- =============================================\n`;
            sqlContent += `-- Table: ${tableName} (${data.length} rows)\n`;
            sqlContent += `-- =============================================\n\n`;

            // Get column names from first row
            const columns = Object.keys(data[0]);

            // Generate INSERT statements
            for (const row of data) {
                const values = columns.map(col => {
                    const val = row[col];
                    if (val === null) return 'NULL';
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    if (typeof val === 'number') return val;
                    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                    // Escape single quotes in strings
                    return `'${String(val).replace(/'/g, "''")}'`;
                });

                sqlContent += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }

            sqlContent += `\n`;

        } catch (err) {
            console.error(`❌ Exception backing up ${tableName}:`, err.message);
            sqlContent += `-- EXCEPTION: ${err.message}\n\n`;
        }
    }

    sqlContent += `\n-- =============================================\n`;
    sqlContent += `-- Backup Summary\n`;
    sqlContent += `-- =============================================\n`;
    sqlContent += `-- Total tables: ${TABLES.length}\n`;
    sqlContent += `-- Total rows: ${totalRows}\n`;
    sqlContent += `-- Completed: ${new Date().toISOString()}\n`;

    // Write to file
    fs.writeFileSync(backupFile, sqlContent, 'utf8');

    const fileSize = fs.statSync(backupFile).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📄 File: ${backupFile}`);
    console.log(`📊 Total rows backed up: ${totalRows}`);
    console.log(`💾 File size: ${fileSizeMB} MB`);
    console.log(`\n🔐 This backup can be restored using psql or Supabase SQL Editor`);

    return backupFile;
}

// Run the backup
backupDatabase()
    .then((file) => {
        console.log(`\n✨ Backup saved to: ${file}`);
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Backup failed:', err);
        process.exit(1);
    });
