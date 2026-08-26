package vn.medicore.config;

import java.time.Clock;
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
import vn.medicore.service.IdentityAccessService;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            IdentityAccessService identityAccess,
            AuthProperties properties,
            ProblemResponseWriter problems) throws Exception {
        return http
                .authorizeHttpRequests(authorize -> authorize
                        // Auth public endpoints (method-agnostic — POST only in practice)
                        .requestMatchers(
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
                        .requestMatchers(HttpMethod.GET, "/api/v1/appointment-slots", "/api/v1/appointment-slots/*")
                        .permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/webhooks/payments/*")
                        .permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                problems.write(request, response, HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED", "Authentication required"))
                        .accessDeniedHandler((request, response, exception) ->
                                problems.write(request, response, HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access denied")))
                .addFilterBefore(new SessionAuthenticationFilter(identityAccess, properties, problems), AnonymousAuthenticationFilter.class)
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .cors(cors -> cors.configurationSource(request -> {
                    var config = new org.springframework.web.cors.CorsConfiguration();
                    config.setAllowedOriginPatterns(java.util.List.of("http://localhost:3000", "http://127.0.0.1:3000", "https://*.medicore.vn"));
                    config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                    config.setAllowedHeaders(java.util.List.of("*"));
                    config.setExposedHeaders(java.util.List.of("X-CSRF-Token", "ETag", "Set-Cookie"));
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
