import { hooks as authHooks } from '@feathersjs/authentication';
import Users from '../../models/users.model.js';

const { authenticate } = authHooks;

class ProgrammeCandidatesService {
  constructor(app) { this.app = app; }
  async find(params) {
    const q = params.query || {};

    // Extract filter parameters based on actual data structure
    const {
      programme,
      faculty,
      level
    } = q;

    // Handle fieldOfStudy specially to ensure it's treated as array when multiple values
    let fieldOfStudy = q.fieldOfStudy;
    if (fieldOfStudy && !Array.isArray(fieldOfStudy)) {
      fieldOfStudy = [fieldOfStudy];
    }

    // Also handle other array parameters
    let educationLevel = q.educationLevel;
    if (educationLevel && !Array.isArray(educationLevel)) {
      educationLevel = [educationLevel];
    }

    let university = q.university;
    if (university && !Array.isArray(university)) {
      university = [university];
    }

    let workIndustry = q.workIndustry;
    if (workIndustry && !Array.isArray(workIndustry)) {
      workIndustry = [workIndustry];
    }

    let skills = q.skills;
    if (skills && !Array.isArray(skills)) {
      skills = [skills];
    }

    let preferredLocation = q.preferredLocation;
    if (preferredLocation && !Array.isArray(preferredLocation)) {
      preferredLocation = [preferredLocation];
    }

    // Debug logging
    console.log('🔍 Programme Candidates Query:', {
      originalQuery: q,
      normalizedParams: {
        fieldOfStudy,
        educationLevel,
        university,
        workIndustry,
        skills,
        preferredLocation
      }
    });

    const startDate = q.startDate ? new Date(q.startDate) : null;
    const endDate = q.endDate ? new Date(q.endDate) : null;
    const salaryMin = q.salaryMin ? Number(q.salaryMin) : null;
    const salaryMax = q.salaryMax ? Number(q.salaryMax) : null;

    const match = { role: 'student' };
    const and = [];

    // Education-based filters (using actual data structure)
    if (university && university.length > 0) {
      and.push({ 'internProfile.educations.institutionName': { $in: university } });
      console.log('🏫 Added university filter:', { 'internProfile.educations.institutionName': { $in: university } });
    }

    if (programme) {
      and.push({ 'internProfile.educations.qualification': programme });
      console.log('🎓 Added programme filter:', { 'internProfile.educations.qualification': programme });
    }

    if (faculty || (fieldOfStudy && fieldOfStudy.length > 0)) {
      const fieldValue = fieldOfStudy || [faculty];
      console.log('🎓 Field of Study filter input:', fieldValue);

      if (fieldValue && fieldValue.length > 0) {
        and.push({ 'internProfile.educations.fieldOfStudy': { $in: fieldValue } });
        console.log('📚 Added field of study filter:', { 'internProfile.educations.fieldOfStudy': { $in: fieldValue } });
      }
    }

    if (level || (educationLevel && educationLevel.length > 0)) {
      const levelValue = educationLevel || [level];
      if (levelValue && levelValue.length > 0) {
        and.push({ 'internProfile.educations.level': { $in: levelValue } });
        console.log('📜 Added education level filter:', { 'internProfile.educations.level': { $in: levelValue } });
      }
    }

    // Work experience filters
    if (workIndustry && workIndustry.length > 0) {
      console.log('💼 Work Industry filter input:', workIndustry);
      and.push({ 'workExperiences.industry': { $in: workIndustry } });
      console.log('💼 Added work industry filter:', { 'workExperiences.industry': { $in: workIndustry } });
    }

    // Skills filters
    if (skills && skills.length > 0) {
      and.push({ 'skills': { $in: skills } });
      console.log('🛠️ Added skills filter:', { 'skills': { $in: skills } });
    }

    // Preferences filters
    if (preferredLocation && preferredLocation.length > 0) {
      and.push({ 'preferences.locations': { $in: preferredLocation } });
      console.log('📍 Added preferred location filter:', { 'preferences.locations': { $in: preferredLocation } });
    }

    // Date filters
    if (startDate) {
      and.push({ 'preferences.preferredStartDate': { $gte: startDate } });
      console.log('📅 Added start date filter:', { 'preferences.preferredStartDate': { $gte: startDate } });
    }

    if (endDate) {
      and.push({ 'preferences.preferredEndDate': { $lte: endDate } });
      console.log('📅 Added end date filter:', { 'preferences.preferredEndDate': { $lte: endDate } });
    }

    // Salary filters
    if (salaryMin != null || salaryMax != null) {
      const cond = {};
      if (salaryMin != null) cond.$gte = salaryMin;
      if (salaryMax != null) cond.$lte = salaryMax;
      and.push({ 'preferences.salaryRange.min': cond });
      console.log('💰 Added salary filter:', { 'preferences.salaryRange.min': cond });
    }

    if (and.length) match.$and = and;

    console.log('🔍 Final MongoDB query:', JSON.stringify(match, null, 2));
    console.log('📊 Query conditions count:', and.length);

    const projection = {
      email: 1,
      role: 1,
      'profile.firstName': 1,
      'profile.lastName': 1,
      'profile.phone': 1,
      educations: 1,
      workExperiences: 1,
      skills: 1,
      preferences: 1,
      certifications: 1,
      interests: 1,
      // Keep internProfile for backward compatibility
      'internProfile.university': 1,
      'internProfile.educations': 1,
      'internProfile.preferences': 1
    };

    // Debug: Check work experience data in all students
    const allStudentsWithWork = await Users.find({ role: 'student' }).select('workExperiences').lean();
    console.log('🔍 Students with work experience data:');
    allStudentsWithWork.forEach((student, index) => {
      if (student.workExperiences && student.workExperiences.length > 0) {
        console.log(`Student ${index + 1}:`, student.workExperiences.map(we => ({
          company: we.companyName,
          industry: we.industry
        })));
      }
    });

    // Debug: Check what the query is finding
    const candidates = await Users.find(match).select(projection).limit(100).lean();
    console.log('📊 Database results count:', candidates.length);
    return { items: candidates };
  }

  async patch(id, data, params) {
    const user = params.user;
    if (!user || user.role !== 'company') throw Object.assign(new Error('Only companies can send invites'), { code: 403 });

    // D169: Handle bulk PATCH request (no ID) - accept userIds array from body
    // If id is null/undefined and data has userIds array, treat as bulk operation
    if ((id === null || id === undefined || id === 'null') && Array.isArray(data?.userIds)) {
      const userIds = data.userIds;
      const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
      if (!uniqueUserIds.length) throw Object.assign(new Error('No userIds provided'), { code: 400 });

      const type = data?.type || 'profile_access';
      const message = data?.message;

      // Delegate to invites.create (array) which performs dedupe and notifications
      const payload = uniqueUserIds.map(uid => ({ userId: uid, type, message }));
      const created = await this.app.service('invites').create(payload, params);
      return { created: Array.isArray(created) ? created : [created] };
    }

    // Accept either a single userId via URL or payload list
    const userIds = [];
    if (id && id !== null && id !== 'null') userIds.push(id);
    if (Array.isArray(data?.userIds)) userIds.push(...data.userIds);
    if (data?.userId) userIds.push(data.userId);

    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueUserIds.length) throw Object.assign(new Error('No userIds provided'), { code: 400 });

    const type = data?.type || 'profile_access';
    const message = data?.message;

    // Delegate to invites.create (array) which performs dedupe and notifications
    const payload = uniqueUserIds.map(uid => ({ userId: uid, type, message }));
    const created = await this.app.service('invites').create(payload, params);
    return { created: Array.isArray(created) ? created : [created] };
  }


}

export default function (app) {
  app.use('/programme-candidates', new ProgrammeCandidatesService(app));
  const service = app.service('programme-candidates');
  service.hooks({ before: { all: [ authenticate('jwt') ] } });
  
  // D169: Add custom method to handle bulk invitations without requiring ID
  service.patch(null, async (data, params) => {
    // This will be called for PATCH /programme-candidates (no ID)
    const user = params.user;
    if (!user || user.role !== 'company') throw Object.assign(new Error('Only companies can send invites'), { code: 403 });
    
    if (!Array.isArray(data?.userIds) || data.userIds.length === 0) {
      throw Object.assign(new Error('No userIds provided'), { code: 400 });
    }
    
    const uniqueUserIds = [...new Set(data.userIds.filter(Boolean))];
    const type = data?.type || 'profile_access';
    const message = data?.message;
    
    // Delegate to invites.create (array) which performs dedupe and notifications
    const payload = uniqueUserIds.map(uid => ({ userId: uid, type, message }));
    const created = await app.service('invites').create(payload, params);
    return { created: Array.isArray(created) ? created : [created] };
  });
}

