package vn.edu.hcmuaf.fit.fashionstore.repository.specification;

import org.springframework.data.jpa.domain.Specification;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class ProductModerationSpecification {

    private ProductModerationSpecification() {
    }

    public static Specification<Product> filterBy(
            UUID storeId,
            UUID categoryId,
            Product.ApprovalStatus approvalStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String searchKeyword
    ) {
        return (root, query, cb) -> {
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                root.fetch("category", jakarta.persistence.criteria.JoinType.LEFT);
                root.fetch("images", jakarta.persistence.criteria.JoinType.LEFT);
                query.distinct(true);
            }

            List<Predicate> predicates = new ArrayList<>();

            if (storeId != null) {
                predicates.add(cb.equal(root.get("storeId"), storeId));
            }

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (approvalStatus != null) {
                predicates.add(cb.equal(root.get("approvalStatus"), approvalStatus));
            }

            Expression<BigDecimal> effectivePriceExpr = cb.<BigDecimal>selectCase()
                    .when(
                            cb.and(
                                    cb.isNotNull(root.get("salePrice")),
                                    cb.greaterThan(root.get("salePrice"), BigDecimal.ZERO)
                            ),
                            root.get("salePrice")
                    )
                    .otherwise(root.get("basePrice"));

            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(effectivePriceExpr, minPrice));
            }

            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(effectivePriceExpr, maxPrice));
            }

            String normalizedKeyword = searchKeyword == null ? "" : searchKeyword.trim().toLowerCase(Locale.ROOT);
            if (!normalizedKeyword.isEmpty()) {
                String keywordLike = "%" + normalizedKeyword + "%";

                Predicate productNameMatch = cb.like(cb.lower(cb.coalesce(root.get("name"), "")), keywordLike);
                Predicate productCodeMatch = cb.like(cb.lower(cb.coalesce(root.get("sku"), "")), keywordLike);

                Subquery<UUID> storeSubquery = query.subquery(UUID.class);
                var storeRoot = storeSubquery.from(Store.class);
                storeSubquery.select(storeRoot.get("id"));
                storeSubquery.where(cb.like(cb.lower(cb.coalesce(storeRoot.get("name"), "")), keywordLike));
                Predicate storeNameMatch = root.get("storeId").in(storeSubquery);

                predicates.add(cb.or(productNameMatch, productCodeMatch, storeNameMatch));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
