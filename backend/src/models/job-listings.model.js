import mongoose from 'mongoose';

const picSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String
}, { _id: false });

const salaryRangeSchema = new mongoose.Schema({
  min: Number,
  max: Number
}, { _id: false });

const projectSchema = new mongoose.Schema({
  title: String,
  description: String,
  startDate: Date,
  endDate: Date,
  locations: [String],
  roleDescription: String,
  areasOfInterest: [String]
}, { _id: false });

const onboardingDocSchema = new mongoose.Schema({
  type: String,
  fileKey: String,
  label: String
}, { _id: false });

const jobListingSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: String, // Required for submission, but optional for drafts
  position: { type: String, default: 'intern' },
  description: String,
  quantityAvailable: { type: Number, default: 1 },
  location: {
    city: String,
    state: String
  },
  salaryRange: salaryRangeSchema,
  pic: picSchema,
  picUpdatedAt: Date,

  // Internship duration fields
  internshipStart: Date,
  internshipEnd: Date,

  project: projectSchema,
  onboardingMaterials: [onboardingDocSchema],

  publishAt: Date, // when to publish (if scheduled); defaults to approval date
  expiresAt: Date,  // system auto-set: publishAt + 30 days
  lastExpiryReminderAt: Date,

  // Status enum stored as integer (see constants/enums)
  // 0=DRAFT, 1=PENDING_APPROVAL, 2=ACTIVE, 3=CLOSED, 4=PENDING_PRE_APPROVAL, 5=PRE_APPROVED
  status: { type: Number, enum: [0,1,2,3,4,5], default: 0, index: true },
  renewal: { type: Boolean, default: false },
  renewalRequestedAt: Date,

  submittedAt: Date,              // When submitted for pre-approval (first time)
  preApprovedAt: Date,            // When pre-approval was granted
  finalSubmittedAt: Date,         // When submitted for final approval
  approvedAt: Date,               // When final approval was granted (becomes ACTIVE)
  closedAt: Date,
  rejectionReason: String,
  preApprovalRejectionReason: String,

  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
}, { timestamps: true });

export default mongoose.model('JobListing', jobListingSchema);

