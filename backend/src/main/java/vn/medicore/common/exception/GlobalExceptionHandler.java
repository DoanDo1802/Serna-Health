package vn.medicore.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import vn.medicore.common.web.RequestContext;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

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

    @ExceptionHandler(RescheduleFundingException.class)
    ResponseEntity<ProblemDetail> rescheduleFunding(RescheduleFundingException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, exception.code(), "Reschedule funding conflict", request);
    }

    @ExceptionHandler(RescheduleEligibilityException.class)
    ResponseEntity<ProblemDetail> rescheduleEligibility(RescheduleEligibilityException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, exception.code(), exception.getMessage(), request);
    }

    @ExceptionHandler(AppointmentCancellationException.class)
    ResponseEntity<ProblemDetail> appointmentCancellation(AppointmentCancellationException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, exception.code(), exception.getMessage(), request);
    }

    @ExceptionHandler(PatientScheduleConflictException.class)
    ResponseEntity<ProblemDetail> patientScheduleConflict(PatientScheduleConflictException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, exception.code(), exception.getMessage(), request);
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
                .header(RequestContext.REQUEST_ID_HEADER, RequestContext.requestId(request))
                .header(RequestContext.CORRELATION_ID_HEADER, RequestContext.correlationId(request))
                .body(response.getBody());
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ProblemDetail> invalid(Exception exception, HttpServletRequest request) {
        String detail = exception instanceof IllegalArgumentException && exception.getMessage() != null 
                ? exception.getMessage() 
                : "Invalid request";
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_INVALID_REQUEST", detail, request);
    }

    @ExceptionHandler({DataIntegrityViolationException.class, IllegalStateException.class})
    ResponseEntity<ProblemDetail> conflict(RuntimeException exception, HttpServletRequest request) {
        log.warn("Conflict error on {} {}: {}", request.getMethod(), request.getRequestURI(), exception.getMessage(), exception);
        String detail = exception.getMessage() != null && !exception.getMessage().isBlank()
                ? exception.getMessage()
                : "Domain state conflict";
        return problem(HttpStatus.CONFLICT, "STATE_CONFLICT", "Domain state conflict", detail, request);
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> messageNotReadable(org.springframework.http.converter.HttpMessageNotReadableException exception, HttpServletRequest request) {
        log.warn("Malformed JSON body on {} {}: {}", request.getMethod(), request.getRequestURI(), exception.getMessage());
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_INVALID_REQUEST", "Malformed JSON request body", request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> internal(Exception exception, HttpServletRequest request) {
        log.error("Unhandled error on {} {}: {}", request.getMethod(), request.getRequestURI(), exception.getMessage(), exception);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error", request);
    }

    private ResponseEntity<ProblemDetail> problem(HttpStatus status, String code, String title, HttpServletRequest request) {
        return problem(status, code, title, title, request);
    }

    private ResponseEntity<ProblemDetail> problem(HttpStatus status, String code, String title, String detailMessage, HttpServletRequest request) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, detailMessage);
        detail.setType(URI.create("https://medicore.vn/problems/" + code.toLowerCase().replace('_', '-')));
        detail.setTitle(title);
        detail.setProperty("code", code);
        String requestId = RequestContext.requestId(request);
        String correlationId = RequestContext.correlationId(request);
        detail.setProperty("requestId", requestId);
        detail.setProperty("correlationId", correlationId);
        return ResponseEntity.status(status)
                .header(RequestContext.REQUEST_ID_HEADER, requestId)
                .header(RequestContext.CORRELATION_ID_HEADER, correlationId)
                .body(detail);
    }
}
