// Migration script - Add partial filter to applications index
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saino365forweb_db_user:dgBXwQFyUwI6LBnI@cluster0.tffyagz.mongodb.net/jobfinder?retryWrites=true&w=majority&appName=Cluster0';

async function migrateApplicationIndex() {
  try {
    console.log('🚀 Starting migration...\n');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('applications');

    console.log('📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log(`Found ${indexes.length} indexes\n`);

    const oldIndexName = 'userId_1_jobListingId_1';
    const hasOldIndex = indexes.some(idx => idx.name === oldIndexName);

    if (hasOldIndex) {
      console.log(`🗑️  Dropping old index: ${oldIndexName}`);
      await collection.dropIndex(oldIndexName);
      console.log('✅ Old index dropped successfully\n');
    } else {
      console.log(`⚠️  Old index "${oldIndexName}" not found, skipping drop\n`);
    }

    console.log('🔧 Creating new partial index...');
    console.log('   Index: userId + jobListingId');
    console.log('   Unique: true');
    console.log('   Partial Filter: status in [0, 1, 2, 3]');
    console.log('   (Only enforces uniqueness for ACTIVE applications)\n');
    
    await collection.createIndex(
      { userId: 1, jobListingId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: { $in: [0, 1, 2, 3] } },
        name: 'userId_1_jobListingId_1'
      }
    );
    console.log('✅ New partial index created successfully\n');

    console.log('🔍 Verifying new index...');
    const newIndexes = await collection.indexes();
    const newIndex = newIndexes.find(idx => idx.name === oldIndexName);
    
    if (newIndex && newIndex.partialFilterExpression) {
      console.log('✅ Verification successful!\n');
      console.log('New index details:');
      console.log('   Name:', newIndex.name);
      console.log('   Unique:', newIndex.unique);
      console.log('   Partial Filter:', JSON.stringify(newIndex.partialFilterExpression));
    } else {
      console.log('❌ Verification failed - index not found or missing partial filter\n');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('What changed:');
    console.log('  ❌ BEFORE: Prevented ANY duplicate applications (userId + jobListingId)');
    console.log('  ✅ AFTER:  Only prevents duplicate ACTIVE applications (status 0, 1, 2, 3)');
    console.log('\nStudents can now reapply after:');
    console.log('  ✅ WITHDRAWN (status 6)');
    console.log('  ✅ REJECTED (status 5)');
    console.log('  ✅ ACCEPTED (status 4)');
    console.log('  ✅ NOT_ATTENDING (status 7)');
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB\n');
    process.exit(0);
  }
}

migrateApplicationIndex();

