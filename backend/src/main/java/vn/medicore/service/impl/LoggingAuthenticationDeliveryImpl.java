package vn.medicore.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import vn.medicore.service.AuthenticationDeliveryService;

@Component
@Profile("local | test")
public class LoggingAuthenticationDeliveryImpl implements AuthenticationDeliveryService {

    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingAuthenticationDeliveryImpl.class);

    @Override
    public void sendEmailVerificationCode(String displayEmail, String code) {
        LOGGER.info("Email verification challenge queued for local recipient hash={}", Integer.toHexString(displayEmail.hashCode()));
    }

    @Override
    public void sendEmailVerificationToken(String displayEmail, String token) {
        LOGGER.info("Email verification token queued for local recipient hash={}", Integer.toHexString(displayEmail.hashCode()));
    }

    @Override
    public void sendLoginCode(String displayEmail, String code) {
        LOGGER.info("Login challenge queued for local recipient hash={}", Integer.toHexString(displayEmail.hashCode()));
    }

    @Override
    public void sendPasswordResetToken(String displayEmail, String token) {
        LOGGER.info("Password reset queued for local recipient hash={}", Integer.toHexString(displayEmail.hashCode()));
    }
}
