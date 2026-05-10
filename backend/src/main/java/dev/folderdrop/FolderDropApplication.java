package dev.folderdrop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

import dev.folderdrop.config.FolderDropProperties;

@SpringBootApplication
@EnableConfigurationProperties(FolderDropProperties.class)
@EnableAsync
public class FolderDropApplication {

    public static void main(String[] args) {
        SpringApplication.run(FolderDropApplication.class, args);
    }
}
