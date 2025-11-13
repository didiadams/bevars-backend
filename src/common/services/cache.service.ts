import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    this.initRedis();
  }

  private initRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured - caching disabled');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected successfully');
      });
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = this.DEFAULT_TTL): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Cache DELETE error for key ${key}:`, error);
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      this.logger.error(`Cache DELETE PATTERN error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Cache-aside pattern helper
   * Fetches from cache, or executes fetchFn and caches result
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`Cache HIT: ${key}`);
      return cached;
    }

    // Cache miss - fetch fresh data
    this.logger.debug(`Cache MISS: ${key}`);
    const fresh = await fetchFn();
    
    // Store in cache (fire and forget)
    this.set(key, fresh, ttlSeconds).catch((err) => {
      this.logger.error(`Failed to cache key ${key}:`, err);
    });

    return fresh;
  }

  /**
   * Invalidate multiple cache keys by patterns
   */
  async invalidate(patterns: string[]): Promise<void> {
    if (!this.redis) return;

    try {
      for (const pattern of patterns) {
        const deleted = await this.deletePattern(pattern);
        this.logger.log(`Invalidated ${deleted} keys matching ${pattern}`);
      }
    } catch (error) {
      this.logger.error('Cache invalidation error:', error);
    }
  }

  /**
   * Health check for cache service
   */
  async isHealthy(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
