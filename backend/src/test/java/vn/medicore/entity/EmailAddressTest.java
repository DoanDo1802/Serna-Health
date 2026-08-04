package vn.medicore.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EmailAddressTest {

    @Test
    void trimsAndNormalizesWithLocaleIndependentLowercase() {
        EmailAddress email = EmailAddress.of("  User.Name@EXAMPLE.COM  ");

        assertThat(email.display()).isEqualTo("User.Name@EXAMPLE.COM");
        assertThat(email.normalized()).isEqualTo("user.name@example.com");
    }

    @Test
    void rejectsMalformedEmail() {
        assertThatThrownBy(() -> EmailAddress.of("not-an-email"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
