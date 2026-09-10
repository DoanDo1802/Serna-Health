package vn.medicore.common.exception;

public class PatientScheduleConflictException extends RuntimeException {

    private final String code;

    public PatientScheduleConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
