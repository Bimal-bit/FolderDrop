package dev.folderdrop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.web.client.MockRestServiceServer;

import dev.folderdrop.config.FolderDropProperties;
import dev.folderdrop.service.StorageService;

class StorageServiceTest {

    @Test
    void downloadUsesAuthenticatedObjectRoute() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        StorageService storageService = new StorageService(restTemplate, props());
        String uuid = "550e8400-e29b-41d4-a716-446655440000";
        byte[] body = new byte[] { 1, 2, 3 };

        server.expect(requestTo("https://mock.supabase.co/storage/v1/object/authenticated/mock-bucket/uploads/" + uuid + ".zip"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("apikey", "mock-service-key"))
                .andExpect(header("Authorization", "Bearer mock-service-key"))
                .andRespond(withSuccess(body, org.springframework.http.MediaType.APPLICATION_OCTET_STREAM));

        assertThat(storageService.download(uuid)).isEqualTo(body);
        server.verify();
    }

    @Test
    void downloadDoesNotSendOpaqueSecretKeyAsBearerToken() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        FolderDropProperties props = props();
        props.getSupabase().setServiceKey("sb_secret_mock-secret");
        StorageService storageService = new StorageService(restTemplate, props);
        String uuid = "550e8400-e29b-41d4-a716-446655440000";
        byte[] body = new byte[] { 7, 8, 9 };

        server.expect(requestTo("https://mock.supabase.co/storage/v1/object/authenticated/mock-bucket/uploads/" + uuid + ".zip"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("apikey", "sb_secret_mock-secret"))
                .andExpect(headerDoesNotExist("Authorization"))
                .andRespond(withSuccess(body, org.springframework.http.MediaType.APPLICATION_OCTET_STREAM));

        assertThat(storageService.download(uuid)).isEqualTo(body);
        server.verify();
    }

    @Test
    void downloadFallsBackToLegacyObjectRoute() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        StorageService storageService = new StorageService(restTemplate, props());
        String uuid = "550e8400-e29b-41d4-a716-446655440000";
        byte[] body = new byte[] { 4, 5, 6 };

        server.expect(requestTo("https://mock.supabase.co/storage/v1/object/authenticated/mock-bucket/uploads/" + uuid + ".zip"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));
        server.expect(requestTo("https://mock.supabase.co/storage/v1/object/mock-bucket/uploads/" + uuid + ".zip"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(body, org.springframework.http.MediaType.APPLICATION_OCTET_STREAM));

        assertThat(storageService.download(uuid)).isEqualTo(body);
        server.verify();
    }

    private FolderDropProperties props() {
        FolderDropProperties props = new FolderDropProperties();
        props.getSupabase().setProjectUrl("https://mock.supabase.co");
        props.getSupabase().setServiceKey("mock-service-key");
        props.getSupabase().setBucket("mock-bucket");
        props.getUpstash().setUrl("https://mock.upstash.io");
        props.getUpstash().setToken("mock-token");
        props.setInternalToken("mock-internal-token");
        return props;
    }
}
