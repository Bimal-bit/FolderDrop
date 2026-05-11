package dev.folderdrop.service;

import java.net.URLDecoder;
import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
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

    public String generateAndStore(String uuid, int maxDownloads) {
        return generateAndStore(uuid, maxDownloads, null);
    }

    public String generateAndStore(String uuid, int maxDownloads, String decryptionKey) {
        int clamped = Math.max(1, Math.min(10, maxDownloads));
        String otp = generateOtp();
        String key = "otp:" + otp;
        String value = uuid + SEPARATOR + clamped + SEPARATOR + clamped
                + SEPARATOR + (decryptionKey == null ? "" : decryptionKey);
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

    public String generateAndStore(String uuid) {
        return generateAndStore(uuid, 1);
    }

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

    public int decrementAndMaybeDelete(String otp, OtpEntry entry) {
        int newRemaining = entry.remaining() - 1;

        if (newRemaining <= 0) {
            delete(otp);
            log.info("OTP burned (last download): otp={}", otp);
            return 0;
        }

        String key = "otp:" + otp;
        String newValue = entry.uuid() + SEPARATOR + entry.maxDownloads() + SEPARATOR + newRemaining
                + SEPARATOR + (entry.decryptionKey() == null ? "" : entry.decryptionKey());

        String url = props.getUpstash().getUrl() + "/set/" + key + "/" + encode(newValue)
                + "?EX=" + props.getOtp().getTtlSeconds() + "&XX";

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

    private String generateOtp() {
        return String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
    }

    private String encode(String value) {
        return value.replace("|", "%7C");
    }

    private HttpHeaders buildHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(props.getUpstash().getToken());
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    public record OtpEntry(String uuid, int maxDownloads, int remaining, String decryptionKey) {
        public OtpEntry(String uuid, int maxDownloads, int remaining) {
            this(uuid, maxDownloads, remaining, null);
        }

        public static OtpEntry parse(String raw) {
            String decoded = URLDecoder.decode(raw, StandardCharsets.UTF_8);
            String[] parts = decoded.split("\\|");
            if (parts.length == 1) return new OtpEntry(parts[0], 1, 1, null);
            if (parts.length == 3) {
                return new OtpEntry(parts[0], Integer.parseInt(parts[1]), Integer.parseInt(parts[2]), null);
            }
            if (parts.length == 4) {
                String storedKey = parts[3].isBlank() ? null : parts[3];
                return new OtpEntry(parts[0], Integer.parseInt(parts[1]), Integer.parseInt(parts[2]), storedKey);
            }
            throw new IllegalArgumentException("Invalid OTP entry format: " + raw);
        }
    }
}
