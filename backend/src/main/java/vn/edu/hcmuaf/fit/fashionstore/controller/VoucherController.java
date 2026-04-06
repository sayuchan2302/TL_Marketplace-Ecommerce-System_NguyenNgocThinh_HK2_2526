package vn.edu.hcmuaf.fit.fashionstore.controller;

import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.VoucherRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.VoucherStatusUpdateRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VoucherListResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VoucherResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Voucher;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext.UserContext;
import vn.edu.hcmuaf.fit.fashionstore.service.VoucherService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/vouchers")
public class VoucherController {

    private final VoucherService voucherService;
    private final AuthContext authContext;

    public VoucherController(VoucherService voucherService, AuthContext authContext) {
        this.voucherService = voucherService;
        this.authContext = authContext;
    }

    @GetMapping("/public")
    public ResponseEntity<List<VoucherResponse>> listPublicVouchers(
            @RequestParam(value = "storeId", required = false) List<UUID> storeIds) {
        return ResponseEntity.ok(voucherService.listPublic(storeIds));
    }

    @GetMapping("/my-store")
    public ResponseEntity<VoucherListResponse> listMyStoreVouchers(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "storeId", required = false) UUID storeId,
            @RequestParam(value = "status", required = false) Voucher.VoucherStatus status,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        Pageable pageable = PageRequest.of(Math.max(page - 1, 0), Math.max(size, 1));
        return ResponseEntity.ok(voucherService.list(effectiveStoreId, status, keyword, pageable));
    }

    @GetMapping("/my-store/{id}")
    public ResponseEntity<VoucherResponse> getMyStoreVoucher(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "storeId", required = false) UUID storeId,
            @PathVariable UUID id) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        return ResponseEntity.ok(voucherService.get(effectiveStoreId, id));
    }

    @PostMapping("/my-store")
    public ResponseEntity<VoucherResponse> createVoucher(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "storeId", required = false) UUID storeId,
            @Valid @RequestBody VoucherRequest request) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        VoucherResponse response = voucherService.create(effectiveStoreId, request, ctx.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/my-store/{id}")
    public ResponseEntity<VoucherResponse> updateVoucher(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "storeId", required = false) UUID storeId,
            @PathVariable UUID id,
            @Valid @RequestBody VoucherRequest request) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        return ResponseEntity.ok(voucherService.update(effectiveStoreId, id, request, ctx.getEmail()));
    }

    @PatchMapping("/my-store/{id}/status")
    public ResponseEntity<VoucherResponse> updateVoucherStatus(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "storeId", required = false) UUID storeId,
            @PathVariable UUID id,
            @Valid @RequestBody VoucherStatusUpdateRequest request) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        return ResponseEntity.ok(voucherService.updateStatus(effectiveStoreId, id, request, ctx.getEmail()));
    }

    @DeleteMapping("/my-store/{id}")
    public ResponseEntity<Void> deleteVoucher(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "storeId", required = false) UUID storeId,
            @PathVariable UUID id) {
        UserContext ctx = authContext.requireVendor(authHeader);
        UUID effectiveStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        voucherService.delete(effectiveStoreId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VoucherListResponse> listAdminVouchers(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "status", required = false) Voucher.VoucherStatus status,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        authContext.requireAdmin(authHeader);
        Pageable pageable = PageRequest.of(Math.max(page - 1, 0), Math.max(size, 1));
        return ResponseEntity.ok(voucherService.listAdmin(status, keyword, pageable));
    }

    @GetMapping("/admin/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VoucherResponse> getAdminVoucher(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id) {
        authContext.requireAdmin(authHeader);
        return ResponseEntity.ok(voucherService.getAdmin(id));
    }

    @PostMapping("/admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VoucherResponse> createAdminVoucher(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody VoucherRequest request) {
        UserContext ctx = authContext.requireAdmin(authHeader);
        VoucherResponse response = voucherService.createAdmin(request, ctx.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/admin/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VoucherResponse> updateAdminVoucher(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id,
            @Valid @RequestBody VoucherRequest request) {
        UserContext ctx = authContext.requireAdmin(authHeader);
        return ResponseEntity.ok(voucherService.updateAdmin(id, request, ctx.getEmail()));
    }

    @PatchMapping("/admin/{id}/status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<VoucherResponse> updateAdminVoucherStatus(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id,
            @Valid @RequestBody VoucherStatusUpdateRequest request) {
        UserContext ctx = authContext.requireAdmin(authHeader);
        return ResponseEntity.ok(voucherService.updateAdminStatus(id, request, ctx.getEmail()));
    }

    @DeleteMapping("/admin/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteAdminVoucher(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id) {
        authContext.requireAdmin(authHeader);
        voucherService.deleteAdmin(id);
        return ResponseEntity.noContent().build();
    }
}
