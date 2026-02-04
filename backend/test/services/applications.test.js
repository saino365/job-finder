import request from 'supertest';
import app from '../../src/app.js';
import { ApplicationStatus as S } from '../../src/constants/enums.js';

describe('Applications service', () => {
  async function bootstrap() {
    const student = await request(app).post('/users').send({ email: 'stud@example.com', password: 'pass1234', role: 'student' }).expect(201);
    const sAuth = await request(app).post('/authentication').send({ strategy: 'local', email: 'stud@example.com', password: 'pass1234' }).expect(201);
    const studentToken = sAuth.body.accessToken;
    const studentId = student.body._id;

    const co = await request(app).post('/users').send({ email: 'owner@example.com', password: 'pass1234', role: 'company' }).expect(201);
    const cAuth = await request(app).post('/authentication').send({ strategy: 'local', email: 'owner@example.com', password: 'pass1234' }).expect(201);
    const companyOwnerToken = cAuth.body.accessToken;
    const companyUserId = co.body._id;

    const Companies = app.service('companies').Model;
    const company = await Companies.create({ ownerUserId: co.body._id, name: 'Globex' });
    const companyId = company._id.toString();

    const JobModel = app.service('job-listings').Model;
    const job = await JobModel.create({ companyId, title: 'Frontend Intern', status: 2 });
    const jobId = job._id.toString();

    return { studentToken, studentId, companyOwnerToken, companyUserId, companyId, jobId };
  }

  test('student can create application; company can shortlist and send offer; student accepts', async () => {
    const { studentToken, companyOwnerToken, jobId } = await bootstrap();
    const sAuthz = { Authorization: `Bearer ${studentToken}` };
    const cAuthz = { Authorization: `Bearer ${companyOwnerToken}` };

    const created = await request(app).post('/applications').set(sAuthz).send({ jobListingId: jobId, candidateStatement: 'I am interested.' }).expect(201);
    expect(created.body.status).toBe(S.NEW);
    const applicationId = created.body._id;

    const shortlisted = await request(app).patch(`/applications/${applicationId}`).set(cAuthz).send({ action: 'shortlist' }).expect(200);
    expect(shortlisted.body.status).toBe(S.SHORTLISTED);

    const offered = await request(app).patch(`/applications/${applicationId}`).set(cAuthz).send({ action: 'sendOffer', title: 'Intern Offer' }).expect(200);
    expect(offered.body.status).toBe(S.PENDING_ACCEPTANCE);

    const accepted = await request(app).patch(`/applications/${applicationId}`).set(sAuthz).send({ action: 'acceptOffer' }).expect(200);
    expect(accepted.body.status).toBe(S.ACCEPTED);
  });

  test('company reject requires reason; sets rejection fields when provided', async () => {
    const { companyOwnerToken, companyId, jobId, studentId } = await bootstrap();
    // Create directly via Model to focus this test on patch validation logic
    const AppModel = app.service('applications').Model;
    const createdDoc = await AppModel.create({ userId: studentId, companyId, jobListingId: jobId, status: S.NEW, candidateStatement: 'Second app', submittedAt: new Date(), validityUntil: new Date(Date.now() + 86400000) });
    const id = createdDoc._id.toString();

    const cAuthz = { Authorization: `Bearer ${companyOwnerToken}` };
    // Try reject without reason
    await request(app).patch(`/applications/${id}`).set(cAuthz).send({ action: 'reject' }).expect(400);

    // Reject with reason
    const rejResp = await request(app).patch(`/applications/${id}`).set(cAuthz).send({ action: 'reject', reason: 'Not a fit' }).expect(200);
    expect(rejResp.body.status).toBe(S.REJECTED);
    expect(rejResp.body.rejection?.by).toBe('company');
    expect(rejResp.body.rejection?.reason).toBe('Not a fit');
  });

  test('sendOffer stores letterKey; offer expiry auto-rejects to applicant', async () => {
    const { companyOwnerToken, companyId, jobId, studentId } = await bootstrap();

    // Create directly via Model to avoid create hook dependency
    const AppModel = app.service('applications').Model;
    const createdDoc = await AppModel.create({ userId: studentId, companyId, jobListingId: jobId, status: S.NEW, submittedAt: new Date(), validityUntil: new Date(Date.now() + 86400000) });
    const id = createdDoc._id.toString();

    const cAuthz = { Authorization: `Bearer ${companyOwnerToken}` };
    await request(app).patch(`/applications/${id}`).set(cAuthz).send({ action: 'shortlist' }).expect(200);

    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const offeredResp = await request(app).patch(`/applications/${id}`).set(cAuthz).send({ action: 'sendOffer', title: 'Offer', letterKey: 'offers/sample.pdf', validUntil: past }).expect(200);
    expect(offeredResp.body.offer?.letterKey).toBe('offers/sample.pdf');

    const runChecks = app.get('scheduler:runApplicationChecks');
    if (typeof runChecks === 'function') {
      await runChecks();
    }

    const afterResp = await request(app).get(`/applications/${id}`).set(cAuthz).expect(200);
    expect(afterResp.body.status).toBe(S.REJECTED);
    expect(afterResp.body.rejection?.by).toBe('applicant');
  });

  test('application validity auto-rejects as company with reason', async () => {
    const { companyOwnerToken, companyId, jobId, studentId } = await bootstrap();
    const ApplicationsSvc = app.service('applications');
    const Applications = ApplicationsSvc.Model;

    const AppModel = ApplicationsSvc.Model;
    const created = await AppModel.create({ userId: studentId, companyId, jobListingId: jobId, status: S.NEW, submittedAt: new Date(), validityUntil: new Date(Date.now() + 86400000) });
    const id = created._id.toString();

    const past = new Date(Date.now() - 60 * 1000);
    await Applications.updateOne({ _id: id }, { $set: { validityUntil: past, status: S.NEW } });

    const runChecks = app.get('scheduler:runApplicationChecks');
    if (typeof runChecks === 'function') {
      await runChecks();
    }

    const cAuthz = { Authorization: `Bearer ${companyOwnerToken}` };
    const afterResp = await request(app).get(`/applications/${id}`).set(cAuthz).expect(200);
    expect(afterResp.body.status).toBe(S.REJECTED);
    expect(afterResp.body.rejection?.by).toBe('company');
  });

  test('company can decline offer when status is PENDING_ACCEPTANCE', async () => {
    const { companyOwnerToken, companyId, jobId, studentId } = await bootstrap();
    const AppModel = app.service('applications').Model;

    // Create application and move it to PENDING_ACCEPTANCE status
    const createdDoc = await AppModel.create({
      userId: studentId,
      companyId,
      jobListingId: jobId,
      status: S.SHORTLISTED,
      submittedAt: new Date(),
      validityUntil: new Date(Date.now() + 86400000)
    });
    const id = createdDoc._id.toString();

    const cAuthz = { Authorization: `Bearer ${companyOwnerToken}` };

    // Send offer to move to PENDING_ACCEPTANCE
    const offered = await request(app).patch(`/applications/${id}`).set(cAuthz).send({
      action: 'sendOffer',
      title: 'Intern Offer',
      letterKey: 'offers/test.pdf'
    }).expect(200);
    expect(offered.body.status).toBe(S.PENDING_ACCEPTANCE);

    // Decline the offer
    const declined = await request(app).patch(`/applications/${id}`).set(cAuthz).send({
      action: 'declineOffer',
      reason: 'Position no longer available'
    }).expect(200);

    expect(declined.body.status).toBe(S.REJECTED);
    expect(declined.body.rejection?.by).toBe('company');
    expect(declined.body.rejection?.reason).toBe('Position no longer available');
  });

});

