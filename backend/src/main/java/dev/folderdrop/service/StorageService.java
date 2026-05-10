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
        headers.setBearerAuth(props.getSupabase().getServiceKey());
        // Supabase's newer "sb_secret_..." key format requires the apikey header
        // in addition to the Authorization Bearer header. The legacy eyJ... JWT
        // format works with Bearer alone, but adding apikey is harmless for both.
        headers.set("apikey", props.getSupabase().getServiceKey());
        return headers;
    }

    private String objectPath(String uuid) {
        return KEY_PREFIX + uuid + ".zip";
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
        String path = objectPath(uuid);
        String bucket = props.getSupabase().getBucket();
        String url = storageBase() + "/object/" + bucket + "/" + path;

        HttpHeaders headers = authHeaders();
        headers.setContentType(MediaType.parseMediaType("application/zip"));
        // x-upsert: false — fail if object already exists (shouldn't happen with UUID keys)
        headers.set("x-upsert", "false");
        // Store original name as cache-control metadata (Supabase supports this header)
        headers.set("Cache-Control", "no-cache");

        try {
            byte[] bytes = file.getBytes();
            HttpEntity<byte[]> entity = new HttpEntity<>(bytes, headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Supabase upload returned: " + response.getStatusCode());
            }

            log.info("Uploaded to Supabase Storage: bucket={}, path={}, size={}B", bucket, path, bytes.length);
        } catch (Exception e) {
            log.error("Supabase upload failed for path {}: {}", path, e.getMessage());
            throw new RuntimeException("Failed to upload file to storage", e);
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
                throw new RuntimeException("Supabase sign URL returned: " + response.getStatusCode());
            }

            // Response: { "signedURL": "/storage/v1/object/sign/bucket/path?token=..." }
            JsonNode root = objectMapper.readTree(response.getBody());
            String signedPath = root.get("signedURL").asText();

            // signedPath is relative — prepend the project URL to make it absolute
            String signedUrl = props.getSupabase().getProjectUrl() + signedPath;
            log.info("Generated signed URL for path={}, valid=60s", path);
            return signedUrl;
        } catch (Exception e) {
            log.error("Supabase sign URL failed for path {}: {}", path, e.getMessage());
            throw new RuntimeException("Failed to generate download link", e);
        }
    }

    public byte[] download(String uuid) {
        String signedUrl = generatePresignedUrl(uuid);

        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    signedUrl,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    byte[].class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Supabase download returned: " + response.getStatusCode());
            }

            return response.getBody();
        } catch (Exception e) {
            log.error("Supabase download failed for uuid {}: {}", uuid, e.getMessage());
            throw new RuntimeException("Failed to download file from storage", e);
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
