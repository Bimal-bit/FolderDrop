package dev.folderdrop;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import dev.folderdrop.service.CleanupService;
import dev.folderdrop.service.OtpService;
import dev.folderdrop.service.OtpService.OtpEntry;
import dev.folderdrop.service.RateLimiterService;
import dev.folderdrop.service.StorageService;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "folderdrop.upstash.url=https://mock.upstash.io",
    "folderdrop.upstash.token=mock-token",
    "folderdrop.supabase.project-url=https://mock.supabase.co",
    "folderdrop.supabase.service-key=mock-service-key",
    "folderdrop.supabase.bucket=mock-bucket",
    "folderdrop.internal-token=mock-internal-token"
})
class DownloadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OtpService otpService;

    @MockBean
    private StorageService storageService;

    @MockBean
    private CleanupService cleanupService;

    @MockBean
    private RateLimiterService rateLimiterService;

    @Test
    void validOtp_returns302Redirect() throws Exception {
        when(rateLimiterService.tryAcquireDownload(anyString())).thenReturn(true);

        String uuid = "550e8400-e29b-41d4-a716-446655440000";
        OtpEntry entry = new OtpEntry(uuid, 1, 1);
        when(otpService.lookup("123456")).thenReturn(Optional.of(entry));
        when(otpService.decrementAndMaybeDelete("123456", entry)).thenReturn(0);
        when(storageService.generatePresignedUrl(uuid))
                .thenReturn("https://mock.supabase.co/storage/v1/object/sign/mock-bucket/uploads/" + uuid + ".zip?token=abc");
        doNothing().when(cleanupService).deleteAsync(uuid);

        mockMvc.perform(get("/api/download/123456"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "https://mock.supabase.co/storage/v1/object/sign/mock-bucket/uploads/" + uuid + ".zip?token=abc"));

        // Verify burn-after-download: decrementAndMaybeDelete was called
        verify(otpService).decrementAndMaybeDelete(eq("123456"), any(OtpEntry.class));
    }

    @Test
    void expiredOtp_returns404() throws Exception {
        when(rateLimiterService.tryAcquireDownload(anyString())).thenReturn(true);
        when(otpService.lookup("999999")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/download/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());

        // Verify decrementAndMaybeDelete was NOT called for missing OTP
        verify(otpService, never()).decrementAndMaybeDelete(anyString(), any());
    }

    @Test
    void invalidOtpFormat_returns400() throws Exception {
        when(rateLimiterService.tryAcquireDownload(anyString())).thenReturn(true);

        mockMvc.perform(get("/api/download/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void invalidOtpTooShort_returns400() throws Exception {
        when(rateLimiterService.tryAcquireDownload(anyString())).thenReturn(true);

        mockMvc.perform(get("/api/download/12345"))
                .andExpect(status().isBadRequest());
    }
}
