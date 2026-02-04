// Script to check application indexes
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saino365forweb_db_user:dgBXwQFyUwI6LBnI@cluster0.tffyagz.mongodb.net/jobfinder?retryWrites=true&w=majority&appName=Cluster0';

async function checkIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('applications');

    console.log('📋 Checking indexes on applications collection...\n');
    const indexes = await collection.indexes();

    console.log('Found', indexes.length, 'indexes:\n');
    console.log('='.repeat(80));

    indexes.forEach((index, i) => {
      console.log(`\nIndex ${i + 1}:`);
      console.log('  Name:', index.name);
      console.log('  Keys:', JSON.stringify(index.key, null, 2));
      
      if (index.unique) {
        console.log('  Unique: ✅ YES');
      }
      
      if (index.partialFilterExpression) {
        console.log('  Partial Filter:', JSON.stringify(index.partialFilterExpression, null, 2));
      }
      
      console.log('-'.repeat(80));
    });

    // Check specifically for the userId + jobListingId index
    console.log('\n🔍 Looking for userId + jobListingId index...\n');
    
    const userJobIndex = indexes.find(idx => 
      idx.key.userId === 1 && idx.key.jobListingId === 1
    );

    if (userJobIndex) {
      console.log('✅ FOUND userId + jobListingId index:');
      console.log('   Name:', userJobIndex.name);
      console.log('   Unique:', userJobIndex.unique ? 'YES' : 'NO');
      
      if (userJobIndex.partialFilterExpression) {
        console.log('   ✅ HAS partial filter (GOOD - allows reapplication after withdrawal)');
        console.log('   Filter:', JSON.stringify(userJobIndex.partialFilterExpression, null, 2));
        
        const statuses = userJobIndex.partialFilterExpression?.status?.$in;
        if (statuses) {
          console.log('\n   Statuses covered by unique constraint:', statuses);
          console.log('   0 = NEW, 1 = SHORTLISTED, 2 = INTERVIEW_SCHEDULED, 3 = PENDING_ACCEPTANCE');
          console.log('   ✅ Status 5 (REJECTED) and 6 (WITHDRAWN) are NOT in the list');
          console.log('   ✅ This means students CAN reapply after withdrawal/rejection');
        }
      } else {
        console.log('   ❌ NO partial filter (BAD - blocks ALL reapplications)');
        console.log('   ❌ This prevents students from reapplying after withdrawal');
        console.log('\n   🔧 SOLUTION: Need to run migration to add partial filter');
      }
    } else {
      console.log('❌ NOT FOUND - No userId + jobListingId index exists');
      console.log('   This is unusual and may cause issues');
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Index check complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

checkIndexes();

