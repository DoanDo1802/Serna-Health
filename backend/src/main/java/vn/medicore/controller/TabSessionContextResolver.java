package vn.medicore.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Enumeration;
import java.util.Optional;
import org.springframework.stereotype.Component;
import vn.medicore.config.AuthProperties;

@Component
public final class TabSessionContextResolver {

    public static final String HEADER = "X-MediCore-Tab-Context";
    private static final String CONTEXT_PATTERN = "^[A-Za-z0-9_-]{22}$";
    private final AuthProperties properties;

    public TabSessionContextResolver(AuthProperties properties) {
        this.properties = properties;
    }

    public Optional<SessionContext> resolve(HttpServletRequest request) {
        return contextValue(request).map(value -> new SessionContext(value, cookie(request, cookieName(value))));
    }

    public SessionContext require(HttpServletRequest request) {
        String value = contextValue(request)
                .orElseThrow(() -> new IllegalArgumentException("X-MediCore-Tab-Context is required"));
        return new SessionContext(value, cookie(request, cookieName(value)));
    }

    public String cookieName(String context) {
        if (context == null || !context.matches(CONTEXT_PATTERN)) {
            throw new IllegalArgumentException("X-MediCore-Tab-Context is invalid");
        }
        return properties.session().cookieNamePrefix() + context;
    }

    private static Optional<String> contextValue(HttpServletRequest request) {
        Enumeration<String> values = request.getHeaders(HEADER);
        if (values == null || !values.hasMoreElements()) return Optional.empty();
        String value = values.nextElement();
        if (values.hasMoreElements() || value == null || !value.matches(CONTEXT_PATTERN)) return Optional.empty();
        return Optional.of(value);
    }

    private static String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        String value = null;
        for (Cookie cookie : request.getCookies()) {
            if (!name.equals(cookie.getName())) continue;
            if (value != null) return null;
            value = cookie.getValue();
        }
        return value;
    }

    public record SessionContext(String value, String sessionToken) {
    }
}
