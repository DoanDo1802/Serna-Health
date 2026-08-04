package vn.medicore.entity;

import java.util.Locale;
import java.util.regex.Pattern;

public record EmailAddress(String display, String normalized) {

    private static final Pattern SIMPLE_EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public EmailAddress {
        if (display == null) {
            throw new IllegalArgumentException("Email is required");
        }
        display = display.trim();
        normalized = display.toLowerCase(Locale.ROOT);
        if (display.length() > 320 || !SIMPLE_EMAIL.matcher(display).matches()) {
            throw new IllegalArgumentException("Email is invalid");
        }
    }

    public static EmailAddress of(String value) {
        return new EmailAddress(value, value);
    }
}
