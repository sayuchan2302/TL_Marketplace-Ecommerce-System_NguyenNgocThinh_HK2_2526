package vn.edu.hcmuaf.fit.marketplace.seeder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import vn.edu.hcmuaf.fit.marketplace.entity.Category;
import vn.edu.hcmuaf.fit.marketplace.entity.Product;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

final class GapCoverageReporter {

    private static final int SAMPLE_LIMIT = 3;

    private final ObjectMapper objectMapper = JsonMapper.builder()
            .findAndAddModules()
            .build()
            .enable(SerializationFeature.INDENT_OUTPUT);

    CoverageSnapshot captureSnapshot(
            String label,
            List<GapProductImportRunner.LeafCategory> leafCategories,
            List<GapProductImportRunner.StyleAnalysis> analyses,
            List<Product> importedProducts,
            List<Product> publicImportedProducts
    ) {
        Map<String, Long> rawCandidateCounts = new LinkedHashMap<>();
        Map<String, Long> mappedCandidateCounts = new LinkedHashMap<>();
        Map<String, Map<String, Long>> confidenceCountsByCategory = new LinkedHashMap<>();
        Map<String, Long> importedCounts = countProductsByCategory(importedProducts);
        Map<String, Long> publicCounts = countProductsByCategory(publicImportedProducts);

        int rowsWithImages = 0;
        int importableRows = 0;
        int strongMatches = 0;
        int heuristicMatches = 0;
        int sourceGapRows = 0;

        for (GapProductImportRunner.StyleAnalysis analysis : analyses) {
            if (!analysis.hasImages()) {
                continue;
            }
            rowsWithImages++;

            for (String slug : analysis.mapping().rawCandidateSlugs()) {
                rawCandidateCounts.merge(slug, 1L, Long::sum);
            }

            if (!analysis.mapping().isImportable() || analysis.preferredLeaf() == null) {
                sourceGapRows++;
                continue;
            }

            importableRows++;
            mappedCandidateCounts.merge(analysis.preferredLeaf().slug(), 1L, Long::sum);
            confidenceCountsByCategory
                    .computeIfAbsent(analysis.preferredLeaf().slug(), ignored -> new LinkedHashMap<>())
                    .merge(analysis.mapping().confidenceLabel(), 1L, Long::sum);

            switch (analysis.mapping().confidence()) {
                case STRONG_MATCH -> strongMatches++;
                case HEURISTIC_FALLBACK -> heuristicMatches++;
                case SOURCE_GAP_FALLBACK -> sourceGapRows++;
            }
        }

        List<CategoryCoverage> categories = new ArrayList<>(leafCategories.size());
        for (GapProductImportRunner.LeafCategory leafCategory : leafCategories) {
            String slug = leafCategory.slug();
            long rawCount = rawCandidateCounts.getOrDefault(slug, 0L);
            long mappedCount = mappedCandidateCounts.getOrDefault(slug, 0L);
            long importedCount = importedCounts.getOrDefault(slug, 0L);
            long publicCount = publicCounts.getOrDefault(slug, 0L);
            Map<String, Long> confidenceBreakdown = confidenceCountsByCategory.getOrDefault(slug, Map.of());
            categories.add(new CategoryCoverage(
                    slug,
                    leafCategory.rootSlug(),
                    rawCount,
                    mappedCount,
                    importedCount,
                    publicCount,
                    rawCount == 0,
                    rawCount > 0 && mappedCount == 0,
                    resolveConfidenceBucket(confidenceBreakdown),
                    confidenceBreakdown
            ));
        }
        categories.sort(Comparator.comparing(CategoryCoverage::categorySlug));

        Map<String, ProductPlacement> importedBySlug = importedProducts.stream()
                .map(this::toPlacement)
                .filter(placement -> placement.productSlug() != null && !placement.productSlug().isBlank())
                .collect(Collectors.toMap(
                        ProductPlacement::productSlug,
                        Function.identity(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        Summary summary = new Summary(
                analyses.size(),
                rowsWithImages,
                importableRows,
                sourceGapRows,
                strongMatches,
                heuristicMatches,
                importedProducts.size(),
                publicImportedProducts.size(),
                (int) categories.stream().filter(category -> category.importedProductCount() > 0).count(),
                (int) categories.stream().filter(CategoryCoverage::sourceGap).count(),
                (int) categories.stream().filter(CategoryCoverage::mapperGap).count()
        );

        return new CoverageSnapshot(
                label,
                LocalDateTime.now(),
                summary,
                categories,
                buildAmbiguousPatterns(analyses),
                importedBySlug,
                groupPlacementSamplesByCategory(importedProducts)
        );
    }

    void writeBeforeReport(Path outputDir, CoverageSnapshot snapshot) throws IOException {
        Files.createDirectories(outputDir);
        writeJson(outputDir.resolve("coverage-before.json"), buildBeforeDocument(snapshot));
        writeMarkdown(outputDir.resolve("coverage-before.md"), buildBeforeMarkdown(snapshot));
    }

    void writeAfterReport(Path outputDir, CoverageSnapshot before, CoverageSnapshot after) throws IOException {
        Files.createDirectories(outputDir);
        writeJson(outputDir.resolve("coverage-after.json"), buildAfterDocument(before, after));
        writeMarkdown(outputDir.resolve("coverage-after.md"), buildAfterMarkdown(before, after));
    }

    private void writeJson(Path path, Object document) throws IOException {
        objectMapper.writeValue(path.toFile(), document);
    }

    private void writeMarkdown(Path path, String content) throws IOException {
        Files.writeString(path, content, StandardCharsets.UTF_8);
    }

    private Map<String, Object> buildBeforeDocument(CoverageSnapshot snapshot) {
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("label", snapshot.label());
        document.put("generatedAt", snapshot.generatedAt());
        document.put("summary", snapshot.summary());
        document.put("categories", snapshot.categories());
        document.put("emptyCategories", snapshot.emptyCategories());
        document.put("ambiguousPatterns", snapshot.ambiguousPatterns());
        return document;
    }

    private Map<String, Object> buildAfterDocument(CoverageSnapshot before, CoverageSnapshot after) {
        List<String> newlyFilledCategories = newlyFilledCategories(before, after);
        List<String> sourceGapCategories = emptyCategoriesWith(after, CategoryCoverage::sourceGap);
        List<String> mapperGapCategories = emptyCategoriesWith(after, CategoryCoverage::mapperGap);
        List<Map<String, Object>> recoveredCategories = recoveredCategories(after, newlyFilledCategories);

        Map<String, Object> document = new LinkedHashMap<>();
        document.put("label", after.label());
        document.put("generatedAt", after.generatedAt());
        document.put("summary", Map.of(
                "totalImportedProducts", after.summary().importedProducts(),
                "totalPublicProducts", after.summary().publicProducts(),
                "nonEmptyLeafCategoryCountBefore", before.summary().nonEmptyLeafCategories(),
                "nonEmptyLeafCategoryCountAfter", after.summary().nonEmptyLeafCategories(),
                "newlyFilledCategories", newlyFilledCategories,
                "movedProductCount", movedProductCount(before, after),
                "categoriesStillEmptyDueToSourceGaps", sourceGapCategories,
                "categoriesStillEmptyDueToMapperGaps", mapperGapCategories
        ));
        document.put("categories", after.categories());
        document.put("recoveredCategories", recoveredCategories);
        document.put("ambiguousPatterns", after.ambiguousPatterns());
        return document;
    }

    private String buildBeforeMarkdown(CoverageSnapshot snapshot) {
        StringBuilder markdown = new StringBuilder();
        markdown.append("# GAP Coverage Before\n\n");
        markdown.append("- Generated at: `").append(snapshot.generatedAt()).append("`\n");
        markdown.append("- Source rows analyzed: `").append(snapshot.summary().sourceRows()).append("`\n");
        markdown.append("- Rows with usable images: `").append(snapshot.summary().rowsWithImages()).append("`\n");
        markdown.append("- Importable rows: `").append(snapshot.summary().importableRows()).append("`\n");
        markdown.append("- Source-gap rows: `").append(snapshot.summary().sourceGapRows()).append("`\n");
        markdown.append("- Imported GAP products in DB: `").append(snapshot.summary().importedProducts()).append("`\n");
        markdown.append("- Public GAP products in DB: `").append(snapshot.summary().publicProducts()).append("`\n");
        markdown.append("- Non-empty leaf categories: `").append(snapshot.summary().nonEmptyLeafCategories()).append("`\n\n");

        markdown.append("## Per Category\n\n");
        markdown.append("| category_slug | root | raw | mapped | imported | public | source_gap | mapper_gap | confidence |\n");
        markdown.append("|---|---:|---:|---:|---:|---:|---|---|---|\n");
        for (CategoryCoverage category : snapshot.categories()) {
            markdown.append("| `").append(category.categorySlug()).append("` | `")
                    .append(category.rootSlug()).append("` | ")
                    .append(category.rawCandidateCount()).append(" | ")
                    .append(category.mappedCandidateCount()).append(" | ")
                    .append(category.importedProductCount()).append(" | ")
                    .append(category.activePublicProductCount()).append(" | `")
                    .append(category.sourceGap()).append("` | `")
                    .append(category.mapperGap()).append("` | `")
                    .append(category.mappingConfidenceBucket()).append("` |\n");
        }

        markdown.append("\n## Empty Categories\n\n");
        for (CategoryCoverage category : snapshot.emptyCategories()) {
            markdown.append("- `").append(category.categorySlug())
                    .append("` raw=").append(category.rawCandidateCount())
                    .append(", mapped=").append(category.mappedCandidateCount())
                    .append(", imported=").append(category.importedProductCount())
                    .append(", source_gap=").append(category.sourceGap())
                    .append(", mapper_gap=").append(category.mapperGap())
                    .append("\n");
        }

        markdown.append("\n## Ambiguous Patterns\n\n");
        for (AmbiguousPattern pattern : snapshot.ambiguousPatterns()) {
            markdown.append("- `").append(pattern.signature()).append("` -> `")
                    .append(pattern.confidence()).append("` (")
                    .append(pattern.count()).append(" rows) samples: ");
            markdown.append(pattern.sampleProducts().stream()
                    .map(sample -> "`" + sample.productSlug() + "` " + sample.productName())
                    .collect(Collectors.joining(", ")));
            markdown.append("\n");
        }

        return markdown.toString();
    }

    private String buildAfterMarkdown(CoverageSnapshot before, CoverageSnapshot after) {
        StringBuilder markdown = new StringBuilder();
        List<String> newlyFilledCategories = newlyFilledCategories(before, after);
        List<String> sourceGapCategories = emptyCategoriesWith(after, CategoryCoverage::sourceGap);
        List<String> mapperGapCategories = emptyCategoriesWith(after, CategoryCoverage::mapperGap);

        markdown.append("# GAP Coverage After\n\n");
        markdown.append("- Generated at: `").append(after.generatedAt()).append("`\n");
        markdown.append("- Total imported GAP products: `").append(after.summary().importedProducts()).append("`\n");
        markdown.append("- Public GAP products: `").append(after.summary().publicProducts()).append("`\n");
        markdown.append("- Non-empty leaf categories before: `").append(before.summary().nonEmptyLeafCategories()).append("`\n");
        markdown.append("- Non-empty leaf categories after: `").append(after.summary().nonEmptyLeafCategories()).append("`\n");
        markdown.append("- Moved product count: `").append(movedProductCount(before, after)).append("`\n\n");

        markdown.append("## Newly Filled Categories\n\n");
        if (newlyFilledCategories.isEmpty()) {
            markdown.append("- None\n");
        } else {
            for (String slug : newlyFilledCategories) {
                markdown.append("- `").append(slug).append("`: ");
                markdown.append(after.sampleProductsByCategory().getOrDefault(slug, List.of()).stream()
                        .map(sample -> "`" + sample.productSlug() + "` " + sample.productName())
                        .collect(Collectors.joining(", ")));
                markdown.append("\n");
            }
        }

        markdown.append("\n## Categories Still Empty Due To Source Gaps\n\n");
        if (sourceGapCategories.isEmpty()) {
            markdown.append("- None\n");
        } else {
            for (String slug : sourceGapCategories) {
                markdown.append("- `").append(slug).append("`\n");
            }
        }

        markdown.append("\n## Categories Still Empty Due To Mapper Gaps\n\n");
        if (mapperGapCategories.isEmpty()) {
            markdown.append("- None\n");
        } else {
            for (String slug : mapperGapCategories) {
                markdown.append("- `").append(slug).append("`\n");
            }
        }

        markdown.append("\n## Top Ambiguous Patterns\n\n");
        for (AmbiguousPattern pattern : after.ambiguousPatterns()) {
            markdown.append("- `").append(pattern.signature()).append("` -> `")
                    .append(pattern.confidence()).append("` (")
                    .append(pattern.count()).append(" rows) samples: ");
            markdown.append(pattern.sampleProducts().stream()
                    .map(sample -> "`" + sample.productSlug() + "` " + sample.productName())
                    .collect(Collectors.joining(", ")));
            markdown.append("\n");
        }

        return markdown.toString();
    }

    private List<String> newlyFilledCategories(CoverageSnapshot before, CoverageSnapshot after) {
        Map<String, CategoryCoverage> beforeBySlug = before.categoryIndex();
        List<String> categories = new ArrayList<>();
        for (CategoryCoverage afterCategory : after.categories()) {
            CategoryCoverage beforeCategory = beforeBySlug.get(afterCategory.categorySlug());
            long beforeImported = beforeCategory == null ? 0L : beforeCategory.importedProductCount();
            if (beforeImported == 0 && afterCategory.importedProductCount() > 0) {
                categories.add(afterCategory.categorySlug());
            }
        }
        return List.copyOf(categories);
    }

    private List<Map<String, Object>> recoveredCategories(
            CoverageSnapshot after,
            List<String> newlyFilledCategories
    ) {
        List<Map<String, Object>> recovered = new ArrayList<>(newlyFilledCategories.size());
        Map<String, CategoryCoverage> afterBySlug = after.categoryIndex();
        for (String slug : newlyFilledCategories) {
            CategoryCoverage category = afterBySlug.get(slug);
            if (category == null) {
                continue;
            }
            recovered.add(Map.of(
                    "categorySlug", slug,
                    "importedProductCount", category.importedProductCount(),
                    "sampleProducts", after.sampleProductsByCategory().getOrDefault(slug, List.of())
            ));
        }
        return recovered;
    }

    private List<String> emptyCategoriesWith(
            CoverageSnapshot snapshot,
            java.util.function.Predicate<CategoryCoverage> predicate
    ) {
        return snapshot.categories().stream()
                .filter(category -> category.importedProductCount() == 0)
                .filter(predicate)
                .map(CategoryCoverage::categorySlug)
                .toList();
    }

    private Map<String, Long> countProductsByCategory(List<Product> products) {
        return products.stream()
                .map(this::toPlacement)
                .filter(placement -> placement.categorySlug() != null && !placement.categorySlug().isBlank())
                .collect(Collectors.groupingBy(
                        ProductPlacement::categorySlug,
                        LinkedHashMap::new,
                        Collectors.counting()
                ));
    }

    private Map<String, List<ProductSample>> groupPlacementSamplesByCategory(List<Product> products) {
        Map<String, List<ProductSample>> samples = new LinkedHashMap<>();
        for (Product product : products) {
            ProductPlacement placement = toPlacement(product);
            if (placement.categorySlug() == null || placement.categorySlug().isBlank()) {
                continue;
            }
            samples.computeIfAbsent(placement.categorySlug(), ignored -> new ArrayList<>());
            List<ProductSample> categorySamples = samples.get(placement.categorySlug());
            if (categorySamples.size() >= SAMPLE_LIMIT) {
                continue;
            }
            categorySamples.add(new ProductSample(
                    placement.productSlug(),
                    placement.productName()
            ));
        }
        return samples;
    }

    private ProductPlacement toPlacement(Product product) {
        Category category = product.getCategory();
        return new ProductPlacement(
                product.getSlug(),
                product.getName(),
                category == null ? "" : normalize(category.getSlug())
        );
    }

    private String resolveConfidenceBucket(Map<String, Long> confidenceBreakdown) {
        if (confidenceBreakdown.isEmpty()) {
            return "none";
        }
        if (confidenceBreakdown.size() == 1) {
            return confidenceBreakdown.keySet().iterator().next();
        }
        return "mixed";
    }

    private List<AmbiguousPattern> buildAmbiguousPatterns(List<GapProductImportRunner.StyleAnalysis> analyses) {
        Map<String, PatternAccumulator> accumulators = new LinkedHashMap<>();
        for (GapProductImportRunner.StyleAnalysis analysis : analyses) {
            if (!analysis.hasImages()) {
                continue;
            }
            if (analysis.mapping().confidence() == GapCategoryMapper.MappingConfidence.STRONG_MATCH
                    && analysis.mapping().rawCandidateSlugs().size() <= 1) {
                continue;
            }
            String signature = normalize(analysis.row().gender()) + " | "
                    + normalize(analysis.row().subCategory()) + " | "
                    + normalize(analysis.row().articleType()) + " | "
                    + analysis.mapping().winningRule();
            PatternAccumulator accumulator = accumulators.computeIfAbsent(
                    signature,
                    ignored -> new PatternAccumulator(analysis.mapping().confidenceLabel())
            );
            accumulator.count++;
            if (accumulator.sampleProducts.size() < SAMPLE_LIMIT) {
                accumulator.sampleProducts.add(new ProductSample(
                        analysis.productSlug(),
                        displayName(analysis.row())
                ));
            }
        }

        return accumulators.entrySet().stream()
                .map(entry -> new AmbiguousPattern(
                        entry.getKey(),
                        entry.getValue().confidence,
                        entry.getValue().count,
                        List.copyOf(entry.getValue().sampleProducts)
                ))
                .sorted(Comparator.comparingLong(AmbiguousPattern::count).reversed())
                .limit(10)
                .toList();
    }

    private int movedProductCount(CoverageSnapshot before, CoverageSnapshot after) {
        int moved = 0;
        for (Map.Entry<String, ProductPlacement> entry : after.importedBySlug().entrySet()) {
            ProductPlacement beforePlacement = before.importedBySlug().get(entry.getKey());
            if (beforePlacement == null) {
                continue;
            }
            if (!beforePlacement.categorySlug().equals(entry.getValue().categorySlug())) {
                moved++;
            }
        }
        return moved;
    }

    private String displayName(GapProductImportRunner.StyleRow row) {
        String productName = row.productDisplayName();
        if (productName == null || productName.isBlank()) {
            return row.articleType();
        }
        return productName;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    static final class CoverageSnapshot {
        private final String label;
        private final LocalDateTime generatedAt;
        private final Summary summary;
        private final List<CategoryCoverage> categories;
        private final List<AmbiguousPattern> ambiguousPatterns;
        private final Map<String, ProductPlacement> importedBySlug;
        private final Map<String, List<ProductSample>> sampleProductsByCategory;

        CoverageSnapshot(
                String label,
                LocalDateTime generatedAt,
                Summary summary,
                List<CategoryCoverage> categories,
                List<AmbiguousPattern> ambiguousPatterns,
                Map<String, ProductPlacement> importedBySlug,
                Map<String, List<ProductSample>> sampleProductsByCategory
        ) {
            this.label = label;
            this.generatedAt = generatedAt;
            this.summary = summary;
            this.categories = List.copyOf(categories);
            this.ambiguousPatterns = List.copyOf(ambiguousPatterns);
            this.importedBySlug = Map.copyOf(importedBySlug);
            this.sampleProductsByCategory = Map.copyOf(sampleProductsByCategory);
        }

        String label() {
            return label;
        }

        LocalDateTime generatedAt() {
            return generatedAt;
        }

        Summary summary() {
            return summary;
        }

        List<CategoryCoverage> categories() {
            return categories;
        }

        List<AmbiguousPattern> ambiguousPatterns() {
            return ambiguousPatterns;
        }

        Map<String, ProductPlacement> importedBySlug() {
            return importedBySlug;
        }

        Map<String, List<ProductSample>> sampleProductsByCategory() {
            return sampleProductsByCategory;
        }

        List<CategoryCoverage> emptyCategories() {
            return categories.stream()
                    .filter(category -> category.importedProductCount() == 0)
                    .toList();
        }

        Map<String, CategoryCoverage> categoryIndex() {
            return categories.stream()
                    .collect(Collectors.toMap(
                            CategoryCoverage::categorySlug,
                            Function.identity(),
                            (left, right) -> left,
                            LinkedHashMap::new
                    ));
        }
    }

    record Summary(
            int sourceRows,
            int rowsWithImages,
            int importableRows,
            int sourceGapRows,
            int strongMatches,
            int heuristicMatches,
            int importedProducts,
            int publicProducts,
            int nonEmptyLeafCategories,
            int sourceGapLeafCategories,
            int mapperGapLeafCategories
    ) {
    }

    record CategoryCoverage(
            String categorySlug,
            String rootSlug,
            long rawCandidateCount,
            long mappedCandidateCount,
            long importedProductCount,
            long activePublicProductCount,
            boolean sourceGap,
            boolean mapperGap,
            String mappingConfidenceBucket,
            Map<String, Long> confidenceBreakdown
    ) {
    }

    record AmbiguousPattern(
            String signature,
            String confidence,
            long count,
            List<ProductSample> sampleProducts
    ) {
    }

    record ProductPlacement(
            String productSlug,
            String productName,
            String categorySlug
    ) {
    }

    record ProductSample(
            String productSlug,
            String productName
    ) {
    }

    private static final class PatternAccumulator {
        private final String confidence;
        private final List<ProductSample> sampleProducts = new ArrayList<>();
        private long count;

        private PatternAccumulator(String confidence) {
            this.confidence = confidence;
        }
    }
}
