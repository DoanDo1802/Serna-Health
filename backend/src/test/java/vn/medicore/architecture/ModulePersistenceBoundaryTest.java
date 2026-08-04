package vn.medicore.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "vn.medicore", importOptions = ImportOption.DoNotIncludeTests.class)
class ModulePersistenceBoundaryTest {

    @ArchTest
    static final ArchRule exposedApiMustNotContainJpaEntities = noClasses()
            .that().resideInAPackage("vn.medicore..api..")
            .should().beAnnotatedWith("jakarta.persistence.Entity")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule modulesMustNotDependOnAnotherModulesPersistenceAdapter = noClasses()
            .that().resideInAnyPackage(
                    "vn.medicore.identityaccess..",
                    "vn.medicore.catalog..",
                    "vn.medicore.patient..",
                    "vn.medicore.scheduling..",
                    "vn.medicore.receptionqueue..",
                    "vn.medicore.clinicalcare..",
                    "vn.medicore.diagnostics..",
                    "vn.medicore.billingpayment..",
                    "vn.medicore.notification..",
                    "vn.medicore.platformaudit..")
            .should().dependOnClassesThat().resideInAPackage("vn.medicore..adapter.out.persistence..");
}
