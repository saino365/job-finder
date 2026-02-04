import { hooks as authHooks } from '@feathersjs/authentication';
import { BadRequest } from '@feathersjs/errors';
import mongoose from 'mongoose';
import { ApplicationStatus as S, EmploymentStatus as ES } from '../../constants/enums.js';
import { storageUtils } from '../../utils/storage.js';

const { authenticate } = authHooks;

function asObjectId(id) { try { return new mongoose.Types.ObjectId(id); } catch { return null; } }

export default (app) => {
  const JobModel = app.service('job-listings')?.Model;
  const Applications = app.service('applications')?.Model;

  async function notify(recipientUserId, recipientRole, type, title, body, data) {
    try {
      await app.service('notifications').create({ recipientUserId, recipientRole, type, title, body, data });
    } catch (_) {}
  }

  // Helper: Generate nicer PDF for an application and upload to object storage
  async function generateAndUploadPdf(a) {
    try {
      const PDFDocument = (await import('pdfkit')).default;
      const job = await app.service('job-listings')?.Model.findById(a.jobListingId).lean();
      const company = await app.service('companies')?.Model.findById(a.companyId).lean();
      const chunks = [];
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      doc.on('data', (c) => chunks.push(c));
      const done = new Promise((resolve) => doc.on('end', resolve));

      // Header
      doc.fontSize(20).text('Application Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#444').text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown();
      doc.fillColor('black');

      // Meta
      doc.fontSize(12).text(`Application ID: ${a._id}`);
      doc.text(`Applicant: ${a.userId}`);
      doc.text(`Company: ${company?.name || a.companyId}`);
      doc.text(`Job: ${job?.title || a.jobListingId}`);
      if (a.submittedAt) doc.text(`Submitted: ${new Date(a.submittedAt).toISOString()}`);

      // Sections
      if (a.candidateStatement) {
        doc.moveDown().fontSize(14).text('Candidate Statement', { underline: true });
        doc.fontSize(12).text(a.candidateStatement);
      }
      if (a.form && Object.keys(a.form).length) {
        doc.moveDown().fontSize(14).text('Form Data', { underline: true });
        doc.fontSize(12);
        Object.entries(a.form).forEach(([k, v]) => {
          const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
          doc.text(`- ${k}: ${val}`);
        });
      }

      doc.end();
      await done;
      const buffer = Buffer.concat(chunks);
      const key = await storageUtils.uploadFile(buffer, `application-${a._id}.pdf`, 'application/pdf', 'applications');
      return key;
    } catch (_) {
      return null;
    }
  }

  async function ensureAccessFind(ctx) {
    const user = ctx.params.user;
    if (!user) return ctx;
    const q = ctx.params.query || {};
    if (user.role === 'student') {
      ctx.params.query = { ...q, userId: user._id };
    } else if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company) { throw new Error('Company profile not found'); }
      // D166: Allow companies to see withdrawn applications (status 6)
      // Remove the filter that excludes withdrawn applications so companies can see all statuses
      ctx.params.query = { ...q, companyId: company._id };
    } // admin sees all
    return ctx;
  }

  async function ensureAccessGet(ctx) {
    const user = ctx.params.user;
    if (!user) return ctx;
    const doc = await Applications.findById(ctx.id).lean();
    if (!doc) return ctx;
    if (user.role === 'student' && String(doc.userId) !== String(user._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company || String(doc.companyId) !== String(company._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
      if (doc.status === S.WITHDRAWN) throw Object.assign(new Error('Not found'), { code: 404 });
    }
    return ctx;
  }

  // Auto-withdraw expired applications (company did not respond within validity)
  // Auto-reject expired offers (candidate did not accept within offer validity)
  async function expireIfNeeded(ctx) {
    try {
      const doc = await Applications.findById(ctx.id).lean();
      if (!doc) return ctx;
      const now = new Date();
      if (doc.status === S.NEW && doc.validityUntil && new Date(doc.validityUntil) <= now) {
        await Applications.updateOne(
          { _id: doc._id },
          { $set: { status: S.WITHDRAWN, withdrawnAt: now }, $push: { history: { at: now, actorRole: 'system', action: 'autoWithdraw', data: { reason: 'validityExpired' } } } }
        );
      }
      if (doc.status === S.PENDING_ACCEPTANCE && doc.offer?.validUntil && new Date(doc.offer.validUntil) <= now) {
        await Applications.updateOne(
          { _id: doc._id },
          { $set: { status: S.REJECTED, rejectedAt: now, rejection: { by: 'system', reason: 'offerExpired' } }, $push: { history: { at: now, actorRole: 'system', action: 'offerExpired', data: {} } } }
        );
        // Send email to student about expiration (best-effort)
        try {
          const { sendMail } = await import('../../utils/mailer.js');
          const Users = app.service('users')?.Model;
          const student = await Users.findById(doc.userId).lean();
          if (student?.email) {
            await sendMail({ to: student.email, subject: 'Offer expired', text: 'Your offer has expired and the application is now rejected.', html: '<p>Your offer has expired and the application is now <b>Rejected</b>.</p>' });
          }
        } catch (_) {}
      }
    } catch (_) {}
    return ctx;
  }

  // Sweep expiration for list endpoints
  async function expireInFind(ctx) {
    try {
      const user = ctx.params.user;
      if (!user) return ctx;
      const now = new Date();
      const scope = user.role === 'student' ? { userId: user._id } : (user.role === 'company' ? { companyId: (await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean())?._id } : {});
      if (!scope || (scope.companyId === undefined && scope.userId === undefined)) return ctx;
      // 1) Auto-withdraw expired NEW applications
      await Applications.updateMany(
        { status: S.NEW, validityUntil: { $lte: now }, ...scope },
        { $set: { status: S.WITHDRAWN, withdrawnAt: now }, $push: { history: { at: now, actorRole: 'system', action: 'autoWithdraw', data: { reason: 'validityExpired' } } } }
      );
      // 2) Auto-reject expired offers
      await Applications.updateMany(
        { status: S.PENDING_ACCEPTANCE, 'offer.validUntil': { $lte: now }, ...scope },
        { $set: { status: S.REJECTED, rejectedAt: now, rejection: { by: 'system', reason: 'offerExpired' } }, $push: { history: { at: now, actorRole: 'system', action: 'offerExpired', data: {} } } }
      );
    } catch (_) {}
    return ctx;
  }

  async function onCreate(ctx) {
    const user = ctx.params.user;
    if (user.role !== 'student') throw Object.assign(new Error('Only students can apply'), { code: 403 });

    // D118: Check if email is verified before allowing application
    if (!user.isEmailVerified) {
      throw Object.assign(new Error('Please verify your email address before applying for jobs'), { code: 403 });
    }

    const jobId = asObjectId(ctx.data.jobListingId);
    const job = await JobModel.findById(jobId).lean();
    if (!job) throw Object.assign(new Error('Job not found'), { code: 404 });

    const ACTIVE_STATUSES = [S.NEW, S.SHORTLISTED, S.INTERVIEW_SCHEDULED, S.PENDING_ACCEPTANCE];
    const existingApp = await Applications.findOne({ userId: user._id, jobListingId: jobId });
    if (existingApp && ACTIVE_STATUSES.includes(existingApp.status)) {
      throw Object.assign(new Error('You have already applied for this position'), { code: 409 });
    }

    const now = new Date();
    const defaultValidityDays = Number(process.env.APPLICATION_VALIDITY_DAYS || 14);
    const validity = ctx.data.validityUntil ? new Date(ctx.data.validityUntil) : new Date(now.getTime() + defaultValidityDays * 86400000);

    console.log('Backend: Received candidateStatement:', ctx.data.candidateStatement);
    console.log('Backend: Full ctx.data:', JSON.stringify(ctx.data, null, 2));

    // Get full user data to access resume
    const UserModel = app.service('users').Model;
    const fullUser = await UserModel.findById(user._id).lean();

    // Automatically attach user's resume if available
    const attachments = ctx.data.attachments || [];
    if (fullUser?.internProfile?.resume && !attachments.includes(fullUser.internProfile.resume)) {
      try {
        const resumeUrl = fullUser.internProfile.resume;
        const urlObj = new URL(resumeUrl);
        const pathParts = urlObj.pathname.split('/');
        const keyParts = pathParts.filter(Boolean).slice(1);
        const resumeKey = keyParts.join('/');
        if (resumeKey) {
          attachments.push(resumeKey);
          console.log('Backend: Automatically attached resume:', resumeKey);
        }
      } catch (e) {
        console.log('Backend: Failed to extract resume key:', e.message);
      }
    }

    ctx.data = {
      userId: user._id,
      companyId: job.companyId,
      jobListingId: job._id,
      candidateStatement: ctx.data.candidateStatement || '',
      form: ctx.data.form || {},
      attachments,
      pdfKey: ctx.data.pdfKey,
      status: S.NEW,
      validityUntil: validity,
      submittedAt: now,
      history: [{ at: now, actorUserId: user._id, actorRole: 'student', action: 'apply', data: {} }]
    };

    console.log('📝 Backend: Prepared ctx.data for save:', JSON.stringify(ctx.data, null, 2));
  }

  async function applyTransition(ctx) {
    // patch with { action, ...payload }
    const user = ctx.params.user;
    const doc = await Applications.findById(ctx.id);
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });

    // Access check (same as get)
    if (user.role === 'student' && String(doc.userId) !== String(user._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    if (user.role === 'company') {
      const company = await app.service('companies').Model.findOne({ ownerUserId: user._id }).lean();
      if (!company || String(doc.companyId) !== String(company._id)) throw Object.assign(new Error('Forbidden'), { code: 403 });
    }

    const action = String(ctx.data.action || '').trim();
    if (!action) return ctx; // normal patch (if any allowed fields later)

    const now = new Date();
    const historyEntry = { at: now, actorUserId: user._id, actorRole: user.role, action, data: { ...ctx.data } };

    function set(data) {
      ctx.data = {
        ...(data || {}),
        $push: { history: historyEntry }
      };
    }

    // Generic: regenerate application PDF (both roles allowed with access)
    if (action === 'regeneratePdf') {
      set({});
      ctx.params._regenPdf = true;
      return;
    }

    // Company-driven
    if (user.role === 'company') {
      if (action === 'shortlist' && doc.status === S.NEW) {
        set({ status: S.SHORTLISTED });
        ctx.params._notify = { type: 'application_shortlisted', toUserId: doc.userId, toRole: 'student' };
        ctx.params._email = { kind: 'status_email', to: 'student', template: 'shortlisted' };
        return;
      }
      if ((action === 'scheduleInterview' || action === 'rescheduleInterview') && (doc.status === S.SHORTLISTED || doc.status === S.INTERVIEW_SCHEDULED)) {
        const when = ctx.data.scheduledAt ? new Date(ctx.data.scheduledAt) : null;
        set({ status: S.INTERVIEW_SCHEDULED, interview: { scheduledAt: when, location: ctx.data.location, locations: ctx.data.locations, mode: ctx.data.mode, notes: ctx.data.notes, updatedAt: now } });
        ctx.params._notify = { type: 'interview_scheduled', toUserId: doc.userId, toRole: 'student' };
        return;
      }
      if (action === 'cancelInterview' && doc.status === S.INTERVIEW_SCHEDULED) {
        set({ status: S.SHORTLISTED, interview: { ...doc.interview?.toObject?.() || {}, scheduledAt: null, updatedAt: now } });
        ctx.params._notify = { type: 'interview_cancelled', toUserId: doc.userId, toRole: 'student' };
        return;
      }
      if (action === 'sendOffer' && (doc.status === S.INTERVIEW_SCHEDULED || doc.status === S.SHORTLISTED)) {
        const defaultOfferDays = Number(process.env.OFFER_VALIDITY_DAYS || 7);
        const validUntil = ctx.data.validUntil ? new Date(ctx.data.validUntil) : new Date(now.getTime() + defaultOfferDays * 86400000);
        set({ status: S.PENDING_ACCEPTANCE, offer: { sentAt: now, validUntil, title: ctx.data.title, notes: ctx.data.notes, letterKey: ctx.data.letterKey } });
        ctx.params._notify = { type: 'offer_sent', toUserId: doc.userId, toRole: 'student' };
        ctx.params._email = { kind: 'status_email', to: 'student', template: 'offer' };
        return;
      }
      if (action === 'reject' && [S.NEW, S.SHORTLISTED, S.INTERVIEW_SCHEDULED, S.PENDING_ACCEPTANCE].includes(doc.status)) {
        const reason = String(ctx.data.reason || '').trim();
        if (!reason) { throw new BadRequest('Rejection reason is required'); }
        set({ status: S.REJECTED, rejectedAt: now, rejection: { by: 'company', reason } });
        ctx.params._notify = { type: 'application_rejected', toUserId: doc.userId, toRole: 'student' };
        ctx.params._email = { kind: 'status_email', to: 'student', template: 'rejected' };
        return;
      }
      if (action === 'markNoShow' && doc.status === S.INTERVIEW_SCHEDULED) {
        set({ status: S.NOT_ATTENDING });
        ctx.params._notify = { type: 'interview_noshow', toUserId: doc.userId, toRole: 'student' };
        return;
      }
      // D126: Add declineOffer action for company to decline offers pending acceptance
      if (action === 'declineOffer' && doc.status === S.PENDING_ACCEPTANCE) {
        const reason = String(ctx.data.reason || 'Offer declined by company').trim();
        set({ status: S.REJECTED, rejectedAt: now, rejection: { by: 'company', reason } });
        ctx.params._notify = { type: 'offer_declined_by_company', toUserId: doc.userId, toRole: 'student' };
        ctx.params._email = { kind: 'status_email', to: 'student', template: 'rejected' };
        return;
      }
      throw Object.assign(new Error('Invalid action for current state'), { code: 400 });
    }

    // Student-driven
    if (user.role === 'student') {
      if (action === 'withdraw' && [S.NEW, S.SHORTLISTED, S.INTERVIEW_SCHEDULED, S.PENDING_ACCEPTANCE, S.ACCEPTED].includes(doc.status)) {
        // For ACCEPTED (hired) applications, check employment status
        if (doc.status === S.ACCEPTED) {
          const Employment = app.service('employment-records')?.Model;
          const employment = await Employment.findOne({ applicationId: doc._id }).lean();
          if (employment) {
            // Don't allow withdraw if employment is in CLOSURE (2), COMPLETED (3), or TERMINATED (4)
            if (employment.status >= ES.CLOSURE) {
              const statusLabels = { 0: 'Upcoming', 1: 'Ongoing', 2: 'Closure', 3: 'Completed', 4: 'Terminated' };
              const empStatus = statusLabels[employment.status] || 'Unknown';
              throw Object.assign(new Error(`Cannot withdraw application. Employment status is ${empStatus}. Withdrawals are not allowed once employment reaches closure phase.`), { code: 400 });
            }
          }
        }

        const reason = String(ctx.data.reason || '').trim();
        const data = { status: S.WITHDRAWN, withdrawnAt: now };
        if (reason) data.withdrawReason = reason;
        set(data);
        ctx.params._notify = { type: 'application_withdrawn', toUserId: doc.companyId, toRole: 'company' };
        ctx.params._email = { kind: 'withdraw', prevStatus: doc.status };
        return;
      }
      if (action === 'extendValidity' && doc.status === S.NEW) {
        const days = Math.max(1, Math.min(30, Number(ctx.data.days || 7)));
        if (doc.extendedOnce) throw new BadRequest('Validity already extended once');
        const until = new Date((doc.validityUntil ? new Date(doc.validityUntil).getTime() : Date.now()) + days * 86400000);
        set({ validityUntil: until, extendedOnce: true });
        return;
      }
      if (action === 'declineInterview' && doc.status === S.INTERVIEW_SCHEDULED) {
        set({ status: S.SHORTLISTED, interview: { ...(doc.interview?.toObject?.() || {}), outcome: 'declined', updatedAt: now } });
        ctx.params._notify = { type: 'interview_declined', toUserId: doc.companyId, toRole: 'company' };
        return;
      }
      if (action === 'acceptOffer' && doc.status === S.PENDING_ACCEPTANCE) {
        set({ status: S.ACCEPTED, acceptedAt: now });
        ctx.params._notify = { type: 'offer_accepted', toUserId: doc.companyId, toRole: 'company' };
        ctx.params._email = { kind: 'status_email', to: 'student', template: 'hired' };
        // Create EmploymentRecord
        try {
          const Employment = app.service('employment-records')?.Model;
          const job = await JobModel.findById(doc.jobListingId).lean();
          const startDate = job?.project?.startDate ? new Date(job.project.startDate) : undefined;
          const endDate = job?.project?.endDate ? new Date(job.project.endDate) : undefined;
          const requiredDocs = ['contract','nda'];
          if (Employment) {
            const nowTs = now.getTime();
            const startTs = startDate ? startDate.getTime() : null;
            const employmentStatus = (startTs && startTs <= nowTs) ? ES.ONGOING : ES.UPCOMING;
            await Employment.create({
              userId: doc.userId,
              companyId: doc.companyId,
              jobListingId: doc.jobListingId,
              applicationId: doc._id,
              status: employmentStatus,
              startDate,
              endDate,
              cadence: 'weekly',
              requiredDocs
            });
          }
        } catch (_) {}
        return;
      }
      if (action === 'declineOffer' && doc.status === S.PENDING_ACCEPTANCE) {
        set({ status: S.REJECTED, rejectedAt: now, rejection: { by: 'applicant', reason: String(ctx.data.reason || 'Offer declined by applicant') } });
        ctx.params._notify = { type: 'offer_declined', toUserId: doc.companyId, toRole: 'company' };
        return;
      }
      throw Object.assign(new Error('Invalid action for current state'), { code: 400 });
    }

    // Admin/system can be handled later
    return ctx;
  }

  async function afterNotify(ctx) {
    const n = ctx.params._notify;
    if (!n) return ctx;
    // Determine recipient userId for company case (owner)
    let recipientUserId = n.toUserId;
    if (n.toRole === 'company') {
      try {
        const company = await app.service('companies').Model.findById(n.toUserId).lean();
        if (company?.ownerUserId) recipientUserId = company.ownerUserId;
      } catch (_) {}
    }
    await notify(recipientUserId, n.toRole, n.type, 'Application update', '', { applicationId: ctx.id || ctx.result?._id });
    return ctx;
  }

  // Send transactional emails when required
  async function afterEmails(ctx) {
    const mail = ctx.params._email;
    if (!mail) return ctx;
    try {
      const { sendMail } = await import('../../utils/mailer.js');
      const appDoc = await Applications.findById(ctx.id).lean();
      if (!appDoc) return ctx;
      const Users = app.service('users')?.Model;
      const Companies = app.service('companies')?.Model;

      if (mail.kind === 'withdraw') {
        // Only email company when previous status was shortlisted or pending acceptance
        if ([S.SHORTLISTED, S.PENDING_ACCEPTANCE].includes(mail.prevStatus)) {
          const company = await Companies.findById(appDoc.companyId).lean();
          const owner = company?.ownerUserId ? await Users.findById(company.ownerUserId).lean() : null;
          if (owner?.email) {
            await sendMail({ to: owner.email, subject: 'Application withdrawn', text: 'The candidate has withdrawn their application.', html: '<p>The candidate has withdrawn their application.</p>' });
          }
        }
        return ctx;
      }

      if (mail.kind === 'status_email') {
        // email student on specific transitions
        const student = await Users.findById(appDoc.userId).lean();
        if (!student?.email) return ctx;
        if (mail.template === 'shortlisted') {
          await sendMail({ to: student.email, subject: 'You have been shortlisted', text: 'Your application status changed to Shortlisted.', html: '<p>Your application status changed to <b>Shortlisted</b>.</p>' });
        } else if (mail.template === 'offer') {
          await sendMail({ to: student.email, subject: 'Offer received', text: 'Your application status changed to Pending Acceptance (offer sent).', html: '<p>Your application status changed to <b>Pending Acceptance</b>.</p>' });
        } else if (mail.template === 'hired') {
          await sendMail({ to: student.email, subject: 'Hired', text: 'Congratulations! Your application has been marked as Hired.', html: '<p>Congratulations! Your application has been marked as <b>Hired</b>.</p>' });
        } else if (mail.template === 'rejected') {
          await sendMail({ to: student.email, subject: 'Application rejected', text: 'Your application status changed to Rejected.', html: '<p>Your application status changed to <b>Rejected</b>.</p>' });
        }
        return ctx;
      }
    } catch (_) {}
    return ctx;
  }

  // Populate company name for applications
  async function populateCompany(ctx) {
    try {
      const Companies = app.service('companies')?.Model;
      if (!Companies) return ctx;

      const populateOne = async (appDoc) => {
        if (!appDoc || !appDoc.companyId) return appDoc;

        // Convert to plain object if it's a Mongoose document
        const app = appDoc.toObject ? appDoc.toObject() : { ...appDoc };

        try {
          const company = await Companies.findById(app.companyId).lean();
          if (company && company.name) {
            app.company = { _id: company._id, name: company.name };
            app.companyName = company.name; // Also set companyName for backward compatibility
          }
        } catch (e) {
          // Company not found or error - return app without company data
        }
        return app;
      };

      // Handle both single result (get) and array result (find)
      if (Array.isArray(ctx.result)) {
        ctx.result = await Promise.all(ctx.result.map(populateOne));
      } else if (ctx.result?.data && Array.isArray(ctx.result.data)) {
        // Paginated result
        ctx.result.data = await Promise.all(ctx.result.data.map(populateOne));
      } else if (ctx.result) {
        // Single result
        ctx.result = await populateOne(ctx.result);
      }
    } catch (e) {
      // Silent fail - don't break the request if population fails
    }
    return ctx;
  }

  return {
    before: {
      all: [ authenticate('jwt') ],
      find: [ ensureAccessFind, expireInFind ],
      get: [ ensureAccessGet, expireIfNeeded ],
      create: [ onCreate ],
      patch: [ applyTransition ]
    },
    after: {
      all: [ populateCompany ],
      create: [ async (ctx) => {
        // 1) Generate and upload nicer PDF
        try {
          if (process.env.GENERATE_PDF !== 'false') {
            const key = await generateAndUploadPdf(ctx.result);
            if (key) {
              ctx.result.pdfKey = key;
              try { await app.service('applications').patch(ctx.result._id, { pdfKey: key }); } catch (_) {}
            }
          }
        } catch (_) {}

        // 2) notify company owner of new application (include pdf link if present)
        try {
          const company = await app.service('companies').Model.findById(ctx.result.companyId).lean();
          if (company?.ownerUserId) {
            const data = { applicationId: ctx.result._id };
            if (ctx.result.pdfKey) {
              try { data.pdfUrl = await storageUtils.getSignedUrl(ctx.result.pdfKey, 3600); } catch (_) {}
            }
            await notify(company.ownerUserId, 'company', 'application_created', 'New application', '', data);
          }
        } catch (_) {}
      } ],
      patch: [ async (ctx) => {
        if (!ctx.params._regenPdf) {
          // derive which email to send from action + resulting status
          try {
            const a = await Applications.findById(ctx.id).lean();
            const action = ctx.params?.data?.action || '';
            if (action === 'shortlist') ctx.params._email = { kind: 'status_email', to: 'student', template: 'shortlisted' };
            if (action === 'sendOffer') ctx.params._email = { kind: 'status_email', to: 'student', template: 'offer' };
            if (action === 'reject') ctx.params._email = { kind: 'status_email', to: 'student', template: 'rejected' };
          } catch (_) {}
        }
        return ctx;
      }, afterEmails, async (ctx) => {
        if (!ctx.params._regenPdf) return ctx;
        try {
          const a = await Applications.findById(ctx.id).lean();
          if (a) {
            const key = await generateAndUploadPdf(a);
            if (key) {
              try { await app.service('applications').patch(ctx.id, { pdfKey: key }); } catch (_) {}
              try {
                const company = await app.service('companies').Model.findById(a.companyId).lean();
                if (company?.ownerUserId) {
                  const data = { applicationId: a._id };
                  try { data.pdfUrl = await storageUtils.getSignedUrl(key, 3600); } catch (_) {}
                  await notify(company.ownerUserId, 'company', 'application_pdf_regenerated', 'Application PDF regenerated', '', data);
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
        return ctx;
      } ]
    },
    error: { }
  };
};

