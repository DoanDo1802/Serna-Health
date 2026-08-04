package vn.medicore.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(InvalidAuthenticationException.class)
    ResponseEntity<ProblemDetail> authentication(InvalidAuthenticationException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, "AUTH_FAILED", "Authentication failed", request);
    }

    @ExceptionHandler({AccessDeniedException.class, InvalidCsrfException.class})
    ResponseEntity<ProblemDetail> forbidden(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access denied", request);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ProblemDetail> notFound(ResourceNotFoundException exception, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Resource not found", request);
    }

    @ExceptionHandler(StaleVersionException.class)
    ResponseEntity<ProblemDetail> stale(StaleVersionException exception, HttpServletRequest request) {
        return problem(HttpStatus.PRECONDITION_FAILED, "CONCURRENCY_STALE_VERSION", "ETag is stale", request);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    ResponseEntity<ProblemDetail> missingHeader(MissingRequestHeaderException exception, HttpServletRequest request) {
        if ("If-Match".equalsIgnoreCase(exception.getHeaderName())) {
            return problem(HttpStatus.PRECONDITION_REQUIRED, "CONCURRENCY_PRECONDITION_REQUIRED", "If-Match is required", request);
        }
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_HEADER_REQUIRED", "Required header is missing", request);
    }

    @ExceptionHandler(RateLimitException.class)
    ResponseEntity<ProblemDetail> rateLimit(RateLimitException exception, HttpServletRequest request) {
        ResponseEntity<ProblemDetail> response = problem(HttpStatus.TOO_MANY_REQUESTS, "AUTH_RATE_LIMITED", "Rate limit exceeded", request);
        response.getBody().setProperty("retryAfterSeconds", exception.retryAfterSeconds());
        return ResponseEntity.status(response.getStatusCode())
                .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfterSeconds()))
                .body(response.getBody());
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ProblemDetail> invalid(Exception exception, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_INVALID_REQUEST", "Invalid request", request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> conflict(DataIntegrityViolationException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "STATE_CONFLICT", "Domain state conflict", request);
    }

    private ResponseEntity<ProblemDetail> problem(HttpStatus status, String code, String title, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, title);
        detail.setType(URI.create("https://medicore.vn/problems/" + code.toLowerCase().replace('_', '-')));
        detail.setTitle(title);
        detail.setProperty("code", code);
        detail.setProperty("requestId", requestId(request));
        detail.setProperty("correlationId", request.getHeader("X-Correlation-Id"));
        return ResponseEntity.status(status).body(detail);
    }

    private String requestId(HttpServletRequest request) {
        String value = request.getHeader("X-Request-Id");
        return value == null || value.isBlank() ? UUID.randomUUID().toString() : value;
    }
}
