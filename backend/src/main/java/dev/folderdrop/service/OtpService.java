package dev.folderdrop.service;

import java.security.SecureRandom;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.folderdrop.config.FolderDropProperties;

/**
 * Manages OTP lifecycle via Upstash Redis REST API.
 *
 * Redis value format:  {uuid}|{maxDownloads}|{remainingDownloads}
 * Example:             550e8400-...|3|3
 *
 * On each download:
 *   - remaining is decremented
 *   - if remaining reaches 0, the key is deleted (burn)
 *   - if maxDownloads == 1, original burn-after-first-download behaviour
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final String SEPARATOR = "|";

    private final FolderDropProperties props;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public OtpService(FolderDropProperties props) {
        this.props = props;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Generates a 6-digit OTP and stores it with the given UUID and download limit.
     *
     * @param uuid         the storage object UUID
     * @param maxDownloads how many times this OTP can be redeemed (1–10)
     * @return the generated OTP string
     */
    public String generateAndStore(String uuid, int maxDownloads) {
        int clamped = Math.max(1, Math.min(10, maxDownloads));
        String otp = generateOtp();
        String key = "otp:" + otp;
        // value = uuid|maxDownloads|remaining
        String value = uuid + SEPARATOR + clamped + SEPARATOR + clamped;
        int ttl = props.getOtp().getTtlSeconds();

        String url = props.getUpstash().getUrl() + "/set/" + key + "/" + encode(value) + "?EX=" + ttl;

        HttpHeaders headers = buildHeaders();
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Upstash SET failed: " + response.getStatusCode());
            }
            log.info("OTP stored: key={}, maxDownloads={}, ttl={}s", key, clamped, ttl);
        } catch (Exception e) {
            log.error("Failed to store OTP: {}", e.getMessage());
            throw new RuntimeException("Failed to store OTP", e);
        }

        return otp;
    }

    /** Backward-compatible single-download variant. */
    public String generateAndStore(String uuid) {
        return generateAndStore(uuid, 1);
    }

    /**
     * Looks up the OTP entry.
     * Returns empty if not found or expired.
     */
    public Optional<OtpEntry> lookup(String otp) {
        String key = "otp:" + otp;
        String url = props.getUpstash().getUrl() + "/get/" + key;

        HttpHeaders headers = buildHeaders();
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return Optional.empty();
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode resultNode = root.get("result");
            if (resultNode == null || resultNode.isNull()) return Optional.empty();

            return Optional.of(OtpEntry.parse(resultNode.asText()));
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) return Optional.empty();
            throw new RuntimeException("Failed to lookup OTP", e);
        } catch (Exception e) {
            log.error("Upstash GET error for otp {}: {}", otp, e.getMessage());
            throw new RuntimeException("Failed to lookup OTP", e);
        }
    }

    /**
     * Decrements the remaining download count.
     * Deletes the key when remaining reaches 0 (burn).
     *
     * @return remaining downloads AFTER this decrement (0 means key was deleted)
     */
    public int decrementAndMaybeDelete(String otp, OtpEntry entry) {
        int newRemaining = entry.remaining() - 1;

        if (newRemaining <= 0) {
            delete(otp);
            log.info("OTP burned (last download): otp={}", otp);
            return 0;
        }

        // Update remaining count in Redis
        String key = "otp:" + otp;
        String newValue = entry.uuid() + SEPARATOR + entry.maxDownloads() + SEPARATOR + newRemaining;

        // Use GETEX to get current TTL, then re-set with same TTL
        // Simpler: just re-set with original TTL (slight inaccuracy is acceptable)
        String url = props.getUpstash().getUrl() + "/set/" + key + "/" + encode(newValue)
                + "?EX=" + props.getOtp().getTtlSeconds() + "&XX"; // XX = only set if exists

        HttpHeaders headers = buildHeaders();
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            log.info("OTP decremented: otp={}, remaining={}", otp, newRemaining);
        } catch (Exception e) {
            log.error("Failed to decrement OTP {}: {}", otp, e.getMessage());
        }

        return newRemaining;
    }

    /**
     * Hard-deletes the OTP key from Redis.
     */
    public void delete(String otp) {
        String key = "otp:" + otp;
        String url = props.getUpstash().getUrl() + "/del/" + key;

        HttpHeaders headers = buildHeaders();
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            log.info("OTP deleted: key={}", key);
        } catch (Exception e) {
            log.error("Failed to delete OTP key {}: {}", key, e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String generateOtp() {
        return String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
    }

    /** URL-encode the value (pipe character must be encoded for Upstash REST path). */
    private String encode(String value) {
        return value.replace("|", "%7C");
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(props.getUpstash().getToken());
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    // ── Value Object ──────────────────────────────────────────────────────────

    /**
     * Parsed OTP entry from Redis.
     */
    public record OtpEntry(String uuid, int maxDownloads, int remaining) {
        public static OtpEntry parse(String raw) {
            // Support legacy format (just uuid, no pipes) → treat as maxDownloads=1
            String[] parts = raw.split("\\|");
            if (parts.length == 1) return new OtpEntry(parts[0], 1, 1);
            if (parts.length == 3) {
                return new OtpEntry(parts[0], Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
            }
            throw new IllegalArgumentException("Invalid OTP entry format: " + raw);
        }
    }
}
