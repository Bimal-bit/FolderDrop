package dev.folderdrop.controller;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import dev.folderdrop.config.FolderDropProperties;
import dev.folderdrop.service.CleanupService;
import dev.folderdrop.service.OtpService;
import dev.folderdrop.service.OtpService.OtpEntry;
import dev.folderdrop.service.RateLimiterService;
import dev.folderdrop.service.StorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api")
@Tag(name = "Download", description = "OTP redemption and file download")
public class DownloadController {

    private static final Logger log = LoggerFactory.getLogger(DownloadController.class);
    private static final String OTP_PATTERN = "^\\d{6}$";

    private final OtpService otpService;
    private final StorageService storageService;
    private final CleanupService cleanupService;
    private final RateLimiterService rateLimiterService;
    private final FolderDropProperties props;

    public DownloadController(OtpService otpService,
                              StorageService storageService,
                              CleanupService cleanupService,
                              RateLimiterService rateLimiterService,
                              FolderDropProperties props) {
        this.otpService = otpService;
        this.storageService = storageService;
        this.cleanupService = cleanupService;
        this.rateLimiterService = rateLimiterService;
        this.props = props;
    }

    @GetMapping("/download/{otp}")
    @Operation(summary = "Redeem a 6-digit OTP and download the shared file")
    public ResponseEntity<?> download(
            @PathVariable String otp,
            HttpServletRequest request) {

        String clientIp = getClientIp(request);

        if (!rateLimiterService.tryAcquireDownload(clientIp)) {
            log.warn("Rate limit exceeded for download from IP: {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ErrorResponse("Too many attempts. Please wait before trying again."));
        }

        if (otp == null || !otp.matches(OTP_PATTERN)) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Invalid code format. Enter a 6-digit code."));
        }

        Optional<OtpEntry> entryOpt = otpService.lookup(otp);
        if (entryOpt.isEmpty()) {
            log.info("OTP not found or expired: otp={}, ip={}", otp, clientIp);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Invalid or expired code."));
        }

        OtpEntry entry = entryOpt.get();
        String uuid = entry.uuid();

        byte[] encryptedBytes;
        try {
            encryptedBytes = storageService.download(uuid);
        } catch (Exception e) {
            log.error("Failed to fetch file for uuid={}: {}", uuid, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to download file."));
        }

        int remaining = otpService.decrementAndMaybeDelete(otp, entry);

        log.info("Download: otp={}, uuid={}, remaining={}, ip={}", otp, uuid, remaining, clientIp);

        if (remaining == 0) {
            cleanupService.deleteAsync(uuid);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(encryptedBytes);
    }

    @GetMapping("/download/{otp}/encrypted")
    @Operation(summary = "Redeem a 6-digit OTP and return encrypted bytes for client-side decryption")
    public ResponseEntity<?> downloadEncrypted(
            @PathVariable String otp,
            HttpServletRequest request) {

        String clientIp = getClientIp(request);

        if (!rateLimiterService.tryAcquireDownload(clientIp)) {
            log.warn("Rate limit exceeded for download from IP: {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ErrorResponse("Too many attempts. Please wait before trying again."));
        }

        if (otp == null || !otp.matches(OTP_PATTERN)) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Invalid code format. Enter a 6-digit code."));
        }

        Optional<OtpEntry> entryOpt = otpService.lookup(otp);
        if (entryOpt.isEmpty()) {
            log.info("OTP not found or expired: otp={}, ip={}", otp, clientIp);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Invalid or expired code."));
        }

        OtpEntry entry = entryOpt.get();
        String uuid = entry.uuid();

        byte[] encryptedBytes;
        try {
            encryptedBytes = storageService.download(uuid);
        } catch (Exception e) {
            log.error("Failed to fetch encrypted file for uuid={}: {}", uuid, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to download encrypted file."));
        }

        int remaining = otpService.decrementAndMaybeDelete(otp, entry);

        if (remaining == 0) {
            cleanupService.deleteAsync(uuid);
        }

        log.info("DownloadEncrypted: otp={}, uuid={}, remaining={}, ip={}", otp, uuid, remaining, clientIp);

        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.APPLICATION_OCTET_STREAM);

        if (entry.decryptionKey() != null && !entry.decryptionKey().isBlank()) {
            response.header("X-FolderDrop-Key", entry.decryptionKey());
        }

        return response.body(encryptedBytes);
    }

    @GetMapping("/info/{otp}")
    @Operation(summary = "Get OTP metadata (remaining downloads) without consuming it")
    public ResponseEntity<?> info(@PathVariable String otp) {
        if (otp == null || !otp.matches(OTP_PATTERN)) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid code format."));
        }

        Optional<OtpEntry> entryOpt = otpService.lookup(otp);
        if (entryOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Invalid or expired code."));
        }

        OtpEntry e = entryOpt.get();
        return ResponseEntity.ok(new InfoResponse(e.maxDownloads(), e.remaining()));
    }

    @DeleteMapping("/file/{uuid}")
    @Operation(summary = "Internal: delete a storage object by UUID")
    public ResponseEntity<?> deleteFile(
            @PathVariable String uuid,
            @RequestHeader(value = "X-Internal-Token", required = false) String token) {

        if (token == null || !token.equals(props.getInternalToken())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse("Unauthorized."));
        }

        if (!uuid.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Invalid UUID format."));
        }

        try {
            storageService.delete(uuid);
            log.info("Internal cleanup: deleted uuid={}", uuid);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("Internal cleanup failed for uuid={}: {}", uuid, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse("Deletion failed."));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    public record ErrorResponse(String error) {}
    public record InfoResponse(int maxDownloads, int remaining) {}
}
