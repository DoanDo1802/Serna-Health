package vn.medicore.controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.medicore.config.AuthProperties;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.service.IdentityAccessService;

public final class SessionAuthenticationFilter extends OncePerRequestFilter {

    private final IdentityAccessService identityAccess;
    private final AuthProperties properties;

    public SessionAuthenticationFilter(IdentityAccessService identityAccess, AuthProperties properties) {
        this.identityAccess = identityAccess;
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = cookie(request, properties.session().cookieName());
        boolean mutateMethod = isMutating(request.getMethod());
        String csrfHeader = request.getHeader("X-CSRF-Token");
        identityAccess.authenticateSession(token, csrfHeader, mutateMethod).ifPresent(account -> {
            List<SimpleGrantedAuthority> authorities = account.permissions().stream()
                    .map(SimpleGrantedAuthority::new).toList();
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(account, null, authorities));
        });
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private static String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    private static boolean isMutating(String method) {
        return "POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method);
    }
}
