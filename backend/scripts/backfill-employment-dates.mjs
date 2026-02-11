#!/usr/bin/env node
/**
 * Migration script to backfill startDate and endDate for employment records
 * that are missing these fields.
 * 
 * Strategy:
 * 1. Find all employment records without startDate or endDate
 * 2. For each record, fetch the associated job listing
 * 3. If job listing has internshipStart/internshipEnd, use those
 * 4. If job listing also doesn't have dates, use application acceptedAt as startDate
 *    and set endDate to 3 months later (typical internship duration)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobfinder';

// Define schemas
const employmentRecordSchema = new mongoose.Schema({}, { strict: false });
const jobListingSchema = new mongoose.Schema({}, { strict: false });
const applicationSchema = new mongoose.Schema({}, { strict: false });

const EmploymentRecord = mongoose.model('EmploymentRecord', employmentRecordSchema);
const JobListing = mongoose.model('JobListing', jobListingSchema);
const Application = mongoose.model('Application', applicationSchema);

async function backfillEmploymentDates() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find employment records without dates
    const recordsWithoutDates = await EmploymentRecord.find({
      $or: [
        { startDate: { $exists: false } },
        { startDate: null },
        { endDate: { $exists: false } },
        { endDate: null }
      ]
    }).lean();

    console.log(`\n📊 Found ${recordsWithoutDates.length} employment records without dates`);

    if (recordsWithoutDates.length === 0) {
      console.log('✅ All employment records already have dates!');
      process.exit(0);
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const record of recordsWithoutDates) {
      try {
        console.log(`\n📝 Processing employment record: ${record._id}`);
        
        let startDate = record.startDate;
        let endDate = record.endDate;

        // Try to get dates from job listing
        if (record.jobListingId) {
          const job = await JobListing.findById(record.jobListingId).lean();
          
          if (job) {
            if (!startDate && job.internshipStart) {
              startDate = new Date(job.internshipStart);
              console.log(`  ✓ Got startDate from job listing: ${startDate.toLocaleDateString()}`);
            }
            
            if (!endDate && job.internshipEnd) {
              endDate = new Date(job.internshipEnd);
              console.log(`  ✓ Got endDate from job listing: ${endDate.toLocaleDateString()}`);
            }

            // Fallback to project dates if available
            if (!startDate && job.project?.startDate) {
              startDate = new Date(job.project.startDate);
              console.log(`  ✓ Got startDate from project: ${startDate.toLocaleDateString()}`);
            }
            
            if (!endDate && job.project?.endDate) {
              endDate = new Date(job.project.endDate);
              console.log(`  ✓ Got endDate from project: ${endDate.toLocaleDateString()}`);
            }
          }
        }

        // If still no dates, use application acceptedAt as fallback
        if (!startDate && record.applicationId) {
          const application = await Application.findById(record.applicationId).lean();
          
          if (application?.acceptedAt) {
            startDate = new Date(application.acceptedAt);
            console.log(`  ⚠️  Using application acceptedAt as startDate: ${startDate.toLocaleDateString()}`);
            
            // Set endDate to 3 months later if not available
            if (!endDate) {
              endDate = new Date(startDate);
              endDate.setMonth(endDate.getMonth() + 3);
              console.log(`  ⚠️  Setting endDate to 3 months later: ${endDate.toLocaleDateString()}`);
            }
          }
        }

        // Update the record if we have dates
        if (startDate || endDate) {
          const updateData = {};
          if (startDate) updateData.startDate = startDate;
          if (endDate) updateData.endDate = endDate;

          await EmploymentRecord.updateOne(
            { _id: record._id },
            { $set: updateData }
          );

          console.log(`  ✅ Updated employment record ${record._id}`);
          updated++;
        } else {
          console.log(`  ⚠️  Could not determine dates for employment record ${record._id}`);
          skipped++;
        }

      } catch (err) {
        console.error(`  ❌ Error processing record ${record._id}:`, err.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`  Total records processed: ${recordsWithoutDates.length}`);
    console.log(`  ✅ Successfully updated: ${updated}`);
    console.log(`  ⚠️  Skipped (no dates found): ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('='.repeat(60));

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
backfillEmploymentDates();

