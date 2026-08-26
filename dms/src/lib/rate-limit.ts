// import { Redis } from "@upstash/redis";

// const redis = Redis.fromEnv(); // same Upstash client already used for password-reset tokens

// export type RateLimitResult =
//   | { allowed: true }
//   | { allowed: false; retryAfterSeconds: number };

// export async function checkRateLimit(
//   key: string,
//   limit: number,
//   windowSeconds: number,
// ): Promise<RateLimitResult> {
//   const count = await redis.incr(key);
//   // Only set the expiry on the FIRST request in a fresh window - if we
//   // called .expire() on every request, a steady stream of attempts could
//   // keep pushing the expiry forward forever, and the limit would never
//   // actually reset.
//   if (count === 1) {
//     await redis.expire(key, windowSeconds);
//   }
//   if (count > limit) {
//     const ttl = await redis.ttl(key);
//     return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
//   }
//   return { allowed: true };
// }
