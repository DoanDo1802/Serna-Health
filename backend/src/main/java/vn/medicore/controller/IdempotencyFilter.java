package vn.medicore.controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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
            "POST /api/v1/auth/registrations", "POST /api/v1/auth/email-verifications",
            "DELETE /api/v1/auth/sessions", "POST /api/v1/auth/password-resets",
            "POST /api/v1/admin/accounts/{id}/actions/change-status", "POST /api/v1/admin/roles",
            "POST /api/v1/admin/accounts/{id}/role-assignments", "POST /api/v1/patients/{id}/break-glass-grants",
            "POST /api/v1/departments", "POST /api/v1/departments/{id}/rooms", "POST /api/v1/services",
            "POST /api/v1/services/{id}/prices", "POST /api/v1/practitioners", "POST /api/v1/practitioners/{id}/roles",
            "POST /api/v1/patients", "POST /api/v1/patients/{id}/identifiers", "POST /api/v1/patients/{id}/account-links",
            "POST /api/v1/appointment-slots", "POST /api/v1/appointment-slots/{id}/actions/cancel",
            "POST /api/v1/slot-holds", "DELETE /api/v1/slot-holds/{id}");

    private final IdempotencyServiceImpl idempotency;

    public IdempotencyFilter(IdempotencyServiceImpl idempotency) {
        this.idempotency = idempotency;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return operation(request) == null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        byte[] body = request.getInputStream().readAllBytes();
        String operation = operation(request);
        String key = request.getHeader("Idempotency-Key");
        if (key == null || !key.matches("^[A-Za-z0-9._-]{8,128}$")) {
            writeMissingKey(response);
            return;
        }
        Reservation reservation;
        try {
            reservation = idempotency.reserve(principalScope(request), operation, key, fingerprint(request, body));
        } catch (IdempotencyConflictException exception) {
            writeConflict(response);
            return;
        }
        if (reservation.replay()) {
            replay(response, reservation);
            return;
        }
        CapturingResponse captured = new CapturingResponse(response);
        try {
            chain.doFilter(new CachedBodyRequest(request, body), captured);
            captured.commit();
            if (captured.getStatus() < 400) {
                idempotency.complete(reservation.id(), captured.getStatus(), captured.body(), captured.contentType(),
                        captured.etag(), captured.location());
            } else {
                idempotency.fail(reservation.id(), captured.getStatus(), "HTTP_" + captured.getStatus());
            }
        } catch (RuntimeException | IOException | ServletException exception) {
            idempotency.fail(reservation.id(), 500, "INTERNAL_ERROR");
            throw exception;
        }
    }

    private static byte[] fingerprint(HttpServletRequest request, byte[] body) {
        String query = request.getQueryString() == null ? "" : request.getQueryString();
        byte[] prefix = ("v1\n" + request.getMethod() + "\n" + request.getRequestURI() + "\n" + query + "\n")
                .getBytes(StandardCharsets.UTF_8);
        return concat(prefix, body);
    }

    private static byte[] concat(byte[] left, byte[] right) {
        byte[] result = new byte[left.length + right.length];
        System.arraycopy(left, 0, result, 0, left.length);
        System.arraycopy(right, 0, result, left.length, right.length);
        return result;
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
        if (reservation.responseContentType() != null) response.setContentType(reservation.responseContentType());
        if (reservation.responseEtag() != null) response.setHeader("ETag", reservation.responseEtag());
        if (reservation.responseLocation() != null) response.setHeader("Location", reservation.responseLocation());
        if (reservation.responseBody() != null) response.getOutputStream().write(reservation.responseBody());
    }

    private static void writeMissingKey(HttpServletResponse response) throws IOException {
        response.setStatus(400);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.getWriter().write("{\"type\":\"https://medicore.vn/problems/idempotency-key-required\",\"title\":\"Idempotency key required\",\"status\":400,\"code\":\"IDEMPOTENCY_KEY_REQUIRED\"}");
    }

    private static void writeConflict(HttpServletResponse response) throws IOException {
        response.setStatus(409);
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.getWriter().write("{\"type\":\"https://medicore.vn/problems/idempotency-key-reused\",\"title\":\"Idempotency conflict\",\"status\":409,\"code\":\"IDEMPOTENCY_KEY_REUSED\"}");
    }

    private static final class CapturingResponse extends HttpServletResponseWrapper {
        private final ByteArrayOutputStream output = new ByteArrayOutputStream();
        private ServletOutputStreamAdapter stream;

        private CapturingResponse(HttpServletResponse response) { super(response); }

        @Override
        public jakarta.servlet.ServletOutputStream getOutputStream() {
            if (stream == null) stream = new ServletOutputStreamAdapter(output);
            return stream;
        }

        @Override
        public java.io.PrintWriter getWriter() {
            return new java.io.PrintWriter(new java.io.OutputStreamWriter(output, StandardCharsets.UTF_8), true);
        }

        byte[] body() { return output.toByteArray(); }
        String contentType() { return getContentType(); }
        String etag() { return getHeader("ETag"); }
        String location() { return getHeader("Location"); }
        void commit() throws IOException { getResponse().getOutputStream().write(body()); }
    }

    private static final class ServletOutputStreamAdapter extends jakarta.servlet.ServletOutputStream {
        private final ByteArrayOutputStream output;
        private ServletOutputStreamAdapter(ByteArrayOutputStream output) { this.output = output; }
        @Override public boolean isReady() { return true; }
        @Override public void setWriteListener(jakarta.servlet.WriteListener listener) { throw new UnsupportedOperationException(); }
        @Override public void write(int value) { output.write(value); }
    }

    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        private CachedBodyRequest(HttpServletRequest request, byte[] body) { super(request); this.body = body.clone(); }
        @Override public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                @Override public int read() { return input.read(); }
            };
        }
    }
}
