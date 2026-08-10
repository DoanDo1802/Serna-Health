package vn.medicore.service.impl;

import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public final class PasswordPolicy {

    // Versioned offline denylist. Keep this local so password plaintext never leaves process.
    private static final String DENYLIST_VERSION = "r1-2026-08";
    private static final Set<String> COMMON_PASSWORDS = Set.of(
            "password1234", "password12345", "password123456", "123456789012", "1234567890123",
            "qwertyuiop12", "qwertyuiop123", "letmein123456", "welcome123456", "admin1234567",
            "changeme1234", "iloveyou12345", "monkey1234567", "football12345", "dragon1234567",
            "abc123abc123", "passwordpassword", "medicore12345", "vietname12345", "thanhpho12345");

    public String denylistVersion() {
        return DENYLIST_VERSION;
    }

    public void validate(String password) {
        if (password == null || password.length() < 12 || password.length() > 128) {
            throw new IllegalArgumentException("Password must contain 12 to 128 characters");
        }
        if (COMMON_PASSWORDS.contains(password.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Password is too common");
        }
    }
}
