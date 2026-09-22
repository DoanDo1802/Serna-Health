package vn.medicore.controller;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.medicore.common.exception.ProblemResponseWriter;
import vn.medicore.common.web.RequestContext;

@Component("medicoreTraceContextFilter")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestContextFilter extends OncePerRequestFilter {

    private final ProblemResponseWriter problems;

    public RequestContextFilter(ProblemResponseWriter problems) {
        this.problems = problems;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String requestId = RequestContext.resolve(request.getHeader(RequestContext.REQUEST_ID_HEADER));
            String correlationId = RequestContext.resolve(request.getHeader(RequestContext.CORRELATION_ID_HEADER));
            request.setAttribute(RequestContext.REQUEST_ID_ATTRIBUTE, requestId);
            request.setAttribute(RequestContext.CORRELATION_ID_ATTRIBUTE, correlationId);
            response.setHeader(RequestContext.REQUEST_ID_HEADER, requestId);
            response.setHeader(RequestContext.CORRELATION_ID_HEADER, correlationId);
            chain.doFilter(request, response);
        } catch (IllegalArgumentException exception) {
            request.setAttribute(RequestContext.REQUEST_ID_ATTRIBUTE, java.util.UUID.randomUUID().toString());
            request.setAttribute(RequestContext.CORRELATION_ID_ATTRIBUTE, java.util.UUID.randomUUID().toString());
            problems.write(request, response, HttpStatus.BAD_REQUEST, "VALIDATION_INVALID_REQUEST", "Invalid request");
        } finally {
            response.setHeader(RequestContext.REQUEST_ID_HEADER, RequestContext.requestId(request));
            response.setHeader(RequestContext.CORRELATION_ID_HEADER, RequestContext.correlationId(request));
        }
    }
}
