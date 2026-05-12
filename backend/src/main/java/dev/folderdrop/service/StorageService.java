package dev.folderdrop.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.folderdrop.config.FolderDropProperties;

/**
 * Handles all Supabase Storage operations via the Supabase Storage REST API.
 *
 * API base: {projectUrl}/storage/v1
 *
 * Upload:        POST   /object/{bucket}/{path}
 * Create signed URL: POST /object/sign/{bucket}/{path}   body: { "expiresIn": 60 }
 * Delete:        DELETE /object/{bucket}                 body: { "prefixes": ["path"] }
 *
 * All requests use the service_role key as Bearer token.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);
    private static final String KEY_PREFIX = "uploads/";

    private final RestTemplate restTemplate;
    private final FolderDropProperties props;
    private final ObjectMapper objectMapper;

    public StorageService(RestTemplate storageRestTemplate, FolderDropProperties props) {
        this.restTemplate = storageRestTemplate;
        this.props = props;
        this.objectMapper = new ObjectMapper();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String storageBase() {
        return props.getSupabase().getProjectUrl() + "/storage/v1";
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        String serviceKey = props.getSupabase().getServiceKey();
        headers.set("apikey", serviceKey);

        // Legacy service_role keys are JWTs and are accepted in Authorization.
        // New sb_secret_* keys are opaque API keys; sending them as Bearer tokens
        // can make Storage reject private object reads with 400/401.
        if (!serviceKey.startsWith("sb_secret_")) {
            headers.setBearerAuth(serviceKey);
        }

        return headers;
    }

    private String objectPath(String uuid) {
        return KEY_PREFIX + uuid + ".fdenc";
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Uploads a ZIP file to Supabase Storage.
     *
     * POST /storage/v1/object/{bucket}/{path}
     * Content-Type: application/zip
     *
     * @param uuid         UUID used as the object path
     * @param file         the multipart ZIP file
     * @param otp          stored as custom metadata header x-upsert
     * @param originalName the original folder name (informational)
     */
    public void upload(String uuid, MultipartFile file, String otp, String originalName) {
        try {
            uploadBytes(uuid, file.getBytes(), file.getContentType() != null
                    ? file.getContentType() : "application/octet-stream");
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload file to storage", e);
        }
    }

    /**
     * Uploads raw bytes to Supabase Storage.
     * Called directly from UploadController after reading bytes once.
     */
    public void uploadBytes(String uuid, byte[] bytes, String contentType) {
        String path = objectPath(uuid);
        String bucket = props.getSupabase().getBucket();
        String url = storageBase() + "/object/" + bucket + "/" + path;

        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.parseMediaType(
                contentType != null ? contentType : "application/octet-stream"));
        headers.set("x-upsert", "false");
        headers.set("Cache-Control", "no-cache");

        try {
            HttpEntity<byte[]> entity = new HttpEntity<>(bytes, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Supabase upload returned: " + response.getStatusCode()
                        + " body=" + response.getBody());
            }

            log.info("Uploaded to Supabase Storage: bucket={}, path={}, size={}B", bucket, path, bytes.length);
        } catch (Exception e) {
            log.error("Supabase upload failed for path={}: {}", path, e.getMessage());
            throw new RuntimeException("Failed to upload file to storage: " + e.getMessage(), e);
        }
    }

    /**
     * Creates a signed download URL valid for 60 seconds.
     *
     * POST /storage/v1/object/sign/{bucket}/{path}
     * Body: { "expiresIn": 60 }
     *
     * @param uuid the UUID of the object
     * @return signed URL string
     */
    public String generatePresignedUrl(String uuid) {
        String path = objectPath(uuid);
        String bucket = props.getSupabase().getBucket();
        String url = storageBase() + "/object/sign/" + bucket + "/" + path;

        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Integer> body = Map.of("expiresIn", 300);
        HttpEntity<Map<String, Integer>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Supabase sign URL returned: " + response.getStatusCode()
                        + " body=" + response.getBody());
            }

            JsonNode root = objectMapper.readTree(response.getBody());

            // Supabase returns either "signedURL" (older) or "signedUrl" (newer) — handle both
            JsonNode signedNode = root.has("signedURL") ? root.get("signedURL") : root.get("signedUrl");
            if (signedNode == null || signedNode.isNull()) {
                throw new RuntimeException("Supabase sign URL response missing signedURL field. Body: "
                        + response.getBody());
            }

            String signedUrl = normalizeSignedUrl(signedNode.asText());

            log.info("Generated signed URL for path={}, valid=300s", path);
            return signedUrl;
        } catch (Exception e) {
            log.error("Supabase sign URL failed for path={}: {}", path, e.getMessage());
            throw new RuntimeException("Failed to generate download link: " + e.getMessage(), e);
        }
    }

    private String normalizeSignedUrl(String signedPath) {
        if (signedPath.startsWith("http")) {
            return signedPath;
        }

        String projectUrl = props.getSupabase().getProjectUrl();
        if (signedPath.startsWith("/storage/v1/")) {
            return projectUrl + signedPath;
        }

        if (signedPath.startsWith("/object/")) {
            return storageBase() + signedPath;
        }

        String normalizedPath = signedPath.startsWith("/") ? signedPath : "/" + signedPath;
        return storageBase() + normalizedPath;
    }

    /**
     * Streams a file from a URL as a Spring Resource — no heap buffering.
     * Used by the download endpoint to pipe Supabase bytes to the browser.
     */
    public org.springframework.core.io.Resource streamFromUrl(String url) {
        try {
            // Signed URLs are pre-authenticated — do NOT send auth headers
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.GET, HttpEntity.EMPTY, byte[].class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Supabase stream returned: " + response.getStatusCode());
            }
            return new org.springframework.core.io.ByteArrayResource(response.getBody());
        } catch (Exception e) {
            log.error("Supabase stream failed for url={}: {}", url, e.getMessage());
            throw new RuntimeException("Failed to stream file: " + e.getMessage(), e);
        }
    }

    public byte[] download(String uuid) {
        String path = objectPath(uuid);
        String bucket = props.getSupabase().getBucket();
        String authenticatedUrl = storageBase() + "/object/authenticated/" + bucket + "/" + path;
        String legacyUrl = storageBase() + "/object/" + bucket + "/" + path;

        try {
            return downloadFromUrl(authenticatedUrl);
        } catch (Exception authenticatedError) {
            log.warn("Authenticated Supabase download failed for uuid {}: {}. Trying legacy object route.",
                    uuid, authenticatedError.getMessage());
            try {
                return downloadFromUrl(legacyUrl);
            } catch (Exception legacyError) {
                log.error("Supabase download failed for uuid {}: authenticated={}, legacy={}",
                        uuid, authenticatedError.getMessage(), legacyError.getMessage());
                throw new RuntimeException("Failed to download file from storage", legacyError);
            }
        }
    }

    private byte[] downloadFromUrl(String url) {
        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<Void>(authHeaders()),
                    byte[].class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Supabase download returned: " + response.getStatusCode());
            }

            return response.getBody();
        } catch (HttpStatusCodeException e) {
            throw new RuntimeException("Supabase download returned " + e.getStatusCode()
                    + " body=" + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new RuntimeException("Supabase download request failed: " + e.getMessage(), e);
        }
    }

    /**
     * Deletes an object from Supabase Storage.
     *
     * DELETE /storage/v1/object/{bucket}
     * Body: { "prefixes": ["uploads/{uuid}.zip"] }
     *
     * @param uuid the UUID of the object to delete
     */
    public void delete(String uuid) {
        String path = objectPath(uuid);
        String bucket = props.getSupabase().getBucket();
        String url = storageBase() + "/object/" + bucket;

        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of("prefixes", new String[]{ path });
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.DELETE, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Supabase delete returned: " + response.getStatusCode());
            }

            log.info("Deleted from Supabase Storage: bucket={}, path={}", bucket, path);
        } catch (Exception e) {
            log.error("Supabase delete failed for path {}: {}", path, e.getMessage());
            throw new RuntimeException("Failed to delete file from storage", e);
        }
    }
}
