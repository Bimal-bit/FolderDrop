package dev.folderdrop.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Handles async cleanup of Supabase Storage objects after download.
 * The @Async annotation ensures deletion doesn't block the HTTP response.
 */
@Service
public class CleanupService {

    private static final Logger log = LoggerFactory.getLogger(CleanupService.class);

    private final StorageService storageService;

    public CleanupService(StorageService storageService) {
        this.storageService = storageService;
    }

    /**
     * Asynchronously deletes a Supabase Storage object after the download redirect has been issued.
     * Runs in a separate thread so the 302 response is not delayed.
     *
     * @param uuid the UUID of the storage object to delete
     */
    @Async
    public void deleteAsync(String uuid) {
        log.info("Async cleanup started for uuid={}", uuid);
        try {
            storageService.delete(uuid);
            log.info("Async cleanup completed for uuid={}", uuid);
        } catch (Exception e) {
            // Log but don't propagate — the download already succeeded.
            log.error("Async cleanup failed for uuid={}: {}", uuid, e.getMessage());
        }
    }
}
