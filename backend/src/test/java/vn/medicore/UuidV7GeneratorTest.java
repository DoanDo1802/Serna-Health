package vn.medicore;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import vn.medicore.common.utils.UuidV7Generator;

class UuidV7GeneratorTest {

    @Test
    void producesVersionSevenRfcVariantIds() {
        UuidV7Generator generator = new UuidV7Generator(
                Clock.fixed(Instant.parse("2026-08-04T00:00:00Z"), ZoneOffset.UTC));

        var id = generator.next();

        assertThat(id.version()).isEqualTo(7);
        assertThat(id.variant()).isEqualTo(2);
        assertThat(id.getMostSignificantBits() >>> 16)
                .isEqualTo(Instant.parse("2026-08-04T00:00:00Z").toEpochMilli());
    }
}
