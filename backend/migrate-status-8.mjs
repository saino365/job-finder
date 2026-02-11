import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

async function migrateToStatus8() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Application = mongoose.model('Application', new mongoose.Schema({}, { strict: false, collection: 'applications' }));

    // Find applications with status 3 and acceptedAt set (these should be status 8)
    const appsToMigrate = await Application.find({ 
      status: 3, 
      acceptedAt: { $exists: true, $ne: null } 
    });
    
    console.log(`\nFound ${appsToMigrate.length} applications to migrate from status 3 to status 8\n`);
    
    if (appsToMigrate.length === 0) {
      console.log('No applications need migration.');
      await mongoose.disconnect();
      return;
    }

    for (const app of appsToMigrate) {
      console.log(`Migrating application ${app._id}:`);
      console.log(`  Before: status=${app.status}, acceptedAt=${app.acceptedAt}`);
      
      // Update to status 8
      await Application.updateOne(
        { _id: app._id },
        { 
          $set: { status: 8 },
          $push: { 
            history: { 
              at: new Date(), 
              actorRole: 'system', 
              action: 'migrateToStatus8', 
              data: { oldStatus: 3, reason: 'Migration to new status 8 (Accepted - Pending Review)' } 
            } 
          }
        }
      );
      
      console.log(`  After: status=8 (Accepted - Pending Review)`);
      console.log('');
    }

    console.log(`✅ Successfully migrated ${appsToMigrate.length} applications to status 8`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateToStatus8();
