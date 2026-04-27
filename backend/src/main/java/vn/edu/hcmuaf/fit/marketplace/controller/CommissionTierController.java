package vn.edu.hcmuaf.fit.marketplace.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmuaf.fit.marketplace.entity.CommissionTier;
import vn.edu.hcmuaf.fit.marketplace.security.AuthContext;
import vn.edu.hcmuaf.fit.marketplace.service.CommissionTierService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/commission-tiers")
public class CommissionTierController {

    private final CommissionTierService commissionTierService;
    private final AuthContext authContext;

    public CommissionTierController(CommissionTierService commissionTierService, AuthContext authContext) {
        this.commissionTierService = commissionTierService;
        this.authContext = authContext;
    }

    @GetMapping
    public ResponseEntity<List<CommissionTier>> getAllActive() {
        return ResponseEntity.ok(commissionTierService.findAllActive());
    }

    @GetMapping("/default")
    public ResponseEntity<CommissionTier> getDefault() {
        return ResponseEntity.ok(commissionTierService.getDefaultTier());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CommissionTier> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(commissionTierService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CommissionTier> create(@RequestBody CreateRequest request) {
        CommissionTier tier = commissionTierService.create(
                request.getName(),
                request.getDescription(),
                request.getRate(),
                request.getMinMonthlyRevenue(),
                request.getMinOrderCount(),
                request.getSortOrder()
        );
        return ResponseEntity.ok(tier);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CommissionTier> update(@PathVariable UUID id, @RequestBody UpdateRequest request) {
        CommissionTier tier = commissionTierService.update(
                id,
                request.getName(),
                request.getDescription(),
                request.getRate(),
                request.getMinMonthlyRevenue(),
                request.getMinOrderCount(),
                request.getSortOrder()
        );
        return ResponseEntity.ok(tier);
    }

    @PatchMapping("/{id}/default")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> setDefault(@PathVariable UUID id) {
        commissionTierService.setDefault(id);
        return ResponseEntity.ok(Map.of("message", "Default tier updated"));
    }

    @PatchMapping("/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> toggleActive(@PathVariable UUID id) {
        commissionTierService.toggleActive(id);
        return ResponseEntity.ok(Map.of("message", "Tier status toggled"));
    }

    @PatchMapping("/{id}/apply-to-store/{storeId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> applyToStore(
            @PathVariable UUID id,
            @PathVariable UUID storeId,
            @RequestHeader("Authorization") String authHeader
    ) {
        AuthContext.UserContext admin = authContext.requireAdmin(authHeader);
        commissionTierService.applyTierToStore(id, storeId, admin.getUserId(), admin.getEmail());
        return ResponseEntity.ok(Map.of("message", "Tier applied to store"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, String>> delete(@PathVariable UUID id) {
        commissionTierService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Tier deleted"));
    }

    public static class CreateRequest {
        private String name;
        private String description;
        private BigDecimal rate;
        private Long minMonthlyRevenue;
        private Integer minOrderCount;
        private Integer sortOrder;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public BigDecimal getRate() { return rate; }
        public void setRate(BigDecimal rate) { this.rate = rate; }
        public Long getMinMonthlyRevenue() { return minMonthlyRevenue; }
        public void setMinMonthlyRevenue(Long minMonthlyRevenue) { this.minMonthlyRevenue = minMonthlyRevenue; }
        public Integer getMinOrderCount() { return minOrderCount; }
        public void setMinOrderCount(Integer minOrderCount) { this.minOrderCount = minOrderCount; }
        public Integer getSortOrder() { return sortOrder; }
        public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    }

    public static class UpdateRequest {
        private String name;
        private String description;
        private BigDecimal rate;
        private Long minMonthlyRevenue;
        private Integer minOrderCount;
        private Integer sortOrder;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public BigDecimal getRate() { return rate; }
        public void setRate(BigDecimal rate) { this.rate = rate; }
        public Long getMinMonthlyRevenue() { return minMonthlyRevenue; }
        public void setMinMonthlyRevenue(Long minMonthlyRevenue) { this.minMonthlyRevenue = minMonthlyRevenue; }
        public Integer getMinOrderCount() { return minOrderCount; }
        public void setMinOrderCount(Integer minOrderCount) { this.minOrderCount = minOrderCount; }
        public Integer getSortOrder() { return sortOrder; }
        public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    }
}
