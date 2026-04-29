package vn.edu.hcmuaf.fit.marketplace.seeder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.edu.hcmuaf.fit.marketplace.entity.Category;
import vn.edu.hcmuaf.fit.marketplace.entity.Product;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GapCoverageReporterTest {

    private static final List<String> BASELINE_LEAFS = List.of(
            "khan",
            "kinh-mat",
            "men-ao-hoodie",
            "men-ao-len",
            "men-ao-so-mi",
            "men-ao-thun",
            "men-quan-jeans",
            "men-quan-short",
            "men-quan-tay",
            "non-mu",
            "tat",
            "that-lung",
            "tui-xach",
            "women-ao-khoac",
            "women-ao-thun",
            "women-quan-jeans",
            "women-quan-short",
            "women-quan-tay",
            "women-vay-lien"
    );

    private static final List<String> RECOVERED_LEAFS = List.of(
            "men-ao-polo",
            "men-quan-kaki",
            "men-quan-jogger",
            "women-ao-croptop",
            "women-ao-kieu",
            "women-quan-legging"
    );

    private static final List<String> EXTRA_EMPTY_LEAFS = List.of(
            "balo",
            "women-ao-so-mi"
    );

    @TempDir
    Path tempDir;

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void afterReportKeepsBeforeAfterComparisonAccurate() throws IOException {
        GapCoverageReporter reporter = new GapCoverageReporter();
        TestTaxonomy taxonomy = taxonomy();
        List<GapProductImportRunner.StyleAnalysis> analyses = analyses(taxonomy.leafCategoriesBySlug());

        GapCoverageReporter.CoverageSnapshot beforeSnapshot = reporter.captureSnapshot(
                "before",
                taxonomy.leafCategories(),
                analyses,
                importedProductsBefore(taxonomy.categoriesBySlug()),
                importedProductsBefore(taxonomy.categoriesBySlug())
        );
        GapCoverageReporter.CoverageSnapshot afterSnapshot = reporter.captureSnapshot(
                "after",
                taxonomy.leafCategories(),
                analyses,
                importedProductsAfter(taxonomy.categoriesBySlug()),
                importedProductsAfter(taxonomy.categoriesBySlug())
        );

        reporter.writeAfterReport(tempDir, beforeSnapshot, afterSnapshot);

        JsonNode summary = objectMapper.readTree(tempDir.resolve("coverage-after.json").toFile()).path("summary");
        assertEquals(19, summary.path("nonEmptyLeafCategoryCountBefore").asInt());
        assertEquals(25, summary.path("nonEmptyLeafCategoryCountAfter").asInt());
        assertEquals(1, summary.path("movedProductCount").asInt());
        assertEquals(Set.copyOf(RECOVERED_LEAFS), stringSet(summary.path("newlyFilledCategories")));
        assertEquals(List.of("balo"), stringList(summary.path("categoriesStillEmptyDueToSourceGaps")));
        assertEquals(List.of("women-ao-so-mi"), stringList(summary.path("categoriesStillEmptyDueToMapperGaps")));

        String markdown = Files.readString(tempDir.resolve("coverage-after.md"));
        assertTrue(markdown.contains("## Categories Still Empty Due To Mapper Gaps"));
        assertTrue(markdown.contains("`women-ao-so-mi`"));
    }

    private TestTaxonomy taxonomy() {
        Category menRoot = rootCategory("men");
        Category womenRoot = rootCategory("women");
        Category accessoriesRoot = rootCategory("accessories");

        Map<String, Category> categoriesBySlug = new LinkedHashMap<>();
        categoriesBySlug.put(menRoot.getSlug(), menRoot);
        categoriesBySlug.put(womenRoot.getSlug(), womenRoot);
        categoriesBySlug.put(accessoriesRoot.getSlug(), accessoriesRoot);

        List<GapProductImportRunner.LeafCategory> leafCategories = new ArrayList<>();
        Map<String, GapProductImportRunner.LeafCategory> leafCategoriesBySlug = new LinkedHashMap<>();

        for (String slug : allLeafSlugs()) {
            Category parent = rootFor(slug, menRoot, womenRoot, accessoriesRoot);
            Category leaf = leafCategory(slug, parent);
            categoriesBySlug.put(slug, leaf);

            GapProductImportRunner.LeafCategory leafCategory = new GapProductImportRunner.LeafCategory(
                    leaf.getId(),
                    leaf.getSlug(),
                    parent.getId(),
                    parent.getSlug()
            );
            leafCategories.add(leafCategory);
            leafCategoriesBySlug.put(slug, leafCategory);
        }

        return new TestTaxonomy(categoriesBySlug, leafCategories, leafCategoriesBySlug);
    }

    private List<GapProductImportRunner.StyleAnalysis> analyses(
            Map<String, GapProductImportRunner.LeafCategory> leafCategoriesBySlug
    ) {
        List<GapProductImportRunner.StyleAnalysis> analyses = new ArrayList<>();
        int index = 1;

        for (String slug : BASELINE_LEAFS) {
            analyses.add(importableAnalysis(index++, slug, leafCategoriesBySlug.get(slug), confidenceFor(slug)));
        }
        for (String slug : RECOVERED_LEAFS) {
            analyses.add(importableAnalysis(index++, slug, leafCategoriesBySlug.get(slug), confidenceFor(slug)));
        }

        analyses.add(new GapProductImportRunner.StyleAnalysis(
                styleRow(index, "women", "Apparel", "Topwear", "Shirts", "Mapper gap shirt"),
                "gap-mapper-gap",
                new GapCategoryMapper.MappingResult(
                        "",
                        GapCategoryMapper.MappingConfidence.SOURCE_GAP_FALLBACK,
                        "source_gap:no_supported_gap_evidence",
                        List.of("articleType"),
                        List.of("article_type:no_match"),
                        Set.of("women-ao-so-mi")
                ),
                null,
                List.of("https://img.local/gap-mapper-gap.jpg")
        ));

        return analyses;
    }

    private GapProductImportRunner.StyleAnalysis importableAnalysis(
            int index,
            String slug,
            GapProductImportRunner.LeafCategory leafCategory,
            GapCategoryMapper.MappingConfidence confidence
    ) {
        return new GapProductImportRunner.StyleAnalysis(
                styleRow(index, genderFor(slug), masterCategoryFor(slug), subCategoryFor(slug), articleTypeFor(slug), slug),
                "gap-source-" + index,
                new GapCategoryMapper.MappingResult(
                        slug,
                        confidence,
                        "test:" + slug,
                        List.of("articleType"),
                        List.of(),
                        Set.of(slug)
                ),
                leafCategory,
                List.of("https://img.local/" + index + ".jpg")
        );
    }

    private List<Product> importedProductsBefore(Map<String, Category> categoriesBySlug) {
        List<Product> products = new ArrayList<>();
        for (String slug : BASELINE_LEAFS) {
            products.add(product("gap-before-" + slug, slug, categoriesBySlug));
        }
        products.add(product("gap-moved", "tui-xach", categoriesBySlug));
        return products;
    }

    private List<Product> importedProductsAfter(Map<String, Category> categoriesBySlug) {
        List<Product> products = new ArrayList<>();
        for (String slug : BASELINE_LEAFS) {
            products.add(product("gap-after-" + slug, slug, categoriesBySlug));
        }
        for (String slug : RECOVERED_LEAFS) {
            products.add(product("gap-after-" + slug, slug, categoriesBySlug));
        }
        products.add(product("gap-moved", "tat", categoriesBySlug));
        return products;
    }

    private Product product(String slug, String categorySlug, Map<String, Category> categoriesBySlug) {
        Product product = new Product();
        product.setSlug(slug);
        product.setName(slug);
        product.setCategory(categoriesBySlug.get(categorySlug));
        return product;
    }

    private GapProductImportRunner.StyleRow styleRow(
            long styleId,
            String gender,
            String masterCategory,
            String subCategory,
            String articleType,
            String productName
    ) {
        return new GapProductImportRunner.StyleRow(
                styleId,
                gender,
                masterCategory,
                subCategory,
                articleType,
                "Black",
                List.of("Black"),
                Map.of("Black", "#000000"),
                List.of("M"),
                "Summer",
                "2026",
                "Casual",
                productName,
                productName,
                "",
                "",
                ""
        );
    }

    private Category rootCategory(String slug) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setSlug(slug);
        category.setName(slug);
        category.setIsVisible(true);
        return category;
    }

    private Category leafCategory(String slug, Category parent) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setSlug(slug);
        category.setName(slug);
        category.setParent(parent);
        category.setIsVisible(true);
        return category;
    }

    private Category rootFor(String slug, Category menRoot, Category womenRoot, Category accessoriesRoot) {
        if (slug.startsWith("men-")) {
            return menRoot;
        }
        if (slug.startsWith("women-")) {
            return womenRoot;
        }
        return accessoriesRoot;
    }

    private List<String> allLeafSlugs() {
        LinkedHashSet<String> slugs = new LinkedHashSet<>();
        slugs.addAll(BASELINE_LEAFS);
        slugs.addAll(RECOVERED_LEAFS);
        slugs.addAll(EXTRA_EMPTY_LEAFS);
        return List.copyOf(slugs);
    }

    private GapCategoryMapper.MappingConfidence confidenceFor(String slug) {
        if ("women-ao-kieu".equals(slug)) {
            return GapCategoryMapper.MappingConfidence.HEURISTIC_FALLBACK;
        }
        return GapCategoryMapper.MappingConfidence.STRONG_MATCH;
    }

    private String genderFor(String slug) {
        if (slug.startsWith("women-")) {
            return "women";
        }
        if (slug.startsWith("men-")) {
            return "men";
        }
        return "women";
    }

    private String masterCategoryFor(String slug) {
        if (slug.startsWith("men-") || slug.startsWith("women-")) {
            return "Apparel";
        }
        return "Accessories";
    }

    private String subCategoryFor(String slug) {
        if (slug.startsWith("men-quan") || slug.startsWith("women-quan")) {
            return "Bottomwear";
        }
        if (slug.startsWith("women-vay")) {
            return "Dress";
        }
        if (slug.startsWith("men-") || slug.startsWith("women-")) {
            return "Topwear";
        }
        return "Fashion Accessories";
    }

    private String articleTypeFor(String slug) {
        if (slug.contains("polo")) {
            return "Polo";
        }
        if (slug.contains("jogger")) {
            return "Joggers";
        }
        if (slug.contains("kaki")) {
            return "Khakis";
        }
        if (slug.contains("croptop")) {
            return "Cropped Tops";
        }
        if (slug.contains("legging")) {
            return "Leggings";
        }
        if (slug.contains("dress") || slug.contains("vay")) {
            return "Dresses";
        }
        if (slug.contains("jeans")) {
            return "Jeans";
        }
        if (slug.contains("short")) {
            return "Shorts";
        }
        if (slug.contains("shirt") || slug.contains("so-mi")) {
            return "Shirts";
        }
        if (slug.contains("thun")) {
            return "Tshirts";
        }
        if (slug.contains("hoodie")) {
            return "Hoodies";
        }
        if (slug.contains("len") || slug.contains("khoac")) {
            return "Sweaters";
        }
        return "Accessories";
    }

    private Set<String> stringSet(JsonNode arrayNode) {
        Set<String> values = new LinkedHashSet<>();
        for (JsonNode node : arrayNode) {
            values.add(node.asText());
        }
        return values;
    }

    private List<String> stringList(JsonNode arrayNode) {
        List<String> values = new ArrayList<>();
        for (JsonNode node : arrayNode) {
            values.add(node.asText());
        }
        return values;
    }

    private record TestTaxonomy(
            Map<String, Category> categoriesBySlug,
            List<GapProductImportRunner.LeafCategory> leafCategories,
            Map<String, GapProductImportRunner.LeafCategory> leafCategoriesBySlug
    ) {
    }
}
