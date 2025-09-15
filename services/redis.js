import { createClient } from "redis";

const SESSION_TTL = 3600;

let redisClient;

async function initializeRedis() {
  if (redisClient) return redisClient;

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    redisClient.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
      console.log("Connected to Redis");
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    console.log("Running without Redis - sessions will not persist");
    return null;
  }
}

export async function saveMessage(sessionKey, message) {
  await redisClient.rPush(sessionKey, JSON.stringify(message));
  await redisClient.expire(sessionKey, SESSION_TTL); 
}

export async function getHistory(sessionKey) {
  const msgs = await redisClient.lRange(sessionKey, 0, -1);
  return msgs.map(m => JSON.parse(m));
}

export async function clearSession(sessionKey) {
  await redisClient.del(sessionKey);
}

export { initializeRedis, redisClient };
