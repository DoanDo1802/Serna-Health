package vn.medicore.common.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import vn.medicore.common.web.RequestContext;

@Component
public class ProblemResponseWriter {

    private final ObjectMapper objectMapper;

    public ProblemResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String code, String title)
            throws IOException {
        String requestId = RequestContext.requestId(request);
        String correlationId = RequestContext.correlationId(request);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader(RequestContext.REQUEST_ID_HEADER, requestId);
        response.setHeader(RequestContext.CORRELATION_ID_HEADER, correlationId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "https://medicore.vn/problems/" + code.toLowerCase().replace('_', '-'));
        body.put("title", title);
        body.put("status", status.value());
        body.put("detail", title);
        body.put("code", code);
        body.put("requestId", requestId);
        body.put("correlationId", correlationId);
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
