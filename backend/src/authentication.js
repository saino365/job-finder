import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import CompanyVerifications from './models/company-verifications.model.js';

// Custom LocalStrategy that supports login with both email and username
class CustomLocalStrategy extends LocalStrategy {
  async findEntity(username, params) {
    console.log('CustomLocalStrategy.findEntity called with:', { username, provider: params.provider });

    // Ensure this is treated as an internal call by removing provider
    const internalParams = { ...params, provider: undefined };

    // Get the entity service (users)
    const entityService = this.entityService;

    // Try to find user by email OR username
    // The 'username' parameter here is actually the value from the login form (could be email or username)
    const usernameValue = username ? String(username).toLowerCase() : username;

    try {
      // Search for user with email OR username matching the input
      const result = await entityService.find({
        ...internalParams,
        query: {
          $or: [
            { email: usernameValue },
            { username: usernameValue }
          ]
        },
        paginate: false
      });

      const users = Array.isArray(result) ? result : result?.data || [];
      const user = users[0];

      console.log('CustomLocalStrategy.findEntity result:', !!user);
      return user || null;
    } catch (error) {
      console.error('CustomLocalStrategy.findEntity error:', error);
      return null;
    }
  }
}

export default (app) => {
  // Ensure strategies are allowed; prefer config but fall back to explicit
  const baseConfig = app.get('authentication') || {};
  const mergedConfig = {
    ...baseConfig,
    entity: 'user',
    service: 'users',
    authStrategies: Array.isArray(baseConfig.authStrategies) && baseConfig.authStrategies.length
      ? baseConfig.authStrategies
      : ['jwt', 'local'],
    local: {
      usernameField: 'email',
      passwordField: 'password',
      entityUsernameField: 'email',
      ...(baseConfig.local || {})
    }
  };
  app.set('authentication', mergedConfig);

  // Use native Feathers AuthenticationService
  const authentication = new AuthenticationService(app);

  // Register stock strategies
  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new CustomLocalStrategy());

  // Mount service
  app.use('/authentication', authentication);

  const service = app.service('authentication');

  // Helper to issue refresh token (native style, via hook; no custom service subclass)
  async function issueRefreshToken(user) {
    const payload = {
      userId: user._id || user.id,
      tokenId: crypto.randomBytes(16).toString('hex'),
      type: 'refresh'
    };
    const authCfg = app.get('authentication') || {};
    const secret = process.env.JWT_REFRESH_SECRET || authCfg.secret;
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const refreshToken = jwt.sign(payload, secret, { expiresIn });

    const redis = app.get('redis');
    if (redis) {
      const key = `refresh_token:${payload.userId}:${payload.tokenId}`;
      try { await redis.setex(key, 7 * 24 * 60 * 60, refreshToken); } catch (_) {}
    }
    return refreshToken;
  }

  // Hooks
  service.hooks({
    before: {
      create: [ async (ctx) => {
        if (ctx.data) {
          if (ctx.data.username && !ctx.data.email) ctx.data.email = ctx.data.username;
          if (ctx.data.email) ctx.data.email = String(ctx.data.email).toLowerCase();


        }
        return ctx;
      } ]
    },
    after: {
      create: [ async (ctx) => {
        // Attach user and tokens when logging in with local
        let user = ctx.params && ctx.params.user;

        // Fallback: if user not present in params (e.g., some envs), lookup by email provided
        if (!user && ctx.data && ctx.data.email) {
          try {
            const users = app.service('users');
            const found = await users.find({ paginate: false, query: { email: String(ctx.data.email).toLowerCase() } });
            user = Array.isArray(found) ? found[0] : found?.data?.[0];
          } catch (_) {}
        }

        if (user) {
          // Check if company user is approved before allowing login
          if (user.role === 'company') {
            try {
              const { isCompanyVerified } = await import('./utils/access.js');
              const { ok, company } = await isCompanyVerified(app, user._id);

              if (!company) {
                // If no company found, but there is a pending verification submission by this user,
                // treat as pending approval and deny login to match the desired flow.
                try {
                  const pending = await CompanyVerifications.findOne({ submittedBy: user._id, status: 0 }).lean();
                  if (pending) {
                    const err = new Error('Your company is pending approval. Please wait for admin approval before signing in.');
                    err.code = 403;
                    err.className = 'forbidden';
                    err.name = 'Forbidden';
                    throw err;
                  }
                } catch (_) {}
                // No company and no pending submission: allow login to complete setup
                console.log('Company user has no company profile yet, allowing login for setup');
              } else if (!ok) {
                // Company exists but not approved - deny login
                const err = new Error('Your company is pending approval. Please wait for admin approval before signing in.');
                err.code = 403;
                err.className = 'forbidden';
                err.name = 'Forbidden';
                throw err;
              }
            } catch (importErr) {
              // Re-throw any explicit pending-approval errors from above, not just a custom name
              const msg = String(importErr?.message || '').toLowerCase();
              if (
                importErr?.name === 'COMPANY_PENDING_APPROVAL' ||
                importErr?.code === 403 ||
                importErr?.className === 'forbidden' ||
                msg.includes('pending approval')
              ) {
                throw importErr;
              }
              console.error('Error checking company verification:', importErr);
            }
          }

          // Ensure accessToken exists (fallback for environments where core didn't attach it)
          if (!ctx.result.accessToken) {
            try {
              const authCfg = app.get('authentication') || {};
              const secret = process.env.JWT_SECRET || authCfg.secret;
              const expiresIn = (authCfg.jwtOptions && authCfg.jwtOptions.expiresIn) || '1d';
              const payload = { sub: String(user._id || user.id), userId: String(user._id || user.id), strategy: 'jwt' };
              ctx.result.accessToken = jwt.sign(payload, secret, { expiresIn });
            } catch (_) {}
          }
          ctx.result.user = user;
          ctx.result.refreshToken = await issueRefreshToken(user);
        }
        return ctx;
      } ]
    }
  });
};
