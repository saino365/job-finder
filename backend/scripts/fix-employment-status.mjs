#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Employment status enum
const EmploymentStatus = {
  UPCOMING: 0,
  ONGOING: 1,
  CLOSURE: 2,
  COMPLETED: 3,
  TERMINATED: 4
};

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const EmploymentRecord = mongoose.model('EmploymentRecord', new mongoose.Schema({}, { strict: false }), 'employmentrecords');

    // Find all employment records with status 0 (UPCOMING)
    const upcomingRecords = await EmploymentRecord.find({ status: EmploymentStatus.UPCOMING });
    
    console.log(`Found ${upcomingRecords.length} employment records with UPCOMING status`);

    if (upcomingRecords.length === 0) {
      console.log('No records to update');
      await mongoose.disconnect();
      return;
    }

    // Update all to status 1 (ONGOING/Hired)
    const result = await EmploymentRecord.updateMany(
      { status: EmploymentStatus.UPCOMING },
      { $set: { status: EmploymentStatus.ONGOING } }
    );

    console.log(`Updated ${result.modifiedCount} employment records from UPCOMING to HIRED`);

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
