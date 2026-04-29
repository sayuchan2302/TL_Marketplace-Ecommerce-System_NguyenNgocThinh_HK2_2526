package vn.edu.hcmuaf.fit.marketplace.seeder;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GapCategoryMapperTest {

    private GapCategoryMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new GapCategoryMapper();
    }

    @Test
    void articleTypeBeatsWeakerFallbackRules() {
        GapProductImportRunner.StyleRow row = styleRow(
                1L,
                "Women",
                "Apparel",
                "Topwear",
                "Shirts",
                "Oxford Work Shirt"
        );

        GapCategoryMapper.MappingResult result = mapper.map(row);

        assertEquals("women-ao-so-mi", result.chosenLeafSlug());
        assertEquals("article_type:shirt", result.winningRule());
        assertEquals("strong_match", result.confidenceLabel());
    }

    @Test
    void descriptiveTextRefinesGenericAccessories() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                2L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Canvas Crossbody Bag"
        ));

        assertEquals("tui-deo-cheo", result.chosenLeafSlug());
        assertEquals("descriptive_text:crossbody_family", result.winningRule());
    }

    @Test
    void crewSocksMapToTat() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                3L,
                "Men",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "CashSoft Crew Socks"
        ));

        assertEquals("tat", result.chosenLeafSlug());
    }

    @Test
    void sunglassesMapToKinhMat() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                4L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Polarized Sunglasses"
        ));

        assertEquals("kinh-mat", result.chosenLeafSlug());
    }

    @Test
    void handbagFamilyMapsToExpectedBagSlugs() {
        assertEquals("tui-xach", mapper.map(styleRow(
                5L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Leather Tote Bag"
        )).chosenLeafSlug());
        assertEquals("tui-deo-cheo", mapper.map(styleRow(
                6L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Mini Crossbody Purse"
        )).chosenLeafSlug());
        assertEquals("balo", mapper.map(styleRow(
                7L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Travel Backpack"
        )).chosenLeafSlug());
        assertEquals("vi", mapper.map(styleRow(
                8L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Zip Wallet"
        )).chosenLeafSlug());
    }

    @Test
    void poloMapsToMenAoPolo() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                9L,
                "Men",
                "Apparel",
                "Topwear",
                "Sweaters",
                "Classic Polo Sweater"
        ));

        assertEquals("men-ao-polo", result.chosenLeafSlug());
    }

    @Test
    void khakiMapsToMenQuanKaki() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                10L,
                "Men",
                "Apparel",
                "Bottomwear",
                "Trousers",
                "Modern Loose Khakis"
        ));

        assertEquals("men-quan-kaki", result.chosenLeafSlug());
    }

    @Test
    void joggerMapsToMenQuanJogger() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                11L,
                "Men",
                "Apparel",
                "Bottomwear",
                "Trousers",
                "Relaxed Jogger Pants"
        ));

        assertEquals("men-quan-jogger", result.chosenLeafSlug());
    }

    @Test
    void unsupportedWatchAndJewelryPatternsRemainSourceGap() {
        GapCategoryMapper.MappingResult watch = mapper.map(styleRow(
                12L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Rose Gold Watch"
        ));
        GapCategoryMapper.MappingResult jewelry = mapper.map(styleRow(
                13L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Statement Necklace"
        ));

        assertFalse(watch.isImportable());
        assertEquals("source_gap_fallback", watch.confidenceLabel());
        assertFalse(jewelry.isImportable());
        assertEquals("source_gap_fallback", jewelry.confidenceLabel());
    }

    @Test
    void denimCorsetTopMapsToWomenAoCroptop() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                14L,
                "Women",
                "Apparel",
                "Topwear",
                "Tops",
                "Denim Corset Top"
        ));

        assertEquals("women-ao-croptop", result.chosenLeafSlug());
        assertEquals("article_type:women_top_crop_family", result.winningRule());
        assertEquals("strong_match", result.confidenceLabel());
    }

    @Test
    void denimFittedPeplumTopMapsToWomenAoKieu() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                15L,
                "Women",
                "Apparel",
                "Topwear",
                "Tops",
                "Denim Fitted Peplum Top"
        ));

        assertEquals("women-ao-kieu", result.chosenLeafSlug());
        assertEquals("article_type:women_top_fashion_family", result.winningRule());
        assertEquals("strong_match", result.confidenceLabel());
    }

    @Test
    void shirtJacketEvidenceMapsToWomenAoSoMi() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                16L,
                "Women",
                "Apparel",
                "Topwear",
                "Tops",
                "Eyelet Hem Relaxed Shirt Jacket"
        ));

        assertEquals("women-ao-so-mi", result.chosenLeafSlug());
        assertEquals("article_type:women_top_shirt_family", result.winningRule());
        assertEquals("strong_match", result.confidenceLabel());
    }

    @Test
    void genericWomenTopsRemainHeuristicFallback() {
        GapCategoryMapper.MappingResult result = mapper.map(styleRow(
                17L,
                "Women",
                "Apparel",
                "Topwear",
                "Tops",
                "Women's Tops"
        ));

        assertEquals("women-ao-kieu", result.chosenLeafSlug());
        assertEquals("article_type:tops", result.winningRule());
        assertEquals("heuristic_fallback", result.confidenceLabel());
    }

    @Test
    void unsupportedBandanaAndFlipFlopsRemainSourceGap() {
        GapCategoryMapper.MappingResult bandana = mapper.map(styleRow(
                18L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Oversized Silk Bandana"
        ));
        GapCategoryMapper.MappingResult flipFlops = mapper.map(styleRow(
                19L,
                "Women",
                "Accessories",
                "Fashion Accessories",
                "Accessories",
                "Jelly Flip Flops"
        ));

        assertFalse(bandana.isImportable());
        assertEquals("source_gap_fallback", bandana.confidenceLabel());
        assertFalse(flipFlops.isImportable());
        assertEquals("source_gap_fallback", flipFlops.confidenceLabel());
    }

    private GapProductImportRunner.StyleRow styleRow(
            long styleId,
            String gender,
            String masterCategory,
            String subCategory,
            String articleType,
            String productDisplayName
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
                List.of("S", "M"),
                "All",
                "2026",
                "Casual",
                productDisplayName,
                productDisplayName,
                "",
                "",
                ""
        );
    }
}
