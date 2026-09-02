type CacheEntry<T> = { value: T; expiresAt: number }

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  constructor(private defaultTtlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }
}

/** Clave compuesta por subject de Drive + uid de Firebase (sin mezclar usuarios). */
export function subjectCacheKey(driveSubject: string, uid: string, part: string): string {
  return `${driveSubject}\x00${uid}\x00${part}`
}
