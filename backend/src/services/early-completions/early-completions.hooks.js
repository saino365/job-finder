import { hooks as authHooks } from '@feathersjs/authentication';
import { RequestStatus as RS, EmploymentStatus as ES } from '../../constants/enums.js';

const { authenticate } = authHooks;

export default (app) => {
  async function ensureAccessFind(ctx) {
    const user = ctx.params.user; const q = ctx.params.query || {};
    if (!user) return ctx;
    if (user.role === 'student') {
      const Employment = app.service('employment-records')?.Model;
      const employmentIds = await Employment.find({ userId: user._id }).select('_id').lean();
      ctx.params.query = { ...q, employmentId: { $in: employmentIds.map(e => e._id) } };
    } else if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      const Employment = app.service('employment-records')?.Model;
      const employmentIds = await Employment.find({ companyId: company?._id }).select('_id').lean();
      ctx.params.query = { ...q, employmentId: { $in: employmentIds.map(e => e._id) } };
    }
    return ctx;
  }

  async function onCreate(ctx) {
    const user = ctx.params.user; const body = ctx.data || {};
    if (user.role !== 'student') throw Object.assign(new Error('Only students can request early completion'), { code: 403 });
    const Employment = app.service('employment-records')?.Model;
    const emp = await Employment.findById(body.employmentId).lean();
    if (!emp) throw Object.assign(new Error('Employment not found'), { code: 404 });
    if (String(emp.userId) !== String(user._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });

    // Check employment status - only allow early completion requests for ONGOING (status === 1)
    if (emp.status !== ES.ONGOING) {
      const statusLabels = { 0: 'Upcoming', 1: 'Ongoing', 2: 'Closure', 3: 'Completed', 4: 'Terminated' };
      const currentStatus = statusLabels[emp.status] || 'Unknown';
      throw Object.assign(new Error(`Cannot request early completion. Employment status is ${currentStatus}. Early completion requests are only allowed for ongoing employments.`), { code: 400 });
    }

    ctx.data = { employmentId: emp._id, initiatedBy: 'student', reason: body.reason, proposedCompletionDate: body.proposedCompletionDate ? new Date(body.proposedCompletionDate) : null, status: RS.PENDING };

    // Notify company owner
    try {
      const company = await app.service('companies').Model.findById(emp.companyId).lean();
      if (company?.ownerUserId) {
        await app.service('notifications').create({ recipientUserId: company.ownerUserId, recipientRole: 'company', type: 'early_completion_requested', title: 'Early completion requested', data: { employmentId: emp._id } });
      }
    } catch (_) {}
  }

  async function applyAction(ctx) {
    const user = ctx.params.user; const id = ctx.id;
    const EC = app.service('early-completions')?.Model;
    const doc = await EC.findById(id);
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });
    const Employment = app.service('employment-records')?.Model;
    const emp = await Employment.findById(doc.employmentId).lean();
    if (!emp) throw Object.assign(new Error('Employment not found'), { code: 404 });

    const action = String(ctx.data.action || '').trim();
    if (!action) return ctx;

    const now = new Date();

    // Company/Admin decide
    if ((user.role === 'company' || user.role === 'admin') && doc.status === RS.PENDING) {
      // Ownership check for company
      if (user.role === 'company') {
        const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
        if (!company || String(emp.companyId) !== String(company._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
      }
      if (action === 'approve') {
        const end = doc.proposedCompletionDate || now;
        // Move to CLOSURE (end earlier)
        await Employment.updateOne({ _id: emp._id }, { $set: { status: ES.CLOSURE, endDate: end } });
        ctx.data = { status: RS.APPROVED, decidedBy: user._id, decidedAt: now };
        try {
          await app.service('notifications').create({ recipientUserId: emp.userId, recipientRole: 'student', type: 'early_completion_approved', title: 'Early completion approved', data: { employmentId: emp._id } });
          await app.service('notifications').create({ recipientUserId: emp.userId, recipientRole: 'student', type: 'employment_moved_to_closure', title: 'Employment moved to closure', data: { employmentId: emp._id } });
        } catch (_) {}
        return;
      }
      if (action === 'reject') {
        const decisionRemark = ctx.data?.decisionRemark || null;
        ctx.data = { status: RS.REJECTED, decidedBy: user._id, decidedAt: now, decisionRemark };
        try {
          await app.service('notifications').create({ recipientUserId: emp.userId, recipientRole: 'student', type: 'early_completion_rejected', title: 'Early completion rejected', data: { employmentId: emp._id } });
        } catch (_) {}
        return;
      }
    }

    throw Object.assign(new Error('Invalid action'), { code: 400 });
  }

  return {
    before: {
      all: [ authenticate('jwt') ],
      find: [ ensureAccessFind ],
      get: [],
      create: [ onCreate ],
      patch: [ applyAction ]
    }
  };
};
