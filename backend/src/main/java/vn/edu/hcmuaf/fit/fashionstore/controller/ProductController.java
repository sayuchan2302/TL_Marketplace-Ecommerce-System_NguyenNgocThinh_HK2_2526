package vn.edu.hcmuaf.fit.fashionstore.controller;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ProductRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorProductPageResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorProductSummaryResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext.UserContext;
import vn.edu.hcmuaf.fit.fashionstore.service.ProductService;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;
    private final AuthContext authContext;

    public ProductController(ProductService productService, AuthContext authContext) {
        this.productService = productService;
        this.authContext = authContext;
    }

    @GetMapping
    public ResponseEntity<List<Product>> getAll() {
        return ResponseEntity.ok(productService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(productService.findById(id));
    }

    @GetMapping("/slug/{slug}")
    public ResponseEntity<Product> getBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(productService.findBySlug(slug));
    }

    @GetMapping("/sku/{sku}")
    public ResponseEntity<Product> getBySku(@PathVariable String sku) {
        return ResponseEntity.ok(productService.findBySku(sku));
    }

    @GetMapping("/store/{storeId}")
    public ResponseEntity<Page<Product>> getByStore(
            @PathVariable String storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(productService.findActiveByStoreIdentifier(storeId, pageable));
    }

    @GetMapping("/my-store")
    public ResponseEntity<VendorProductPageResponse> getMyStoreProducts(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) UUID storeId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, name = "q") String keyword,
            @RequestParam(required = false, name = "category_id") UUID categoryId,
            @RequestParam(required = false, name = "inventory") String inventoryState) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        Pageable pageable = PageRequest.of(page, size);

        Product.ProductStatus parsedStatus = parseProductStatus(status);
        ProductService.InventoryState parsedInventory = parseInventoryState(inventoryState);

        return ResponseEntity.ok(
                productService.getVendorProductPage(
                        effectiveStoreId,
                        parsedStatus,
                        keyword,
                        categoryId,
                        parsedInventory,
                        pageable
                )
        );
    }

    @PostMapping
    public ResponseEntity<VendorProductSummaryResponse> create(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody ProductRequest request) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID storeId = authContext.resolveStoreId(ctx, null);
        return ResponseEntity.ok(productService.createVendorProduct(request, storeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<VendorProductSummaryResponse> update(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id,
            @RequestBody ProductRequest request) {
        UserContext ctx = authContext.requireVendor(authHeader);

        if (ctx.isAdmin()) {
            return ResponseEntity.ok(productService.updateProductSummary(id, request));
        }

        return ResponseEntity.ok(productService.updateVendorProduct(id, ctx.getStoreId(), request));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<VendorProductSummaryResponse> patch(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id,
            @RequestBody ProductRequest request) {
        return update(authHeader, id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id) {
        UserContext ctx = authContext.requireVendor(authHeader);

        if (ctx.isAdmin()) {
            productService.delete(id);
        } else {
            productService.deleteForStore(id, ctx.getStoreId());
        }

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/store/{storeId}/count")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Long> getStoreProductCount(@PathVariable UUID storeId) {
        return ResponseEntity.ok(productService.countByStoreId(storeId));
    }

    private Product.ProductStatus parseProductStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank() || rawStatus.equalsIgnoreCase("all")) {
            return null;
        }

        String normalized = rawStatus.trim().toUpperCase(Locale.ROOT);
        String resolved = switch (normalized) {
            case "HIDDEN" -> "DRAFT";
            default -> normalized;
        };

        try {
            return Product.ProductStatus.valueOf(resolved);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported product status: " + rawStatus);
        }
    }

    private ProductService.InventoryState parseInventoryState(String rawInventory) {
        if (rawInventory == null || rawInventory.isBlank()) {
            return null;
        }

        String normalized = rawInventory.trim().toUpperCase(Locale.ROOT);
        try {
            return ProductService.InventoryState.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported inventory filter: " + rawInventory);
        }
    }
}
