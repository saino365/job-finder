import { hooks as authHooks } from '@feathersjs/authentication';
import { iff, isProvider } from 'feathers-hooks-common';
import mongoose from 'mongoose';
import { getCompanyForUser, isCompanyVerified } from '../../utils/access.js';
import { JobListingStatus } from '../../constants/enums.js';

const { authenticate } = authHooks;

function onlyRoles(...roles) {
  return async (ctx) => {
    const r = ctx.params?.user?.role;
    if (!r || !roles.includes(r)) {
      const err = new Error('Not authorized');
      err.code = 403;
      throw err;
    }
  };
}

// Use centralized status constants
const STATUS = JobListingStatus;

function computeExpiry(publishAt) {
  const base = publishAt ? new Date(publishAt) : new Date();
  const dt = new Date(base.getTime());
  dt.setDate(dt.getDate() + 30);
  return dt;
}

export default (app) => ({
  before: {
    all: [],
    find: [
      // Try to authenticate if token is present, but don't fail if not
      async (ctx) => {
        try {
          if (ctx.params.headers?.authorization || ctx.params.authentication) {
            await authenticate('jwt')(ctx);
          }
        } catch (err) {
          // Authentication failed or no token - continue as unauthenticated
          console.log('🔍 Job Backend FIND: Authentication failed or no token, continuing as unauthenticated');
        }
        return ctx;
      },
      async (ctx) => {
        const user = ctx.params?.user;
        ctx.params.query = ctx.params.query || {};

        console.log('🔍 Job Backend FIND: User:', user ? `${user.email} (${user.role})` : 'NOT AUTHENTICATED');

        // Company sees own jobs (all statuses); admin sees all; students/unauthenticated see ACTIVE only
        if (!user || user.role === 'student') {
        ctx.params.query.status = STATUS.ACTIVE; // public browse (but still auth in our app)

        // Handle custom filters that need backend processing
        const q = { ...(ctx.params.query || {}) };
        console.log('🔍 Job Backend: Received query parameters:', q);

        // Store keyword for comprehensive search in after hook (avoid FeathersJS validation issues)
        if (q.keyword) {
          ctx.params.keywordFilter = q.keyword;
          console.log('🔍 Job Backend: Stored keyword for after hook search:', { keyword: q.keyword });
        }

        // Store industry filter for after hook (company population)
        if (q.industry) {
          ctx.params.industryFilter = Array.isArray(q.industry) ? q.industry : [q.industry];
          console.log('🔍 Job Backend: Stored industry filter for after hook:', ctx.params.industryFilter);
        }

        // Handle start date filtering
        if (q.startDate) {
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Start of today
          let startDateQuery = {};

          if (q.startDate === 'This Month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            startDateQuery = { $gte: startOfMonth, $lte: endOfMonth };
            console.log('🔍 Job Backend: This Month filter:', { startOfMonth, endOfMonth });
          } else if (q.startDate === 'Next Month') {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
            startDateQuery = { $gte: nextMonth, $lte: endOfNextMonth };
            console.log('🔍 Job Backend: Next Month filter:', { nextMonth, endOfNextMonth });
          } else if (q.startDate === 'Next 3 Months') {
            const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59, 999);
            startDateQuery = { $gte: now, $lte: threeMonthsLater };
            console.log('🔍 Job Backend: Next 3 Months filter:', { now, threeMonthsLater });
          } else if (q.startDate === 'Next 6 Months') {
            const sixMonthsLater = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59, 999);
            startDateQuery = { $gte: now, $lte: sixMonthsLater };
            console.log('🔍 Job Backend: Next 6 Months filter:', { now, sixMonthsLater });
          } else if (q.startDate === 'Flexible') {
            // For "Flexible", show all jobs (no date filter)
            console.log('🔍 Job Backend: Flexible filter - no date restriction');
          }

          if (Object.keys(startDateQuery).length > 0) {
            ctx.params.query['project.startDate'] = startDateQuery;
            console.log('🔍 Job Backend: Applied start date filter:', {
              startDate: q.startDate,
              query: startDateQuery,
              queryField: 'project.startDate'
            });
          }
        }

        // Remove custom params so they don't leak to the adapter
        // Note: location, salaryRange filters are handled by FeathersJS directly
        ['keyword', 'industry', 'startDate'].forEach(k => delete ctx.params.query[k]);

        console.log('🔍 Job Backend: Final query after cleanup:', ctx.params.query);

      } else if (user.role === 'company') {
        const company = await getCompanyForUser(app, user._id);
        if (!company) throw new Error('Company profile not found');
        console.log('🔍 Job Backend FIND: Company user, filtering by companyId:', company._id);
        ctx.params.query.companyId = company._id;
      }

      console.log('🔍 Job Backend FIND: Final query:', ctx.params.query);
    } ],
    get: [ async (ctx) => {
      const user = ctx.params?.user;
      if (!user || user.role === 'student') {
        // Only allow getting ACTIVE listings publicly
        const current = await app.service('job-listings').Model.findById(ctx.id).lean();
        if (!current || current.status !== STATUS.ACTIVE) {
          const e = new Error('Not found'); e.code = 404; throw e;
        }
      }
    } ],
    create: [
      authenticate('jwt'),
      onlyRoles('company','admin'),
      async (ctx) => {
        const user = ctx.params.user;
        let companyId = null;
        if (user.role === 'company') {
          const { ok, company } = await isCompanyVerified(app, user._id);
          if (!ok) {
            const e = new Error('Company verification required');
            e.code = 403;
            throw e;
          }
          companyId = company._id;
        } else if (user.role === 'admin') {
          if (ctx.data.companyId) companyId = new mongoose.Types.ObjectId(ctx.data.companyId);
        }
        if (!companyId) throw new Error('companyId is required');

        const d = ctx.data || {};
        d.companyId = companyId;
        d.createdBy = user._id;

        // Simple approval workflow:
        // submitForApproval → PENDING (for admin approval)
        // otherwise → DRAFT
        const submitForApproval = !!d.submitForApproval;
        delete d.submitForApproval;

        if (submitForApproval) {
          // Validate required fields for submission
          if (!d.title || !d.title.trim()) {
            throw new Error('Title is required for submission');
          }
          d.status = STATUS.PENDING;
          d.submittedAt = new Date();
        } else {
          d.status = STATUS.DRAFT;
        }
        ctx.data = d;
      }
    ],
    update: [ () => { throw new Error('Method not allowed'); } ],
    patch: [
      authenticate('jwt'),
      async (ctx) => {
        const user = ctx.params?.user;
        const current = await app.service('job-listings').get(ctx.id, ctx.params);
        // capture snapshot for after hooks
        ctx.params._before = { status: current.status };

        // Role-based authorization
        if (user.role === 'company') {
          const company = await getCompanyForUser(app, user._id);
          if (!company || String(company._id) !== String(current.companyId)) {
            const e = new Error('Not authorized'); e.code = 403; throw e;
          }
        } else if (user.role !== 'admin') {
          const e = new Error('Not authorized'); e.code = 403; throw e;
        }

        const d = ctx.data || {};

        // Company actions
        if (user.role === 'company') {
          // While pending approval, restrict company edits to PIC details only
          if (current.status === STATUS.PENDING) {
            const pic = d.pic || {};
            ctx.params._picUpdatedDuringPending = true;
            ctx.data = { pic: { name: pic.name, phone: pic.phone, email: pic.email }, picUpdatedAt: new Date() };
            return;
          }

          // Submit for approval - from DRAFT
          if (d.submitForApproval && current.status === STATUS.DRAFT) {
            // Validate required fields for submission
            const title = d.title !== undefined ? d.title : current.title;
            if (!title || !title.trim()) {
              throw new Error('Title is required for submission');
            }
            d.status = STATUS.PENDING;
            d.submittedAt = new Date();
          }

          if (d.close === true && current.status === STATUS.ACTIVE) {
            d.status = STATUS.CLOSED;
            d.closedAt = new Date();
          }
          // Company requests renewal when listing is active
          if (d.requestRenewal === true && current.status === STATUS.ACTIVE) {
            d.renewal = true;
            d.renewalRequestedAt = new Date();
            ctx.params._requestedRenewal = true;
          }
          delete d.close; delete d.submitForApproval; delete d.requestRenewal;
        }

        // Admin actions
        if (user.role === 'admin') {
          // Pre-approval stage: PENDING_PRE_APPROVAL (4) → PRE_APPROVED (5)
          if ((d.approvePreApproval === true || d.approve === true) && current.status === STATUS.PENDING_PRE_APPROVAL) {
            d.status = STATUS.PRE_APPROVED;
            d.preApprovedAt = new Date();
          }

          // Pre-approval rejected: PENDING_PRE_APPROVAL (4) → DRAFT (0)
          if ((d.rejectPreApproval === true || d.reject === true) && current.status === STATUS.PENDING_PRE_APPROVAL) {
            d.status = STATUS.DRAFT;
            if (d.rejectionReason) {
              d.preApprovalRejectionReason = d.rejectionReason;
            }
          }

          // Final approval: PENDING (1) → ACTIVE (2)
          if (d.approve === true && current.status === STATUS.PENDING) {
            d.status = STATUS.ACTIVE;
            d.approvedAt = new Date();
            if (!current.publishAt) d.publishAt = new Date();
            const pub = d.publishAt || current.publishAt || new Date();
            d.expiresAt = computeExpiry(pub);
          }

          // Final rejection: PENDING (1) → DRAFT (0)
          if (d.reject === true && current.status === STATUS.PENDING) {
            d.status = STATUS.DRAFT;
            if (d.rejectionReason) d.rejectionReason = d.rejectionReason;
          }

          // Approve renewal if requested
          if (d.approveRenewal === true && current.renewal === true && current.status === STATUS.ACTIVE) {
            const base = current.expiresAt && new Date(current.expiresAt) > new Date() ? new Date(current.expiresAt) : new Date();
            const newExp = new Date(base.getTime());
            newExp.setDate(newExp.getDate() + 30);
            d.expiresAt = newExp;
            d.renewal = false;
            ctx.params._approvedRenewal = true;
          }
          delete d.approve; delete d.reject; delete d.approveRenewal; delete d.approvePreApproval; delete d.rejectPreApproval;
        }

        ctx.data = d;
      }
    ],
    remove: [ authenticate('jwt'), onlyRoles('admin') ]
  },
  after: {
    all: [
      // Populate company information and handle industry filtering
      async (ctx) => {
        const populateCompany = async (job) => {
          if (job && job.companyId) {
            try {
              const company = await app.service('companies').get(job.companyId);
              return {
                ...job,
                company: {
                  _id: company._id,
                  name: company.name,
                  industry: company.industry,
                  logo: company.logo,
                  logoUrl: company.logoUrl,
                  logoKey: company.logoKey
                }
              };
            } catch (err) {
              return job; // Return original job if company not found
            }
          }
          return job;
        };

        // Handle filtering after company population
        const industryFilter = ctx.params.industryFilter;
        const keywordFilter = ctx.params.keywordFilter;
        let jobs = Array.isArray(ctx.result) ? ctx.result : (ctx.result.data || [ctx.result]);

        // Populate companies for all jobs
        jobs = await Promise.all(jobs.map(populateCompany));

        // Filter by industry if specified (case-insensitive)
        if (industryFilter && industryFilter.length > 0) {
          console.log('🔍 Job Backend: Applying industry filter after population:', { industryFilter });
          const beforeCount = jobs.length;
          // Convert filter to lowercase for case-insensitive matching
          const lowerIndustryFilter = industryFilter.map(ind => ind.toLowerCase());
          jobs = jobs.filter(job =>
            job.company && job.company.industry &&
            lowerIndustryFilter.includes(job.company.industry.toLowerCase())
          );
          console.log('🔍 Job Backend: Industry filter results:', { beforeCount, afterCount: jobs.length });
        }

        // Filter by keyword across title, description, and company name
        if (keywordFilter) {
          console.log('🔍 Job Backend: Applying comprehensive keyword filter after population:', { keywordFilter });
          const beforeCount = jobs.length;
          const keyword = keywordFilter.toLowerCase();

          jobs = jobs.filter(job => {
            // Search in job title
            if (job.title && job.title.toLowerCase().includes(keyword)) return true;

            // Search in job description
            if (job.description && job.description.toLowerCase().includes(keyword)) return true;

            // Search in company name
            if (job.company && job.company.name && job.company.name.toLowerCase().includes(keyword)) return true;

            return false;
          });

          console.log('🔍 Job Backend: Comprehensive keyword filter results:', { beforeCount, afterCount: jobs.length });
        }

        // Update the result with filtered and populated jobs
        if (Array.isArray(ctx.result?.data)) {
          // Handle paginated results
          ctx.result.data = jobs;
          ctx.result.total = jobs.length; // Update total count after filtering
        } else if (Array.isArray(ctx.result)) {
          // Handle non-paginated array results
          ctx.result = jobs;
        } else if (ctx.result && jobs.length > 0) {
          // Handle single result
          ctx.result = jobs[0];
        }
      }
    ],
    create: [ async (ctx) => {
      // Notify admins when a listing is submitted for pre-approval or final approval
      try {
        if (ctx.result.status === STATUS.PENDING_PRE_APPROVAL) {
          const admins = await app.service('users').find({ paginate: false, query: { role: 'admin' } });
          await Promise.all((admins || []).map(a => app.service('notifications').create({
            recipientUserId: a._id,
            recipientRole: 'admin',
            type: 'job_pre_approval_submitted',
            title: 'New job listing submitted for pre-approval',
            body: `${ctx.result.title}`
          })));
        } else if (ctx.result.status === STATUS.PENDING) {
          const admins = await app.service('users').find({ paginate: false, query: { role: 'admin' } });
          await Promise.all((admins || []).map(a => app.service('notifications').create({
            recipientUserId: a._id,
            recipientRole: 'admin',
            type: 'job_submitted',
            title: 'Job listing submitted for final approval',
            body: `${ctx.result.title}`
          })));
        }
      } catch (_) {}
    } ],
    patch: [ async (ctx) => {
      // Transition-based notifications
      const prev = ctx.params._before || {};
      const next = ctx.result;
      const notifyCompany = async (title, body, type = 'job_update') => {
        try {
          const company = await app.service('companies').get(next.companyId);
          if (!company) return;
          await app.service('notifications').create({
            recipientUserId: company.ownerUserId,
            recipientRole: 'company',
            type,
            title, body
          });
        } catch (_) {}
      };
      // Pre-approval granted (PENDING_PRE_APPROVAL → PRE_APPROVED)
      if (prev.status === STATUS.PENDING_PRE_APPROVAL && next.status === STATUS.PRE_APPROVED) {
        await notifyCompany('Job pre-approved', 'Your job listing has been pre-approved. You can now submit it for final approval.');
      }

      // Pre-approval rejected (PENDING_PRE_APPROVAL → DRAFT)
      if (prev.status === STATUS.PENDING_PRE_APPROVAL && next.status === STATUS.DRAFT) {
        await notifyCompany('Job pre-approval rejected', 'Your job listing pre-approval was rejected. Please review and resubmit.');
      }

      // Final approval granted (PENDING → ACTIVE)
      if (prev.status === STATUS.PENDING && next.status === STATUS.ACTIVE) {
        await notifyCompany('Job approved', 'Your job listing has been approved and is now active.');
      }

      // Final approval rejected (PENDING → PRE_APPROVED)
      if (prev.status === STATUS.PENDING && next.status === STATUS.PRE_APPROVED) {
        await notifyCompany('Job final approval rejected', 'Your job listing final approval was rejected. Please review and resubmit.');
      }

      // PIC updated while pending: notify admins
      if (ctx.params._picUpdatedDuringPending) {
        try {
          const admins = await app.service('users').find({ paginate: false, query: { role: 'admin' } });
          await Promise.all((admins || []).map(a => app.service('notifications').create({
            recipientUserId: a._id,
            recipientRole: 'admin',
            type: 'job_pic_updated',
            title: 'Pending job PIC updated',
            body: `${next.title}`
          })));
        } catch (_) {}
      }
      if (prev.status === STATUS.ACTIVE && next.status === STATUS.CLOSED) {
        await notifyCompany('Job closed', 'Your job listing has been closed.');
      }
      // Renewal events
      if (ctx.params._requestedRenewal) {
        try {
          const admins = await app.service('users').find({ paginate: false, query: { role: 'admin' } });
          await Promise.all((admins || []).map(a => app.service('notifications').create({
            recipientUserId: a._id,
            recipientRole: 'admin',
            type: 'job_renewal_requested',
            title: 'Job renewal requested',
            body: `${next.title}`
          })));
        } catch (_) {}
      }
      if (ctx.params._approvedRenewal) {
        await notifyCompany('Job renewal approved', 'Your job listing expiry has been extended by 30 days.', 'job_renewal_approved');
      }
    } ]
  },
  error: { }
});

