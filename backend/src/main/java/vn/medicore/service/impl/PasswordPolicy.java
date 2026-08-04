package vn.medicore.service.impl;

import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public final class PasswordPolicy {

    private static final Set<String> COMMON_PASSWORDS = Set.of(
            "password1234",
            "123456789012",
            "qwertyuiop12",
            "letmein123456");

    public void validate(String password) {
        if (password == null || password.length() < 12 || password.length() > 128) {
            throw new IllegalArgumentException("Password must contain 12 to 128 characters");
        }
        if (COMMON_PASSWORDS.contains(password.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Password is too common");
        }
    }
}
