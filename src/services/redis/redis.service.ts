/* eslint-disable */
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { parseBooleanFlag } from '@/utils/env.util';

interface MemoryEntry {
  value: string;
  expiresAt?: number;
  timer?: NodeJS.Timeout;
}

/**
 * RedisService provides a wrapper around ioredis
 * to simplify publishing, subscribing, and key management.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /**
   * Redis client instance for general commands.
   */
  public readonly client: Redis | null;

  /**
   * Dedicated Redis client instance for caching operations (get/set/setex).
   * This is separate from pub/sub to avoid "subscriber mode" conflicts.
   */
  public readonly cacheClient: Redis | null;

  /**
   * Redis client instance for publishing messages.
   */
  public readonly publisher: Redis | null;

  /**
   * Redis client instance for subscribing to messages.
   */
  public readonly subscriber: Redis | null;

  private readonly redisEnabled: boolean;
  private readonly memoryStore = new Map<string, MemoryEntry>();
  private readonly pubSubEmitter = new EventEmitter();

  constructor(private readonly configService: ConfigService) {
    const isRedisEnabled = parseBooleanFlag(
      this.configService.get<string | boolean>('REDIS_ENABLED'),
      true,
    );
    const redisUrl = this.configService.get<string>('REDIS_URL');

    this.redisEnabled = isRedisEnabled && !!redisUrl;

    if (!this.redisEnabled) {
      this.client = null;
      this.cacheClient = null;
      this.publisher = null;
      this.subscriber = null;

      const reason = isRedisEnabled
        ? 'REDIS_URL is not defined'
        : 'REDIS_ENABLED is false';
      this.logger.warn(`${reason}. Falling back to in-memory Redis storage.`);
      return;
    }

    try {
      const client = new Redis(redisUrl!, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      const cacheClient = client.duplicate();
      const publisher = client.duplicate();
      const subscriber = client.duplicate();

      for (const redisClient of [client, cacheClient, publisher, subscriber]) {
        redisClient.on('error', (error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown Redis error';
          this.logger.warn(`Redis client error: ${errorMessage}`);
        });
      }

      this.client = client;
      this.cacheClient = cacheClient;
      this.publisher = publisher;
      this.subscriber = subscriber;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize Redis client: ${errorMessage}`);
    }
  }

  public isEnabled(): boolean {
    return this.redisEnabled;
  }

  /**
   * Wait for Redis connections to be ready before proceeding
   */
  async onModuleInit(): Promise<void> {
    if (!this.redisEnabled) {
      return;
    }

    try {
      // Wait for all Redis clients to be ready
      await Promise.all([
        this.waitForClientReady(this.client!),
        this.waitForClientReady(this.cacheClient!),
        this.waitForClientReady(this.publisher!),
        this.waitForClientReady(this.subscriber!),
      ]);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to establish Redis connections: ${errorMessage}`);
    }
  }

  /**
   * Wait for a Redis client to be ready
   */
  private async waitForClientReady(client: Redis): Promise<void> {
    return new Promise((resolve, reject) => {
      if (client.status === 'ready') {
        resolve();
        return;
      }

      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        clearTimeout(timer);
      };

      client.once('ready', onReady);
      client.once('error', onError);

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Redis connection timeout'));
      }, 5000);

      if (client.status === 'wait') {
        client.connect().catch(onError);
      }
    });
  }

  /**
   * Cleanup Redis connections when module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.redisEnabled) {
      this.clearMemoryStore();
      return;
    }

    try {
      await Promise.all([
        this.client?.disconnect(),
        this.cacheClient?.disconnect(),
        this.publisher?.disconnect(),
        this.subscriber?.disconnect(),
      ]);
    } catch (error: unknown) {
      // Log error but don't throw to avoid blocking shutdown
      // Using process.env.NODE_ENV check to allow console.error in non-production environments
      if (this.configService.get('NODE_ENV') !== 'production') {
        console.error('Error during Redis cleanup:', error);
      }
    }
  }

  /**
   * Waits for a single event from a Redis channel.
   *
   * @param channel - Redis channel name
   * @param timeout - Maximum wait time in ms (default: 5000ms = 5 seconds)
   * @returns The received message or null if timed out
   */
  async waitForEvent(channel: string, timeout = 5000): Promise<string | null> {
    if (!this.redisEnabled) {
      return new Promise<string | null>((resolve) => {
        const onMessage = (message: string): void => {
          clearTimeout(timer);
          this.pubSubEmitter.removeListener(channel, onMessage);
          resolve(message);
        };

        const timer = setTimeout(() => {
          this.pubSubEmitter.removeListener(channel, onMessage);
          resolve(null);
        }, timeout);

        this.pubSubEmitter.on(channel, onMessage);
      });
    }

    return new Promise<string | null>((resolve) => {
      let isResolved = false;

      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.subscriber?.removeListener('message', onMessage);
          resolve(null);
        }
      }, timeout);

      const onMessage = (receivedChannel: string, message: string): void => {
        if (receivedChannel === channel && !isResolved) {
          isResolved = true;
          clearTimeout(timer);
          this.subscriber?.removeListener('message', onMessage);
          resolve(message);
        }
      };

      // Subscribe to channel first
      this.subscriber?.subscribe(channel).catch((error: unknown) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          // Using process.env.NODE_ENV check to allow console.error in non-production environments
          if (this.configService.get('NODE_ENV') !== 'production') {
            console.error(`Failed to subscribe to channel ${channel}:`, error);
          }
          resolve(null);
        }
      });

      this.subscriber?.on('message', onMessage);
    });
  }

  /**
   * Removes all keys matching the given prefix pattern.
   *
   * The script uses the KEYS command to retrieve all keys matching the pattern,
   * deletes them, and returns the number of deleted keys.
   *
   * @param prefix - The key pattern to match (e.g., "orders:*")
   * @returns A promise that resolves with the number of deleted keys
   */
  public async removeKeyWithPrefix(prefix: string): Promise<number> {
    if (!this.redisEnabled) {
      const pattern = new RegExp(
        `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`,
      );

      let deleted = 0;
      for (const key of [...this.memoryStore.keys()]) {
        if (pattern.test(key)) {
          deleted += await this.del(key);
        }
      }

      return deleted;
    }

    try {
      const luaScript = `
        local keys = redis.call('KEYS', ARGV[1])
        local deleted = 0
        for i = 1, #keys do
          redis.call('DEL', keys[i])
          deleted = deleted + 1
        end
        return deleted
      `;

      const result = await this.client!.eval(luaScript, 0, prefix);
      const deleted = typeof result === 'number' ? result : 0;
      return deleted;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to remove keys with prefix ${prefix}: ${errorMessage}`,
      );
    }
  }

  /**
   * Publishes a message to a Redis channel
   *
   * @param channel - Redis channel name
   * @param message - Message to publish
   * @returns Number of subscribers that received the message
   */
  public async publish(channel: string, message: string): Promise<number> {
    if (!this.redisEnabled) {
      this.pubSubEmitter.emit(channel, message);
      return this.pubSubEmitter.listenerCount(channel);
    }

    try {
      return await this.publisher!.publish(channel, message);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to publish message to channel ${channel}: ${errorMessage}`,
      );
    }
  }

  /**
   * Subscribe to a Redis channel
   *
   * @param channel - Redis channel name
   * @param callback - Function to handle received messages
   */
  public async subscribe(
    channel: string,
    callback: (channel: string, message: string) => void,
  ): Promise<void> {
    if (!this.redisEnabled) {
      this.pubSubEmitter.on(channel, (message: string) => {
        callback(channel, message);
      });
      return;
    }

    try {
      await this.subscriber!.subscribe(channel);
      this.subscriber!.on('message', callback);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to subscribe to channel ${channel}: ${errorMessage}`,
      );
    }
  }

  /**
   * Unsubscribe from a Redis channel
   *
   * @param channel - Redis channel name
   */
  public async unsubscribe(channel: string): Promise<void> {
    if (!this.redisEnabled) {
      this.pubSubEmitter.removeAllListeners(channel);
      return;
    }

    try {
      await this.subscriber!.unsubscribe(channel);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to unsubscribe from channel ${channel}: ${errorMessage}`,
      );
    }
  }

  /**
   * Atomic increment operation
   *
   * @param key - Redis key name
   * @returns The value after increment
   */
  public async incr(key: string): Promise<number> {
    if (!this.redisEnabled) {
      const currentValue = parseInt(this.getMemoryValue(key) ?? '0', 10) || 0;
      const nextValue = currentValue + 1;
      this.setMemoryValue(key, nextValue.toString());
      return nextValue;
    }

    try {
      return await this.client!.incr(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to increment key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Atomic decrement operation
   *
   * @param key - Redis key name
   * @returns The value after decrement
   */
  public async decr(key: string): Promise<number> {
    if (!this.redisEnabled) {
      const currentValue = parseInt(this.getMemoryValue(key) ?? '0', 10) || 0;
      const nextValue = currentValue - 1;
      this.setMemoryValue(key, nextValue.toString());
      return nextValue;
    }

    try {
      return await this.client!.decr(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to decrement key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Get value from Redis
   *
   * @param key - Redis key name
   * @returns The value or null if key doesn't exist
   */
  public async get(key: string): Promise<string | null> {
    if (!this.redisEnabled) {
      return this.getMemoryValue(key);
    }

    try {
      return await this.cacheClient!.get(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Set value in Redis
   *
   * @param key - Redis key name
   * @param value - Value to set
   * @returns OK if successful
   */
  public async set(
    key: string,
    value: string | number,
  ): Promise<string | null> {
    if (!this.redisEnabled) {
      this.setMemoryValue(key, value.toString());
      return 'OK';
    }

    try {
      return await this.cacheClient!.set(key, value.toString());
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to set key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Set value in Redis with expiry (seconds)
   *
   * @param key - Redis key name
   * @param seconds - Expiry time in seconds
   * @param value - Value to set
   * @returns OK if successful
   */
  public async setex(
    key: string,
    seconds: number,
    value: string | number,
  ): Promise<string> {
    if (!this.redisEnabled) {
      this.setMemoryValue(key, value.toString(), seconds * 1000);
      return 'OK';
    }

    try {
      return await this.cacheClient!.setex(key, seconds, value.toString());
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to setex key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Delete key from Redis
   *
   * @param key - Redis key name
   * @returns Number of keys deleted (0 or 1)
   */
  public async del(key: string): Promise<number> {
    if (!this.redisEnabled) {
      const entry = this.memoryStore.get(key);
      if (!entry) {
        return 0;
      }

      if (entry.timer) {
        clearTimeout(entry.timer);
      }

      this.memoryStore.delete(key);
      return 1;
    }

    try {
      return await this.client!.del(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Set expiration for a key in seconds
   *
   * @param key - Redis key name
   * @param seconds - Expiration time in seconds
   * @returns 1 if the timeout was set, 0 if key does not exist
   */
  public async expire(key: string, seconds: number): Promise<number> {
    if (!this.redisEnabled) {
      return this.applyMemoryExpiry(key, seconds * 1000);
    }

    try {
      return await this.client!.expire(key, seconds);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to set expire for key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Set expiration for a key in milliseconds
   *
   * @param key - Redis key name
   * @param milliseconds - Expiration time in milliseconds
   * @returns 1 if the timeout was set, 0 if key does not exist
   */
  public async pexpire(key: string, milliseconds: number): Promise<number> {
    if (!this.redisEnabled) {
      return this.applyMemoryExpiry(key, milliseconds);
    }

    try {
      return await this.client!.pexpire(key, milliseconds);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to set pexpire for key ${key}: ${errorMessage}`);
    }
  }

  public async setWithTimeoutMs(
    key: string,
    milliseconds: number,
    value: string | number,
  ): Promise<string | null> {
    if (!this.redisEnabled) {
      this.setMemoryValue(key, value.toString(), milliseconds);
      return 'OK';
    }

    try {
      return await this.client!.set(key, value.toString(), 'PX', milliseconds);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to set key ${key} with timeout ${milliseconds}: ${errorMessage}`,
      );
    }
  }

  public async setIfAbsent(
    key: string,
    milliseconds: number,
    value: string | number,
  ): Promise<boolean> {
    if (!this.redisEnabled) {
      if (this.getMemoryValue(key) !== null) {
        return false;
      }

      this.setMemoryValue(key, value.toString(), milliseconds);
      return true;
    }

    try {
      const result = await this.client!.set(
        key,
        value.toString(),
        'PX',
        milliseconds,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to set NX key ${key}: ${errorMessage}`);
    }
  }

  private getMemoryValue(key: string): string | null {
    const entry = this.memoryStore.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
      this.memoryStore.delete(key);
      return null;
    }

    return entry.value;
  }

  private setMemoryValue(
    key: string,
    value: string,
    ttlMs?: number,
  ): void {
    const existingEntry = this.memoryStore.get(key);

    if (existingEntry?.timer) {
      clearTimeout(existingEntry.timer);
    }

    const preservedTtlMs =
      ttlMs ??
      (existingEntry?.expiresAt
        ? Math.max(existingEntry.expiresAt - Date.now(), 1)
        : undefined);

    const entry: MemoryEntry = {
      value,
    };

    if (preservedTtlMs && preservedTtlMs > 0) {
      entry.expiresAt = Date.now() + preservedTtlMs;
      entry.timer = setTimeout(() => {
        this.memoryStore.delete(key);
      }, preservedTtlMs);
    }

    this.memoryStore.set(key, entry);
  }

  private applyMemoryExpiry(key: string, milliseconds: number): number {
    const value = this.getMemoryValue(key);

    if (value === null) {
      return 0;
    }

    this.setMemoryValue(key, value, milliseconds);
    return 1;
  }

  private clearMemoryStore(): void {
    for (const entry of this.memoryStore.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
    }

    this.memoryStore.clear();
    this.pubSubEmitter.removeAllListeners();
  }
}
