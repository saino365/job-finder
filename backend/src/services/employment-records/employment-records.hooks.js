import { hooks as authHooks } from '@feathersjs/authentication';
import mongoose from 'mongoose';
import { EmploymentStatus as ES, TimesheetStatus as TS } from '../../constants/enums.js';

const { authenticate } = authHooks;

export default (app) => {
  // Models are resolved lazily inside hook functions to avoid init order issues

  async function ensureAccessFind(ctx) {
    const user = ctx.params.user; const q = ctx.params.query || {};
    if (!user) return ctx;
    if (user.role === 'student') ctx.params.query = { ...q, userId: user._id };
    else if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company) throw Object.assign(new Error('Company not found'), { code: 404 });
      ctx.params.query = { ...q, companyId: company._id };
    }
    return ctx;
  }

  async function populateApplication(ctx) {
    // Populate application data after find so frontend can filter by application status
    const Employment = app.service('employment-records')?.Model;
    if (ctx.result && ctx.result.data) {
      // Paginated result
      const populated = await Employment.populate(ctx.result.data, { path: 'applicationId' });
      ctx.result.data = populated;
    } else if (Array.isArray(ctx.result)) {
      // Non-paginated result
      ctx.result = await Employment.populate(ctx.result, { path: 'applicationId' });
    }
    return ctx;
  }

  async function ensureAccessGet(ctx) {
    const user = ctx.params.user; if (!user) return ctx;
    const Employment = app.service('employment-records')?.Model;
    const doc = await Employment.findById(ctx.id).lean(); if (!doc) return ctx;
    if (user.role === 'student' && String(doc.userId) !== String(user._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company || String(doc.companyId) !== String(company._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    }
    return ctx;
  }

  async function onCreate(ctx) {
    // Disallow external creation; records are created by system (applications.accept)
    if (ctx.params.provider) throw Object.assign(new Error('Method not allowed'), { code: 405 });
  }

  async function applyAction(ctx) {
    const user = ctx.params.user; const id = ctx.id;
    const Employment = app.service('employment-records')?.Model;
    const doc = await Employment.findById(id);
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });
    if (user.role === 'student' && String(doc.userId) !== String(user._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company || String(doc.companyId) !== String(company._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    }

    const action = String(ctx.data.action || '').trim();
    if (!action) return ctx; // allow normal minimal patch like updating cadence by admin (not exposed here)

    const now = new Date();

    function set(data, pushNoteText) {
      ctx.data = { ...(data || {}) };
      if (pushNoteText) {
        ctx.data.$push = { ...(ctx.data.$push || {}), notes: { at: now, byUserId: user._id, text: pushNoteText } };
      }
    }

    // Company/Admin actions
    if (user.role === 'company' || user.role === 'admin') {
      if (action === 'startNow' && doc.status === ES.UPCOMING) { set({ status: ES.ONGOING }); ctx.params._notify = { type: 'employment_started', toUserId: doc.userId, toRole: 'student' }; return; }
      if (action === 'moveToClosure' && doc.status === ES.ONGOING) {
        // Require required documents to be verified before moving to Closure
        const required = doc.requiredDocs || [];
        const hasAllDocs = required.every(rt => (doc.docs || []).some(d => d.type === rt && d.verified));
        if (!hasAllDocs) throw Object.assign(new Error('Required documents must be verified before moving to closure'), { code: 400 });
        set({ status: ES.CLOSURE });
        ctx.params._notify = { type: 'employment_moved_to_closure', toUserId: doc.userId, toRole: 'student' };
        return;
      }
      if (action === 'terminate' && [ES.UPCOMING, ES.ONGOING, ES.CLOSURE].includes(doc.status)) { set({ status: ES.TERMINATED, endDate: now }, 'Terminated'); ctx.params._notify = { type: 'employment_terminated', toUserId: doc.userId, toRole: 'student' }; return; }
      if (action === 'updatePIC') { set({ supervisorUserId: ctx.data.supervisorUserId }); return; }
      if (action === 'addNote') { set({}, ctx.data.text || ''); return; }
      if (action === 'attachDoc') { set({ $push: { docs: { type: ctx.data.type, fileKey: ctx.data.fileKey, verified: false, uploadedAt: now } } }); return; }
      if (action === 'verifyDoc') {
        const docId = ctx.data.docId;
        set({ $set: { 'docs.$[d].verified': !!ctx.data.verified } });
        ctx.params.mongoose = { arrayFilters: [{ 'd._id': new mongoose.Types.ObjectId(docId) }] };
        return;
      }
      if (action === 'complete' && doc.status === ES.CLOSURE) {
        // gate by required docs and approved timesheets
        // 1) docs verified
        const required = doc.requiredDocs || [];
        const hasAllDocs = required.every(rt => (doc.docs || []).some(d => d.type === rt && d.verified));
        if (!hasAllDocs) throw Object.assign(new Error('Required documents not verified'), { code: 400 });
        // 2) all timesheets up to endDate approved
        const Timesheets = app.service('timesheets')?.Model;
        if (Timesheets && doc.endDate) {
          const pending = await Timesheets.countDocuments({ employmentId: doc._id, periodEnd: { $lte: doc.endDate }, status: { $ne: TS.APPROVED } });
          if (pending > 0) throw Object.assign(new Error('Pending timesheets not approved'), { code: 400 });
        }
        set({ status: ES.COMPLETED });
        ctx.params._notify = { type: 'employment_completed', toUserId: doc.userId, toRole: 'student' };
        return;
      }
      throw Object.assign(new Error('Invalid action'), { code: 400 });
    }

    // Student actions: add notes and attach docs (e.g., finalReport/jobReview/companyReview)
    if (user.role === 'student') {
      if (action === 'addNote') { set({}, ctx.data.text || ''); return; }
      if (action === 'attachDoc') { set({ $push: { docs: { type: ctx.data.type, fileKey: ctx.data.fileKey, verified: false, uploadedAt: now } } }); return; }
      throw Object.assign(new Error('Invalid action'), { code: 400 });
    }

    return ctx;
  }

  async function afterNotify(ctx) {
    const n = ctx.params._notify; if (!n) return ctx;
    try { await app.service('notifications').create({ recipientUserId: n.toUserId, recipientRole: n.toRole, type: n.type, title: 'Employment update', data: { employmentId: ctx.id || ctx.result?._id } }); } catch (_) {}
    return ctx;
  }

  return {
    before: {
      all: [ authenticate('jwt') ],
      find: [ ensureAccessFind ],
      get: [ ensureAccessGet ],
      create: [ onCreate ],
      patch: [ applyAction ]
    },
    after: {
      find: [ populateApplication ],
      patch: [ afterNotify ]
    },
    error: {}
  };
};

