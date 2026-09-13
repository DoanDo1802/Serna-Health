package vn.medicore.controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.medicore.common.exception.InvalidCsrfException;
import vn.medicore.common.exception.ProblemResponseWriter;
import vn.medicore.dto.AuthenticatedAccount;
import vn.medicore.service.IdentityAccessService;

public final class SessionAuthenticationFilter extends OncePerRequestFilter {

    private final IdentityAccessService identityAccess;
    private final TabSessionContextResolver contexts;
    private final ProblemResponseWriter problems;

    public SessionAuthenticationFilter(
            IdentityAccessService identityAccess,
            TabSessionContextResolver contexts,
            ProblemResponseWriter problems) {
        this.identityAccess = identityAccess;
        this.contexts = contexts;
        this.problems = problems;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        TabSessionContextResolver.SessionContext session = contexts.resolve(request).orElse(null);
        boolean csrfRequired = isMutating(request.getMethod()) && !isPublicAuthEndpoint(request);
        String csrfHeader = request.getHeader("X-CSRF-Token");
        try {
            identityAccess.authenticateSession(
                    session == null ? null : session.sessionToken(),
                    session == null ? null : session.value(),
                    csrfHeader,
                    csrfRequired).ifPresent(account -> {
                List<SimpleGrantedAuthority> authorities = account.permissions().stream()
                        .map(SimpleGrantedAuthority::new).toList();
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(account, null, authorities));
            });
            chain.doFilter(request, response);
        } catch (InvalidCsrfException exception) {
            problems.write(request, response, HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access denied");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }


    private static boolean isMutating(String method) {
        return "POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method);
    }

    private static boolean isPublicAuthEndpoint(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri.startsWith("/api/v1/webhooks/payments/")) return true;
        return switch (uri) {
            case "/api/v1/auth/registrations",
                 "/api/v1/auth/email-verification-challenges",
                 "/api/v1/auth/email-verifications",
                 "/api/v1/auth/password-sessions",
                 "/api/v1/auth/otp-challenges",
                 "/api/v1/auth/otp-sessions",
                 "/api/v1/auth/password-recovery-challenges",
                 "/api/v1/auth/password-resets" -> true;
            default -> false;
        };
    }
}
