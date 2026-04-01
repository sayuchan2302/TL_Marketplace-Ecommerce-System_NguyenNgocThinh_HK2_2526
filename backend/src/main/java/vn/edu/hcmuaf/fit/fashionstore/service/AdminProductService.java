package vn.edu.hcmuaf.fit.fashionstore.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.StockAdjustmentRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminProductModerationResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminProductResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminVariantResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.InventoryLedgerResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.InventoryLedger;
import vn.edu.hcmuaf.fit.fashionstore.entity.Notification;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductAuditLog;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductImage;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductVariant;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.repository.InventoryLedgerRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.NotificationRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductAuditLogRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductVariantRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.specification.ProductModerationSpecification;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminProductService {

    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final InventoryLedgerRepository ledgerRepository;
    private final ProductAuditLogRepository productAuditLogRepository;
    private final StoreRepository storeRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public Page<AdminProductModerationResponse> getAdminProducts(
            UUID storeId,
            UUID categoryId,
            Product.ApprovalStatus status,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String searchKeyword,
            Pageable pageable
    ) {
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "minPrice must be <= maxPrice");
        }

        Specification<Product> specification = ProductModerationSpecification.filterBy(
                storeId,
                categoryId,
                status,
                minPrice,
                maxPrice,
                searchKeyword
        );

        Page<Product> productPage = productRepository.findAll(specification, pageable);
        Map<UUID, String> storeNames = resolveStoreNames(productPage.getContent());
        Map<UUID, Long> salesByProductId = resolveDeliveredSales(productPage.getContent());

        return productPage.map(product -> toModerationResponse(
                product,
                storeNames.get(product.getStoreId()),
                salesByProductId.getOrDefault(product.getId(), 0L)
        ));
    }

    @Transactional
    public AdminProductModerationResponse toggleApprovalStatus(
            UUID productId,
            Product.ApprovalStatus targetStatus,
            String adminEmail
    ) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        Product.ApprovalStatus currentStatus = effectiveApprovalStatus(product);
        Product.ApprovalStatus nextStatus;
        if (targetStatus == null) {
            nextStatus = currentStatus == Product.ApprovalStatus.APPROVED
                    ? Product.ApprovalStatus.BANNED
                    : Product.ApprovalStatus.APPROVED;
        } else if (targetStatus == Product.ApprovalStatus.APPROVED || targetStatus == Product.ApprovalStatus.BANNED) {
            nextStatus = targetStatus;
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetStatus must be APPROVED or BANNED");
        }

        if (currentStatus == nextStatus) {
            String storeName = resolveStoreName(product.getStoreId());
            long sales = resolveDeliveredSales(List.of(product)).getOrDefault(product.getId(), 0L);
            return toModerationResponse(product, storeName, sales);
        }

        product.setApprovalStatus(nextStatus);
        productRepository.save(product);

        ProductAuditLog.Action action = nextStatus == Product.ApprovalStatus.APPROVED
                ? ProductAuditLog.Action.APPROVED
                : ProductAuditLog.Action.BANNED;

        String reason = "Status transitioned from " + currentStatus + " to " + nextStatus;
        logAudit(product.getId(), resolveAdminId(adminEmail), action, reason);

        String storeName = resolveStoreName(product.getStoreId());
        long sales = resolveDeliveredSales(List.of(product)).getOrDefault(product.getId(), 0L);
        return toModerationResponse(product, storeName, sales);
    }

    @Transactional
    public AdminProductModerationResponse rejectProduct(UUID productId, String reason, String adminEmail) {
        String normalizedReason = reason == null ? "" : reason.trim();
        if (normalizedReason.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reason is required");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        product.setApprovalStatus(Product.ApprovalStatus.REJECTED);
        productRepository.save(product);

        logAudit(
                product.getId(),
                resolveAdminId(adminEmail),
                ProductAuditLog.Action.REJECTED,
                normalizedReason
        );
        notifyVendorOnReject(product, normalizedReason);

        String storeName = resolveStoreName(product.getStoreId());
        long sales = resolveDeliveredSales(List.of(product)).getOrDefault(product.getId(), 0L);
        return toModerationResponse(product, storeName, sales);
    }

    @Transactional
    public int bulkApproveProducts(List<UUID> productIds, String adminEmail) {
        if (productIds == null || productIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "productIds must not be empty");
        }

        List<Product> products = productRepository.findAllById(productIds);
        UUID adminId = resolveAdminId(adminEmail);
        int updated = 0;

        for (Product product : products) {
            if (effectiveApprovalStatus(product) == Product.ApprovalStatus.APPROVED) {
                continue;
            }

            product.setApprovalStatus(Product.ApprovalStatus.APPROVED);
            logAudit(
                    product.getId(),
                    adminId,
                    ProductAuditLog.Action.BULK_APPROVED,
                    "Bulk approved by admin"
            );
            updated += 1;
        }

        productRepository.saveAll(products);
        return updated;
    }

    // Legacy admin-inventory detail endpoint (keep for backward compatibility)
    @Transactional(readOnly = true)
    public AdminProductResponse getProductBySku(String sku) {
        Product p = productRepository.findBySku(sku).orElseThrow(() -> new RuntimeException("Product not found"));
        return toAdminProductResponse(p);
    }

    @Transactional
    public void adjustStock(StockAdjustmentRequest request, String actor) {
        Product product = productRepository.findBySku(request.getSku()).orElse(null);
        if (product != null) {
            int delta = request.getAfter() - request.getBefore();
            product.setStockQuantity(request.getAfter());
            productRepository.save(product);

            InventoryLedger ledger = InventoryLedger.builder()
                    .productSku(product.getSku())
                    .actor(actor)
                    .source(InventoryLedger.InventorySource.MANUAL_ADJUSTMENT)
                    .reason(request.getSuggestedReason())
                    .delta(delta)
                    .beforeStock(request.getBefore())
                    .afterStock(request.getAfter())
                    .build();
            ledgerRepository.save(ledger);
            return;
        }

        ProductVariant variant = productVariantRepository.findBySku(request.getSku())
                .orElseThrow(() -> new RuntimeException("Product or Variant not found"));

        int delta = request.getAfter() - request.getBefore();
        variant.setStockQuantity(request.getAfter());
        productVariantRepository.save(variant);

        InventoryLedger ledger = InventoryLedger.builder()
                .productSku(variant.getSku())
                .actor(actor)
                .source(InventoryLedger.InventorySource.MANUAL_ADJUSTMENT)
                .reason(request.getSuggestedReason())
                .delta(delta)
                .beforeStock(request.getBefore())
                .afterStock(request.getAfter())
                .build();
        ledgerRepository.save(ledger);

        Product parent = variant.getProduct();
        int totalStock = parent.getVariants().stream().mapToInt(ProductVariant::getStockQuantity).sum();
        parent.setStockQuantity(totalStock);
        productRepository.save(parent);
    }

    @Transactional
    public void updatePrice(String sku, Double price) {
        Product product = productRepository.findBySku(sku).orElse(null);
        if (product != null) {
            product.setBasePrice(BigDecimal.valueOf(price));
            productRepository.save(product);
            return;
        }

        productVariantRepository.findBySku(sku)
                .orElseThrow(() -> new RuntimeException("Product or Variant not found"));
        throw new RuntimeException("Cannot update price directly on variant from this endpoint");
    }

    private AdminProductModerationResponse toModerationResponse(Product product, String storeName, long soldCount) {
        String thumbnail = orderedImages(product).stream()
                .map(ProductImage::getUrl)
                .filter(this::hasText)
                .findFirst()
                .orElse("");

        List<String> images = orderedImages(product).stream()
                .map(ProductImage::getUrl)
                .filter(this::hasText)
                .toList();

        return AdminProductModerationResponse.builder()
                .id(product.getId())
                .productCode(resolveProductCode(product))
                .name(product.getName())
                .thumbnail(thumbnail)
                .storeId(product.getStoreId())
                .storeName(storeName)
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .price(resolveEffectivePrice(product))
                .sales(soldCount)
                .stock(product.getStockQuantity() == null ? 0 : product.getStockQuantity())
                .productStatus(product.getStatus())
                .approvalStatus(effectiveApprovalStatus(product))
                .description(product.getDescription())
                .images(images)
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private AdminProductResponse toAdminProductResponse(Product product) {
        List<AdminVariantResponse> matrix = product.getVariants().stream().map(v ->
                AdminVariantResponse.builder()
                        .id(v.getId().toString())
                        .size(v.getSize())
                        .color(v.getColor())
                        .sku(v.getSku())
                        .price(v.getPrice().doubleValue())
                        .stock(v.getStockQuantity())
                        .build()
        ).toList();

        List<InventoryLedgerResponse> ledger = ledgerRepository
                .findByProductSkuOrderByCreatedAtDesc(product.getSku() != null ? product.getSku() : product.getId().toString(), Pageable.ofSize(10))
                .stream().map(l -> InventoryLedgerResponse.builder()
                        .id(l.getId().toString())
                        .at(l.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                        .actor(l.getActor())
                        .source(l.getSource().name().toLowerCase(Locale.ROOT))
                        .reason(l.getReason())
                        .delta(l.getDelta())
                        .beforeStock(l.getBeforeStock())
                        .afterStock(l.getAfterStock())
                        .build()
                ).toList();

        int totalStock = resolveTotalStock(product);

        String statusType = totalStock <= 0 ? "out" : (totalStock < 10 ? "low" : "active");
        String status = totalStock <= 0 ? "Out of stock" : (totalStock < 10 ? "Low stock" : "Active");

        String thumb = orderedImages(product).stream()
                .map(ProductImage::getUrl)
                .filter(this::hasText)
                .findFirst()
                .orElse("");

        return AdminProductResponse.builder()
                .id(product.getId())
                .sku(resolveProductCode(product))
                .name(product.getName())
                .category(product.getCategory() != null ? product.getCategory().getName() : "")
                .price(resolveEffectivePrice(product).doubleValue())
                .stock(totalStock)
                .status(status)
                .statusType(statusType)
                .variants(product.getVariants().size() + " variants")
                .thumb(thumb)
                .variantMatrix(matrix)
                .inventoryLedger(ledger)
                .version(1)
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private Map<UUID, String> resolveStoreNames(Collection<Product> products) {
        Set<UUID> storeIds = products.stream()
                .map(Product::getStoreId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (storeIds.isEmpty()) {
            return Map.of();
        }

        return storeRepository.findAllById(storeIds).stream()
                .collect(Collectors.toMap(Store::getId, Store::getName));
    }

    private String resolveStoreName(UUID storeId) {
        if (storeId == null) {
            return null;
        }
        return storeRepository.findById(storeId).map(Store::getName).orElse(null);
    }

    private Map<UUID, Long> resolveDeliveredSales(Collection<Product> products) {
        Map<UUID, Long> salesByProductId = new HashMap<>();
        if (products == null || products.isEmpty()) {
            return salesByProductId;
        }

        Map<UUID, List<UUID>> productIdsByStore = products.stream()
                .filter(product -> product.getStoreId() != null && product.getId() != null)
                .collect(Collectors.groupingBy(
                        Product::getStoreId,
                        Collectors.mapping(Product::getId, Collectors.toList())
                ));

        for (Map.Entry<UUID, List<UUID>> entry : productIdsByStore.entrySet()) {
            if (entry.getValue().isEmpty()) {
                continue;
            }

            List<OrderRepository.ProductSalesProjection> rows =
                    orderRepository.findDeliveredProductSalesByStoreAndProductIds(entry.getKey(), entry.getValue());
            for (OrderRepository.ProductSalesProjection row : rows) {
                if (row.getProductId() == null) {
                    continue;
                }
                salesByProductId.put(row.getProductId(), row.getSoldCount() == null ? 0L : row.getSoldCount());
            }
        }

        return salesByProductId;
    }

    private void logAudit(UUID productId, UUID adminId, ProductAuditLog.Action action, String reason) {
        ProductAuditLog log = ProductAuditLog.builder()
                .productId(productId)
                .adminId(adminId)
                .action(action)
                .reason(reason)
                .build();
        productAuditLogRepository.save(log);
    }

    private void notifyVendorOnReject(Product product, String reason) {
        UUID storeId = product.getStoreId();
        if (storeId == null) {
            return;
        }

        storeRepository.findById(storeId).ifPresent(store -> {
            User owner = store.getOwner();
            if (owner == null) {
                return;
            }

            Notification notification = Notification.builder()
                    .user(owner)
                    .type(Notification.NotificationType.SYSTEM)
                    .title("Product rejected")
                    .message("Product " + resolveProductCode(product) + " was rejected: " + reason)
                    .link("/vendor/products?approvalStatus=REJECTED")
                    .isRead(false)
                    .build();
            notificationRepository.save(notification);
        });
    }

    private UUID resolveAdminId(String adminEmail) {
        if (!hasText(adminEmail)) {
            return null;
        }
        return userRepository.findByEmail(adminEmail.trim())
                .map(User::getId)
                .orElse(null);
    }

    private Product.ApprovalStatus effectiveApprovalStatus(Product product) {
        return product.getApprovalStatus() != null ? product.getApprovalStatus() : Product.ApprovalStatus.APPROVED;
    }

    private String resolveProductCode(Product product) {
        if (hasText(product.getSku())) {
            return product.getSku().trim();
        }
        return product.getId() != null ? product.getId().toString() : "";
    }

    private int resolveTotalStock(Product product) {
        if (product.getVariants() == null || product.getVariants().isEmpty()) {
            return product.getStockQuantity() == null ? 0 : product.getStockQuantity();
        }

        return product.getVariants().stream()
                .filter(variant -> !Boolean.FALSE.equals(variant.getIsActive()))
                .map(ProductVariant::getStockQuantity)
                .filter(Objects::nonNull)
                .reduce(0, Integer::sum);
    }

    private BigDecimal resolveEffectivePrice(Product product) {
        BigDecimal effective = product.getEffectivePrice();
        if (effective != null) {
            return effective;
        }
        if (product.getBasePrice() != null) {
            return product.getBasePrice();
        }
        return BigDecimal.ZERO;
    }

    private List<ProductImage> orderedImages(Product product) {
        if (product.getImages() == null || product.getImages().isEmpty()) {
            return List.of();
        }

        return product.getImages().stream()
                .filter(Objects::nonNull)
                .sorted(
                        Comparator.comparing((ProductImage image) -> !Boolean.TRUE.equals(image.getIsPrimary()))
                                .thenComparing(
                                        image -> image.getSortOrder() == null ? Integer.MAX_VALUE : image.getSortOrder()
                                )
                )
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
