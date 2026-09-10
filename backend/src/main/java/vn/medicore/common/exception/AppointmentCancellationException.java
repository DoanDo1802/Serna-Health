package vn.medicore.common.exception;

public class AppointmentCancellationException extends RuntimeException {

    private final String code;

    public AppointmentCancellationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
