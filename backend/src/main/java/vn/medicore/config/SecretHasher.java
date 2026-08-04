package vn.medicore.config;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public final class SecretHasher {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private final SecretKeySpec key;
    private final SecureRandom secureRandom = new SecureRandom();

    public SecretHasher(AuthProperties properties) {
        key = new SecretKeySpec(
                properties.secretHashKey().getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }

    public String randomToken(int byteLength) {
        byte[] value = new byte[byteLength];
        secureRandom.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    public String hash(String purpose, String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(key);
            mac.update(purpose.getBytes(StandardCharsets.UTF_8));
            mac.update((byte) 0);
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
            throw new IllegalStateException("Cannot initialize secret hashing", exception);
        }
    }
}
