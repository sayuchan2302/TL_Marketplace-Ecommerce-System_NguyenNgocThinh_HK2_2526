package vn.edu.hcmuaf.fit.marketplace.seeder;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class GapCategoryMapper {

    MappingResult map(GapProductImportRunner.StyleRow row) {
        LinkedHashSet<String> rawCandidateSlugs = new LinkedHashSet<>();
        List<String> fallbackPath = new ArrayList<>();

        RuleMatch articleMatch = matchArticleType(row);
        if (articleMatch != null) {
            rawCandidateSlugs.add(articleMatch.slug());
            return toResult(articleMatch, rawCandidateSlugs, fallbackPath);
        }
        fallbackPath.add("article_type:no_match");

        RuleMatch subCategoryMatch = matchSubCategory(row);
        if (subCategoryMatch != null) {
            rawCandidateSlugs.add(subCategoryMatch.slug());
            return toResult(subCategoryMatch, rawCandidateSlugs, fallbackPath);
        }
        fallbackPath.add("sub_category:no_match");

        RuleMatch descriptiveMatch = matchDescriptiveText(row);
        if (descriptiveMatch != null) {
            rawCandidateSlugs.add(descriptiveMatch.slug());
            return toResult(descriptiveMatch, rawCandidateSlugs, fallbackPath);
        }
        fallbackPath.add("descriptive_text:no_match");

        RuleMatch usageMatch = matchUsage(row);
        if (usageMatch != null) {
            rawCandidateSlugs.add(usageMatch.slug());
            return toResult(usageMatch, rawCandidateSlugs, fallbackPath);
        }
        fallbackPath.add("usage:no_match");

        RuleMatch genderMatch = matchGenderFallback(row);
        if (genderMatch != null) {
            rawCandidateSlugs.add(genderMatch.slug());
            return toResult(genderMatch, rawCandidateSlugs, fallbackPath);
        }
        fallbackPath.add("gender:no_match");

        return new MappingResult(
                "",
                MappingConfidence.SOURCE_GAP_FALLBACK,
                "source_gap:no_supported_gap_evidence",
                List.of(),
                List.copyOf(fallbackPath),
                Set.copyOf(rawCandidateSlugs)
        );
    }

    private MappingResult toResult(
            RuleMatch match,
            LinkedHashSet<String> rawCandidateSlugs,
            List<String> fallbackPath
    ) {
        return new MappingResult(
                match.slug(),
                match.confidence(),
                match.rule(),
                List.copyOf(match.sourceFieldsUsed()),
                List.copyOf(fallbackPath),
                Set.copyOf(rawCandidateSlugs)
        );
    }

    private RuleMatch matchArticleType(GapProductImportRunner.StyleRow row) {
        String article = normalizedToken(row.articleType());
        String usage = normalizedToken(row.usage());
        boolean female = isFemale(row.gender());
        boolean male = isMale(row.gender());

        if ("accessories".equals(normalizedToken(row.masterCategory()))) {
            return matchAccessoryText(
                    article,
                    "article_type",
                    MappingConfidence.STRONG_MATCH,
                    false
            );
        }

        String descriptiveText = apparelEvidenceText(row);
        if (containsAnyToken(descriptiveText, "polo")) {
            return match(
                    male ? "men-ao-polo" : "women-ao-kieu",
                    "article_type:polo_refinement",
                    MappingConfidence.STRONG_MATCH,
                    "articleType",
                    "productDisplayName"
            );
        }
        if (containsAnyToken(descriptiveText, "khaki", "khakis")) {
            return match(
                    female ? "women-quan-tay" : "men-quan-kaki",
                    "article_type:khaki_refinement",
                    MappingConfidence.STRONG_MATCH,
                    "articleType",
                    "productDisplayName"
            );
        }
        if (containsAnyToken(descriptiveText, "jogger", "joggers")) {
            return match(
                    female ? "women-quan-legging" : "men-quan-jogger",
                    "article_type:jogger_refinement",
                    MappingConfidence.STRONG_MATCH,
                    "articleType",
                    "productDisplayName"
            );
        }
        if (containsAnyToken(descriptiveText, "crop", "cropped", "croptop")) {
            return match(
                    female ? "women-ao-croptop" : "men-ao-thun",
                    "article_type:crop_refinement",
                    MappingConfidence.STRONG_MATCH,
                    "articleType",
                    "productDisplayName"
            );
        }

        if (containsAnyToken(article, "hoodie", "hoodies", "sweatshirt", "sweatshirts")) {
            return match(
                    female ? "women-ao-khoac" : "men-ao-hoodie",
                    "article_type:hoodie_or_sweatshirt",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "tshirt", "tshirts", "t shirt", "t shirts", "tee", "tees")) {
            return match(
                    female ? "women-ao-thun" : "men-ao-thun",
                    "article_type:tshirt",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "shirt", "shirts")) {
            return match(
                    female ? "women-ao-so-mi" : "men-ao-so-mi",
                    "article_type:shirt",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "sweater", "sweaters", "pullover", "pullovers", "cardigan", "cardigans")) {
            return match(
                    female ? "women-ao-khoac" : "men-ao-len",
                    "article_type:sweater_family",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "jacket", "jackets", "coat", "coats", "blazer", "blazers")) {
            return match(
                    female ? "women-ao-khoac" : "men-ao-len",
                    "article_type:jacket_or_coat",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "dress", "dresses", "gown", "gowns", "skirt", "skirts")) {
            return match(
                    mapFemaleDressByUsage(usage),
                    "article_type:dress_family",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "jean", "jeans", "jeggings")) {
            return match(
                    female ? "women-quan-jeans" : "men-quan-jeans",
                    "article_type:jeans",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "legging", "leggings", "tights")) {
            return match(
                    female ? "women-quan-legging" : "men-quan-jogger",
                    "article_type:leggings",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "short", "shorts", "capri", "capris")) {
            return match(
                    female ? "women-quan-short" : "men-quan-short",
                    "article_type:shorts",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "trouser", "trousers", "pant", "pants", "chino", "chinos")) {
            if (containsAnyToken(usage, "sports")) {
                return match(
                        female ? "women-quan-the-thao" : "men-quan-the-thao",
                        "article_type:sports_pants",
                        MappingConfidence.HEURISTIC_FALLBACK,
                        "articleType",
                        "usage"
                );
            }
            return match(
                    female ? "women-quan-tay" : "men-quan-tay",
                    "article_type:trousers",
                    MappingConfidence.STRONG_MATCH,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "top", "tops", "camisole", "camisoles", "vest", "vests", "tank", "tanks")) {
            if (female) {
                RuleMatch womenTopMatch = matchWomenTopwearRefinement(
                        descriptiveText,
                        "article_type"
                );
                if (womenTopMatch != null) {
                    return womenTopMatch;
                }
                return match(
                        "women-ao-kieu",
                        "article_type:tops",
                        MappingConfidence.HEURISTIC_FALLBACK,
                        "articleType"
                );
            }
            return match(
                    "men-ao-thun",
                    "article_type:tops",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "tracksuit", "sports bra", "sports bras", "jersey", "jerseys", "training")) {
            if (containsAnyToken(article, "set", "tracksuit")) {
                return match(
                        female ? "women-set-the-thao" : "men-set-the-thao",
                        "article_type:sports_set",
                        MappingConfidence.HEURISTIC_FALLBACK,
                        "articleType"
                );
            }
            if (containsAnyToken(article, "pant", "pants", "short", "shorts")) {
                return match(
                        female ? "women-quan-the-thao" : "men-quan-the-thao",
                        "article_type:sports_bottom",
                        MappingConfidence.HEURISTIC_FALLBACK,
                        "articleType"
                );
            }
            return match(
                    female ? "women-ao-the-thao" : "men-ao-the-thao",
                    "article_type:sports_top",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "articleType"
            );
        }
        if (containsAnyToken(article, "night", "sleep", "lounge", "pyjama", "pyjamas", "robe", "robes", "innerwear")) {
            return match(
                    female ? "women-bo-mac-nha" : "men-bo-mac-nha",
                    "article_type:loungewear",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "articleType"
            );
        }
        return null;
    }

    private RuleMatch matchSubCategory(GapProductImportRunner.StyleRow row) {
        String subCategory = normalizedToken(row.subCategory());
        String usage = normalizedToken(row.usage());
        boolean female = isFemale(row.gender());
        boolean male = isMale(row.gender());

        if ("accessories".equals(normalizedToken(row.masterCategory()))) {
            if (containsAnyToken(subCategory, "eyewear")) {
                return match("kinh-mat", "sub_category:eyewear", MappingConfidence.STRONG_MATCH, "subCategory");
            }
            if (containsAnyToken(subCategory, "socks")) {
                return match("tat", "sub_category:socks", MappingConfidence.STRONG_MATCH, "subCategory");
            }
            if (containsAnyToken(subCategory, "headwear", "caps")) {
                return match("non-mu", "sub_category:headwear", MappingConfidence.STRONG_MATCH, "subCategory");
            }
            if (containsAnyToken(subCategory, "bags")) {
                return match("tui-xach", "sub_category:bags", MappingConfidence.HEURISTIC_FALLBACK, "subCategory");
            }
            return null;
        }

        String descriptiveText = apparelEvidenceText(row);
        if (containsAnyToken(subCategory, "topwear")) {
            if (female) {
                RuleMatch womenTopMatch = matchWomenTopwearRefinement(
                        descriptiveText,
                        "sub_category"
                );
                if (womenTopMatch != null) {
                    return womenTopMatch;
                }
            }
            return match(
                    female ? "women-ao-kieu" : "men-ao-thun",
                    "sub_category:topwear",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "subCategory"
            );
        }
        if (containsAnyToken(subCategory, "bottomwear")) {
            if (containsAnyToken(descriptiveText, "khaki", "khakis")) {
                return match(
                        female ? "women-quan-tay" : "men-quan-kaki",
                        "sub_category:bottomwear_khaki_refinement",
                        MappingConfidence.STRONG_MATCH,
                        "subCategory",
                        "productDisplayName"
                );
            }
            if (containsAnyToken(descriptiveText, "jogger", "joggers")) {
                return match(
                        female ? "women-quan-legging" : "men-quan-jogger",
                        "sub_category:bottomwear_jogger_refinement",
                        MappingConfidence.STRONG_MATCH,
                        "subCategory",
                        "productDisplayName"
                );
            }
            if (containsAnyToken(descriptiveText, "short", "shorts")) {
                return match(
                        female ? "women-quan-short" : "men-quan-short",
                        "sub_category:bottomwear_short_refinement",
                        MappingConfidence.STRONG_MATCH,
                        "subCategory",
                        "productDisplayName"
                );
            }
            if (containsAnyToken(descriptiveText, "jean", "jeans", "denim")) {
                return match(
                        female ? "women-quan-jeans" : "men-quan-jeans",
                        "sub_category:bottomwear_denim_refinement",
                        MappingConfidence.STRONG_MATCH,
                        "subCategory",
                        "productDisplayName"
                );
            }
            return match(
                    female ? "women-quan-tay" : "men-quan-tay",
                    "sub_category:bottomwear",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "subCategory"
            );
        }
        if (containsAnyToken(subCategory, "dress")) {
            return match(
                    mapFemaleDressByUsage(usage),
                    "sub_category:dress",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "subCategory",
                    "usage"
            );
        }
        if (containsAnyToken(subCategory, "innerwear", "sleepwear", "loungewear")) {
            return match(
                    female ? "women-bo-mac-nha" : "men-bo-mac-nha",
                    "sub_category:loungewear",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "subCategory"
            );
        }
        if (containsAnyToken(subCategory, "sports")) {
            return match(
                    female ? "women-set-the-thao" : "men-set-the-thao",
                    "sub_category:sports",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "subCategory"
            );
        }
        return null;
    }

    private RuleMatch matchWomenTopwearRefinement(String descriptiveText, String rulePrefix) {
        if (containsAnyToken(descriptiveText, "crop", "cropped", "croptop", "corset", "bustier")) {
            return match(
                    "women-ao-croptop",
                    rulePrefix + ":women_top_crop_family",
                    MappingConfidence.STRONG_MATCH,
                    ruleSourceField(rulePrefix),
                    "productDisplayName"
            );
        }
        if (containsAnyToken(
                descriptiveText,
                "shirt",
                "shirts",
                "button down",
                "buttondown",
                "button up",
                "buttonup",
                "button front",
                "shirt jacket"
        )) {
            return match(
                    "women-ao-so-mi",
                    rulePrefix + ":women_top_shirt_family",
                    MappingConfidence.STRONG_MATCH,
                    ruleSourceField(rulePrefix),
                    "productDisplayName"
            );
        }
        if (containsAnyToken(
                descriptiveText,
                "blouse",
                "blouses",
                "cami",
                "camisole",
                "camisoles",
                "tank",
                "tanks",
                "peplum"
        )) {
            return match(
                    "women-ao-kieu",
                    rulePrefix + ":women_top_fashion_family",
                    MappingConfidence.STRONG_MATCH,
                    ruleSourceField(rulePrefix),
                    "productDisplayName"
            );
        }
        return null;
    }

    private RuleMatch matchDescriptiveText(GapProductImportRunner.StyleRow row) {
        if (!"accessories".equals(normalizedToken(row.masterCategory()))) {
            return null;
        }

        String descriptiveText = descriptiveText(row);
        if (descriptiveText.isBlank()) {
            return null;
        }

        return matchAccessoryText(
                descriptiveText,
                "descriptive_text",
                MappingConfidence.STRONG_MATCH,
                true
        );
    }

    private RuleMatch matchUsage(GapProductImportRunner.StyleRow row) {
        String usage = normalizedToken(row.usage());
        if (usage.isBlank()) {
            return null;
        }

        if ("accessories".equals(normalizedToken(row.masterCategory()))) {
            return null;
        }

        boolean female = isFemale(row.gender());
        if (containsAnyToken(usage, "sports")) {
            return match(
                    female ? "women-ao-the-thao" : "men-ao-the-thao",
                    "usage:sports",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "usage"
            );
        }
        if (containsAnyToken(usage, "party")) {
            return match(
                    female ? "women-vay-du-tiec" : "men-quan-tay",
                    "usage:party",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "usage"
            );
        }
        if (containsAnyToken(usage, "formal")) {
            return match(
                    female ? "women-vay-cong-so" : "men-quan-tay",
                    "usage:formal",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "usage"
            );
        }
        if (containsAnyToken(usage, "home")) {
            return match(
                    female ? "women-bo-mac-nha" : "men-bo-mac-nha",
                    "usage:home",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "usage"
            );
        }
        return null;
    }

    private RuleMatch matchGenderFallback(GapProductImportRunner.StyleRow row) {
        if ("accessories".equals(normalizedToken(row.masterCategory()))) {
            return null;
        }

        if (isFemale(row.gender())) {
            return match(
                    "women-ao-kieu",
                    "gender_fallback:women_default",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "gender"
            );
        }
        if (isMale(row.gender())) {
            return match(
                    "men-ao-thun",
                    "gender_fallback:men_default",
                    MappingConfidence.HEURISTIC_FALLBACK,
                    "gender"
            );
        }
        return null;
    }

    private RuleMatch matchAccessoryText(
            String source,
            String fieldName,
            MappingConfidence confidence,
            boolean useWordAwareTokens
    ) {
        if (useWordAwareTokens) {
            if (containsAnyToken(source, "crossbody", "messenger", "sling")) {
                return match("tui-deo-cheo", fieldName + ":crossbody_family", confidence, fieldName);
            }
            if (containsAnyToken(source, "handbag", "handbags", "tote", "totes", "hobo", "satchel", "satchels", "clutch", "clutches", "bag", "bags")) {
                return match("tui-xach", fieldName + ":handbag_family", confidence, fieldName);
            }
            if (containsAnyToken(source, "backpack", "backpacks")) {
                return match("balo", fieldName + ":backpack", confidence, fieldName);
            }
            if (containsAnyToken(source, "wallet", "wallets")) {
                return match("vi", fieldName + ":wallet", confidence, fieldName);
            }
            if (containsAnyToken(source, "belt", "belts")) {
                return match("that-lung", fieldName + ":belt", confidence, fieldName);
            }
            if (containsAnyToken(source, "cap", "caps", "hat", "hats", "beanie", "beanies")) {
                return match("non-mu", fieldName + ":headwear", confidence, fieldName);
            }
            if (containsAnyToken(source, "scarf", "scarves", "stole", "stoles")) {
                return match("khan", fieldName + ":scarf", confidence, fieldName);
            }
            if (containsAnyToken(source, "sock", "socks")) {
                return match("tat", fieldName + ":socks", confidence, fieldName);
            }
            if (containsAnyToken(source, "sunglass", "sunglasses", "eyewear", "polarized")) {
                return match("kinh-mat", fieldName + ":sunglasses", confidence, fieldName);
            }
            return null;
        }

        if (containsAnyToken(source, "crossbody", "messenger", "sling")) {
            return match("tui-deo-cheo", fieldName + ":crossbody_family", confidence, fieldName);
        }
        if (containsAnyToken(source, "handbag", "handbags", "tote", "totes", "hobo", "satchel", "satchels", "clutch", "clutches", "bag", "bags")) {
            return match("tui-xach", fieldName + ":handbag_family", confidence, fieldName);
        }
        if (containsAnyToken(source, "backpack", "backpacks")) {
            return match("balo", fieldName + ":backpack", confidence, fieldName);
        }
        if (containsAnyToken(source, "wallet", "wallets")) {
            return match("vi", fieldName + ":wallet", confidence, fieldName);
        }
        if (containsAnyToken(source, "belt", "belts")) {
            return match("that-lung", fieldName + ":belt", confidence, fieldName);
        }
        if (containsAnyToken(source, "cap", "caps", "hat", "hats", "beanie", "beanies")) {
            return match("non-mu", fieldName + ":headwear", confidence, fieldName);
        }
        if (containsAnyToken(source, "scarf", "scarves", "stole", "stoles")) {
            return match("khan", fieldName + ":scarf", confidence, fieldName);
        }
        if (containsAnyToken(source, "sock", "socks")) {
            return match("tat", fieldName + ":socks", confidence, fieldName);
        }
        if (containsAnyToken(source, "sunglass", "sunglasses", "eyewear", "polarized")) {
            return match("kinh-mat", fieldName + ":sunglasses", confidence, fieldName);
        }
        return null;
    }

    private RuleMatch match(
            String slug,
            String rule,
            MappingConfidence confidence,
            String... sourceFieldsUsed
    ) {
        return new RuleMatch(
                slug,
                rule,
                confidence,
                List.of(sourceFieldsUsed)
        );
    }

    private String ruleSourceField(String rulePrefix) {
        return switch (rulePrefix) {
            case "article_type" -> "articleType";
            case "sub_category" -> "subCategory";
            default -> rulePrefix;
        };
    }

    private String mapFemaleDressByUsage(String usage) {
        if (containsAnyToken(usage, "party")) {
            return "women-vay-du-tiec";
        }
        if (containsAnyToken(usage, "formal")) {
            return "women-vay-cong-so";
        }
        if (containsAnyToken(usage, "ethnic")) {
            return "women-vay-maxi";
        }
        return "women-vay-lien";
    }

    private String apparelEvidenceText(GapProductImportRunner.StyleRow row) {
        return normalizeEvidenceText(String.join(" ",
                row.articleType(),
                row.productDisplayName(),
                row.productDetails()
        ));
    }

    private String descriptiveText(GapProductImportRunner.StyleRow row) {
        return normalizeEvidenceText(String.join(" ",
                row.articleType(),
                row.productDisplayName(),
                row.productDetails()
        ));
    }

    private boolean isFemale(String gender) {
        String token = normalizedToken(gender);
        return token.equals("women") || token.equals("girls");
    }

    private boolean isMale(String gender) {
        String token = normalizedToken(gender);
        return token.equals("men") || token.equals("boys");
    }

    private boolean containsAnyToken(String source, String... tokens) {
        String normalizedSource = normalizeEvidenceText(source);
        if (normalizedSource.isBlank()) {
            return false;
        }
        String paddedSource = " " + normalizedSource + " ";
        for (String token : tokens) {
            String normalizedToken = normalizeEvidenceText(token);
            if (!normalizedToken.isBlank() && paddedSource.contains(" " + normalizedToken + " ")) {
                return true;
            }
        }
        return false;
    }

    private String normalizeEvidenceText(String value) {
        String normalized = normalizedToken(value);
        if (normalized.isBlank()) {
            return "";
        }
        return normalized.replaceAll("[^\\p{Alnum}]+", " ").trim().replaceAll("\\s+", " ");
    }

    private String normalizedToken(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    enum MappingConfidence {
        STRONG_MATCH,
        HEURISTIC_FALLBACK,
        SOURCE_GAP_FALLBACK
    }

    record MappingResult(
            String chosenLeafSlug,
            MappingConfidence confidence,
            String winningRule,
            List<String> sourceFieldsUsed,
            List<String> fallbackPath,
            Set<String> rawCandidateSlugs
    ) {
        boolean isImportable() {
            return chosenLeafSlug != null
                    && !chosenLeafSlug.isBlank()
                    && confidence != MappingConfidence.SOURCE_GAP_FALLBACK;
        }

        String confidenceLabel() {
            return confidence.name().toLowerCase(Locale.ROOT);
        }
    }

    private record RuleMatch(
            String slug,
            String rule,
            MappingConfidence confidence,
            List<String> sourceFieldsUsed
    ) {
    }
}
