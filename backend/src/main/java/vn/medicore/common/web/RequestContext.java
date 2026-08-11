package vn.medicore.common.web;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

public final class RequestContext {

    public static final String REQUEST_ID_ATTRIBUTE = RequestContext.class.getName() + ".requestId";
    public static final String CORRELATION_ID_ATTRIBUTE = RequestContext.class.getName() + ".correlationId";
    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final int MAX_ID_LENGTH = 128;

    private RequestContext() {
    }

    public static String requestId(HttpServletRequest request) {
        return value(request, REQUEST_ID_ATTRIBUTE, REQUEST_ID_HEADER);
    }

    public static String correlationId(HttpServletRequest request) {
        return value(request, CORRELATION_ID_ATTRIBUTE, CORRELATION_ID_HEADER);
    }

    public static String resolve(String value) {
        if (value == null || value.isBlank()) return UUID.randomUUID().toString();
        if (value.length() > MAX_ID_LENGTH) throw new IllegalArgumentException("Trace identifier is invalid");
        return value;
    }

    public static void replace(HttpServletRequest request, String requestId, String correlationId) {
        request.setAttribute(REQUEST_ID_ATTRIBUTE, resolve(requestId));
        request.setAttribute(CORRELATION_ID_ATTRIBUTE, resolve(correlationId));
    }

    private static String value(HttpServletRequest request, String attribute, String header) {
        Object value = request.getAttribute(attribute);
        if (value instanceof String id) return id;
        String id = resolve(request.getHeader(header));
        request.setAttribute(attribute, id);
        return id;
    }
}
