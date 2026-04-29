package vn.edu.hcmuaf.fit.marketplace.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.seed.gap")
public class GapSeedProperties {
    private boolean enabled = false;
    private int targetCount = 1000;
    private String stylesPath = "backend/src/main/resources/seeder/gap/styles.csv";
    private String imagesPath = "backend/src/main/resources/seeder/gap/images.csv";
    private boolean cleanBeforeImport = true;
    private boolean reportEnabled = false;
    private String reportOutputDir = "backend/target/gap-coverage";
}
