import mongoose from 'mongoose';
import config from 'config';

const mongoUrl = config.get('mongodb');

async function migrateApplicationIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('applications');

    console.log('\nChecking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    const oldIndexName = 'userId_1_jobListingId_1';
    const hasOldIndex = indexes.some(idx => idx.name === oldIndexName);

    if (hasOldIndex) {
      console.log(`\nDropping old index: ${oldIndexName}`);
      await collection.dropIndex(oldIndexName);
      console.log('Old index dropped successfully');
    } else {
      console.log(`\nOld index "${oldIndexName}" not found, skipping drop`);
    }

    console.log('\nCreating new partial index...');
    await collection.createIndex(
      { userId: 1, jobListingId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: { $in: [0, 1, 2, 3] } },
        name: 'userId_1_jobListingId_1'
      }
    );
    console.log('New partial index created successfully');

    console.log('\nVerifying new indexes...');
    const newIndexes = await collection.indexes();
    console.log('Updated indexes:', JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Migration completed successfully!');
    console.log('\nWhat changed:');
    console.log('- Old index: Prevented ANY duplicate applications (userId + jobListingId)');
    console.log('- New index: Only prevents duplicate ACTIVE applications (status 0, 1, 2, 3)');
    console.log('- Users can now reapply after WITHDRAWN (6), REJECTED (5), ACCEPTED (4), or NOT_ATTENDING (7)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

migrateApplicationIndex();

