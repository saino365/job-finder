import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: { type: String, enum: ['student','company','admin','system'] },
  action: { type: String },
  notes: { type: String },
  data: { type: Object }
}, { _id: false });

const interviewSchema = new mongoose.Schema({
  scheduledAt: Date,
  location: String,
  locations: [String],
  mode: { type: String }, // online/onsite
  notes: String,
  outcome: { type: String, enum: ['pass','fail','no_show','declined', null], default: null },
  updatedAt: { type: Date }
}, { _id: false });

const offerSchema = new mongoose.Schema({
  sentAt: Date,
  validUntil: Date,
  title: String,
  notes: String,
  letterKey: String // object storage key for uploaded offer letter
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  jobListingId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobListing', required: true, index: true },

  candidateStatement: String,
  form: { type: Object },
  attachments: [{ type: String }], // keys in object storage
  pdfKey: { type: String },

  status: { type: Number, enum: [0,1,2,3,4,5,6,7], default: 0, index: true },
  validityUntil: { type: Date },

  interview: interviewSchema,
  offer: offerSchema,

  submittedAt: Date,
  acceptedAt: Date,
  rejectedAt: Date,
  withdrawnAt: Date,

  // Rejection attribution and reason (when status=REJECTED)
  rejection: {
    by: { type: String, enum: ['company','applicant','system'], default: undefined },
    reason: { type: String }
  },

  history: [historySchema]
}, { timestamps: true });

applicationSchema.index(
  { userId: 1, jobListingId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [0, 1, 2, 3] } }
  }
);

export default mongoose.model('Application', applicationSchema);

