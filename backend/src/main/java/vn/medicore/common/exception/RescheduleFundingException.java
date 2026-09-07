package vn.medicore.common.exception;

public class RescheduleFundingException extends RuntimeException {

    private final String code;

    public RescheduleFundingException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
