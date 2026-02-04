// Safety check: Look for duplicate active applications before migration
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://saino365forweb_db_user:dgBXwQFyUwI6LBnI@cluster0.tffyagz.mongodb.net/jobfinder?retryWrites=true&w=majority&appName=Cluster0';

async function checkDuplicates() {
  try {
    console.log('🔍 Safety Check: Looking for duplicate active applications...\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('applications');

    // Check for duplicate active applications (statuses 0, 1, 2, 3)
    const ACTIVE_STATUSES = [0, 1, 2, 3]; // NEW, SHORTLISTED, INTERVIEW_SCHEDULED, PENDING_ACCEPTANCE

    console.log('Checking for duplicate ACTIVE applications (statuses 0, 1, 2, 3)...\n');
    
    const duplicates = await collection.aggregate([
      {
        $match: {
          status: { $in: ACTIVE_STATUSES }
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            jobListingId: '$jobListingId'
          },
          count: { $sum: 1 },
          applications: { $push: { id: '$_id', status: '$status', createdAt: '$createdAt' } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (duplicates.length === 0) {
      console.log('✅ GOOD NEWS: No duplicate active applications found!');
      console.log('✅ Migration is safe to run.\n');
    } else {
      console.log('⚠️  WARNING: Found', duplicates.length, 'duplicate active applications:\n');
      duplicates.forEach((dup, i) => {
        console.log(`Duplicate ${i + 1}:`);
        console.log('  User ID:', dup._id.userId);
        console.log('  Job ID:', dup._id.jobListingId);
        console.log('  Count:', dup.count);
        console.log('  Applications:', dup.applications);
        console.log('');
      });
      console.log('⚠️  These duplicates need to be resolved before migration.\n');
    }

    // Also check total applications with withdrawn/rejected status
    console.log('📊 Statistics:\n');
    
    const stats = await collection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();

    const statusNames = {
      0: 'NEW',
      1: 'SHORTLISTED',
      2: 'INTERVIEW_SCHEDULED',
      3: 'PENDING_ACCEPTANCE',
      4: 'ACCEPTED',
      5: 'REJECTED',
      6: 'WITHDRAWN',
      7: 'NOT_ATTENDING'
    };

    console.log('Applications by status:');
    stats.forEach(stat => {
      const name = statusNames[stat._id] || `Unknown (${stat._id})`;
      console.log(`  ${name}: ${stat.count}`);
    });

    // Check for withdrawn/rejected applications that would benefit from migration
    const withdrawnCount = stats.find(s => s._id === 6)?.count || 0;
    const rejectedCount = stats.find(s => s._id === 5)?.count || 0;

    console.log('\n📈 Impact of migration:');
    console.log(`  ${withdrawnCount} withdrawn applications → students can reapply`);
    console.log(`  ${rejectedCount} rejected applications → students can reapply`);
    console.log(`  Total: ${withdrawnCount + rejectedCount} applications will allow reapplication\n`);

    console.log('='.repeat(80));
    console.log('\n✅ Safety check complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

checkDuplicates();

