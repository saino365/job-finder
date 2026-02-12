#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const EmploymentRecord = mongoose.model('EmploymentRecord', new mongoose.Schema({}, { strict: false }), 'employmentrecords');

    const records = await EmploymentRecord.find({}).select('_id applicationId status startDate endDate').lean();
    
    console.log(`Total employment records: ${records.length}`);
    console.log('\nStatus breakdown:');
    
    const statusCounts = {};
    records.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    
    console.log(JSON.stringify(statusCounts, null, 2));
    
    console.log('\nSample records:');
    records.slice(0, 5).forEach(r => {
      console.log(`ID: ${r._id}, AppID: ${r.applicationId}, Status: ${r.status}, Start: ${r.startDate}, End: ${r.endDate}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
