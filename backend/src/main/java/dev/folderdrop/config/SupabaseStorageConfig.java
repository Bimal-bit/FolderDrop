package dev.folderdrop.config;

import java.util.concurrent.TimeUnit;

import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Configures a high-performance RestTemplate for Supabase Storage calls.
 *
 * Uses Apache HttpClient 5 with:
 * - Connection pooling (reuse TLS connections across requests)
 * - Explicit connect / response timeouts
 * - Larger buffer sizes for large file uploads
 */
@Configuration
public class SupabaseStorageConfig {

    @Bean
    public RestTemplate storageRestTemplate() {
        // Connection pool — reuse TLS sessions across upload/sign/delete calls
        PoolingHttpClientConnectionManager cm = new PoolingHttpClientConnectionManager();
        cm.setMaxTotal(20);
        cm.setDefaultMaxPerRoute(10);

        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(10, TimeUnit.SECONDS)
                .setResponseTimeout(300, TimeUnit.SECONDS)   // 5 min for large uploads
                .setConnectionRequestTimeout(10, TimeUnit.SECONDS)
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(cm)
                .setDefaultRequestConfig(requestConfig)
                .disableRedirectHandling()   // we handle redirects explicitly
                .build();

        HttpComponentsClientHttpRequestFactory factory =
                new HttpComponentsClientHttpRequestFactory(httpClient);
        factory.setBufferRequestBody(false);  // stream request body — don't buffer in memory

        return new RestTemplate(factory);
    }
}
