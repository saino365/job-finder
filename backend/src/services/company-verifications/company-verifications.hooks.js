import { hooks as authHooks } from '@feathersjs/authentication';
import { VERIFICATION_STATUS } from '../../constants/enums.js';

const { authenticate } = authHooks;

export default (app) => ({
  before: {
    all: [ authenticate('jwt') ],
    find: [ async (ctx) => {
      if (ctx.params.user.role !== 'admin') {
        // company owner can only see their own submissions
        ctx.params.query = ctx.params.query || {};
        ctx.params.query.submittedBy = ctx.params.user._id;
      }
    } ],
    get: [ async (ctx) => {
      if (ctx.params.user.role === 'admin') return;
      const doc = await app.service('company-verifications').get(ctx.id, { paginate: false });
      if (doc.submittedBy.toString() !== ctx.params.user._id.toString()) {
        throw new Error('Not authorized');
      }
    } ],
    create: [ async (ctx) => {
      // Only company owners can create
      if (ctx.params.user.role !== 'company') throw new Error('Only company users can submit KYC');
      ctx.data.submittedBy = ctx.params.user._id;
      ctx.data.status = VERIFICATION_STATUS.PENDING;
      ctx.data.submittedAt = new Date();
    } ],
    patch: [ async (ctx) => {
      // Admin-only approve/reject
      if (!ctx.params.user) {
        console.error('PATCH company-verifications: No user in context', { 
          hasParams: !!ctx.params, 
          hasAuthentication: !!ctx.params.authentication,
          headers: ctx.params.headers 
        });
        throw new Error('Authentication required - user not found in context');
      }
      if (ctx.params.user.role !== 'admin') {
        console.error('PATCH company-verifications: Non-admin user attempted action', { 
          userId: ctx.params.user._id, 
          role: ctx.params.user.role 
        });
        throw new Error('Admin access required');
      }
      const { action, rejectionReason } = ctx.data;
      if (!['approve','reject'].includes(action)) throw new Error('Invalid action');
      
      // Pass authentication context for internal service call
      const current = await app.service('company-verifications').get(ctx.id, {
        provider: undefined,
        user: ctx.params.user
      });
      
      ctx.data = { 
        status: action === 'approve' ? VERIFICATION_STATUS.APPROVED : VERIFICATION_STATUS.REJECTED,
        rejectionReason: action === 'reject' ? (rejectionReason || '') : undefined,
        reviewedAt: new Date(), 
        reviewerId: ctx.params.user._id 
      };
      
      // Also patch company - pass authentication context
      await app.service('companies').patch(current.companyId, {
        verifiedStatus: action === 'approve' ? VERIFICATION_STATUS.APPROVED : VERIFICATION_STATUS.REJECTED,
        rejectionReason: action === 'reject' ? (rejectionReason || '') : undefined,
        reviewedAt: new Date(), 
        reviewerId: ctx.params.user._id
      }, {
        provider: undefined,
        user: ctx.params.user
      });
    } ],
    remove: []
  },
  after: {
    all: [], find: [], get: [],
    create: [ async (ctx) => {
      // Receipt to submitter
      await app.service('notifications').create({
        recipientUserId: ctx.params.user._id,
        recipientRole: 'company',
        type: 'kyc_submitted',
        title: 'KYC submitted',
        body: 'Your company verification has been submitted.'
      }).catch(()=>{});

      // Notify all admins
      try {
        const admins = await app.service('users').find({ paginate: false, query: { role: 'admin' } });
        await Promise.all((admins || []).map(a => app.service('notifications').create({
          recipientUserId: a._id,
          recipientRole: 'admin',
          type: 'kyc_review_required',
          title: 'KYC review required',
          body: 'A new company verification was submitted and awaits review.',
          data: { verificationId: ctx.result?._id, companyId: ctx.result?.companyId }
        }).catch(()=>{})));
      } catch (_) {}
    } ],
    patch: [ async (ctx) => {
      // notify owner based on updated status
      const current = await app.service('company-verifications').get(ctx.id, {
        provider: undefined,
        user: ctx.params.user
      });
      const approved = ctx.result.status === VERIFICATION_STATUS.APPROVED;
      const type = approved ? 'kyc_approved' : 'kyc_rejected';
      await app.service('notifications').create({
        recipientUserId: current.submittedBy,
        recipientRole: 'company',
        type,
        title: approved ? 'KYC approved' : 'KYC rejected',
        body: approved ? 'Your company is verified.' : (ctx.result.rejectionReason || 'Your verification was rejected.')
      }).catch(()=>{});
    } ],
    update: [], remove: []
  },
  error: { all: [], find: [], get: [], create: [], update: [], patch: [], remove: [] }
});

