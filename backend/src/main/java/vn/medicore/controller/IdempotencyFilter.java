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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.security.SecurityProperties;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.medicore.common.exception.ProblemResponseWriter;
import vn.medicore.common.web.RequestContext;
import vn.medicore.service.impl.IdempotencyServiceImpl;
import vn.medicore.service.impl.IdempotencyServiceImpl.IdempotencyConflictException;
import vn.medicore.service.impl.IdempotencyServiceImpl.Reservation;

@Component
@Order(SecurityProperties.DEFAULT_FILTER_ORDER + 1)
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final Set<String> IDEMPOTENT_OPERATIONS = Set.of(
            "POST /api/v1/auth/registrations", "POST /api/v1/auth/email-verifications",
            "DELETE /api/v1/auth/sessions", "POST /api/v1/auth/password-resets",
            "POST /api/v1/admin/accounts/{id}/actions/change-status", "POST /api/v1/admin/roles",
            "POST /api/v1/admin/accounts/{id}/role-assignments", "POST /api/v1/admin/personnel",
            "POST /api/v1/admin/personnel/{id}/actions/deactivate", "POST /api/v1/patients/{id}/break-glass-grants",
            "POST /api/v1/departments", "POST /api/v1/rooms", "POST /api/v1/services",
            "POST /api/v1/services/{id}/prices", "POST /api/v1/practitioners", "POST /api/v1/practitioners/{id}/roles",
            "POST /api/v1/patients", "POST /api/v1/patients/self", "POST /api/v1/patients/{id}/identifiers", "POST /api/v1/patients/{id}/account-links",
            "POST /api/v1/appointment-slots", "POST /api/v1/appointment-slots/{id}/actions/cancel",
            "POST /api/v1/admin/work-schedules", "POST /api/v1/admin/work-schedules/{id}/actions/cancel",
            "POST /api/v1/slot-holds", "DELETE /api/v1/slot-holds/{id}",
            "POST /api/v1/slot-holds/{id}/payment-intents", "POST /api/v1/mock-payment-intents/{id}/actions/simulate",
            "POST /api/v1/appointments/{id}/actions/reschedule-slot-holds",
            "POST /api/v1/appointments/{id}/actions/reschedule",
            "POST /api/v1/appointments/{id}/actions/reschedule-top-up",
            "POST /api/v1/appointments/{id}/actions/cancel",
            "POST /api/v1/appointments/{id}/check-ins",
            "POST /api/v1/visits/{id}/actions/complete",
            "POST /api/v1/encounters/{id}/actions/start",
            "POST /api/v1/encounters/{id}/actions/complete",
            "POST /api/v1/encounters/{id}/clinical-notes",
            "POST /api/v1/clinical-note-versions/{id}/actions/finalize",
            "POST /api/v1/clinical-note-versions/{id}/actions/amend");

    private final IdempotencyServiceImpl idempotency;
    private final TabSessionContextResolver contexts;
    private final ProblemResponseWriter problems;
    private final TransactionTemplate transactions;

    public IdempotencyFilter(
            IdempotencyServiceImpl idempotency,
            TabSessionContextResolver contexts,
            ProblemResponseWriter problems,
            TransactionTemplate transactions) {
        this.idempotency = idempotency;
        this.contexts = contexts;
        this.problems = problems;
        this.transactions = transactions;
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
            problems.write(request, response, org.springframework.http.HttpStatus.BAD_REQUEST,
                    "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required");
            return;
        }
        CapturingResponse[] capturedResponse = new CapturingResponse[1];
        try {
            CapturingResponse captured = transactions.execute(status -> {
                Reservation reservation;
                try {
                    reservation = idempotency.reserve(principalScope(request), operation, key, fingerprint(request, body));
                } catch (IdempotencyConflictException exception) {
                    status.setRollbackOnly();
                    throw new IdempotencyConflictFilterException();
                }
                if (reservation.replay()) {
                    restoreTraceContext(request, reservation);
                    replayUnchecked(request, response, reservation);
                    return null;
                }
                CapturingResponse pending = new CapturingResponse(response);
                try {
                    chain.doFilter(new CachedBodyRequest(request, body), pending);
                    if (status.isRollbackOnly()) {
                        capturedResponse[0] = pending;
                        return null;
                    }
                    int responseStatus = pending.getStatus();
                    idempotency.complete(
                            reservation.id(),
                            responseStatus,
                            pending.body(),
                            pending.contentType(),
                            pending.etag(),
                            pending.location(),
                            pending.replayHeaders(),
                            responseStatus < 400 ? null : "HTTP_" + responseStatus);
                    return pending;
                } catch (RuntimeException | IOException | ServletException exception) {
                    status.setRollbackOnly();
                    throw new FilterExecutionException(exception);
                }
            });
            if (captured != null) captured.commit();
            else if (capturedResponse[0] != null) capturedResponse[0].commit();
        } catch (UnexpectedRollbackException exception) {
            if (capturedResponse[0] != null) {
                capturedResponse[0].commit();
                return;
            }
            throw exception;
        } catch (IdempotencyConflictFilterException exception) {
            problems.write(request, response, org.springframework.http.HttpStatus.CONFLICT,
                    "IDEMPOTENCY_KEY_REUSED", "Idempotency conflict");
        } catch (FilterExecutionException exception) {
            rethrow(exception.getCause());
        }
    }

    private void writeProblem(
            HttpServletRequest request,
            HttpServletResponse response,
            org.springframework.http.HttpStatus status,
            String code,
            String title) {
        try {
            problems.write(request, response, status, code, title);
        } catch (IOException exception) {
            throw new FilterExecutionException(exception);
        }
    }

    private void replayUnchecked(HttpServletRequest request, HttpServletResponse response, Reservation reservation) {
        try {
            replay(request, response, reservation);
        } catch (IOException exception) {
            throw new FilterExecutionException(exception);
        }
    }

    private static void rethrow(Throwable exception) throws IOException, ServletException {
        if (exception instanceof IOException ioException) throw ioException;
        if (exception instanceof ServletException servletException) throw servletException;
        if (exception instanceof RuntimeException runtimeException) throw runtimeException;
        throw new ServletException(exception);
    }

    private static final class FilterExecutionException extends RuntimeException {
        private FilterExecutionException(Throwable cause) {
            super(cause);
        }
    }

    private static final class IdempotencyConflictFilterException extends RuntimeException {
    }

    private static byte[] fingerprint(HttpServletRequest request, byte[] body) {
        String query = request.getQueryString() == null ? "" : request.getQueryString();
        String ifMatch = request.getHeader("If-Match") == null ? "" : request.getHeader("If-Match");
        byte[] prefix = ("v1\n" + request.getMethod() + "\n" + request.getRequestURI() + "\n" + query + "\n"
                + ifMatch + "\n").getBytes(StandardCharsets.UTF_8);
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

    private String principalScope(HttpServletRequest request) {
        String session = contexts.resolve(request).map(TabSessionContextResolver.SessionContext::sessionToken).orElse(null);
        String value = session == null ? "ip:" + request.getRemoteAddr() : "session:" + session;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8))).substring(0, 64);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }


    private static void restoreTraceContext(HttpServletRequest request, Reservation reservation) {
        Map<String, List<String>> headers = reservation.responseHeaders();
        if (headers == null) return;
        String requestId = firstHeader(headers, RequestContext.REQUEST_ID_HEADER);
        String correlationId = firstHeader(headers, RequestContext.CORRELATION_ID_HEADER);
        if (requestId != null && correlationId != null) RequestContext.replace(request, requestId, correlationId);
    }

    private static String firstHeader(Map<String, List<String>> headers, String name) {
        return headers.entrySet().stream()
                .filter(entry -> entry.getKey().equalsIgnoreCase(name))
                .map(Map.Entry::getValue)
                .filter(values -> !values.isEmpty())
                .map(List::getFirst)
                .findFirst()
                .orElse(null);
    }

    private void replay(HttpServletRequest request, HttpServletResponse response, Reservation reservation) throws IOException {
        if ("IN_PROGRESS".equals(reservation.status())) {
            problems.write(request, response, org.springframework.http.HttpStatus.CONFLICT,
                    "IDEMPOTENCY_IN_PROGRESS", "Idempotency request is in progress");
            return;
        }
        response.setStatus(reservation.responseStatus() == null ? 200 : reservation.responseStatus());
        if (reservation.responseHeaders() != null) {
            reservation.responseHeaders().forEach((name, values) -> {
                if (values.isEmpty()) return;
                response.setHeader(name, values.getFirst());
                values.stream().skip(1).forEach(value -> response.addHeader(name, value));
            });
        }
        if (reservation.responseContentType() != null) response.setContentType(reservation.responseContentType());
        if (reservation.responseEtag() != null) response.setHeader("ETag", reservation.responseEtag());
        if (reservation.responseLocation() != null) response.setHeader("Location", reservation.responseLocation());
        if (reservation.responseBody() != null) response.getOutputStream().write(reservation.responseBody());
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
        Map<String, List<String>> replayHeaders() {
            Map<String, List<String>> headers = new LinkedHashMap<>();
            getHeaderNames().forEach(name -> {
                if (!name.equalsIgnoreCase("Content-Length")) {
                    headers.put(name, List.copyOf(getHeaders(name)));
                }
            });
            return Map.copyOf(headers);
        }
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
