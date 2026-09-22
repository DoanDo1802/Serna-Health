package vn.medicore.config;

import java.time.Clock;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import vn.medicore.common.exception.ProblemResponseWriter;
import vn.medicore.controller.SessionAuthenticationFilter;
import vn.medicore.controller.TabSessionContextResolver;
import vn.medicore.service.IdentityAccessService;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            IdentityAccessService identityAccess,
            TabSessionContextResolver tabSessionContexts,
            ProblemResponseWriter problems,
            @Value("${medicore.web.cors.allowed-origins}") List<String> corsAllowedOrigins) throws Exception {
        return http
                .authorizeHttpRequests(authorize -> authorize
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR, jakarta.servlet.DispatcherType.FORWARD).permitAll()
                        // Auth public endpoints (method-agnostic — POST only in practice)
                        .requestMatchers(
                                "/error",
                                "/actuator/health",
                                "/api/v1/medicore.openapi.yaml",
                                "/api/v1/swagger-ui/**",
                                "/api/v1/auth/registrations",
                                "/api/v1/auth/email-verification-challenges",
                                "/api/v1/auth/email-verifications",
                                "/api/v1/auth/password-sessions",
                                "/api/v1/auth/otp-challenges",
                                "/api/v1/auth/otp-sessions",
                                "/api/v1/auth/password-recovery-challenges",
                                "/api/v1/auth/password-resets")
                        .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/payments/*")
                        .permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                problems.write(request, response, HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "Authentication required"))
                        .accessDeniedHandler((request, response, exception) ->
                                problems.write(request, response, HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access denied")))
                .addFilterBefore(new SessionAuthenticationFilter(identityAccess, tabSessionContexts, problems), AnonymousAuthenticationFilter.class)
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .cors(cors -> cors.configurationSource(request -> {
                    var config = new org.springframework.web.cors.CorsConfiguration();
                    config.setAllowedOrigins(corsAllowedOrigins);
                    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                    config.setAllowedHeaders(List.of("*"));
                    config.setExposedHeaders(List.of("X-CSRF-Token", "ETag", "X-Request-Id", "X-Correlation-Id"));
                    config.setAllowCredentials(true);
                    return config;
                }))
                .csrf(csrf -> csrf.disable())
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
