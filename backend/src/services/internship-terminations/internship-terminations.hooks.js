import { hooks as authHooks } from '@feathersjs/authentication';
import { RequestStatus as RS, EmploymentStatus as ES } from '../../constants/enums.js';

const { authenticate } = authHooks;

export default (app) => {
  // Resolve models lazily inside handlers to avoid init-order issues

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
    const Employment = app.service('employment-records')?.Model;
    const emp = await Employment.findById(body.employmentId).lean();
    if (!emp) throw Object.assign(new Error('Employment not found'), { code: 404 });

    // Check employment status - allow termination for UPCOMING and ONGOING
    if (emp.status !== ES.UPCOMING && emp.status !== ES.ONGOING) {
      const statusLabels = { 0: 'Upcoming', 1: 'Ongoing', 2: 'Closure', 3: 'Completed', 4: 'Terminated' };
      const currentStatus = statusLabels[emp.status] || 'Unknown';
      throw Object.assign(new Error(`Cannot request termination. Employment status is ${currentStatus}. Termination requests are only allowed for upcoming or ongoing employments.`), { code: 400 });
    }

    const initiatedBy = user.role === 'company' ? 'company' : (user.role === 'student' ? 'student' : null);
    if (!initiatedBy) throw Object.assign(new Error('Forbidden'), { code: 403 });
    // Ownership check
    if (initiatedBy === 'student' && String(emp.userId) !== String(user._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    if (initiatedBy === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company || String(emp.companyId) !== String(company._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    }
    ctx.data = { employmentId: emp._id, initiatedBy, reason: body.reason, remark: body.remark || null, proposedLastDay: body.proposedLastDay ? new Date(body.proposedLastDay) : null, status: RS.PENDING };
  }

  async function applyAction(ctx) {
    const user = ctx.params.user; const id = ctx.id;
    const Terminations = app.service('internship-terminations')?.Model;
    const doc = await Terminations.findById(id);
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });
    const Employment = app.service('employment-records')?.Model;
    const emp = await Employment.findById(doc.employmentId).lean();
    if (!emp) throw Object.assign(new Error('Employment not found'), { code: 404 });

    const action = String(ctx.data.action || '').trim();
    if (!action) return ctx;

    const now = new Date();

    if (action === 'cancel' && doc.status === RS.PENDING) {
      if ((doc.initiatedBy === 'student' && user.role === 'student' && String(emp.userId) === String(user._id)) ||
          (doc.initiatedBy === 'company' && user.role === 'company')) {
        ctx.data = { status: RS.CANCELLED };
        return;
      }
      throw Object.assign(new Error('Forbidden'), { code: 403 });
    }

    // Approve/Reject by company (or admin)
    if ((user.role === 'company' || user.role === 'admin') && doc.status === RS.PENDING) {
      if (action === 'approve') {
        const lastDay = doc.proposedLastDay || now;
        await Employment.updateOne({ _id: emp._id }, { $set: { status: ES.TERMINATED, endDate: lastDay } });
        ctx.data = { status: RS.APPROVED, decidedBy: user._id, decidedAt: now };
        try { await app.service('notifications').create({ recipientUserId: emp.userId, recipientRole: 'student', type: 'employment_terminated', title: 'Employment terminated', data: { employmentId: emp._id } }); } catch (_) {}
        return;
      }
      if (action === 'reject') { const decisionRemark = ctx.data?.decisionRemark || null; ctx.data = { status: RS.REJECTED, decidedBy: user._id, decidedAt: now, decisionRemark }; return; }
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

