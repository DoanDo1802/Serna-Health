package vn.medicore.service.impl;

import org.springframework.context.annotation.Profile;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import vn.medicore.service.AuthenticationDeliveryService;

@Component
@Profile("!local & !test")
public class SmtpAuthenticationDeliveryImpl implements AuthenticationDeliveryService {

    private final JavaMailSender mailSender;

    public SmtpAuthenticationDeliveryImpl(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public void sendEmailVerificationCode(String displayEmail, String code) {
        send(displayEmail, "Verify your MediCore email", "Your verification code is: " + code);
    }

    @Override
    public void sendEmailVerificationToken(String displayEmail, String token) {
        send(displayEmail, "Verify your MediCore email", "Your one-time verification token is: " + token);
    }

    @Override
    public void sendLoginCode(String displayEmail, String code) {
        send(displayEmail, "Your MediCore login code", "Your login code is: " + code);
    }

    @Override
    public void sendPasswordResetToken(String displayEmail, String token) {
        send(displayEmail, "Reset your MediCore password", "Your one-time reset token is: " + token);
    }

    private void send(String recipient, String subject, String content) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText(content);
        mailSender.send(message);
    }
}
