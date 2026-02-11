import { hooks as authHooks } from '@feathersjs/authentication';
import SearchProfile from '../../models/search-profiles.model.js';

const { authenticate } = authHooks;

class SearchProfilesService {
  constructor(app) { this.app = app; }

  // List current user's profiles, optionally by kind
  async find(params) {
    const user = params.user;
    if (!user) throw Object.assign(new Error('Not authenticated'), { code: 401 });
    const q = params.query || {};
    const filter = { userId: user._id };
    if (q.kind) filter.kind = q.kind;
    const list = await SearchProfile.find(filter).lean();
    return { items: list };
  }

  async get(id, params) {
    const user = params.user;
    if (!user) throw Object.assign(new Error('Not authenticated'), { code: 401 });
    const doc = await SearchProfile.findById(id).lean();
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });
    if (String(doc.userId) !== String(user._id) && user.role !== 'admin') {
      throw Object.assign(new Error('Forbidden'), { code: 403 });
    }
    return doc;
  }

  // Upsert a single profile per kind per user
  async create(data, params) {
    const user = params.user;
    if (!user) throw Object.assign(new Error('Not authenticated'), { code: 401 });

    const kind = data?.kind;
    const validKinds = ['intern', 'company', 'job-search', 'intern-search'];
    if (!kind || !validKinds.includes(kind)) {
      throw Object.assign(new Error('Invalid kind'), { code: 400 });
    }

    const payload = {
      name: data?.name || undefined,
      filters: data?.filters || {}
    };

    const existing = await SearchProfile.findOne({ userId: user._id, kind });
    if (existing) {
      existing.name = payload.name ?? existing.name;
      existing.filters = { ...(existing.filters || {}), ...(payload.filters || {}) };
      await existing.save();
      return existing.toObject();
    }

    const created = await SearchProfile.create({ userId: user._id, kind, ...payload });
    return created.toObject();
  }

  async patch(id, data, params) {
    const user = params.user;
    if (!user) throw Object.assign(new Error('Not authenticated'), { code: 401 });

    const doc = await SearchProfile.findById(id);
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });
    if (String(doc.userId) !== String(user._id) && user.role !== 'admin') {
      throw Object.assign(new Error('Forbidden'), { code: 403 });
    }

    if (data?.name !== undefined) doc.name = data.name;
    if (data?.filters) doc.filters = { ...(doc.filters || {}), ...data.filters };

    await doc.save();
    return doc.toObject();
  }

  async remove(id, params) {
    const user = params.user;
    if (!user) throw Object.assign(new Error('Not authenticated'), { code: 401 });

    const doc = await SearchProfile.findById(id);
    if (!doc) throw Object.assign(new Error('Not found'), { code: 404 });
    if (String(doc.userId) !== String(user._id) && user.role !== 'admin') {
      throw Object.assign(new Error('Forbidden'), { code: 403 });
    }

    await SearchProfile.deleteOne({ _id: id });
    return { id };
  }
}

export default function (app) {
  app.use('/search-profiles', new SearchProfilesService(app));
  app.service('search-profiles').hooks({ before: { all: [ authenticate('jwt') ] } });
}

