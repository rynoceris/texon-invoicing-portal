#!/bin/bash
# Cron script to sync invoice data every 15 minutes
# Add to crontab: */15 * * * * /path/to/sync-invoices-cron.sh

# Set working directory
cd /home/collegesportsdir/public_html/texon-invoicing-portal

# Load environment variables
source .env 2>/dev/null || true

# Log file configuration
LOG_FILE="/tmp/invoice-sync.log"
MAX_LOG_SIZE_MB=50  # Rotate when log exceeds 50MB
MAX_LOG_FILES=10    # Keep last 10 rotated logs
COMPRESS_LOGS=true  # Compress rotated logs with gzip

# Function to rotate logs if too large
rotate_logs() {
    if [ -f "$LOG_FILE" ]; then
        local size_mb=$(du -m "$LOG_FILE" | cut -f1)
        if [ "$size_mb" -gt "$MAX_LOG_SIZE_MB" ]; then
            echo "$(date): Log file size ${size_mb}MB exceeds ${MAX_LOG_SIZE_MB}MB, rotating..."

            # Rotate existing logs
            for i in $(seq $((MAX_LOG_FILES - 1)) -1 1); do
                if [ "$COMPRESS_LOGS" = true ]; then
                    if [ -f "${LOG_FILE}.$i.gz" ]; then
                        mv "${LOG_FILE}.$i.gz" "${LOG_FILE}.$((i + 1)).gz"
                    fi
                else
                    if [ -f "${LOG_FILE}.$i" ]; then
                        mv "${LOG_FILE}.$i" "${LOG_FILE}.$((i + 1))"
                    fi
                fi
            done

            # Move current log to .1 and optionally compress
            if [ "$COMPRESS_LOGS" = true ]; then
                gzip -c "$LOG_FILE" > "${LOG_FILE}.1.gz"
                > "$LOG_FILE"  # Truncate current log
            else
                mv "$LOG_FILE" "${LOG_FILE}.1"
            fi

            # Remove oldest log if it exists
            if [ "$COMPRESS_LOGS" = true ]; then
                if [ -f "${LOG_FILE}.$((MAX_LOG_FILES + 1)).gz" ]; then
                    rm "${LOG_FILE}.$((MAX_LOG_FILES + 1)).gz"
                fi
            else
                if [ -f "${LOG_FILE}.$((MAX_LOG_FILES + 1))" ]; then
                    rm "${LOG_FILE}.$((MAX_LOG_FILES + 1))"
                fi
            fi

            echo "$(date): Log rotation completed" > "$LOG_FILE"
        fi
    fi
}

# Rotate logs before running sync
rotate_logs

# Run the sync service
/home/collegesportsdir/.nvm/versions/node/v22.15.0/bin/node invoice-sync-service.js >> "$LOG_FILE" 2>&1

# Log the completion
echo "$(date): Invoice sync completed" >> "$LOG_FILE"