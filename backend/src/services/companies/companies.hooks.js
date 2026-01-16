import { hooks as authHooks } from '@feathersjs/authentication';
import { iff, isProvider } from 'feathers-hooks-common';
import mongoose from 'mongoose';
import { VERIFICATION_STATUS } from '../../constants/enums.js';

const { authenticate } = authHooks;

export default (app) => ({
  before: {
    all: [],
    find: [
      // Optionally authenticate to detect admin role, but do not require auth for public listing
      async (context) => {
        try {
          const hasAuthHeader = !!context.params?.headers?.authorization;
          const hasAccessToken = !!context.params?.authentication?.accessToken;
          if (hasAuthHeader || hasAccessToken) {
            await authenticate('jwt')(context);
          }
        } catch (_) {
          // ignore auth errors here to keep endpoint public; role remains undefined
        }
        const q = { ...(context.params.query || {}) };

        // Debug: Log all query parameters
        console.log('🏢 Backend: Received query parameters:', q);

        // Custom params
        const keyword = (q.q || q.keyword || '').trim();
        const nature = q.nature || q.industry;
        const city = q.city || q.location;
        const size = q.size;
        const salaryMin = q.salaryMin ? Number(q.salaryMin) : undefined;
        const salaryMax = q.salaryMax ? Number(q.salaryMax) : undefined;
        const latest = q.latest === 'true' || q.sort === 'latest';
        const sortBy = q.sortBy || q.sort;
        const recommended = q.recommended === 'true';

        // Additional filters for student company search
        const industryFilter = q.industry; // Direct industry filter from student search

        // Public (unauthenticated) and student users only see approved companies
        // Exceptions:
        // 1. company users can search by registrationNumber for uniqueness check
        // 2. company users can query their own companies by ownerUserId
        const isExternal = !!context.params.provider;
        const role = context.params.user?.role;
        const isUniquenessCheck = q.registrationNumber && context.params.query?.$limit === 1;
        const isOwnCompanyCheck = role === 'company' && q.ownerUserId &&
                                  String(q.ownerUserId) === String(context.params.user._id);

        if (isExternal && role !== 'admin' &&
            !(role === 'company' && isUniquenessCheck) &&
            !isOwnCompanyCheck) {
          q.verifiedStatus = VERIFICATION_STATUS.APPROVED;
        }

        // Build Mongo query
        const query = {};

        // Handle industry filtering - support both legacy 'nature' and direct 'industry' filters
        // D174: Normalize industry values and use case-insensitive matching
        const normalizeIndustry = (ind) => {
          if (!ind) return ind;
          const normalized = String(ind).trim();
          // Normalize common variations
          if (normalized.toLowerCase() === 'technology') return 'Information Technology';
          if (normalized.toLowerCase() === 'it') return 'Information Technology';
          return normalized;
        };
        
        if (industryFilter) {
          // D174: Normalize and use case-insensitive regex matching for industry
          const normalizedFilter = typeof industryFilter === 'string' 
            ? normalizeIndustry(industryFilter)
            : (Array.isArray(industryFilter) ? industryFilter.map(normalizeIndustry) : industryFilter);
          
          if (typeof normalizedFilter === 'string') {
            // Use case-insensitive regex for matching
            query.industry = { $regex: new RegExp(`^${normalizedFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
            console.log('🏢 Backend: Applied industry case-insensitive filter:', { industryFilter, normalizedFilter, query: query.industry });
          } else if (Array.isArray(normalizedFilter)) {
            // Multiple industries - use $in with case-insensitive regex
            query.industry = { $in: normalizedFilter.map(ind => new RegExp(`^${ind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) };
            console.log('🏢 Backend: Applied industry array filter (case-insensitive):', { industryFilter, normalizedFilter, query: query.industry });
          } else {
            query.industry = normalizedFilter;
            console.log('🏢 Backend: Applied industry direct filter:', { industryFilter, normalizedFilter, query: query.industry });
          }
        } else if (nature) {
          // Legacy nature filter - normalize and use case-insensitive matching
          const normalizedNature = normalizeIndustry(nature);
          query.industry = { $regex: new RegExp(`^${normalizedNature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
          console.log('🏢 Backend: Applied nature filter (case-insensitive):', { nature, normalizedNature, query: query.industry });
        }

        // Store city for filtering in after hook (avoid FeathersJS validation issues)
        if (city) {
          context.params.cityFilter = city;
          console.log('🏢 Backend: Stored city for after hook search:', { city });
        }

        // Handle company size filtering
        if (size) {
          query.size = size;
          console.log('🏢 Backend: Applied size filter:', { size, query: query.size });
        }

        // Store keyword for comprehensive search in after hook (avoid FeathersJS validation issues)
        if (keyword) {
          context.params.keywordFilter = keyword;
          console.log('🏢 Backend: Stored keyword for after hook search:', { keyword });
        }
        // Handle registrationNumber query for uniqueness checks
        if (q.registrationNumber) {
          query.registrationNumber = q.registrationNumber;
        }
        // Handle ownerUserId query for finding user's companies
        if (q.ownerUserId) {
          query.ownerUserId = new mongoose.Types.ObjectId(q.ownerUserId);
        }
        // Salary range filter (based on internships array)
        if (salaryMin != null || salaryMax != null) {
          const elem = {};
          if (salaryMin != null) elem['salaryRange.max'] = { $gte: salaryMin };
          if (salaryMax != null) elem['salaryRange.min'] = { ...(elem['salaryRange.min'] || {}), $lte: salaryMax };
          query.internships = { $elemMatch: elem };
        }

        // Recommendations: simple industry-based using user internProfile
        if (recommended && context.params.user) {
          try {
            const user = await app.service('users').get(context.params.user._id);
            const prefs = user && user.internProfile && user.internProfile.preferences;
            const industries = (prefs && prefs.industries) || [];
            if (industries.length) {
              query.industry = { $in: industries };
            }
          } catch (_) {}
        }

        // Apply sorting
        const $sort = {};
        if (sortBy === 'name') $sort.name = 1;
        else if (sortBy === 'salary') $sort['internships.salaryRange.max'] = -1;
        else if (latest) $sort.createdAt = -1;
        else if (q.$sort) Object.assign($sort, q.$sort);

        // Build final query; only include $sort when it has fields to avoid
        // `Invalid query parameter $sort` from the adapter
        // Legacy tolerance: for admin filters, if verifiedStatus is 0/1/2 also include string forms
        const finalQuery = { ...query };
        if (q.verifiedStatus !== undefined) {
          const vsNum = typeof q.verifiedStatus === 'string' && q.verifiedStatus.match(/^\d+$/) ? Number(q.verifiedStatus) : q.verifiedStatus;
          const map = { 0: 'pending', 1: 'approved', 2: 'rejected' };
          if (context.params.user?.role === 'admin' && (vsNum === 0 || vsNum === 1 || vsNum === 2)) {
            finalQuery.$or = [ { verifiedStatus: vsNum }, { verifiedStatus: map[vsNum] } ];
          } else {
            finalQuery.verifiedStatus = q.verifiedStatus;
          }
        }

        console.log('🏢 Backend: Final MongoDB query:', finalQuery);
        context.params.query = {
          ...finalQuery,
          ...(Object.keys($sort).length ? { $sort } : {})
        };

        console.log('🏢 Backend: Applied query to context:', context.params.query);

        // Remove custom params so they don't leak to the adapter
        // NOTE: Don't remove 'industry' if we built a query with it
        const paramsToRemove = ['q','keyword','nature','city','location','size','salaryMin','salaryMax','latest','sort','sortBy','recommended'];

        // Only remove 'industry' if we didn't build a query with it
        if (!query.industry) {
          paramsToRemove.push('industry');
        }

        paramsToRemove.forEach(k => delete context.params.query[k]);

        console.log('🏢 Backend: Final query after cleanup:', context.params.query);
      }
    ],
    get: [ async (context) => {
      // Public or student can only view approved companies
      const isExternal = !!context.params.provider;
      const role = context.params.user?.role;
      if (isExternal && role !== 'admin') {
        const doc = await app.service('companies').Model.findById(context.id).lean();
        if (!doc || doc.verifiedStatus !== VERIFICATION_STATUS.APPROVED) {
          const e = new Error('Not found'); e.code = 404; throw e;
        }
      }
    } ],
    create: [
      authenticate('jwt'),
      async (context) => {
        // owner is the authenticated user
        context.data.ownerUserId = context.params.user._id;
        context.data.verifiedStatus = VERIFICATION_STATUS.PENDING;
        context.data.submittedAt = new Date();

        // Optional: enforce unique registration number if provided
        const reg = (context.data.registrationNumber || '').toString().trim();
        if (reg) {
          try {
            const existing = await app.service('companies').Model.findOne({ registrationNumber: reg }).lean();
            if (existing) {
              const e = new Error(`Company with registration number ${reg} already exists: ${existing.name}`);
              e.code = 409; // conflict
              e.data = {
                companyId: existing._id,
                companyName: existing.name,
                registrationNumber: existing.registrationNumber
              };
              throw e;
            }
          } catch (err) {
            if (err && err.code === 409) throw err;
            // swallow find errors to avoid blocking create for transient db issues
          }
          context.data.registrationNumber = reg;
        }
      }
    ],
    update: [ authenticate('jwt') ],
    patch: [
      authenticate('jwt'),
      // Admin or owner can patch; capture previous for notifications
      async (context) => {
        const prev = await app.service('companies').get(context.id);
        context.params._before = { verifiedStatus: prev.verifiedStatus, ownerUserId: prev.ownerUserId };
        if (context.params.user.role === 'admin') return;
        if (prev.ownerUserId.toString() !== context.params.user._id.toString()) {
          throw new Error('Not authorized');
        }
      }
    ],
    remove: [ authenticate('jwt') ]
  },
  after: {
    all: [],
    find: [
      // Attach computed internship stats for list view
      async (context) => {
        const mapCompany = (c) => ({
          ...c,
          internshipListingCount: Array.isArray(c.internships) ? c.internships.length : 0,
          internshipTopTitles: Array.isArray(c.internships) ? c.internships.slice(0, 3).map(j => j.title) : []
        });
        if (Array.isArray(context.result?.data)) {
          context.result.data = context.result.data.map(doc => mapCompany(doc));
        } else if (Array.isArray(context.result)) {
          context.result = context.result.map(doc => mapCompany(doc));
        } else if (context.result) {
          context.result = mapCompany(context.result);
        }
        return context;
      },
      // Handle keyword and city search after data retrieval (avoid FeathersJS validation issues)
      async (context) => {
        const keywordFilter = context.params.keywordFilter;
        const cityFilter = context.params.cityFilter;

        if (keywordFilter || cityFilter) {
          console.log('🏢 Backend: Applying comprehensive filters after retrieval:', { keywordFilter, cityFilter });
          let companies = Array.isArray(context.result) ? context.result : (context.result.data || [context.result]);
          const beforeCount = companies.length;

          companies = companies.filter(company => {
            let matches = true;

            // Apply keyword filter
            if (keywordFilter) {
              const keyword = keywordFilter.toLowerCase();
              const keywordMatch = (
                (company.name && company.name.toLowerCase().includes(keyword)) ||
                (company.description && company.description.toLowerCase().includes(keyword)) ||
                (company.industry && company.industry.toLowerCase().includes(keyword))
              );
              if (!keywordMatch) matches = false;
            }

            // Apply city filter
            if (cityFilter && matches) {
              const city = cityFilter.toLowerCase();
              const cityMatch = (
                (company.address?.city && company.address.city.toLowerCase().includes(city)) ||
                (company.address?.fullAddress && company.address.fullAddress.toLowerCase().includes(city))
              );
              if (!cityMatch) matches = false;
            }

            return matches;
          });

          console.log('🏢 Backend: Comprehensive filter results:', { beforeCount, afterCount: companies.length });

          // Update the result
          if (Array.isArray(context.result)) {
            context.result = companies;
          } else if (context.result.data) {
            context.result.data = companies;
            context.result.total = companies.length;
          }
        }
        return context;
      }
    ],
    get: [],
    create: [ async (context) => {
      // Notify admins of a new company submission and receipt to owner
      try {
        const admins = await app.service('users').find({ paginate: false, query: { role: 'admin' } });
        await Promise.all((admins||[]).map(a => app.service('notifications').create({
          recipientUserId: a._id,
          recipientRole: 'admin',
          type: 'system',
          title: 'New company submitted',
          body: `${context.result?.name || 'Company'} is pending verification.`
        }).catch(()=>{})));
      } catch (_) {}
      try {
        await app.service('notifications').create({
          recipientUserId: context.params.user._id,
          recipientRole: 'company',
          type: 'system',
          title: 'Company submitted',
          body: 'Your company profile has been submitted for verification.'
        }).catch(()=>{});
      } catch (_) {}
    } ],
    update: [],
    patch: [ async (context) => {
      // If verification status changed (including direct admin patch), notify owner
      try {
        const before = context.params._before || {};
        const after = context.result || {};
        if (before.verifiedStatus !== undefined && after.verifiedStatus !== undefined && before.verifiedStatus !== after.verifiedStatus) {
          const approved = after.verifiedStatus === VERIFICATION_STATUS.APPROVED;
          const rejected = after.verifiedStatus === VERIFICATION_STATUS.REJECTED;
          const title = approved ? 'Company approved' : rejected ? 'Company rejected' : 'Company status updated';
          const body = approved ? 'Your company is verified.' : rejected ? (after.rejectionReason || 'Your company verification was rejected.') : 'Your company verification status changed.';
          await app.service('notifications').create({
            recipientUserId: before.ownerUserId || after.ownerUserId,
            recipientRole: 'company',
            type: 'system',
            title, body
          }).catch(()=>{});
        }
      } catch (_) {}
    } ],
    remove: []
  },
  error: { all: [], find: [], get: [], create: [], update: [], patch: [], remove: [] }
});

