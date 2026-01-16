// Centralized integer-based enums for statuses (CommonJS for Phase A)
// Follows the frozen-enum + bi-directional label map approach

const CompanyVerificationStatus = Object.freeze({
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2
});

const CompanyVerificationStatusLabel = Object.freeze({
  [CompanyVerificationStatus.PENDING]: 'pending',
  [CompanyVerificationStatus.APPROVED]: 'approved',
  [CompanyVerificationStatus.REJECTED]: 'rejected'
});

const InviteStatus = Object.freeze({
  PENDING: 0,
  ACCEPTED: 1,
  DECLINED: 2,
  EXPIRED: 3
});

const InviteStatusLabel = Object.freeze({
  [InviteStatus.PENDING]: 'pending',
  [InviteStatus.ACCEPTED]: 'accepted',
  [InviteStatus.DECLINED]: 'declined',
  [InviteStatus.EXPIRED]: 'expired'
});

// Job listing status (integer enum)
// Two-stage approval workflow:
// DRAFT → PENDING_PRE_APPROVAL (4) → PRE_APPROVED (5) → PENDING (1) → ACTIVE (2) → CLOSED (3)
const JobListingStatus = Object.freeze({
  DRAFT: 0,
  PENDING: 1,
  ACTIVE: 2,
  CLOSED: 3,
  PENDING_PRE_APPROVAL: 4,
  PRE_APPROVED: 5,
});

const JobListingStatusLabel = Object.freeze({
  [JobListingStatus.DRAFT]: 'draft',
  [JobListingStatus.PENDING]: 'pending',
  [JobListingStatus.ACTIVE]: 'active',
  [JobListingStatus.CLOSED]: 'closed',
  [JobListingStatus.PENDING_PRE_APPROVAL]: 'pending_pre_approval',
  [JobListingStatus.PRE_APPROVED]: 'pre_approved',
});


// Application lifecycle status (integer enum)
const ApplicationStatus = Object.freeze({
  NEW: 0,
  SHORTLISTED: 1,
  INTERVIEW_SCHEDULED: 2,
  PENDING_ACCEPTANCE: 3,
  ACCEPTED: 4,
  REJECTED: 5,
  WITHDRAWN: 6,
  NOT_ATTENDING: 7
});

const ApplicationStatusLabel = Object.freeze({
  [ApplicationStatus.NEW]: 'new',
  [ApplicationStatus.SHORTLISTED]: 'shortlisted',
  [ApplicationStatus.INTERVIEW_SCHEDULED]: 'interview_scheduled',
  [ApplicationStatus.PENDING_ACCEPTANCE]: 'pending_acceptance',
  [ApplicationStatus.ACCEPTED]: 'accepted',
  [ApplicationStatus.REJECTED]: 'rejected',
  [ApplicationStatus.WITHDRAWN]: 'withdrawn',
  [ApplicationStatus.NOT_ATTENDING]: 'not_attending'
});

// Employment lifecycle
const EmploymentStatus = Object.freeze({
  UPCOMING: 0,
  ONGOING: 1,
  CLOSURE: 2,
  COMPLETED: 3,
  TERMINATED: 4
});

const EmploymentStatusLabel = Object.freeze({
  [EmploymentStatus.UPCOMING]: 'upcoming',
  [EmploymentStatus.ONGOING]: 'ongoing',
  [EmploymentStatus.CLOSURE]: 'closure',
  [EmploymentStatus.COMPLETED]: 'completed',
  [EmploymentStatus.TERMINATED]: 'terminated'
});

// Timesheets
const TimesheetStatus = Object.freeze({
  DRAFT: 0,
  SUBMITTED: 1,
  APPROVED: 2,
  REJECTED: 3
});

const TimesheetStatusLabel = Object.freeze({
  [TimesheetStatus.DRAFT]: 'draft',
  [TimesheetStatus.SUBMITTED]: 'submitted',
  [TimesheetStatus.APPROVED]: 'approved',
  [TimesheetStatus.REJECTED]: 'rejected'
});

// Generic request status (extensions/terminations)
const RequestStatus = Object.freeze({
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  CANCELLED: 3
});

const RequestStatusLabel = Object.freeze({
  [RequestStatus.PENDING]: 'pending',
  [RequestStatus.APPROVED]: 'approved',
  [RequestStatus.REJECTED]: 'rejected',
  [RequestStatus.CANCELLED]: 'cancelled'
});

// Backwards-compat exports to avoid touching all imports now
const VERIFICATION_STATUS = CompanyVerificationStatus;
const VERIFICATION_STATUS_LABELS = CompanyVerificationStatusLabel;
const INVITE_STATUS = InviteStatus;
const INVITE_STATUS_LABELS = InviteStatusLabel;

export {
  // Preferred names
  CompanyVerificationStatus,
  CompanyVerificationStatusLabel,
  InviteStatus,
  InviteStatusLabel,
  JobListingStatus,
  JobListingStatusLabel,
  ApplicationStatus,
  ApplicationStatusLabel,
  EmploymentStatus,
  EmploymentStatusLabel,
  TimesheetStatus,
  TimesheetStatusLabel,
  RequestStatus,
  RequestStatusLabel,
  // Back-compat names (used in current code)
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LABELS,
  INVITE_STATUS,
  INVITE_STATUS_LABELS
};

