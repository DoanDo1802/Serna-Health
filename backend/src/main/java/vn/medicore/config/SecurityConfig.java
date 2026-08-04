package vn.medicore.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import vn.medicore.controller.SessionAuthenticationFilter;
import vn.medicore.service.IdentityAccessService;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            IdentityAccessService identityAccess,
            AuthProperties properties) throws Exception {
        return http
                .authorizeHttpRequests(authorize -> authorize
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
                                "/api/v1/auth/password-resets",
                                // Catalog read — public (patient-facing availability)
                                "GET /api/v1/departments",
                                "GET /api/v1/departments/*",
                                "GET /api/v1/rooms",
                                "GET /api/v1/rooms/*",
                                "GET /api/v1/services",
                                "GET /api/v1/services/*",
                                "GET /api/v1/services/*/prices",
                                "GET /api/v1/service-prices/*",
                                "GET /api/v1/practitioners",
                                "GET /api/v1/practitioners/*",
                                "GET /api/v1/practitioner-roles",
                                "GET /api/v1/practitioner-roles/*")
                        .permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors.authenticationEntryPoint(
                        (request, response, exception) -> response.sendError(HttpStatus.UNAUTHORIZED.value())))
                .addFilterBefore(new SessionAuthenticationFilter(identityAccess, properties), AnonymousAuthenticationFilter.class)
                .httpBasic(httpBasic -> httpBasic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
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
