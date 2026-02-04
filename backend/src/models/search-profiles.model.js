import mongoose from 'mongoose';

const salaryRangeSchema = new mongoose.Schema({
  min: { type: Number },
  max: { type: Number }
}, { _id: false });

const filtersSchema = new mongoose.Schema({
  // Intern search (used by companies) - Updated to support arrays
  fieldOfStudy: [{ type: String }], // Changed to array
  educationLevel: [{ type: String }], // Added
  university: [{ type: String }], // Added
  workExperience: [{ type: String }], // Added
  skills: [{ type: String }], // Added
  preferredLocations: [{ type: String }], // Added
  preferredStartDate: { type: Date },
  preferredEndDate: { type: Date },
  locations: [{ type: String }], // Legacy support
  salaryRange: { type: salaryRangeSchema },

  // Company search (used by students) - Updated to support arrays
  industry: [{ type: String }], // Added
  jobType: [{ type: String }], // Added
  experience: [{ type: String }], // Added
  location: [{ type: String }], // Changed to array
  salary: [{ type: String }], // Added
  keyword: { type: String },
  companyName: { type: String },
  nature: { type: String }, // Legacy support
  sort: { type: String },

  // Store complete filter selections for future use
  filterSelections: { type: mongoose.Schema.Types.Mixed }
}, { _id: false, minimize: true });

const searchProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['intern', 'company', 'job-search', 'intern-search'], required: true, index: true },
  name: { type: String },
  filters: { type: filtersSchema, default: {} }
}, { timestamps: true });

searchProfileSchema.index({ userId: 1, kind: 1 }, { unique: true }); // enforce 1 profile per kind per user

const SearchProfile = mongoose.model('SearchProfile', searchProfileSchema);
export default SearchProfile;

