package vn.medicore.common.exception;

public class RescheduleEligibilityException extends RuntimeException {

    private final String code;

    public RescheduleEligibilityException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
