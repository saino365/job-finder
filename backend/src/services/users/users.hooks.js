import { hooks as authHooks } from '@feathersjs/authentication';
import { hooks as localHooks } from '@feathersjs/authentication-local';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import mongoose from 'mongoose';
import { getCompanyForUser, hasAcceptedInvite, maskStudent, isCompanyVerified } from '../../utils/access.js';

const { authenticate } = authHooks;
const { hashPassword, protect } = localHooks;

async function maskForCompanies(context) {
  // Only apply when requester is a company and viewing other users
  const requester = context.params && context.params.user;
  if (!requester || requester.role !== 'company') return context;

  const company = await getCompanyForUser(context.app, requester._id);
  const companyId = company && company._id;

  const applyMask = async (record) => {
    if (!record || (record._id && record._id.toString() === requester._id.toString())) return record;
    if (record.role !== 'student') return record;

    // If private, block direct access on get
    if (context.method === 'get' && record.privacySetting === 'private') {
      const err = new Error('Not found');
      err.code = 404;
      throw err;
    }

    if (!companyId) return maskStudent(record);
    const ok = await hasAcceptedInvite(context.app, new mongoose.Types.ObjectId(companyId), new mongoose.Types.ObjectId(record._id));
    return ok ? record : maskStudent(record);
  };

  if (Array.isArray(context.result && context.result.data)) {
    const data = context.result.data;
    context.result.data = await Promise.all(data.map(applyMask));
  } else if (Array.isArray(context.result)) {
    context.result = await Promise.all(context.result.map(applyMask));
  } else {
    context.result = await applyMask(context.result);
  }
  return context;
}

// Require verified company before browsing students
async function requireVerifiedCompany(context) {
  const requester = context.params && context.params.user;
  if (requester && requester.role === 'company') {
    // Allow a company to access its own user record (e.g., during authentication)
    if (context.path === 'users' && context.method === 'get' && context.id && String(context.id) === String(requester._id)) {
      return context;
    }
    const { ok } = await isCompanyVerified(context.app, requester._id);
    if (!ok) {
      const err = new Error('Company verification required');
      err.code = 403;
      err.name = 'COMPANY_UNVERIFIED';
      throw err;
    }
  }
  return context;
}

// Map friendly filters to Mongo query for student search
async function mapStudentFilters(context) {
  if (!context.params) return context;
  const q = context.params.query || {};
  const m = {};
  if (q.keyword) {
    m.$or = [
      { 'profile.firstName': { $regex: String(q.keyword), $options: 'i' } },
      { 'profile.middleName': { $regex: String(q.keyword), $options: 'i' } },
      { 'profile.lastName': { $regex: String(q.keyword), $options: 'i' } },
      { 'internProfile.skills': { $regex: String(q.keyword), $options: 'i' } }
    ];
  }
  if (q.university) m['internProfile.university'] = { $regex: String(q.university), $options: 'i' };
  if (q.major) m['internProfile.major'] = { $regex: String(q.major), $options: 'i' };
  if (q.skill) {
    const skills = Array.isArray(q.skill) ? q.skill : [ q.skill ];
    m['internProfile.skills'] = { $in: skills };
  }
  if (q.city) m['profile.location.city'] = { $regex: String(q.city), $options: 'i' };
  if (q.gpaMin != null) m['internProfile.gpa'] = { ...(m['internProfile.gpa']||{}), $gte: Number(q.gpaMin) };
  if (q.gpaMax != null) m['internProfile.gpa'] = { ...(m['internProfile.gpa']||{}), $lte: Number(q.gpaMax) };
  if (q.gradYear != null) m['internProfile.graduationYear'] = Number(q.gradYear);

  // If company is searching, exclude private profiles entirely
  const requester = context.params && context.params.user;
  if (requester && requester.role === 'company') {
    m.privacySetting = { $ne: 'private' };
  }

  // Force role=student for search
  context.params.query = { role: 'student', ...m };

  // Remove friendly params
  ['keyword','university','major','skill','city','gpaMin','gpaMax','gradYear'].forEach(k => delete q[k]);
  return context;
}

export default {
  before: {
    all: [],
    find: [
      (context) => {
        console.log('🔍 Users.find hook - provider:', context.params.provider, 'query:', JSON.stringify(context.params.query));
        return context;
      },
      iff(isProvider('external'), authenticate('jwt')),
      iff(isProvider('external'), requireVerifiedCompany),
      iff(isProvider('external'), mapStudentFilters)
    ],
    get: [
      iff(isProvider('external'), authenticate('jwt')),
      // Skip company verification check for /users/me endpoint
      iff(
        isProvider('external'),
        iff(
          (context) => context.id !== 'me',
          requireVerifiedCompany
        )
      )
    ],
    create: [
      hashPassword('password'),
      // Normalize username/email and validate
      (context) => {
        const data = context.data || {};
        const { email, password } = data;
        if (!email && !data.username) {
          throw new Error('Email or username is required');
        }
        if (!password) {
          throw new Error('Password is required');
        }

        // Validate username contains at least 3 alphabetic characters
        if (data.username) {
          const username = String(data.username).trim();
          const alphabeticCount = (username.match(/[A-Za-z]/g) || []).length;
          if (alphabeticCount < 3) {
            throw new Error('Username must contain at least 3 alphabetic characters');
          }
        }

        // Validate name fields contain at least 3 alphabetic characters
        if (data.profile) {
          if (data.profile.firstName) {
            const firstName = String(data.profile.firstName).trim();
            const alphabeticCount = (firstName.match(/[A-Za-z]/g) || []).length;
            if (alphabeticCount < 3) {
              throw new Error('First name must contain at least 3 alphabetic characters');
            }
          }
          if (data.profile.middleName) {
            const middleName = String(data.profile.middleName).trim();
            const alphabeticCount = (middleName.match(/[A-Za-z]/g) || []).length;
            if (alphabeticCount < 3) {
              throw new Error('Middle name must contain at least 3 alphabetic characters');
            }
          }
          if (data.profile.lastName) {
            const lastName = String(data.profile.lastName).trim();
            const alphabeticCount = (lastName.match(/[A-Za-z]/g) || []).length;
            if (alphabeticCount < 3) {
              throw new Error('Last name must contain at least 3 alphabetic characters');
            }
          }
        }

        // Default role to student if not provided
        if (!data.role) data.role = 'student';
        // If username not given, use email (or lowercase of provided username)
        const identifier = (data.username || data.email || '').toLowerCase();
        data.username = identifier;
        if (!data.email) data.email = identifier; // allow login by either
        context.data = data;
      }
    ],
    update: [
      disallow('external'),
      hashPassword('password')
    ],
    patch: [
      authenticate('jwt'),
      iff(
        isProvider('external'),
        // Users can only update their own profile
        (context) => {
          if (context.params.user.role !== 'admin') {
            context.id = context.params.user._id;
          }
        }
      ),
      // Whitelist fields for patch when called externally. Internal calls (from services) may update system fields.
      (context) => {
        if (!context.params.provider) return context; // internal call, allow system-managed fields
        const allowedRoots = ['profile','internProfile','privacySetting','password'];
        const data = context.data || {};
        const filtered = {};
        for (const [k, v] of Object.entries(data)) {
          if (allowedRoots.includes(k) || k.startsWith('profile.') || k.startsWith('internProfile.')) {
            filtered[k] = v;
          }
        }
        context.data = filtered;
      },
      // Validate name fields contain at least 3 alphabetic characters
      (context) => {
        const data = context.data || {};

        // Check nested profile object
        if (data.profile) {
          if (data.profile.firstName) {
            const firstName = String(data.profile.firstName).trim();
            const alphabeticCount = (firstName.match(/[A-Za-z]/g) || []).length;
            if (alphabeticCount < 3) {
              throw new Error('First name must contain at least 3 alphabetic characters');
            }
          }
          if (data.profile.middleName) {
            const middleName = String(data.profile.middleName).trim();
            const alphabeticCount = (middleName.match(/[A-Za-z]/g) || []).length;
            if (alphabeticCount < 3) {
              throw new Error('Middle name must contain at least 3 alphabetic characters');
            }
          }
          if (data.profile.lastName) {
            const lastName = String(data.profile.lastName).trim();
            const alphabeticCount = (lastName.match(/[A-Za-z]/g) || []).length;
            if (alphabeticCount < 3) {
              throw new Error('Last name must contain at least 3 alphabetic characters');
            }
          }
        }

        // Check dot-notation fields (e.g., 'profile.firstName')
        if (data['profile.firstName']) {
          const firstName = String(data['profile.firstName']).trim();
          const alphabeticCount = (firstName.match(/[A-Za-z]/g) || []).length;
          if (alphabeticCount < 3) {
            throw new Error('First name must contain at least 3 alphabetic characters');
          }
        }
        if (data['profile.middleName']) {
          const middleName = String(data['profile.middleName']).trim();
          const alphabeticCount = (middleName.match(/[A-Za-z]/g) || []).length;
          if (alphabeticCount < 3) {
            throw new Error('Middle name must contain at least 3 alphabetic characters');
          }
        }
        if (data['profile.lastName']) {
          const lastName = String(data['profile.lastName']).trim();
          const alphabeticCount = (lastName.match(/[A-Za-z]/g) || []).length;
          if (alphabeticCount < 3) {
            throw new Error('Last name must contain at least 3 alphabetic characters');
          }
        }

        return context;
      },
      hashPassword('password')
    ],
    remove: [
      authenticate('jwt'),
      iff(
        isProvider('external'),
        // Only admins can delete users, or users can delete themselves
        (context) => {
          if (context.params.user.role !== 'admin') {
            context.id = context.params.user._id;
          }
        }
      )
    ]
  },

  after: {
    all: [
      // Make sure the password field is never sent to external clients
      iff(isProvider('external'), protect('password'))
    ],
    find: [ maskForCompanies ],
    get: [ maskForCompanies ],
    create: [
      // Send welcome email or verification email here
      (context) => {
        // TODO: Implement email verification
        console.log('User created:', context.result.email);
      }
    ],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [
      (context) => {
        const error = context.error;
        if (error && error.code === 11000) {
          if (error.message && error.message.includes('email')) {
            error.message = 'This email address is already registered. Please use a different email address.';
          } else if (error.message && error.message.includes('username')) {
            error.message = 'This username is already registered. Please use a different username.';
          } else {
            error.message = 'This account already exists. Please use different credentials.';
          }
          error.code = 409;
        }
        return context;
      }
    ],
    update: [],
    patch: [],
    remove: []
  }
};
