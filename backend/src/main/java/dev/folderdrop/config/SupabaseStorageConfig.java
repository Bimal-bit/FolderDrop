package dev.folderdrop.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Configuration for Supabase Storage.
 *
 * Supabase Storage uses a plain HTTPS REST API — no SDK needed.
 * All calls go to:
 *   https://<project-ref>.supabase.co/storage/v1/...
 * authenticated with the service role key as a Bearer token.
 */
@Configuration
public class SupabaseStorageConfig {

    /**
     * Shared RestTemplate for Supabase Storage REST calls.
     * StorageService injects this bean.
     */
    @Bean
    public RestTemplate storageRestTemplate() {
        return new RestTemplate();
    }
}
