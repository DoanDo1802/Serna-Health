package vn.medicore.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import vn.medicore.MediCoreApplication;

class ModularityTest {

    private static final Set<String> EXPECTED_MODULES = Set.of(
            "identityaccess",
            "catalog",
            "patient",
            "scheduling",
            "receptionqueue",
            "clinicalcare",
            "diagnostics",
            "billingpayment",
            "notification",
            "platformaudit");

    private final ApplicationModules modules = ApplicationModules.of(MediCoreApplication.class);

    @Test
    void verifiesModuleBoundaries() {
        modules.verify();
    }

    @Test
    void discoversExactlyTheCanonicalModules() {
        Set<String> discoveredModules = modules.stream()
                .map(module -> module.getIdentifier().toString())
                .collect(Collectors.toSet());

        assertThat(discoveredModules).containsExactlyInAnyOrderElementsOf(EXPECTED_MODULES);
    }
}
