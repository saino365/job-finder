import mongoose from 'mongoose';
import { VERIFICATION_STATUS, INVITE_STATUS } from '../constants/enums.js';
import Companies from '../models/companies.model.js';
import Invites from '../models/invites.model.js';

async function getCompanyForUser(app, userId) {
  return Companies.findOne({ ownerUserId: new mongoose.Types.ObjectId(userId) });
}

async function isCompanyVerified(app, userId) {
  const company = await getCompanyForUser(app, userId);
  if (!company) return { ok: false, company: null };
  const s = company.verifiedStatus;
  const ok = (typeof s === 'number' && s === VERIFICATION_STATUS.APPROVED) || (typeof s === 'string' && s === 'approved');
  return { ok, company };
}

async function hasAcceptedInvite(app, companyId, userId) {
  const invite = await Invites.findOne({ companyId, userId, status: INVITE_STATUS.ACCEPTED });
  return !!invite;
}

// Apply privacy masking for student profiles when viewed by companies
function maskStudent(record) {
  if (!record || record.role !== 'student') return record;
  const r = record.toObject ? record.toObject() : { ...record };
  const privacy = r.privacySetting || 'full';

  if (privacy === 'private') {
    // Caller should already filter out private in list; for safety, return minimal stub
    return { _id: r._id, role: r.role, privacySetting: 'private' };
  }

  // Base masking (hide sensitive academic docs)
  if (r.internProfile) {
    delete r.internProfile.gpa;
    delete r.internProfile.resume;
    delete r.internProfile.portfolio;
  }

  if (privacy === 'restricted') {
    // Hide identity/contact
    delete r.email;
    if (r.profile) {
      delete r.profile.phone;
      delete r.profile.firstName;
      delete r.profile.middleName;
      delete r.profile.lastName;
    }
  } else {
    // full: show everything, unless user opted to hide phone from companies
    if (r.profile && r.profile.hidePhoneForCompanies) {
      delete r.profile.phone;
    }
  }
  return r;
}

export { getCompanyForUser, isCompanyVerified, hasAcceptedInvite, maskStudent };

