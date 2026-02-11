#!/usr/bin/env node
/**
 * Script to update application statuses via API
 * This uses the application service, so hooks and validations are triggered
 * 
 * Usage:
 *   # Update specific application
 *   node scripts/update-application-status-api.mjs --id <applicationId> --status <newStatus>
 *   
 *   # List applications by status
 *   node scripts/update-application-status-api.mjs --list --status <status>
 * 
 * Status values:
 *   0 = NEW (Applied)
 *   1 = SHORTLISTED
 *   2 = INTERVIEW_SCHEDULED
 *   3 = PENDING_ACCEPTANCE (Active offer)
 *   4 = ACCEPTED (Hired)
 *   5 = REJECTED
 *   6 = WITHDRAWN
 *   7 = NOT_ATTENDING
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import Applications from '../src/models/applications.model.js';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const STATUS_NAMES = {
  0: 'NEW',
  1: 'SHORTLISTED',
  2: 'INTERVIEW_SCHEDULED',
  3: 'PENDING_ACCEPTANCE',
  4: 'ACCEPTED',
  5: 'REJECTED',
  6: 'WITHDRAWN',
  7: 'NOT_ATTENDING'
};

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : null;
  };
  const hasFlag = (flag) => args.includes(flag);

  const applicationId = getArg('--id');
  const status = getArg('--status');
  const list = hasFlag('--list');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Error: MONGODB_URI not found in environment variables');
    console.error('Make sure backend/.env file exists and contains MONGODB_URI');
    process.exit(1);
  }
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  try {
    if (list && status) {
      await listApplications(parseInt(status));
    } else if (applicationId && status) {
      await updateApplication(applicationId, parseInt(status));
    } else {
      console.error('❌ Error: Invalid arguments');
      console.log('\nUsage:');
      console.log('  List: node scripts/update-application-status-api.mjs --list --status <status>');
      console.log('  Update: node scripts/update-application-status-api.mjs --id <id> --status <status>');
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

async function listApplications(status) {
  console.log(`📋 Listing applications with status ${status} (${STATUS_NAMES[status]})\n`);

  const applications = await Applications.find({ status })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  console.log(`Found ${applications.length} application(s)\n`);

  applications.forEach((app, index) => {
    console.log(`${index + 1}. ID: ${app._id}`);
    console.log(`   Company: ${app.companyId}`);
    console.log(`   User: ${app.userId}`);
    console.log(`   Created: ${app.createdAt}`);
    console.log(`   Updated: ${app.updatedAt}`);
    console.log('');
  });
}

async function updateApplication(id, newStatus) {
  console.log(`📝 Updating application ${id} to status ${newStatus} (${STATUS_NAMES[newStatus]})\n`);

  try {
    // Get current application
    const current = await Applications.findById(id);
    if (!current) {
      console.error(`❌ Application ${id} not found`);
      return;
    }

    console.log(`Current status: ${current.status} (${STATUS_NAMES[current.status]})`);
    console.log(`New status: ${newStatus} (${STATUS_NAMES[newStatus]})`);

    // Update
    current.status = newStatus;
    current.updatedAt = new Date();
    await current.save();

    console.log('\n✅ Application updated successfully');
    console.log(`Updated at: ${current.updatedAt}`);
  } catch (error) {
    console.error('❌ Error updating application:', error.message);
    throw error;
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
