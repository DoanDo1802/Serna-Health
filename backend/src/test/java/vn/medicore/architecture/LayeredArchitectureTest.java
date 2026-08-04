package vn.medicore.architecture;

import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "vn.medicore", importOptions = ImportOption.DoNotIncludeTests.class)
class LayeredArchitectureTest {

    @ArchTest
    static final ArchRule layeredArchitectureBoundaryRules = layeredArchitecture()
            .consideringAllDependencies()
            .layer("Controller").definedBy("vn.medicore.controller..")
            .layer("Service").definedBy("vn.medicore.service..")
            .layer("Repository").definedBy("vn.medicore.repository..")
            .layer("Config").definedBy("vn.medicore.config..")
            .layer("Common").definedBy("vn.medicore.common..")
            .layer("Dto").definedBy("vn.medicore.dto..")
            .layer("Entity").definedBy("vn.medicore.entity..")

            .whereLayer("Controller").mayOnlyBeAccessedByLayers("Config")
            .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller", "Config")
            .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service", "Repository", "Config");
}
