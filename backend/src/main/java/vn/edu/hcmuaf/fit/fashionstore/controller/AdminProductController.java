package vn.edu.hcmuaf.fit.fashionstore.controller;

import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.AdminBulkApproveProductsRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.AdminProductRejectRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ProductPriceUpdateRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.StockAdjustmentRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminProductModerationResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminProductResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.service.AdminProductService;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminProductController {

    private final AdminProductService adminProductService;

    @GetMapping
    public ResponseEntity<Page<AdminProductModerationResponse>> getAllProducts(
            @RequestParam(required = false) UUID storeId,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) Product.ApprovalStatus status,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) String searchKeyword,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable
    ) {
        return ResponseEntity.ok(adminProductService.getAdminProducts(
                storeId,
                categoryId,
                status,
                minPrice,
                maxPrice,
                searchKeyword,
                pageable
        ));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AdminProductModerationResponse> toggleStatus(
            @PathVariable UUID id,
            @RequestParam(required = false) Product.ApprovalStatus targetStatus,
            Authentication authentication
    ) {
        String adminEmail = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(adminProductService.toggleApprovalStatus(id, targetStatus, adminEmail));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<AdminProductModerationResponse> rejectProduct(
            @PathVariable UUID id,
            @Valid @RequestBody AdminProductRejectRequest request,
            Authentication authentication
    ) {
        String adminEmail = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(adminProductService.rejectProduct(id, request.getReason(), adminEmail));
    }

    @PatchMapping("/bulk-approve")
    public ResponseEntity<Map<String, Object>> bulkApprove(
            @Valid @RequestBody AdminBulkApproveProductsRequest request,
            Authentication authentication
    ) {
        String adminEmail = authentication != null ? authentication.getName() : null;
        int updatedCount = adminProductService.bulkApproveProducts(request.getProductIds(), adminEmail);
        return ResponseEntity.ok(Map.of(
                "requested", request.getProductIds().size(),
                "updated", updatedCount
        ));
    }

    // Legacy endpoints kept for existing admin inventory flow.
    @GetMapping("/{sku}")
    public ResponseEntity<AdminProductResponse> getProductBySku(@PathVariable String sku) {
        return ResponseEntity.ok(adminProductService.getProductBySku(sku));
    }

    @PostMapping("/adjust-stock")
    public ResponseEntity<Void> adjustStock(@RequestBody StockAdjustmentRequest request, Authentication authentication) {
        String actor = authentication != null ? authentication.getName() : "system";
        adminProductService.adjustStock(request, actor);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{sku}/price")
    public ResponseEntity<Void> updatePrice(@PathVariable String sku, @RequestBody ProductPriceUpdateRequest request) {
        adminProductService.updatePrice(sku, request.getPrice());
        return ResponseEntity.ok().build();
    }
}
