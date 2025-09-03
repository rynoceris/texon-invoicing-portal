#!/bin/bash
# Cron script to sync invoice data every 15 minutes
# Add to crontab: */15 * * * * /path/to/sync-invoices-cron.sh

# Set working directory
cd /home/collegesportsdir/public_html/texon-invoicing-portal

# Load environment variables
source .env 2>/dev/null || true

# Run the sync service
/home/collegesportsdir/.nvm/versions/node/v22.15.0/bin/node invoice-sync-service.js >> /tmp/invoice-sync.log 2>&1

# Log the completion
echo "$(date): Invoice sync completed" >> /tmp/invoice-sync.log