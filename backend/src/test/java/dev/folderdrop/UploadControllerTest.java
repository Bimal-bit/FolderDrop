package dev.folderdrop;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import dev.folderdrop.service.OtpService;
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
class UploadControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OtpService otpService;

    @MockBean
    private StorageService storageService;

    @MockBean
    private RateLimiterService rateLimiterService;

    @Test
    void uploadValidZip_returns200WithOtp() throws Exception {
        when(rateLimiterService.tryAcquireUpload(anyString())).thenReturn(true);
        when(otpService.generateAndStore(anyString(), org.mockito.ArgumentMatchers.anyInt())).thenReturn("123456");
        doNothing().when(storageService).upload(anyString(), any(), anyString(), anyString());

        MockMultipartFile file = new MockMultipartFile(
                "file", "myfolder.zip", "application/zip", new byte[1024]);

        mockMvc.perform(multipart("/api/upload").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.otp").value("123456"))
                .andExpect(jsonPath("$.expiresIn").value(600));
    }

    @Test
    void uploadEmptyFile_returns400() throws Exception {
        when(rateLimiterService.tryAcquireUpload(anyString())).thenReturn(true);

        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.zip", "application/zip", new byte[0]);

        mockMvc.perform(multipart("/api/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void uploadWrongContentType_returns400() throws Exception {
        when(rateLimiterService.tryAcquireUpload(anyString())).thenReturn(true);

        MockMultipartFile file = new MockMultipartFile(
                "file", "program.exe", "application/x-msdownload", new byte[1024]);

        mockMvc.perform(multipart("/api/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }
}
