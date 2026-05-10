package dev.folderdrop.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Validated
@ConfigurationProperties(prefix = "folderdrop")
public class FolderDropProperties {

    @Valid
    @NotNull
    private Upstash upstash = new Upstash();

    @Valid
    @NotNull
    private Supabase supabase = new Supabase();

    @Valid
    @NotNull
    private Otp otp = new Otp();

    @Valid
    @NotNull
    private Upload upload = new Upload();

    @NotBlank
    private String internalToken;

    @Data
    public static class Upstash {
        @NotBlank
        private String url;

        @NotBlank
        private String token;
    }

    /**
     * Supabase Storage configuration.
     *
     * projectUrl  — e.g. https://xyzxyzxyz.supabase.co
     * serviceKey  — service_role JWT from Project Settings → API
     * bucket      — the Storage bucket name (e.g. folderdrop-files)
     */
    @Data
    public static class Supabase {
        @NotBlank
        private String projectUrl;

        @NotBlank
        private String serviceKey;

        @NotBlank
        private String bucket;
    }

    @Data
    public static class Otp {
        @Min(60)
        private int ttlSeconds = 600;
    }

    @Data
    public static class Upload {
        @Min(1)
        private int maxSizeMb = 50;
    }
}
