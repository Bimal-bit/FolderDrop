package dev.folderdrop.controller;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import dev.folderdrop.config.FolderDropProperties;
import dev.folderdrop.service.OtpService;
import dev.folderdrop.service.RateLimiterService;
import dev.folderdrop.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api")
@Tag(name = "Upload", description = "File upload and OTP generation")
public class UploadController {

    private static final Logger log = LoggerFactory.getLogger(UploadController.class);

    private final StorageService storageService;
    private final OtpService otpService;
    private final RateLimiterService rateLimiterService;
    private final FolderDropProperties props;

    public UploadController(StorageService storageService,
                            OtpService otpService,
                            RateLimiterService rateLimiterService,
                            FolderDropProperties props) {
        this.storageService = storageService;
        this.otpService = otpService;
        this.rateLimiterService = rateLimiterService;
        this.props = props;
    }

    /**
     * POST /api/upload
     *
     * Accepts a file (multipart/form-data, field name "file").
     * Optional param: maxDownloads (1–10, default 1)
     *
     * OTP generation (Upstash) and file upload (Supabase) run in parallel
     * to cut total latency roughly in half.
     *
     * Returns: { "otp": "482910", "expiresIn": 600, "maxDownloads": 3 }
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a file/folder ZIP and receive a 6-digit OTP")
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "key", required = false) String decryptionKey,
            @RequestParam(value = "maxDownloads", defaultValue = "1") int maxDownloads,
            HttpServletRequest request) {

        String clientIp = getClientIp(request);

        if (!rateLimiterService.tryAcquireUpload(clientIp)) {
            log.warn("Rate limit exceeded for upload from IP: {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ErrorResponse("Too many upload requests. Please wait before trying again."));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("No file provided."));
        }

        String contentType = file.getContentType();
        if (contentType == null || !isAcceptedContentType(contentType)) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Unsupported file type: " + contentType));
        }

        long maxBytes = (long) props.getUpload().getMaxSizeMb() * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(new ErrorResponse("File too large. Max size is " + props.getUpload().getMaxSizeMb() + " MB."));
        }

        int clampedMax = Math.max(1, Math.min(10, maxDownloads));
        String uuid = UUID.randomUUID().toString();
        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename().replaceAll("\\.(zip|fdenc)$", "")
                : "file";

        // Read bytes once — MultipartFile stream can only be read once
        byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (Exception e) {
            log.error("Failed to read upload bytes: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to read uploaded file."));
        }

        // Store OTP first, then upload file — sequential so a Supabase failure
        // returns an error to the user instead of giving them a code with no file
        String otp;
        try {
            otp = otpService.generateAndStore(uuid, clampedMax, decryptionKey);
        } catch (Exception e) {
            log.error("OTP store failed for uuid={}: {}", uuid, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to generate code. Please try again."));
        }

        try {
            storageService.uploadBytes(uuid, fileBytes, contentType);
        } catch (Exception e) {
            log.error("Supabase upload failed for uuid={}: {}", uuid, e.getMessage());
            // Clean up the OTP so the user doesn't get a code with no file
            otpService.delete(otp);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to store file. Please try again."));
        }

        log.info("Upload: uuid={}, otp={}, maxDownloads={}, ip={}, size={}B",
                uuid, otp, clampedMax, clientIp, fileBytes.length);

        return ResponseEntity.ok(new UploadResponse(otp, props.getOtp().getTtlSeconds(), clampedMax));
    }

    private boolean isAcceptedContentType(String ct) {
        return ct.equals("application/zip")
                || ct.equals("application/octet-stream")
                || ct.equals("application/x-zip-compressed")
                || ct.equals("application/pdf")
                || ct.startsWith("application/msword")
                || ct.startsWith("application/vnd.")
                || ct.startsWith("image/")
                || ct.startsWith("text/")
                || ct.startsWith("video/")
                || ct.startsWith("audio/");
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    public record UploadResponse(String otp, int expiresIn, int maxDownloads) {}
    public record ErrorResponse(String error) {}
}
