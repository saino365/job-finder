#!/usr/bin/env node
/**
 * Script to update application statuses
 * 
 * Usage:
 *   # Update specific application
 *   node scripts/update-application-status.mjs --id <applicationId> --status <newStatus>
 *   
 *   # Bulk update by current status
 *   node scripts/update-application-status.mjs --from <currentStatus> --to <newStatus>
 *   
 *   # Dry run (preview changes without applying)
 *   node scripts/update-application-status.mjs --from 5 --to 6 --dry-run
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
  const fromStatus = getArg('--from');
  const toStatus = getArg('--to');
  const dryRun = hasFlag('--dry-run');

  if (!toStatus) {
    console.error('❌ Error: --to <status> is required');
    process.exit(1);
  }

  const newStatus = parseInt(toStatus);
  if (isNaN(newStatus) || newStatus < 0 || newStatus > 7) {
    console.error('❌ Error: Invalid status value. Must be 0-7');
    process.exit(1);
  }

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
    if (applicationId) {
      // Update single application
      await updateSingleApplication(applicationId, newStatus, dryRun);
    } else if (fromStatus) {
      // Bulk update
      const currentStatus = parseInt(fromStatus);
      if (isNaN(currentStatus) || currentStatus < 0 || currentStatus > 7) {
        console.error('❌ Error: Invalid --from status value. Must be 0-7');
        process.exit(1);
      }
      await bulkUpdateApplications(currentStatus, newStatus, dryRun);
    } else {
      console.error('❌ Error: Either --id or --from is required');
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

async function updateSingleApplication(id, newStatus, dryRun) {
  console.log(`📝 ${dryRun ? '[DRY RUN] ' : ''}Updating application ${id} to status ${newStatus} (${STATUS_NAMES[newStatus]})\n`);

  const app = await Applications.findById(id);
  if (!app) {
    console.error(`❌ Application ${id} not found`);
    return;
  }

  console.log(`Current status: ${app.status} (${STATUS_NAMES[app.status]})`);
  console.log(`New status: ${newStatus} (${STATUS_NAMES[newStatus]})`);
  console.log(`Company: ${app.companyId}`);
  console.log(`User: ${app.userId}`);

  if (!dryRun) {
    app.status = newStatus;
    app.updatedAt = new Date();
    await app.save();
    console.log('\n✅ Application updated successfully');
  } else {
    console.log('\n⚠️  DRY RUN - No changes made');
  }
}

async function bulkUpdateApplications(fromStatus, toStatus, dryRun) {
  console.log(`📝 ${dryRun ? '[DRY RUN] ' : ''}Bulk updating applications`);
  console.log(`From: ${fromStatus} (${STATUS_NAMES[fromStatus]})`);
  console.log(`To: ${toStatus} (${STATUS_NAMES[toStatus]})\n`);

  const applications = await Applications.find({ status: fromStatus }).lean();
  console.log(`Found ${applications.length} application(s) with status ${fromStatus}\n`);

  if (applications.length === 0) {
    console.log('No applications to update');
    return;
  }

  // Show preview
  console.log('Applications to be updated:');
  applications.forEach((app, index) => {
    console.log(`${index + 1}. ID: ${app._id}, Company: ${app.companyId}, User: ${app.userId}`);
  });

  if (!dryRun) {
    console.log('\n🔄 Updating...');
    const result = await Applications.updateMany(
      { status: fromStatus },
      { 
        $set: { 
          status: toStatus,
          updatedAt: new Date()
        } 
      }
    );
    console.log(`✅ Updated ${result.modifiedCount} application(s)`);
  } else {
    console.log('\n⚠️  DRY RUN - No changes made');
    console.log('Remove --dry-run flag to apply changes');
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
