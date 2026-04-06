package vn.edu.hcmuaf.fit.fashionstore.controller;

import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReviewRequestDTO;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReviewReplyRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReviewStatusUpdateRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.ReviewEligibleItemResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.ReviewResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorReviewSummaryResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Review;
import vn.edu.hcmuaf.fit.fashionstore.exception.ForbiddenException;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext;
import vn.edu.hcmuaf.fit.fashionstore.service.ReviewService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewService reviewService;
    private final AuthContext authContext;

    public ReviewController(ReviewService reviewService, AuthContext authContext) {
        this.reviewService = reviewService;
        this.authContext = authContext;
    }

    @GetMapping("/product/{productId}")
    public ResponseEntity<List<ReviewResponse>> getApprovedProductReviews(@PathVariable UUID productId) {
        return ResponseEntity.ok(reviewService.getApprovedProductReviews(productId));
    }

    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<ReviewResponse>> getApprovedStoreReviews(@PathVariable UUID storeId) {
        return ResponseEntity.ok(reviewService.getApprovedStoreReviews(storeId));
    }

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ReviewResponse>> getMyReviews(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) UUID orderId,
            @RequestParam(required = false) UUID productId) {
        AuthContext.UserContext ctx = authContext.fromAuthHeader(authHeader);
        return ResponseEntity.ok(reviewService.getCustomerReviews(ctx.getUserId(), orderId, productId));
    }

    @GetMapping("/my/eligible")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ReviewEligibleItemResponse>> getMyEligibleReviews(
            @RequestHeader("Authorization") String authHeader
    ) {
        AuthContext.UserContext ctx = authContext.fromAuthHeader(authHeader);
        if (!ctx.isCustomer() && !ctx.isVendor()) {
            throw new ForbiddenException("Only customer or vendor accounts can view eligible review items");
        }
        return ResponseEntity.ok(reviewService.getEligibleCustomerReviews(ctx.getUserId()));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ReviewResponse> submitReview(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody ReviewRequestDTO request
    ) {
        AuthContext.UserContext ctx = authContext.fromAuthHeader(authHeader);
        if (!ctx.isCustomer() && !ctx.isVendor()) {
            throw new ForbiddenException("Only customer or vendor accounts can submit reviews");
        }
        return ResponseEntity.ok(reviewService.submitCustomerReview(ctx.getUserId(), request));
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Page<ReviewResponse>> getAllReviews(
            @RequestParam(required = false) Review.ReviewStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(reviewService.getAllReviews(status, pageable));
    }

    @PatchMapping("/admin/{id}/status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ReviewResponse> updateReviewStatus(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewStatusUpdateRequest request) {
        return ResponseEntity.ok(reviewService.updateStatus(id, request.getStatus()));
    }

    @PostMapping("/admin/{id}/reply")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ReviewResponse> addAdminReply(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewReplyRequest request) {
        return ResponseEntity.ok(reviewService.addReply(id, request.getReply()));
    }

    @GetMapping("/my-store")
    @PreAuthorize("hasAnyRole('VENDOR', 'SUPER_ADMIN')")
    public ResponseEntity<Page<ReviewResponse>> getMyStoreReviews(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) UUID storeId,
            @RequestParam(required = false) Review.ReviewStatus status,
            @RequestParam(required = false, name = "q") String keyword,
            @RequestParam(required = false) Boolean needReply,
            @RequestParam(required = false) Integer maxRating,
            Pageable pageable) {
        AuthContext.UserContext ctx = authContext.requireVendor(authHeader);
        UUID resolvedStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        return ResponseEntity.ok(reviewService.getStoreReviews(
                resolvedStoreId,
                status,
                keyword,
                needReply,
                maxRating,
                pageable
        ));
    }

    @GetMapping("/my-store/summary")
    @PreAuthorize("hasAnyRole('VENDOR', 'SUPER_ADMIN')")
    public ResponseEntity<VendorReviewSummaryResponse> getMyStoreReviewSummary(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) UUID storeId
    ) {
        AuthContext.UserContext ctx = authContext.requireVendor(authHeader);
        UUID resolvedStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        return ResponseEntity.ok(reviewService.getStoreReviewSummary(resolvedStoreId));
    }

    @PostMapping("/my-store/{id}/reply")
    @PreAuthorize("hasAnyRole('VENDOR', 'SUPER_ADMIN')")
    public ResponseEntity<ReviewResponse> addStoreReply(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID id,
            @RequestParam(required = false) UUID storeId,
            @Valid @RequestBody ReviewReplyRequest request) {
        AuthContext.UserContext ctx = authContext.requireVendor(authHeader);
        UUID resolvedStoreId = authContext.resolveRequiredStoreId(ctx, storeId);
        return ResponseEntity.ok(reviewService.addStoreReply(id, resolvedStoreId, request.getReply()));
    }

    @DeleteMapping("/admin/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteReview(@PathVariable UUID id) {
        reviewService.deleteReview(id);
        return ResponseEntity.noContent().build();
    }
}
