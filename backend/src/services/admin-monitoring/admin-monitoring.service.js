import hooks from './admin-monitoring.hooks.js';

class AdminMonitoringService {
  constructor(options, app) {
    this.options = options || {};
    this.app = app;
  }

  // GET /admin/monitoring/overview
  async get(id, params) {
    if (id !== 'overview') {
      const err = new Error('Not found');
      err.code = 404;
      throw err;
    }

    const Job = this.app.service('job-listings');
    const Companies = this.app.service('companies');
    const Users = this.app.service('users');

    const JobModel = Job?.Model;
    const CompanyModel = Companies?.Model;
    const UserModel = Users?.Model;

    // Fallbacks to avoid crashes if a service is missing
    const countOrZero = async (fn) => { try { return await fn(); } catch (_) { return 0; } };

    const [
      jlDraft, jlPending, jlActive, jlClosed, jlTotal,
      coPending, coApproved, coRejected, coTotal,
      uStudents, uCompanies, uAdmins,
      recentListings
    ] = await Promise.all([
      countOrZero(() => JobModel.countDocuments({ status: 0 })),
      countOrZero(() => JobModel.countDocuments({ status: 1 })),
      countOrZero(() => JobModel.countDocuments({ status: 2 })),
      countOrZero(() => JobModel.countDocuments({ status: 3 })),
      countOrZero(() => JobModel.countDocuments({})),

      countOrZero(() => CompanyModel.countDocuments({ $or: [ { verifiedStatus: 0 }, { verifiedStatus: 'pending' }, { verifiedStatus: { $exists: false } } ] })), // pending (tolerate legacy strings/null)
      countOrZero(() => CompanyModel.countDocuments({ $or: [ { verifiedStatus: 1 }, { verifiedStatus: 'approved' } ] })), // approved (tolerate legacy strings)
      countOrZero(() => CompanyModel.countDocuments({ $or: [ { verifiedStatus: 2 }, { verifiedStatus: 'rejected' } ] })), // rejected (tolerate legacy strings)
      countOrZero(() => CompanyModel.countDocuments({})),

      countOrZero(() => UserModel.countDocuments({ role: 'student' })),
      countOrZero(() => UserModel.countDocuments({ role: 'company' })),
      countOrZero(() => UserModel.countDocuments({ role: 'admin' })),

      (async () => {
        try {
          return await JobModel.find({}, { title: 1, status: 1, companyId: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean();
        } catch (_) { return []; }
      })()
    ]);

    return {
      jobListings: {
        counts: { draft: jlDraft, pending: jlPending, active: jlActive, closed: jlClosed, total: jlTotal },
        recent: recentListings
      },
      companies: {
        counts: { pending: coPending, approved: coApproved, rejected: coRejected, total: coTotal }
      },
      users: {
        counts: { students: uStudents, companies: uCompanies, admins: uAdmins }
      }
    };
  }

  // GET /admin/monitoring (list pending items)
  async find(params) {
    const query = params?.query || {};
    const type = String(query.type || 'pending_jobs');

    const $limit = Math.max(1, Math.min(1000, Number(query.$limit || 50)));
    const $skip = Math.max(0, Number(query.$skip || 0));
    const q = String(query.q || '').trim();
    const start = query.start ? new Date(query.start) : null;
    const end = query.end ? new Date(query.end) : null;

    // Helpers
    const applyRange = (criteria, field) => {
      if (start && end) criteria[field] = { $gte: start, $lte: end };
      return criteria;
    };
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    if (type === 'pending_pre_approval') {
      const JobModel = this.app.service('job-listings').Model;
      const CompanyModel = this.app.service('companies').Model;
      const criteria = applyRange({ status: 4 }, 'submittedAt'); // PENDING_PRE_APPROVAL
      if (rx) {
        const companyIds = (await CompanyModel.find({ name: rx }, { _id: 1 }).lean()).map(c => c._id);
        criteria.$or = [{ title: rx }, { companyId: { $in: companyIds } }];
      }
      const total = await JobModel.countDocuments(criteria);
      const data = await JobModel.find(criteria).sort({ submittedAt: -1 }).skip($skip).limit($limit).lean();
      return { total, data };
    }

    if (type === 'pending_final_approval') {
      const JobModel = this.app.service('job-listings').Model;
      const CompanyModel = this.app.service('companies').Model;
      const criteria = applyRange({ status: 1 }, 'finalSubmittedAt'); // PENDING_APPROVAL (final stage)
      if (rx) {
        const companyIds = (await CompanyModel.find({ name: rx }, { _id: 1 }).lean()).map(c => c._id);
        criteria.$or = [{ title: rx }, { companyId: { $in: companyIds } }];
      }
      const total = await JobModel.countDocuments(criteria);
      const data = await JobModel.find(criteria).sort({ finalSubmittedAt: -1 }).skip($skip).limit($limit).lean();
      return { total, data };
    }

    // Legacy support for 'pending_jobs' - defaults to pending_pre_approval
    if (type === 'pending_jobs') {
      const JobModel = this.app.service('job-listings').Model;
      const CompanyModel = this.app.service('companies').Model;
      const criteria = applyRange({ status: { $in: [1, 4] } }, 'submittedAt'); // Both pending states
      if (rx) {
        const companyIds = (await CompanyModel.find({ name: rx }, { _id: 1 }).lean()).map(c => c._id);
        criteria.$or = [{ title: rx }, { companyId: { $in: companyIds } }];
      }
      const total = await JobModel.countDocuments(criteria);
      const data = await JobModel.find(criteria).sort({ submittedAt: -1 }).skip($skip).limit($limit).lean();
      return { total, data };
    }

    if (type === 'pending_companies') {
      const CompanyModel = this.app.service('companies').Model;
      // D122: Fix pending companies query - include companies with verifiedStatus 0 (pending) or null/undefined
      // Also check for companies that have submittedAt set (submitted for verification)
      const criteria = applyRange({ 
        $and: [
          {
            $or: [ 
              { verifiedStatus: 0 }, 
              { verifiedStatus: 'pending' }, 
              { verifiedStatus: { $exists: false } },
              { verifiedStatus: null }
            ]
          },
          {
            $or: [
              { submittedAt: { $exists: true, $ne: null } },
              { verifiedStatus: 0 }
            ]
          }
        ]
      }, 'submittedAt');
      if (rx) criteria.name = rx;
      const total = await CompanyModel.countDocuments(criteria);
      const data = await CompanyModel.find(criteria).sort({ submittedAt: -1, createdAt: -1 }).skip($skip).limit($limit).lean();
      return { total, data };
    }

    if (type === 'renewal_requests') {
      const JobModel = this.app.service('job-listings').Model;
      const CompanyModel = this.app.service('companies').Model;
      const now = new Date();

      const maxDays = Number(query.maxDays || 0);

      const criteria = { status: 2, renewal: true };
      if (start && end) { criteria.renewalRequestedAt = { $gte: start, $lte: end }; }
      else if (maxDays > 0) {
        const max = new Date(now.getTime()); max.setDate(max.getDate() + maxDays);
        criteria.expiresAt = { $lte: max, $gte: now };
      }

      if (rx) {
        const companyIds = (await CompanyModel.find({ name: rx }, { _id: 1 }).lean()).map(c => c._id);
        criteria.$or = [ { title: rx }, { companyId: { $in: companyIds } } ];
      }

      const total = await JobModel.countDocuments(criteria);
      const data = await JobModel.find(criteria).sort({ renewalRequestedAt: -1 }).skip($skip).limit($limit).lean();
      return { total, data };
    }

    if (type === 'expiring_jobs') {
      const JobModel = this.app.service('job-listings').Model;
      let criteria = { status: 2 };
      if (start && end) criteria = applyRange(criteria, 'expiresAt');
      else {
        const now = new Date(); const threshold = new Date(now.getTime()); threshold.setDate(threshold.getDate() + 7);
        criteria.expiresAt = { $lte: threshold, $gte: now };
      }
      const total = await JobModel.countDocuments(criteria);
      const data = await JobModel.find(criteria).sort({ expiresAt: 1 }).skip($skip).limit($limit).lean();
      return { total, data };
    }

    return { total: 0, data: [] };
  }
}

export default function (app) {
  const options = { paginate: false };
  app.use('/admin/monitoring', new AdminMonitoringService(options, app));
  const service = app.service('admin/monitoring');
  service.hooks(hooks(app));
}

