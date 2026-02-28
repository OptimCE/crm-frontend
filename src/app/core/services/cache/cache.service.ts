import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CacheService {
  private cache = new Map<string, { data: unknown; expiry: number }>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  set(key: string, data: unknown, ttlMs: number): void {
    this.cache.set(key, { data, expiry: Date.now() + ttlMs });
  }

  invalidate(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}
