#!/usr/bin/env node

/**
 * Contact Enrichment Script
 * 
 * This script enriches cached Brightpearl notes with contact information
 * by fetching contact names, emails, and company info from the Brightpearl API.
 * 
 * Usage: node enrich-contacts.js
 */

require('dotenv').config();
const ContactEnrichmentService = require('./contact-enrichment-service.js');

async function main() {
    console.log('🚀 Starting contact enrichment process...');
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    
    const enrichmentService = new ContactEnrichmentService();
    
    try {
        await enrichmentService.enrichCachedNotes();
        console.log('✅ Contact enrichment completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Contact enrichment failed:', error);
        process.exit(1);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Process interrupted by user');
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Process terminated');
    process.exit(1);
});

main();