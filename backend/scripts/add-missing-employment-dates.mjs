#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const EmploymentRecord = mongoose.model('EmploymentRecord', new mongoose.Schema({}, { strict: false }), 'employmentrecords');
    const Application = mongoose.model('Application', new mongoose.Schema({}, { strict: false }), 'applications');
    const JobListing = mongoose.model('JobListing', new mongoose.Schema({}, { strict: false }), 'joblisting');

    // Find employment records without dates
    const recordsWithoutDates = await EmploymentRecord.find({
      $or: [
        { startDate: { $exists: false } },
        { startDate: null },
        { endDate: { $exists: false } },
        { endDate: null }
      ]
    }).lean();

    console.log(`Found ${recordsWithoutDates.length} employment records with missing dates`);

    let updated = 0;
    let skipped = 0;

    for (const record of recordsWithoutDates) {
      let startDate = record.startDate;
      let endDate = record.endDate;
      let needsUpdate = false;

      // Try to get dates from application offer first
      if (record.applicationId) {
        const app = await Application.findById(record.applicationId).lean();
        if (app?.offer) {
          if (!startDate && app.offer.startDate) {
            startDate = new Date(app.offer.startDate);
            needsUpdate = true;
          }
          if (!endDate && app.offer.endDate) {
            endDate = new Date(app.offer.endDate);
            needsUpdate = true;
          }
        }
      }

      // If still no dates, try job listing
      if ((!startDate || !endDate) && record.jobListingId) {
        const job = await JobListing.findById(record.jobListingId).lean();
        if (job) {
          if (!startDate && job.internshipStart) {
            startDate = new Date(job.internshipStart);
            needsUpdate = true;
          }
          if (!endDate && job.internshipEnd) {
            endDate = new Date(job.internshipEnd);
            needsUpdate = true;
          }
        }
      }

      // If still no dates, use defaults
      if (!startDate) {
        startDate = record.createdAt || new Date();
        needsUpdate = true;
      }
      if (!endDate) {
        // Default to 3 months after start date
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 3);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await EmploymentRecord.updateOne(
          { _id: record._id },
          { $set: { startDate, endDate } }
        );
        console.log(`Updated record ${record._id}: Start=${startDate.toISOString().split('T')[0]}, End=${endDate.toISOString().split('T')[0]}`);
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Updated: ${updated} records`);
    console.log(`- Skipped: ${skipped} records`);

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
