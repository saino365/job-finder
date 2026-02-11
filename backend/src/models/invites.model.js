import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  type: { type: String, enum: ['profile_access','interview'], required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobListingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobListing', index: true }, // Job position for this invitation
  message: String,
  status: { type: Number, enum: [0,1,2,3], default: 0, index: true },
  respondedAt: Date,
  reason: String // Reason for declining (when status is 2)
}, { timestamps: true });

export default mongoose.model('Invite', inviteSchema);

