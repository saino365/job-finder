import { hooks as authHooks } from '@feathersjs/authentication';
import mongoose from 'mongoose';
import Companies from '../../models/companies.model.js';
import { isCompanyVerified } from '../../utils/access.js';
import { INVITE_STATUS } from '../../constants/enums.js';

const { authenticate } = authHooks;

export default (app) => ({
  before: {
    all: [ authenticate('jwt') ],
    find: [ async (ctx) => {
      // Company sees its invites; user sees invites addressed to them; admin sees all
      if (ctx.params.user.role === 'admin') return;
      ctx.params.query = ctx.params.query || {};
      if (ctx.params.user.role === 'company') {
        const company = await Companies.findOne({ ownerUserId: ctx.params.user._id });
        if (!company) throw new Error('Company profile not found');
        ctx.params.query.companyId = company._id;
      } else {
        ctx.params.query.userId = ctx.params.user._id;
      }
    } ],
    get: [ authenticate('jwt') ],
    create: [ async (ctx) => {
      if (ctx.params.user.role !== 'company') throw new Error('Only verified companies can create invites');
      const { ok, company } = await isCompanyVerified(app, ctx.params.user._id);
      if (!ok) throw new Error('Company not verified');

      const normalize = (item) => ({
        type: item.type || 'profile_access',
        userId: item.userId,
        jobListingId: item.jobListingId || null, // Include job listing ID
        message: item.message,
        companyId: company._id,
        status: INVITE_STATUS.PENDING
      });

      const data = Array.isArray(ctx.data) ? ctx.data.map(normalize) : [ normalize(ctx.data) ];

      // De-duplicate: skip if there is an existing PENDING invite for same company-user-job combination
      // Also check if student already has an active application for the same job
      // Company can send multiple invites to same user for different jobs
      const InviteModel = app.service('invites')?.Model;
      const Applications = app.service('applications')?.Model;
      const filtered = [];
      const errors = [];
      
      for (const item of data) {
        if (!item.userId) continue;
        
        // Check for duplicate: same company, user, type, AND job (if specified)
        const query = { 
          companyId: item.companyId, 
          userId: item.userId, 
          type: item.type, 
          status: INVITE_STATUS.PENDING 
        };
        
        // If jobListingId is specified, include it in duplicate check
        if (item.jobListingId) {
          query.jobListingId = item.jobListingId;
        }
        
        const exists = await InviteModel.findOne(query).lean();
        if (exists) {
          errors.push(`Cannot invite this student. A pending invitation already exists for this position.`);
          continue;
        }
        
        // Check if student already has an active application for this job
        // Active statuses: SHORTLISTED (1), INTERVIEW_SCHEDULED (2), PENDING_ACCEPTANCE (3), ACCEPTED_PENDING_REVIEW (8), HIRED (4)
        if (item.jobListingId && Applications) {
          const ACTIVE_STATUSES = [1, 2, 3, 8, 4]; // SHORTLISTED through HIRED
          const existingApp = await Applications.findOne({
            userId: item.userId,
            companyId: item.companyId,
            jobListingId: item.jobListingId,
            status: { $in: ACTIVE_STATUSES }
          }).lean();
          
          if (existingApp) {
            const statusLabels = {
              1: 'Shortlisted',
              2: 'Interview Scheduled',
              3: 'Pending Acceptance',
              8: 'Accepted - Pending Review',
              4: 'Hired'
            };
            const currentStatus = statusLabels[existingApp.status] || 'Active';
            errors.push(`Cannot invite this student. They already have an active application for this position (Status: ${currentStatus}).`);
            continue;
          }
        }
        
        filtered.push(item);
      }
      
      // If there were errors and no valid invites, throw the first error
      if (errors.length > 0 && filtered.length === 0) {
        throw new Error(errors[0]);
      }

      ctx.data = Array.isArray(ctx.data) ? filtered : (filtered[0] || null);
      if (!ctx.data || (Array.isArray(ctx.data) && ctx.data.length === 0)) {
        // no-op creation: avoid error, return empty result
        ctx.result = [];
        return ctx;
      }
    } ],
    patch: [ async (ctx) => {
      const { status, reason } = ctx.data;
      let newStatus;
      if (typeof status === 'number') {
        if (![INVITE_STATUS.ACCEPTED, INVITE_STATUS.DECLINED].includes(status)) {
          throw new Error('Only accept/decline allowed');
        }
        newStatus = status;
      } else if (typeof status === 'string') {
        if (status === 'accepted') newStatus = INVITE_STATUS.ACCEPTED;
        else if (status === 'declined') newStatus = INVITE_STATUS.DECLINED;
        else throw new Error('Only accept/decline allowed');
      } else {
        throw new Error('Invalid status');
      }
      const invite = await app.service('invites').get(ctx.id);
      // Only the target user can respond
      if (invite.userId.toString() !== ctx.params.user._id.toString()) throw new Error('Not authorized');
      
      const updateData = { status: newStatus, respondedAt: new Date() };
      // If declining and reason provided, store it
      if (newStatus === INVITE_STATUS.DECLINED && reason) {
        updateData.reason = reason;
      }
      ctx.data = updateData;
    } ],
    remove: []
  },
  after: {
    all: [],
    create: [ async (ctx) => {
      const make = async (inv) => app.service('notifications').create({
        recipientUserId: inv.userId,
        recipientRole: 'student',
        type: 'invite_sent',
        title: 'Invitation received',
        body: 'A company has invited you to connect.',
        data: { inviteId: inv._id }
      }).catch(()=>{});
      if (Array.isArray(ctx.result)) {
        await Promise.all(ctx.result.map(make));
      } else if (ctx.result) {
        await make(ctx.result);
      }
    } ],
    patch: [ async (ctx) => {
      const updated = ctx.result;
      const invite = await app.service('invites').get(updated._id);
      const type = updated.status === INVITE_STATUS.ACCEPTED ? 'invite_accepted' : 'invite_declined';
      const company = await Companies.findById(invite.companyId);
      
      // If invitation is accepted and type is profile_access, create a shortlisted application
      if (updated.status === INVITE_STATUS.ACCEPTED && invite.type === 'profile_access') {
        try {
          // Check if application already exists for THIS SPECIFIC INVITE
          const Applications = app.service('applications')?.Model;
          const existingApp = await Applications.findOne({
            inviteId: invite._id
          }).lean();

          if (!existingApp) {
            // Create a new application with Shortlisted status (status 1)
            // Each accepted invitation creates its own application record
            const applicationData = {
              userId: invite.userId,
              companyId: invite.companyId,
              status: 1, // Shortlisted
              source: 'invitation',
              inviteId: invite._id,
              submittedAt: new Date(),
              history: [{
                at: new Date(),
                action: 'shortlisted',
                notes: 'Student accepted company invitation'
              }]
            };
            
            // If invitation has a job listing, include it in the application
            if (invite.jobListingId) {
              applicationData.jobListingId = invite.jobListingId;
            }
            
            await Applications.create(applicationData);
            console.log(`✅ Created application from accepted invite ${invite._id}${invite.jobListingId ? ` for job ${invite.jobListingId}` : ''}`);
          } else {
            console.log(`ℹ️  Application already exists for this specific invite ${invite._id}`);
          }
        } catch (e) {
          console.error('❌ Failed to create application from accepted invite:', e);
          console.error(e);
        }
      }
      
      if (company) {
        await app.service('notifications').create({
          recipientUserId: company.ownerUserId,
          recipientRole: 'company',
          type,
          title: updated.status === INVITE_STATUS.ACCEPTED ? 'Invite accepted' : 'Invite declined',
          body: 'Your invite has been ' + (updated.status === INVITE_STATUS.ACCEPTED ? 'accepted' : 'declined') + '.',
          data: { inviteId: updated._id, userId: invite.userId }
        }).catch(()=>{});
      }
    } ],
    find: [], get: [], update: [], remove: []
  },
  error: { all: [], find: [], get: [], create: [], update: [], patch: [], remove: [] }
});

