package vn.medicore.controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.medicore.service.impl.IdempotencyServiceImpl;
import vn.medicore.service.impl.IdempotencyServiceImpl.IdempotencyConflictException;
import vn.medicore.service.impl.IdempotencyServiceImpl.Reservation;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final Set<String> IDEMPOTENT_OPERATIONS = Set.of(
            "POST /api/v1/auth/registrations",
            "POST /api/v1/auth/email-verifications",
            "DELETE /api/v1/auth/sessions",
            "POST /api/v1/auth/password-resets",
            "POST /api/v1/admin/accounts/{id}/actions/change-status",
            "POST /api/v1/admin/roles",
            "POST /api/v1/admin/accounts/{id}/role-assignments",
            "POST /api/v1/patients/{id}/break-glass-grants");

    private final IdempotencyServiceImpl idempotency;

    public IdempotencyFilter(IdempotencyServiceImpl idempotency) {
        this.idempotency = idempotency;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getHeader("Idempotency-Key") == null || operation(request) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        byte[] body = request.getInputStream().readAllBytes();
        String operation = operation(request);
        String key = request.getHeader("Idempotency-Key");
        String principalScope = principalScope(request);
        Reservation reservation;
        try {
            reservation = idempotency.reserve(principalScope, operation, key, body);
        } catch (IdempotencyConflictException exception) {
            writeConflict(response);
            return;
        }
        if (reservation.replay()) {
            replay(response, reservation);
            return;
        }
        try {
            chain.doFilter(new CachedBodyRequest(request, body), response);
            if (response.getStatus() < 400) {
                idempotency.complete(reservation.id(), response.getStatus(), null);
            } else {
                idempotency.fail(reservation.id(), response.getStatus(), "HTTP_" + response.getStatus());
            }
        } catch (RuntimeException | IOException | ServletException exception) {
            idempotency.fail(reservation.id(), 500, "INTERNAL_ERROR");
            throw exception;
        }
    }

    private static String operation(HttpServletRequest request) {
        String normalizedPath = request.getRequestURI().replaceAll(
                "/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=/|$)", "/{id}");
        String operation = request.getMethod() + " " + normalizedPath;
        return IDEMPOTENT_OPERATIONS.contains(operation) ? operation : null;
    }

    private static String principalScope(HttpServletRequest request) {
        String session = cookie(request, "MEDICORE_SESSION");
        String value = session == null ? "ip:" + request.getRemoteAddr() : "session:" + session;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8))).substring(0, 64);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) if (name.equals(cookie.getName())) return cookie.getValue();
        return null;
    }

    private static void replay(HttpServletResponse response, Reservation reservation) throws IOException {
        if ("IN_PROGRESS".equals(reservation.status())) {
            response.setStatus(409);
            return;
        }
        response.setStatus(reservation.responseStatus() == null ? 200 : reservation.responseStatus());
        if (response.getStatus() == 202) {
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"accepted\":true,\"requestId\":\"idempotent-replay\"}");
        }
    }

    private static void writeConflict(HttpServletResponse response) throws IOException {
        response.setStatus(409);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.getWriter().write("""
                {"type":"https://medicore.vn/problems/idempotency-key-reused","title":"Idempotency conflict","status":409,"code":"IDEMPOTENCY_KEY_REUSED","requestId":"idempotency-filter"}
                """);
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        private CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body.clone();
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                    throw new UnsupportedOperationException();
                }

                @Override
                public int read() {
                    return input.read();
                }
            };
        }
    }
}
