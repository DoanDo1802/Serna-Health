package vn.medicore.service;

public interface AuthenticationDeliveryService {

    void sendEmailVerificationCode(String displayEmail, String code);

    void sendEmailVerificationToken(String displayEmail, String token);

    void sendLoginCode(String displayEmail, String code);

    void sendPasswordResetToken(String displayEmail, String token);
}
