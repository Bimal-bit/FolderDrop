package dev.folderdrop;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import dev.folderdrop.service.OtpService.OtpEntry;

class OtpServiceTest {

    @Test
    void parseDecodesUpstashPathEncodedValue() {
        OtpEntry entry = OtpEntry.parse(
                "69f0cdd1-bdbd-457a-9fc0-9984d51b4b4f%7C1%7C1%7CGVs0TOPXRO71VaqA3_aek2V4y7lOCHlN90Yrjs_3nZE");

        assertThat(entry.uuid()).isEqualTo("69f0cdd1-bdbd-457a-9fc0-9984d51b4b4f");
        assertThat(entry.maxDownloads()).isEqualTo(1);
        assertThat(entry.remaining()).isEqualTo(1);
        assertThat(entry.decryptionKey()).isEqualTo("GVs0TOPXRO71VaqA3_aek2V4y7lOCHlN90Yrjs_3nZE");
    }
}
