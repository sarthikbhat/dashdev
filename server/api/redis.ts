import { Router } from "express";
import Redis from "ioredis";

const REDIS_URL = process.env.DEVDASH_REDIS_URL ?? "redis://localhost:6379";

export function redisRouter(): Router {
  const router = Router();
  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

  let connected = false;

  async function ensureConnected(): Promise<void> {
    if (!connected) {
      await redis.connect();
      connected = true;
    }
  }

  // ── GET /info — Redis server info ────────────────────────────────────────────

  router.get("/info", async (_req, res) => {
    try {
      await ensureConnected();
      const info = await redis.info();

      const get = (key: string): string => {
        const match = info.match(new RegExp(`^${key}:(.+)$`, "m"));
        return match ? match[1].trim() : "";
      };

      // Parse db0 key count: "db0:keys=42,expires=3,avg_ttl=0"
      const db0 = get("db0");
      let totalKeys = 0;
      if (db0) {
        const keysMatch = db0.match(/keys=(\d+)/);
        if (keysMatch) totalKeys = parseInt(keysMatch[1], 10);
      }

      res.json({
        version: get("redis_version"),
        connected_clients: parseInt(get("connected_clients") || "0", 10),
        used_memory_human: get("used_memory_human"),
        total_keys: totalKeys,
        uptime_seconds: parseInt(get("uptime_in_seconds") || "0", 10),
      });
    } catch (err) {
      res.status(500).json({ error: `Redis connection failed: ${(err as Error).message}` });
    }
  });

  // ── GET /keys — SCAN-based key listing ───────────────────────────────────────

  router.get("/keys", async (req, res) => {
    try {
      await ensureConnected();
      const pattern = (req.query.pattern as string) || "*";
      const cursor = (req.query.cursor as string) || "0";
      const count = parseInt((req.query.count as string) || "50", 10);

      const [nextCursor, rawKeys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        count
      );

      // Get type and TTL for each key
      const pipeline = redis.pipeline();
      for (const key of rawKeys) {
        pipeline.type(key);
        pipeline.ttl(key);
      }
      const results = await pipeline.exec();

      const keys = rawKeys.map((key, i) => ({
        key,
        type: (results?.[i * 2]?.[1] as string) ?? "unknown",
        ttl: (results?.[i * 2 + 1]?.[1] as number) ?? -1,
      }));

      res.json({ keys, nextCursor });
    } catch (err) {
      res.status(500).json({ error: `Redis error: ${(err as Error).message}` });
    }
  });

  // ── GET /key/:key — Get key value + metadata ────────────────────────────────

  router.get("/key/:key", async (req, res) => {
    try {
      await ensureConnected();
      const key = req.params.key;
      const type = await redis.type(key);

      if (type === "none") {
        res.status(404).json({ error: "Key not found" });
        return;
      }

      const ttl = await redis.ttl(key);
      let value: unknown;
      let size = 0;

      switch (type) {
        case "string": {
          const v = await redis.get(key);
          value = v;
          size = v ? Buffer.byteLength(v) : 0;
          break;
        }
        case "hash": {
          const h = await redis.hgetall(key);
          value = h;
          size = Object.keys(h).length;
          break;
        }
        case "list": {
          const len = await redis.llen(key);
          const items = await redis.lrange(key, 0, Math.min(len - 1, 99));
          value = items;
          size = len;
          break;
        }
        case "set": {
          const members = await redis.smembers(key);
          value = members;
          size = members.length;
          break;
        }
        case "zset": {
          const items = await redis.zrange(key, 0, 99, "WITHSCORES");
          // zrange WITHSCORES returns [member, score, member, score, ...]
          const pairs: { member: string; score: string }[] = [];
          for (let i = 0; i < items.length; i += 2) {
            pairs.push({ member: items[i], score: items[i + 1] });
          }
          value = pairs;
          size = await redis.zcard(key);
          break;
        }
        default:
          value = null;
      }

      res.json({ key, type, value, ttl, size });
    } catch (err) {
      res.status(500).json({ error: `Redis error: ${(err as Error).message}` });
    }
  });

  // ── PUT /key/:key — Update string key value ─────────────────────────────────

  router.put("/key/:key", async (req, res) => {
    try {
      await ensureConnected();
      const key = req.params.key;
      const { value } = req.body as { value?: string };

      if (value === undefined || value === null) {
        res.status(400).json({ error: "value is required" });
        return;
      }

      const type = await redis.type(key);

      // Only allow updating string keys (or creating new ones)
      if (type !== "string" && type !== "none") {
        res.status(400).json({ error: `Cannot set value on ${type} key. Only string keys supported.` });
        return;
      }

      // Preserve TTL if key exists
      const ttl = type !== "none" ? await redis.ttl(key) : -1;
      await redis.set(key, value);
      if (ttl > 0) {
        await redis.expire(key, ttl);
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Redis error: ${(err as Error).message}` });
    }
  });

  // ── DELETE /key/:key — Delete a key ──────────────────────────────────────────

  router.delete("/key/:key", async (req, res) => {
    try {
      await ensureConnected();
      const key = req.params.key;
      const deleted = await redis.del(key);
      res.json({ deleted: deleted > 0 });
    } catch (err) {
      res.status(500).json({ error: `Redis error: ${(err as Error).message}` });
    }
  });

  return router;
}
