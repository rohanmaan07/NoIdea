const Redis = require("ioredis");

let redisClient;

function getRedisConnection() {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: process.env.REDIS_PORT || 6379,
            maxRetriesPerRequest: null, // BullMQ ke liye required
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        redisClient.on("connect", () => {
            console.log(" Redis connected successfully");
        });

        redisClient.on("error", (err) => {
            console.error(" Redis connection error:", err.message);
        });

        redisClient.on("ready", () => {
            console.log(" Redis client ready");
        });
    }

    return redisClient;
}

function closeRedisConnection() {
    if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
        console.log("🔌 Redis connection closed");
    }
}

module.exports = {
    getRedisConnection,
    closeRedisConnection,
};
