#!/bin/bash

# Contact Enrichment Cron Job
# This script runs contact enrichment for cached Brightpearl notes
# Add to crontab to run periodically (e.g., daily at 2 AM)

# Change to the application directory
cd /home/collegesportsdir/public_html/texon-invoicing-portal

# Set up logging
LOG_FILE="/home/collegesportsdir/logs/contact-enrichment.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "================================" >> "$LOG_FILE"
echo "Contact Enrichment Started: $(date)" >> "$LOG_FILE"
echo "================================" >> "$LOG_FILE"

# Load environment variables
source /home/collegesportsdir/.nvm/nvm.sh
nvm use 22

# Run the enrichment with proper Node.js path and environment
/home/collegesportsdir/.nvm/versions/node/v22.15.0/bin/node enrich-contacts.js >> "$LOG_FILE" 2>&1

ENRICHMENT_EXIT_CODE=$?

echo "================================" >> "$LOG_FILE"
echo "Contact Enrichment Finished: $(date)" >> "$LOG_FILE"
echo "Exit Code: $ENRICHMENT_EXIT_CODE" >> "$LOG_FILE"
echo "================================" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Keep only last 1000 lines of log to prevent it from growing too large
tail -n 1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"

exit $ENRICHMENT_EXIT_CODE