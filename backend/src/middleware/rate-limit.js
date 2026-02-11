import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Forbidden } from '@feathersjs/errors';

export default function (app) {
  const redis = app.get('redis');

  // If Redis not configured, skip rate limiting to avoid blocking API
  if (!redis) {
    console.warn('Redis not configured, skipping rate limiting');
    return;
  }

  // Rate limiter for authentication endpoints
  const authLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'auth_limit',
    points: 5, // Number of attempts
    duration: 900, // Per 15 minutes
  });

  // Rate limiter for general API endpoints
  const apiLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'api_limit',
    points: 100, // Number of requests
    duration: 60, // Per minute
  });

  // Apply auth rate limiting to authentication endpoints
  app.use('/authentication', async (req, res, next) => {
    try {
      const key = req.ip;
      await authLimiter.consume(key);
      next();
    } catch (rejRes) {
      throw new Forbidden('Too many authentication attempts. Please try again later.');
    }
  });

  // Apply general rate limiting to all API endpoints
  app.use('/api', async (req, res, next) => {
    try {
      const key = req.ip;
      await apiLimiter.consume(key);
      next();
    } catch (rejRes) {
      throw new Forbidden('Rate limit exceeded. Please try again later.');
    }
  });
};
