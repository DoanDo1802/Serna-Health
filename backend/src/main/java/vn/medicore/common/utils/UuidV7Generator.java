package vn.medicore.common.utils;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public final class UuidV7Generator {

    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public UuidV7Generator(Clock clock) {
        this.clock = clock;
    }

    public UUID next() {
        long timestamp = clock.millis() & 0x0000FFFFFFFFFFFFL;
        long mostSignificant = (timestamp << 16) | 0x7000L | random.nextInt(0x1000);
        long leastSignificant = 0x8000000000000000L | (random.nextLong() & 0x3FFFFFFFFFFFFFFFL);
        return new UUID(mostSignificant, leastSignificant);
    }
}
