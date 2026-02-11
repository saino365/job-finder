import mongoose from 'mongoose';

const earlyCompletionSchema = new mongoose.Schema({
  employmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmploymentRecord', required: true, index: true },
  initiatedBy: { type: String, enum: ['student', 'company'], default: 'student', required: true },
  reason: String,
  proposedCompletionDate: Date,
  status: { type: Number, enum: [0,1,2,3], default: 0, index: true }, // RequestStatus
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  decisionRemark: String // reason for rejection/decision (company/admin)
}, { timestamps: true });

export default mongoose.model('EarlyCompletion', earlyCompletionSchema);

