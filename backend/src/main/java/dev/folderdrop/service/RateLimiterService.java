package dev.folderdrop.service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Service;

import com.google.common.util.concurrent.RateLimiter;

/**
 * Per-IP rate limiting using Guava's RateLimiter.
 *
 * Upload limit: 5 requests per minute per IP.
 * Download limit: 10 attempts per minute per IP (brute-force protection).
 *
 * RateLimiter uses a token-bucket algorithm. Each IP gets its own limiter.
 * Limiters are created lazily and stored in a ConcurrentHashMap.
 *
 * Note: In a multi-instance deployment, this is per-instance only.
 * For distributed rate limiting, move to Upstash Redis counters.
 */
@Service
public class RateLimiterService {

    // 5 uploads per 60 seconds = ~0.0833 permits/second
    private static final double UPLOAD_RATE = 5.0 / 60.0;

    // 10 download attempts per 60 seconds = ~0.1667 permits/second
    private static final double DOWNLOAD_RATE = 10.0 / 60.0;

    private final ConcurrentHashMap<String, RateLimiter> uploadLimiters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateLimiter> downloadLimiters = new ConcurrentHashMap<>();

    /**
     * Attempts to acquire an upload permit for the given IP.
     *
     * @param ip the client IP address
     * @return true if the request is allowed, false if rate-limited
     */
    public boolean tryAcquireUpload(String ip) {
        RateLimiter limiter = uploadLimiters.computeIfAbsent(ip,
                k -> RateLimiter.create(UPLOAD_RATE));
        return limiter.tryAcquire(0, TimeUnit.SECONDS);
    }

    /**
     * Attempts to acquire a download permit for the given IP.
     *
     * @param ip the client IP address
     * @return true if the request is allowed, false if rate-limited
     */
    public boolean tryAcquireDownload(String ip) {
        RateLimiter limiter = downloadLimiters.computeIfAbsent(ip,
                k -> RateLimiter.create(DOWNLOAD_RATE));
        return limiter.tryAcquire(0, TimeUnit.SECONDS);
    }
}
