package vn.edu.hcmuaf.fit.fashionstore.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReturnAdminVerdictRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReturnSubmitRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.ReturnRequestResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.OrderItem;
import vn.edu.hcmuaf.fit.fashionstore.entity.ReturnRequest;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ReturnRequestRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReturnRequestService {

    private final ReturnRequestRepository returnRequestRepository;
    private final OrderRepository orderRepository;
    private final StoreRepository storeRepository;
    private final PublicCodeService publicCodeService;
    private final WalletService walletService;

    public ReturnRequestService(
            ReturnRequestRepository returnRequestRepository,
            OrderRepository orderRepository,
            StoreRepository storeRepository,
            PublicCodeService publicCodeService,
            WalletService walletService
    ) {
        this.returnRequestRepository = returnRequestRepository;
        this.orderRepository = orderRepository;
        this.storeRepository = storeRepository;
        this.publicCodeService = publicCodeService;
        this.walletService = walletService;
    }

    @Transactional
    public ReturnRequestResponse submit(UUID userId, ReturnSubmitRequest payload) {
        if (payload == null || payload.getOrderId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order is required");
        }

        Order order = orderRepository.findById(payload.getOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (order.getUser() == null || !order.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Order does not belong to user");
        }
        if (payload.getItems() == null || payload.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return request must include at least one item");
        }

        Map<UUID, OrderItem> orderItemMap = order.getItems().stream()
                .collect(Collectors.toMap(OrderItem::getId, oi -> oi));

        List<ReturnRequest.ReturnItemSnapshot> snapshots = payload.getItems().stream().map(itemPayload -> {
            OrderItem matched = orderItemMap.get(itemPayload.getOrderItemId());
            if (matched == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid order item");
            }
            if (matched.getStoreId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return item does not belong to a vendor store");
            }

            int requestedQty = itemPayload.getQuantity() == null ? matched.getQuantity() : itemPayload.getQuantity();
            if (requestedQty <= 0 || requestedQty > matched.getQuantity()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid return quantity");
            }

            String evidenceUrl = normalizeOptionalText(itemPayload.getEvidenceUrl());
            if (evidenceUrl.isEmpty()) {
                evidenceUrl = normalizeOptionalText(itemPayload.getAdminImageUrl());
            }

            return new ReturnRequest.ReturnItemSnapshot(
                    matched.getId(),
                    matched.getProductName(),
                    matched.getVariantName(),
                    matched.getProductImage(),
                    evidenceUrl.isEmpty() ? null : evidenceUrl,
                    requestedQty,
                    safeAmount(matched.getUnitPrice())
            );
        }).toList();

        UUID storeId = resolveSingleStoreId(snapshots, orderItemMap);

        ReturnRequest request = ReturnRequest.builder()
                .returnCode(publicCodeService.nextReturnCode())
                .order(order)
                .user(order.getUser())
                .storeId(storeId)
                .reason(payload.getReason())
                .note(payload.getNote())
                .resolution(payload.getResolution())
                .status(ReturnRequest.ReturnStatus.PENDING_VENDOR)
                .items(snapshots)
                .updatedBy(userId.toString())
                .build();

        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional(readOnly = true)
    public Page<ReturnRequestResponse> list(ReturnRequest.ReturnStatus status, Pageable pageable) {
        Page<ReturnRequest> page = status == null
                ? returnRequestRepository.findAll(pageable)
                : returnRequestRepository.findByStatus(status, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ReturnRequestResponse> listForVendor(UUID storeId, ReturnRequest.ReturnStatus status, Pageable pageable) {
        if (storeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Store is required");
        }
        Page<ReturnRequest> page = status == null
                ? returnRequestRepository.findByStoreIdOrderByCreatedAtDesc(storeId, pageable)
                : returnRequestRepository.findByStoreIdAndStatusOrderByCreatedAtDesc(storeId, status, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ReturnRequestResponse get(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional(readOnly = true)
    public ReturnRequestResponse getByCode(String code) {
        ReturnRequest request = returnRequestRepository.findByReturnCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Return request not found"));
        return toResponse(request);
    }

    @Transactional
    public ReturnRequestResponse acceptReturn(UUID returnId, UUID storeId, String actor) {
        ReturnRequest request = findById(returnId);
        assertStoreOwnership(request, storeId);
        assertStatus(request, ReturnRequest.ReturnStatus.PENDING_VENDOR);

        request.setStatus(ReturnRequest.ReturnStatus.ACCEPTED);
        request.setVendorReason(null);
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional
    public ReturnRequestResponse rejectReturn(UUID returnId, UUID storeId, String reason, String actor) {
        String normalizedReason = normalizeRequiredText(reason, "Reject reason is required");
        ReturnRequest request = findById(returnId);
        assertStoreOwnership(request, storeId);
        if (request.getStatus() != ReturnRequest.ReturnStatus.PENDING_VENDOR
                && request.getStatus() != ReturnRequest.ReturnStatus.RECEIVED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Reject action only allowed for pending or received requests"
            );
        }

        request.setStatus(ReturnRequest.ReturnStatus.REJECTED);
        request.setVendorReason(normalizedReason);
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional
    public ReturnRequestResponse markShipping(UUID returnId, UUID userId, String trackingNumber, String carrier, String actor) {
        ReturnRequest request = findById(returnId);
        assertCustomerOwnership(request, userId);
        assertStatus(request, ReturnRequest.ReturnStatus.ACCEPTED);

        request.setStatus(ReturnRequest.ReturnStatus.SHIPPING);
        request.setShippingTrackingNumber(normalizeRequiredText(trackingNumber, "Tracking number is required"));
        request.setShippingCarrier(normalizeRequiredText(carrier, "Carrier is required"));
        request.setShippedAt(LocalDateTime.now());
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional
    public ReturnRequestResponse markReceived(UUID returnId, UUID storeId, String actor) {
        ReturnRequest request = findById(returnId);
        assertStoreOwnership(request, storeId);
        assertStatus(request, ReturnRequest.ReturnStatus.SHIPPING);

        request.setStatus(ReturnRequest.ReturnStatus.RECEIVED);
        request.setReceivedAt(LocalDateTime.now());
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional
    public ReturnRequestResponse confirmReceipt(UUID returnId, UUID storeId, String actor) {
        ReturnRequest request = findById(returnId);
        assertStoreOwnership(request, storeId);
        assertStatus(request, ReturnRequest.ReturnStatus.RECEIVED);

        BigDecimal refundAmount = calculateRefundAmount(request);
        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than zero");
        }

        request.setStatus(ReturnRequest.ReturnStatus.COMPLETED);
        request.setCompletedAt(LocalDateTime.now());
        request.setUpdatedBy(actor);
        ReturnRequest saved = returnRequestRepository.save(request);

        walletService.refundToCustomerFromEscrow(
                saved.getId(),
                saved.getOrder(),
                refundAmount,
                "Refund for return " + resolveReturnCode(saved)
        );
        return toResponse(saved);
    }

    @Transactional
    public ReturnRequestResponse openDispute(UUID returnId, UUID userId, String reason, String actor) {
        ReturnRequest request = findById(returnId);
        assertCustomerOwnership(request, userId);
        assertStatus(request, ReturnRequest.ReturnStatus.REJECTED);

        request.setStatus(ReturnRequest.ReturnStatus.DISPUTED);
        request.setDisputeReason(normalizeRequiredText(reason, "Dispute reason is required"));
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional
    public ReturnRequestResponse cancelByCustomer(UUID returnId, UUID userId, String reason, String actor) {
        ReturnRequest request = findById(returnId);
        assertCustomerOwnership(request, userId);
        if (request.getStatus() != ReturnRequest.ReturnStatus.PENDING_VENDOR
                && request.getStatus() != ReturnRequest.ReturnStatus.ACCEPTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return request can no longer be cancelled");
        }

        request.setStatus(ReturnRequest.ReturnStatus.CANCELLED);
        String normalizedReason = normalizeOptionalText(reason);
        if (!normalizedReason.isEmpty()) {
            String baseNote = normalizeOptionalText(request.getNote());
            String cancelNote = "Customer cancelled request: " + normalizedReason;
            request.setNote(baseNote.isEmpty() ? cancelNote : baseNote + "\n" + cancelNote);
        }
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    @Transactional
    public ReturnRequestResponse finalVerdict(
            UUID returnId,
            ReturnAdminVerdictRequest.VerdictAction action,
            String adminNote,
            String actor
    ) {
        if (action == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verdict action is required");
        }

        ReturnRequest request = findById(returnId);
        assertStatus(request, ReturnRequest.ReturnStatus.DISPUTED);

        if (action == ReturnAdminVerdictRequest.VerdictAction.REFUND_TO_CUSTOMER) {
            BigDecimal refundAmount = calculateRefundAmount(request);
            if (refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than zero");
            }
            request.setStatus(ReturnRequest.ReturnStatus.COMPLETED);
            request.setCompletedAt(LocalDateTime.now());
            request.setAdminNote(normalizeOptionalText(adminNote));
            request.setUpdatedBy(actor);
            ReturnRequest saved = returnRequestRepository.save(request);
            walletService.refundToCustomerFromEscrow(
                    saved.getId(),
                    saved.getOrder(),
                    refundAmount,
                    "Dispute refund for return " + resolveReturnCode(saved)
            );
            return toResponse(saved);
        }

        request.setStatus(ReturnRequest.ReturnStatus.REJECTED);
        request.setAdminNote(normalizeOptionalText(adminNote));
        request.setUpdatedBy(actor);
        return toResponse(returnRequestRepository.save(request));
    }

    private ReturnRequest findById(UUID id) {
        return returnRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Return request not found"));
    }

    private void assertStatus(ReturnRequest request, ReturnRequest.ReturnStatus expected) {
        if (request.getStatus() != expected) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid status transition: " + request.getStatus() + " -> " + expected
            );
        }
    }

    private void assertStoreOwnership(ReturnRequest request, UUID storeId) {
        UUID ownerStoreId = resolveStoreId(request);
        if (storeId == null || ownerStoreId == null || !ownerStoreId.equals(storeId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Return request does not belong to your store");
        }
    }

    private void assertCustomerOwnership(ReturnRequest request, UUID userId) {
        if (request.getUser() == null || request.getUser().getId() == null || !request.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Return request does not belong to this customer");
        }
    }

    private UUID resolveSingleStoreId(List<ReturnRequest.ReturnItemSnapshot> snapshots, Map<UUID, OrderItem> orderItemMap) {
        UUID resolvedStoreId = null;
        for (ReturnRequest.ReturnItemSnapshot snapshot : snapshots) {
            OrderItem item = orderItemMap.get(snapshot.getOrderItemId());
            UUID itemStoreId = item != null ? item.getStoreId() : null;
            if (itemStoreId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return item must belong to a vendor store");
            }
            if (resolvedStoreId == null) {
                resolvedStoreId = itemStoreId;
                continue;
            }
            if (!resolvedStoreId.equals(itemStoreId)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "A return request can only include items from one vendor store"
                );
            }
        }
        return resolvedStoreId;
    }

    private UUID resolveStoreId(ReturnRequest request) {
        if (request.getStoreId() != null) {
            return request.getStoreId();
        }
        return request.getOrder() != null ? request.getOrder().getStoreId() : null;
    }

    private BigDecimal calculateRefundAmount(ReturnRequest request) {
        return request.getItems().stream()
                .map(item -> safeAmount(item.getUnitPrice()).multiply(BigDecimal.valueOf(Math.max(0, item.getQuantity() == null ? 0 : item.getQuantity()))))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String normalizeRequiredText(String value, String message) {
        String normalized = normalizeOptionalText(value);
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        return value == null ? "" : value.trim();
    }

    private BigDecimal safeAmount(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount.max(BigDecimal.ZERO);
    }

    private String resolveReturnCode(ReturnRequest request) {
        return request.getReturnCode() == null || request.getReturnCode().isBlank()
                ? String.valueOf(request.getId())
                : request.getReturnCode();
    }

    private ReturnRequestResponse toResponse(ReturnRequest request) {
        UUID effectiveStoreId = resolveStoreId(request);
        String storeName = effectiveStoreId == null
                ? null
                : storeRepository.findById(effectiveStoreId).map(Store::getName).orElse(null);

        return ReturnRequestResponse.builder()
                .id(request.getId())
                .code(request.getReturnCode())
                .orderId(request.getOrder().getId())
                .orderCode(request.getOrder().getOrderCode())
                .userId(request.getUser().getId())
                .customerName(request.getUser().getName())
                .customerEmail(request.getUser().getEmail())
                .customerPhone(request.getUser().getPhone())
                .reason(request.getReason())
                .note(request.getNote())
                .resolution(request.getResolution())
                .status(request.getStatus())
                .items(request.getItems().stream().map(item ->
                        ReturnRequestResponse.ReturnItem.builder()
                                .orderItemId(item.getOrderItemId())
                                .productName(item.getProductName())
                                .variantName(item.getVariantName())
                                .imageUrl(item.getImageUrl())
                                .evidenceUrl(item.getEvidenceUrl())
                                .quantity(item.getQuantity())
                                .unitPrice(item.getUnitPrice())
                                .build()
                ).toList())
                .refundAmount(calculateRefundAmount(request))
                .storeId(effectiveStoreId)
                .storeName(storeName)
                .vendorReason(request.getVendorReason())
                .disputeReason(request.getDisputeReason())
                .shippingTrackingNumber(request.getShippingTrackingNumber())
                .shippingCarrier(request.getShippingCarrier())
                .adminNote(request.getAdminNote())
                .updatedBy(request.getUpdatedBy())
                .shippedAt(request.getShippedAt())
                .receivedAt(request.getReceivedAt())
                .completedAt(request.getCompletedAt())
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .build();
    }
}
