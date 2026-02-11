// ROLLBACK SCRIPT - Only use if migration causes issues
// This recreates the OLD index (without partial filter)
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saino365forweb_db_user:dgBXwQFyUwI6LBnI@cluster0.tffyagz.mongodb.net/jobfinder?retryWrites=true&w=majority&appName=Cluster0';

async function rollbackIndex() {
  try {
    console.log('⚠️  ROLLBACK: Recreating old index (blocks all reapplications)\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('applications');

    // Drop the partial index if it exists
    try {
      console.log('Dropping partial index...');
      await collection.dropIndex('userId_1_jobListingId_1');
      console.log('✅ Dropped partial index\n');
    } catch (e) {
      console.log('Index not found, continuing...\n');
    }

    // Recreate the old index (without partial filter)
    console.log('Creating old index (without partial filter)...');
    await collection.createIndex(
      { userId: 1, jobListingId: 1 },
      {
        unique: true,
        name: 'userId_1_jobListingId_1'
      }
    );
    console.log('✅ Old index recreated\n');

    console.log('✅ Rollback complete - system restored to previous state\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

rollbackIndex();

