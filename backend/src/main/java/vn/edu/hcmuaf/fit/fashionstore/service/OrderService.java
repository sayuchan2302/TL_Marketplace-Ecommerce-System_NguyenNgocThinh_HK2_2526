package vn.edu.hcmuaf.fit.fashionstore.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext.UserContext;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.OrderRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorTopProductResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorOrderDetailResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorOrderPageResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorOrderSummaryResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminOrderResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.OrderTreeResponseDto;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.ParentOrderSummaryDto;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.SubOrderSummaryDto;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.VendorSubOrderPageResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.*;
import vn.edu.hcmuaf.fit.fashionstore.exception.ForbiddenException;
import vn.edu.hcmuaf.fit.fashionstore.exception.ResourceNotFoundException;
import vn.edu.hcmuaf.fit.fashionstore.repository.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final WalletService walletService;
    private final StoreRepository storeRepository;
    private final CouponRepository couponRepository;
    private final VoucherRepository voucherRepository;
    private final PublicCodeService publicCodeService;

    public OrderService(OrderRepository orderRepository, UserRepository userRepository,
                        AddressRepository addressRepository, ProductRepository productRepository,
                        ProductVariantRepository productVariantRepository, WalletService walletService,
                        StoreRepository storeRepository, CouponRepository couponRepository,
                        VoucherRepository voucherRepository, PublicCodeService publicCodeService) {
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.addressRepository = addressRepository;
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
        this.walletService = walletService;
        this.storeRepository = storeRepository;
        this.couponRepository = couponRepository;
        this.voucherRepository = voucherRepository;
        this.publicCodeService = publicCodeService;
    }

    // Default commission rate (5%)
    private static final BigDecimal DEFAULT_COMMISSION_RATE_PERCENT = new BigDecimal("5.0");
    private static final BigDecimal COMMISSION_RATE_DIVISOR = new BigDecimal("100");
    private static final BigDecimal DEFAULT_SHIPPING_FEE = new BigDecimal("30000.0");
    private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("500000.0");
    private static final LocalDateTime DEFAULT_FILTER_FROM = LocalDateTime.of(1970, 1, 1, 0, 0);
    private static final LocalDateTime DEFAULT_FILTER_TO = LocalDateTime.of(2999, 12, 31, 23, 59, 59);
    private static final EnumSet<Order.OrderStatus> TRACKING_UPDATABLE_STATUSES =
            EnumSet.of(Order.OrderStatus.PROCESSING, Order.OrderStatus.SHIPPED);

    private record PreparedOrderItem(
            Product product,
            ProductVariant variant,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal totalPrice,
            UUID storeId,
            String productName,
            String variantName,
            String productImage
    ) {}

    private record StoreOrderGroup(
            UUID storeId,
            List<PreparedOrderItem> items,
            BigDecimal subtotal
    ) {}

    private record DiscountApplication(
            String code,
            BigDecimal totalDiscount,
            Map<UUID, BigDecimal> storeDiscounts,
            Coupon coupon,
            Voucher voucher
    ) {
        static DiscountApplication none() {
            return new DiscountApplication(null, BigDecimal.ZERO, Map.of(), null, null);
        }

        BigDecimal discountForStore(UUID storeId) {
            if (storeId == null) {
                return BigDecimal.ZERO;
            }
            return storeDiscounts.getOrDefault(storeId, BigDecimal.ZERO);
        }
    }

    // ─── Customer Methods ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminOrderResponse> findByUserId(UUID userId) {
        return orderRepository.findByUserIdAndParentOrderIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toAdminOrderResponse)
                .toList();
    }

    public Order findById(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    public Order findByCode(String code) {
        return orderRepository.findByOrderCode(normalizeRequiredText(code, "Order code is required"))
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    /**
     * Find order by ID with user ownership validation
     */
    public Order findByIdForUser(UUID orderId, UUID userId) {
        Order order = findById(orderId);
        if (!order.getUser().getId().equals(userId)) {
            throw new ForbiddenException("You don't have access to this order");
        }
        return order;
    }

    public Order findByCodeForUser(String orderCode, UUID userId) {
        Order order = findByCode(orderCode);
        if (!order.getUser().getId().equals(userId)) {
            throw new ForbiddenException("You don't have access to this order");
        }
        return order;
    }

    @Transactional(readOnly = true)
    public AdminOrderResponse getAdminOrderById(UUID id) {
        return toAdminOrderResponse(findById(id));
    }

    @Transactional(readOnly = true)
    public AdminOrderResponse getAdminOrderByCode(String code) {
        return toAdminOrderResponse(findByCode(code));
    }

    @Transactional(readOnly = true)
    public AdminOrderResponse getCustomerOrderById(UUID orderId, UUID userId) {
        return toAdminOrderResponse(findByIdForUser(orderId, userId));
    }

    @Transactional(readOnly = true)
    public AdminOrderResponse getCustomerOrderByCode(String orderCode, UUID userId) {
        return toAdminOrderResponse(findByCodeForUser(orderCode, userId));
    }

    // ─── Vendor Methods (Multi-tenant) ─────────────────────────────────────────

    /**
     * Find all orders for a specific store (vendor's view)
     */
    public Page<Order> findByStoreId(UUID storeId, Pageable pageable) {
        return orderRepository.findByStoreIdOrderByCreatedAtDesc(storeId, pageable);
    }

    /**
     * Find orders by store with status filter
     */
    public Page<Order> findByStoreIdAndStatus(UUID storeId, Order.OrderStatus status, Pageable pageable) {
        return orderRepository.findByStoreIdAndStatusOrderByCreatedAtDesc(storeId, status, pageable);
    }

    public Page<Order> findByStoreIdFiltered(
            UUID storeId,
            Order.OrderStatus status,
            String keyword,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Pageable pageable
    ) {
        String normalizedKeyword = normalizeKeyword(keyword);
        LocalDateTime effectiveFrom = fromDate != null ? fromDate : DEFAULT_FILTER_FROM;
        LocalDateTime effectiveTo = toDate != null ? toDate : DEFAULT_FILTER_TO;

        if (!effectiveTo.isAfter(effectiveFrom)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date_to must be greater than date_from");
        }

        return orderRepository.searchByStore(storeId, status, normalizedKeyword, effectiveFrom, effectiveTo, pageable);
    }

    /**
     * Find order by ID with store ownership validation (for vendors)
     */
    public Order findByIdForStore(UUID orderId, UUID storeId) {
        return orderRepository.findByIdAndStoreId(orderId, storeId)
                .orElseThrow(() -> new ForbiddenException("Order not found or you don't have access to it"));
    }

    public Order findByCodeForStore(String orderCode, UUID storeId) {
        return orderRepository.findByOrderCodeAndStoreId(normalizeRequiredText(orderCode, "Order code is required"), storeId)
                .orElseThrow(() -> new ForbiddenException("Order not found or you don't have access to it"));
    }

    @Transactional(readOnly = true)
    public VendorOrderPageResponse getVendorOrderPage(
            UUID storeId,
            Order.OrderStatus status,
            String keyword,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Pageable pageable
    ) {
        Page<Order> page = findByStoreIdFiltered(storeId, status, keyword, fromDate, toDate, pageable);
        return VendorOrderPageResponse.builder()
                .content(page.getContent().stream().map(this::toVendorOrderSummaryResponse).toList())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .number(page.getNumber())
                .size(page.getSize())
                .statusCounts(buildVendorStatusCounts(storeId))
                .build();
    }

    @Transactional(readOnly = true)
    public VendorOrderDetailResponse getVendorOrderDetail(UUID orderId, UUID storeId) {
        return toVendorOrderDetailResponse(findByIdForStore(orderId, storeId));
    }

    @Transactional(readOnly = true)
    public VendorOrderDetailResponse getVendorOrderDetailByCode(String orderCode, UUID storeId) {
        return toVendorOrderDetailResponse(findByCodeForStore(orderCode, storeId));
    }

    @Transactional(readOnly = true)
    public VendorSubOrderPageResponse getVendorSubOrderPage(
            UUID storeId,
            Order.OrderStatus status,
            String keyword,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Pageable pageable
    ) {
        Page<Order> page = findByStoreIdFiltered(storeId, status, keyword, fromDate, toDate, pageable);
        Map<UUID, String> storeNames = buildStoreNameMap(page.getContent());

        return VendorSubOrderPageResponse.builder()
                .content(page.getContent().stream()
                        .map(order -> toSubOrderSummaryDto(order, storeNames))
                        .toList())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .number(page.getNumber())
                .size(page.getSize())
                .statusCounts(buildVendorSubOrderStatusCounts(storeId))
                .build();
    }

    @Transactional
    public VendorOrderDetailResponse updateVendorDelayNote(UUID orderId, UUID storeId, String warehouseNote) {
        String normalizedNote = normalizeRequiredText(
                warehouseNote,
                "Delay reason is required"
        );
        Order order = findByIdForStore(orderId, storeId);
        if (order.getStatus() == Order.OrderStatus.DELIVERED || order.getStatus() == Order.OrderStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot add delay note for delivered or cancelled order"
            );
        }

        order.setWarehouseNote(normalizedNote);
        String delayAuditNote = "Delay note: " + normalizedNote;
        String currentNote = order.getNote() == null ? "" : order.getNote().trim();
        order.setNote(currentNote.isEmpty() ? delayAuditNote : currentNote + "\n" + delayAuditNote);

        Order saved = orderRepository.save(order);
        if (saved.isSubOrder()) {
            syncParentOrderStatus(saved.getParentOrder().getId());
        }
        return toVendorOrderDetailResponse(saved);
    }

    /**
     * Get order count for a store
     */
    public long countByStoreId(UUID storeId) {
        return orderRepository.countByStoreId(storeId);
    }

    /**
     * Get order count by status for a store
     */
    public long countByStoreIdAndStatus(UUID storeId, Order.OrderStatus status) {
        return orderRepository.countByStoreIdAndStatus(storeId, status);
    }

    private VendorSubOrderPageResponse.StatusCounts buildVendorSubOrderStatusCounts(UUID storeId) {
        return VendorSubOrderPageResponse.StatusCounts.builder()
                .all(countByStoreId(storeId))
                .pending(countByStoreIdAndStatus(storeId, Order.OrderStatus.PENDING))
                .confirmed(countByStoreIdAndStatus(storeId, Order.OrderStatus.CONFIRMED))
                .processing(countByStoreIdAndStatus(storeId, Order.OrderStatus.PROCESSING))
                .shipped(countByStoreIdAndStatus(storeId, Order.OrderStatus.SHIPPED))
                .delivered(countByStoreIdAndStatus(storeId, Order.OrderStatus.DELIVERED))
                .cancelled(countByStoreIdAndStatus(storeId, Order.OrderStatus.CANCELLED))
                .build();
    }

    private VendorOrderPageResponse.StatusCounts buildVendorStatusCounts(UUID storeId) {
        return VendorOrderPageResponse.StatusCounts.builder()
                .all(countByStoreId(storeId))
                .pending(countByStoreIdAndStatus(storeId, Order.OrderStatus.PENDING))
                .confirmed(countByStoreIdAndStatus(storeId, Order.OrderStatus.CONFIRMED))
                .processing(countByStoreIdAndStatus(storeId, Order.OrderStatus.PROCESSING))
                .shipped(countByStoreIdAndStatus(storeId, Order.OrderStatus.SHIPPED))
                .delivered(countByStoreIdAndStatus(storeId, Order.OrderStatus.DELIVERED))
                .cancelled(countByStoreIdAndStatus(storeId, Order.OrderStatus.CANCELLED))
                .build();
    }

    /**
     * Calculate total revenue for a store
     */
    public BigDecimal calculateRevenueByStoreId(UUID storeId) {
        return orderRepository.calculateRevenueByStoreId(storeId);
    }

    /**
     * Calculate total payout for a store
     */
    public BigDecimal calculatePayoutByStoreId(UUID storeId) {
        return orderRepository.calculatePayoutByStoreId(storeId);
    }

    @Transactional(readOnly = true)
    public List<VendorTopProductResponse> getTopProductsByStore(UUID storeId, int days, int limit) {
        if (days != 1 && days != 7 && days != 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "days must be one of: 1, 7, 30");
        }

        if (limit < 1 || limit > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be between 1 and 20");
        }

        LocalDateTime fromDate = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        LocalDateTime toDate = LocalDate.now().plusDays(1).atStartOfDay();

        return orderRepository.findTopDeliveredProductsByStoreBetween(
                        storeId,
                        fromDate,
                        toDate,
                        PageRequest.of(0, limit)
                ).stream()
                .map(row -> VendorTopProductResponse.builder()
                        .productId(row.getProductId())
                        .productName((row.getProductName() == null || row.getProductName().isBlank()) ? "Sản phẩm" : row.getProductName())
                        .productImage(row.getProductImage() == null ? "" : row.getProductImage())
                        .soldCount(row.getSoldCount() == null ? 0L : row.getSoldCount())
                        .grossRevenue(row.getGrossRevenue() == null ? BigDecimal.ZERO : row.getGrossRevenue())
                        .build())
                .toList();
    }

    // ─── Admin Methods ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminOrderResponse> findAllAdminOrders() {
        return orderRepository.findAll().stream()
                .map(this::toAdminOrderResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ParentOrderSummaryDto> getAdminParentOrderSummaries() {
        List<Order> rootOrders = orderRepository.findByParentOrderIsNullOrderByCreatedAtDesc();
        if (rootOrders.isEmpty()) {
            return List.of();
        }

        List<UUID> parentOrderIds = rootOrders.stream()
                .map(Order::getId)
                .toList();
        List<Order> subOrders = orderRepository.findByParentOrderIdInWithItemsOrderByCreatedAtDesc(parentOrderIds);
        Map<UUID, List<Order>> subOrdersByParent = groupSubOrdersByParent(subOrders);

        List<Order> ordersForStoreLookup = new ArrayList<>(rootOrders);
        ordersForStoreLookup.addAll(subOrders);
        Map<UUID, String> storeNames = buildStoreNameMap(ordersForStoreLookup);

        return rootOrders.stream()
                .map(rootOrder -> toParentOrderSummaryDto(rootOrder, subOrdersByParent, storeNames))
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderTreeResponseDto getCustomerOrderTree(UUID orderId, UUID userId) {
        return buildCustomerOrderTree(findByIdForUser(orderId, userId), userId);
    }

    @Transactional(readOnly = true)
    public OrderTreeResponseDto getCustomerOrderTreeByCode(String orderCode, UUID userId) {
        return buildCustomerOrderTree(findByCodeForUser(orderCode, userId), userId);
    }

    private OrderTreeResponseDto buildCustomerOrderTree(Order selectedOrder, UUID userId) {
        Order rootOrder = selectedOrder.getParentOrder() != null
                ? findByIdForUser(selectedOrder.getParentOrder().getId(), userId)
                : selectedOrder;

        List<Order> dbSubOrders = orderRepository.findByParentOrderIdWithItemsOrderByCreatedAtDesc(rootOrder.getId());
        boolean syntheticSingleSubOrder = dbSubOrders.isEmpty() && rootOrder.getStoreId() != null;
        List<Order> normalizedSubOrders = syntheticSingleSubOrder ? List.of(rootOrder) : dbSubOrders;
        Map<UUID, String> storeNames = buildStoreNameMap(normalizedSubOrders);

        List<OrderTreeResponseDto.SubOrderNode> subOrderNodes = normalizedSubOrders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(order -> toOrderTreeSubOrderNode(order, storeNames))
                .toList();

        List<OrderTreeResponseDto.ItemNode> rootItems = normalizedSubOrders.isEmpty()
                ? toOrderTreeItemNodes(rootOrder.getItems())
                : List.of();

        return OrderTreeResponseDto.builder()
                .id(rootOrder.getId())
                .code(rootOrder.getOrderCode())
                .status(rootOrder.getStatus())
                .paymentMethod(rootOrder.getPaymentMethod())
                .paymentStatus(rootOrder.getPaymentStatus())
                .subtotal(rootOrder.getSubtotal())
                .shippingFee(rootOrder.getShippingFee())
                .discount(rootOrder.getDiscount())
                .totalAmount(rootOrder.getTotal())
                .splitOrder(!syntheticSingleSubOrder && !normalizedSubOrders.isEmpty())
                .createdAt(rootOrder.getCreatedAt())
                .updatedAt(rootOrder.getUpdatedAt())
                .customer(toOrderTreeCustomer(rootOrder))
                .shippingAddress(toOrderTreeAddress(rootOrder))
                .subOrders(subOrderNodes)
                .items(rootItems)
                .build();
    }

    private AdminOrderResponse toAdminOrderResponse(Order order) {
        String storeName = order.getStoreId() != null 
            ? storeRepository.findById(order.getStoreId()).map(Store::getName).orElse("Unknown Store")
            : "Platform";

        return AdminOrderResponse.builder()
                .id(order.getId())
                .code(order.getOrderCode())
                .storeName(storeName)
                .status(order.getStatus())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .subtotal(order.getSubtotal())
                .shippingFee(order.getShippingFee())
                .discount(order.getDiscount())
                .total(order.getTotal())
                .commissionFee(order.getCommissionFee())
                .vendorPayout(order.getVendorPayout())
                .trackingNumber(order.getTrackingNumber())
                .carrier(order.getShippingCarrier())
                .note(order.getNote())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .customer(order.getUser() != null ? AdminOrderResponse.CustomerInfo.builder()
                        .name(order.getUser().getName())
                        .email(order.getUser().getEmail())
                        .phone(order.getUser().getPhone())
                        .build() : null)
                .shippingAddress(order.getShippingAddress() != null ? AdminOrderResponse.AddressInfo.builder()
                        .fullName(order.getShippingAddress().getFullName())
                        .phone(order.getShippingAddress().getPhone())
                        .address(order.getShippingAddress().getDetail())
                        .ward(order.getShippingAddress().getWard())
                        .district(order.getShippingAddress().getDistrict())
                        .city(order.getShippingAddress().getProvince())
                        .build() : null)
                .items(order.getItems() == null ? List.of() : order.getItems().stream().map(item -> AdminOrderResponse.ItemInfo.builder()
                        .id(item.getId())
                        .name(item.getProductName())
                        .sku(item.getVariant() != null && item.getVariant().getSku() != null ? item.getVariant().getSku() : (item.getId() != null ? item.getId().toString() : ""))
                        .variant(item.getVariantName())
                        .price(item.getUnitPrice())
                        .quantity(item.getQuantity())
                        .image(item.getProductImage())
                        .build()).toList())
                .build();
    }

    private ParentOrderSummaryDto toParentOrderSummaryDto(
            Order rootOrder,
            Map<UUID, List<Order>> subOrdersByParent,
            Map<UUID, String> storeNames
    ) {
        List<Order> normalizedSubOrders = resolveSubOrdersForRoot(rootOrder, subOrdersByParent);
        List<SubOrderSummaryDto> subOrderDtos = normalizedSubOrders.stream()
                .sorted(Comparator.comparing(Order::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .map(subOrder -> toSubOrderSummaryDto(subOrder, storeNames))
                .toList();

        int itemCount = subOrderDtos.stream()
                .map(SubOrderSummaryDto::getItemCount)
                .filter(value -> value != null)
                .mapToInt(Integer::intValue)
                .sum();

        return ParentOrderSummaryDto.builder()
                .id(rootOrder.getId())
                .code(rootOrder.getOrderCode())
                .status(rootOrder.getStatus())
                .paymentMethod(rootOrder.getPaymentMethod())
                .paymentStatus(rootOrder.getPaymentStatus())
                .subtotal(rootOrder.getSubtotal())
                .shippingFee(rootOrder.getShippingFee())
                .discount(rootOrder.getDiscount())
                .totalAmount(rootOrder.getTotal())
                .subOrderCount(subOrderDtos.size())
                .itemCount(itemCount)
                .createdAt(rootOrder.getCreatedAt())
                .updatedAt(rootOrder.getUpdatedAt())
                .customer(ParentOrderSummaryDto.Customer.builder()
                        .name(rootOrder.getUser() != null ? rootOrder.getUser().getName() : null)
                        .email(rootOrder.getUser() != null ? rootOrder.getUser().getEmail() : null)
                        .phone(rootOrder.getUser() != null ? rootOrder.getUser().getPhone() : null)
                        .build())
                .shippingAddress(ParentOrderSummaryDto.Address.builder()
                        .fullName(rootOrder.getShippingAddress() != null ? rootOrder.getShippingAddress().getFullName() : null)
                        .phone(rootOrder.getShippingAddress() != null ? rootOrder.getShippingAddress().getPhone() : null)
                        .address(rootOrder.getShippingAddress() != null ? rootOrder.getShippingAddress().getDetail() : null)
                        .ward(rootOrder.getShippingAddress() != null ? rootOrder.getShippingAddress().getWard() : null)
                        .district(rootOrder.getShippingAddress() != null ? rootOrder.getShippingAddress().getDistrict() : null)
                        .city(rootOrder.getShippingAddress() != null ? rootOrder.getShippingAddress().getProvince() : null)
                        .build())
                .subOrders(subOrderDtos)
                .build();
    }

    private List<Order> resolveSubOrdersForRoot(Order rootOrder, Map<UUID, List<Order>> subOrdersByParent) {
        List<Order> foundSubOrders = subOrdersByParent.getOrDefault(rootOrder.getId(), List.of());
        if (!foundSubOrders.isEmpty()) {
            return foundSubOrders;
        }
        if (rootOrder.getStoreId() != null) {
            return List.of(rootOrder);
        }
        return List.of();
    }

    private Map<UUID, List<Order>> groupSubOrdersByParent(List<Order> subOrders) {
        Map<UUID, List<Order>> grouped = new HashMap<>();
        for (Order subOrder : subOrders) {
            if (subOrder.getParentOrder() == null || subOrder.getParentOrder().getId() == null) {
                continue;
            }
            grouped.computeIfAbsent(subOrder.getParentOrder().getId(), ignored -> new ArrayList<>()).add(subOrder);
        }
        return grouped;
    }

    private Map<UUID, String> buildStoreNameMap(List<Order> orders) {
        List<UUID> storeIds = orders.stream()
                .map(Order::getStoreId)
                .filter(value -> value != null)
                .distinct()
                .toList();
        if (storeIds.isEmpty()) {
            return Map.of();
        }

        Map<UUID, String> storeNames = new HashMap<>();
        for (Store store : storeRepository.findAllById(storeIds)) {
            storeNames.put(store.getId(), store.getName());
        }
        return storeNames;
    }

    private SubOrderSummaryDto toSubOrderSummaryDto(Order subOrder, Map<UUID, String> storeNames) {
        return SubOrderSummaryDto.builder()
                .id(subOrder.getId())
                .code(subOrder.getOrderCode())
                .vendorId(subOrder.getStoreId())
                .vendorName(subOrder.getStoreId() == null ? null : storeNames.getOrDefault(subOrder.getStoreId(), "Unknown Store"))
                .status(subOrder.getStatus())
                .subtotal(subOrder.getSubtotal())
                .shippingFee(subOrder.getShippingFee())
                .commissionAmount(subOrder.getCommissionFee())
                .total(subOrder.getTotal())
                .trackingNumber(subOrder.getTrackingNumber())
                .warehouseNote(subOrder.getWarehouseNote())
                .itemCount(subOrder.getItems() == null ? 0 : subOrder.getItems().size())
                .createdAt(subOrder.getCreatedAt())
                .updatedAt(subOrder.getUpdatedAt())
                .customer(SubOrderSummaryDto.Customer.builder()
                        .name(subOrder.getUser() != null ? subOrder.getUser().getName() : null)
                        .email(subOrder.getUser() != null ? subOrder.getUser().getEmail() : null)
                        .phone(subOrder.getUser() != null ? subOrder.getUser().getPhone() : null)
                        .build())
                .build();
    }

    private OrderTreeResponseDto.Customer toOrderTreeCustomer(Order order) {
        return OrderTreeResponseDto.Customer.builder()
                .name(order.getUser() != null ? order.getUser().getName() : null)
                .email(order.getUser() != null ? order.getUser().getEmail() : null)
                .phone(order.getUser() != null ? order.getUser().getPhone() : null)
                .build();
    }

    private OrderTreeResponseDto.Address toOrderTreeAddress(Order order) {
        return OrderTreeResponseDto.Address.builder()
                .fullName(order.getShippingAddress() != null ? order.getShippingAddress().getFullName() : null)
                .phone(order.getShippingAddress() != null ? order.getShippingAddress().getPhone() : null)
                .address(order.getShippingAddress() != null ? order.getShippingAddress().getDetail() : null)
                .ward(order.getShippingAddress() != null ? order.getShippingAddress().getWard() : null)
                .district(order.getShippingAddress() != null ? order.getShippingAddress().getDistrict() : null)
                .city(order.getShippingAddress() != null ? order.getShippingAddress().getProvince() : null)
                .build();
    }

    private OrderTreeResponseDto.SubOrderNode toOrderTreeSubOrderNode(Order subOrder, Map<UUID, String> storeNames) {
        return OrderTreeResponseDto.SubOrderNode.builder()
                .id(subOrder.getId())
                .code(subOrder.getOrderCode())
                .vendorId(subOrder.getStoreId())
                .vendorName(subOrder.getStoreId() == null ? null : storeNames.getOrDefault(subOrder.getStoreId(), "Unknown Store"))
                .status(subOrder.getStatus())
                .subtotal(subOrder.getSubtotal())
                .shippingFee(subOrder.getShippingFee())
                .discount(subOrder.getDiscount())
                .totalAmount(subOrder.getTotal())
                .commissionAmount(subOrder.getCommissionFee())
                .trackingNumber(subOrder.getTrackingNumber())
                .warehouseNote(subOrder.getWarehouseNote())
                .createdAt(subOrder.getCreatedAt())
                .updatedAt(subOrder.getUpdatedAt())
                .items(toOrderTreeItemNodes(subOrder.getItems()))
                .build();
    }

    private List<OrderTreeResponseDto.ItemNode> toOrderTreeItemNodes(List<OrderItem> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return items.stream()
                .map(item -> OrderTreeResponseDto.ItemNode.builder()
                        .id(item.getId())
                        .productId(item.getProduct() != null ? item.getProduct().getId() : null)
                        .variantId(item.getVariant() != null ? item.getVariant().getId() : null)
                        .name(item.getProductName())
                        .sku(item.getVariant() != null ? item.getVariant().getSku() : null)
                        .variant(item.getVariantName())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .totalPrice(item.getTotalPrice())
                        .image(item.getProductImage())
                        .build())
                .toList();
    }

    // ─── Create Order ──────────────────────────────────────────────────────────

    @Transactional
    public AdminOrderResponse create(UUID userId, OrderRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order request is required");
        }
        if (request.getAddressId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Address is required");
        }
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order must contain at least one item");
        }
        if (request.getPaymentMethod() == null || request.getPaymentMethod().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method is required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Address address = addressRepository.findById(request.getAddressId())
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));

        if (!address.getUser().getId().equals(userId)) {
            throw new ForbiddenException("You don't have access to this address");
        }

        Order.PaymentMethod paymentMethod;
        try {
            paymentMethod = Order.PaymentMethod.valueOf(request.getPaymentMethod().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported payment method: " + request.getPaymentMethod());
        }
        List<PreparedOrderItem> preparedItems = prepareOrderItems(request.getItems());
        Map<UUID, StoreOrderGroup> groupedByStore = groupItemsByStore(preparedItems);
        DiscountApplication discountApplication = resolveDiscountApplication(request.getCouponCode(), groupedByStore);

        if (groupedByStore.size() <= 1) {
            StoreOrderGroup onlyGroup = groupedByStore.values().stream().findFirst()
                    .orElseThrow(() -> new ResourceNotFoundException("Order must contain at least one valid store item"));
            
            Order created = createStoreScopedOrder(
                    user,
                    address,
                    request,
                    paymentMethod,
                    onlyGroup,
                    null,
                    discountApplication,
                    discountApplication.discountForStore(onlyGroup.storeId())
            );
            incrementDiscountUsage(discountApplication);
            return toAdminOrderResponse(created);
        }

        Order parent = createParentOrderWithSubOrders(
                user,
                address,
                request,
                paymentMethod,
                preparedItems,
                groupedByStore,
                discountApplication
        );
        incrementDiscountUsage(discountApplication);
        return toAdminOrderResponse(parent);
    }

    // ─── Cancel Order ──────────────────────────────────────────────────────────

    @Transactional
    public AdminOrderResponse cancel(UUID orderId, UUID userId, String reason) {
        Order order = findByIdForUser(orderId, userId);

        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Can only cancel pending orders");
        }

        order.setStatus(Order.OrderStatus.CANCELLED);
        order.setNote((order.getNote() != null ? order.getNote() : "") + "\nCancellation reason: " + reason);
        Order savedOrder = orderRepository.save(order);

        if (savedOrder.isParentOrder()) {
            cascadeCancelToSubOrders(savedOrder, reason);
            return toAdminOrderResponse(syncParentOrderStatus(savedOrder.getId()));
        }

        if (savedOrder.isSubOrder()) {
            syncParentOrderStatus(savedOrder.getParentOrder().getId());
        }

        return toAdminOrderResponse(savedOrder);
    }

    // ─── Tracking ──────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public AdminOrderResponse getTrackingInfo(UUID orderId, UUID userId) {
        Order order = findByIdForUser(orderId, userId);
        return toAdminOrderResponse(order);
    }

    // ─── Update Status ─────────────────────────────────────────────────────────

    /**
     * Update order status (admin only - no ownership check)
     */
    @Transactional
    public Order updateStatus(UUID orderId, Order.OrderStatus status) {
        Order order = findById(orderId);
        return applyStatusUpdate(order, status, null, null, null, false);
    }

    /**
     * Update order status with store ownership validation (vendor operation)
     */
    @Transactional
    public Order updateStatusForStore(
            UUID orderId,
            UUID storeId,
            Order.OrderStatus status,
            String trackingNumber,
            String carrier,
            String reason
    ) {
        Order order = findByIdForStore(orderId, storeId);
        return applyStatusUpdate(order, status, trackingNumber, carrier, reason, true);
    }

    @Transactional
    public VendorOrderDetailResponse updateVendorOrderStatus(
            UUID orderId,
            UUID storeId,
            Order.OrderStatus status,
            String trackingNumber,
            String carrier,
            String reason
    ) {
        Order updated = updateStatusForStore(orderId, storeId, status, trackingNumber, carrier, reason);
        return toVendorOrderDetailResponse(updated);
    }

    private Order applyStatusUpdate(
            Order order,
            Order.OrderStatus status,
            String trackingNumber,
            String carrier,
            String reason,
            boolean enforceVendorRules
    ) {
        Order.OrderStatus previousStatus = order.getStatus();
        validateStatusTransition(previousStatus, status, enforceVendorRules);

        if (status == Order.OrderStatus.SHIPPED) {
            String normalizedTracking = "ADMIN_FORCE_SHIPPED";
            String normalizedCarrier = "SYSTEM_SYNC";
            
            if (enforceVendorRules) {
                normalizedTracking = resolveRequiredField(
                        trackingNumber,
                        order.getTrackingNumber(),
                        "Tracking number is required before shipping"
                );
                normalizedCarrier = resolveRequiredField(
                        carrier,
                        order.getShippingCarrier(),
                        "Carrier is required before shipping"
                );
            } else if (trackingNumber != null && !trackingNumber.isBlank()) {
                normalizedTracking = trackingNumber.trim();
                normalizedCarrier = carrier != null && !carrier.isBlank() ? carrier.trim() : "ADMIN_SYNC";
            }
            order.setTrackingNumber(normalizedTracking);
            order.setShippingCarrier(normalizedCarrier);
        }

        if (status == Order.OrderStatus.CANCELLED) {
            String normalizedReason = normalizeOptionalText(reason);
            if (enforceVendorRules && normalizedReason.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cancellation reason is required");
            }
            if (!normalizedReason.isEmpty()) {
                String currentNote = order.getNote() == null ? "" : order.getNote().trim();
                String cancelNote = "Cancellation reason: " + normalizedReason;
                order.setNote(currentNote.isEmpty() ? cancelNote : currentNote + "\n" + cancelNote);
            }
        }

        order.setStatus(status);

        if (status == Order.OrderStatus.DELIVERED) {
            if (enforceVendorRules) {
                ensureTrackingDataReady(order);
            }
            order.setPaidAt(LocalDateTime.now());
            order.setPaymentStatus(Order.PaymentStatus.PAID);
        }

        Order savedOrder = orderRepository.save(order);

        if (savedOrder.isParentOrder()) {
            cascadeStatusToSubOrders(savedOrder, status, trackingNumber, carrier, reason);
        }

        if (status == Order.OrderStatus.DELIVERED && savedOrder.getStoreId() != null) {
            walletService.creditVendorForOrder(savedOrder);
        }

        if (previousStatus == Order.OrderStatus.DELIVERED
                && status == Order.OrderStatus.CANCELLED
                && savedOrder.getStoreId() != null) {
            walletService.debitVendorForRefund(savedOrder);
        }

        if (savedOrder.isSubOrder()) {
            syncParentOrderStatus(savedOrder.getParentOrder().getId());
        }

        return savedOrder;
    }

    private void cascadeStatusToSubOrders(Order parentOrder, Order.OrderStatus status, String trackingNumber, String carrier, String reason) {
        if (status == Order.OrderStatus.CANCELLED) return; // Handled separately by cascadeCancelToSubOrders

        List<Order> subOrders = orderRepository.findByParentOrderOrderByCreatedAtDesc(parentOrder);
        for (Order subOrder : subOrders) {
            if (subOrder.getStatus() == status) continue;

            String subTracking = trackingNumber == null ? "ADMIN_FORCE_" + status.name() : trackingNumber;
            String subCarrier = carrier == null ? "SYSTEM_SYNC" : carrier;
            
            // Recurse without enforcing vendor rules (since Admin forced it)
            applyStatusUpdate(subOrder, status, subTracking, subCarrier, reason, false);
        }
    }

    private void validateStatusTransition(Order.OrderStatus current, Order.OrderStatus next, boolean enforceVendorRules) {
        if (current == next) {
            return;
        }
        if (!enforceVendorRules) {
            return; // Admins can bypass strict state sequence
        }

        boolean allowed = switch (current) {
            case PENDING -> next == Order.OrderStatus.CONFIRMED || next == Order.OrderStatus.CANCELLED;
            case CONFIRMED -> next == Order.OrderStatus.PROCESSING || next == Order.OrderStatus.CANCELLED;
            case PROCESSING -> next == Order.OrderStatus.SHIPPED || next == Order.OrderStatus.CANCELLED;
            case SHIPPED -> next == Order.OrderStatus.DELIVERED;
            case DELIVERED, CANCELLED -> false;
        };

        if (!allowed) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    String.format("Invalid status transition: %s -> %s", current, next)
            );
        }
    }

    private String normalizeRequiredText(String value, String message) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        return value == null ? "" : value.trim();
    }

    private String resolveRequiredField(String providedValue, String fallbackValue, String message) {
        String normalizedProvided = normalizeOptionalText(providedValue);
        if (!normalizedProvided.isEmpty()) {
            return normalizedProvided;
        }
        return normalizeRequiredText(fallbackValue, message);
    }

    private void ensureTrackingDataReady(Order order) {
        normalizeRequiredText(order.getTrackingNumber(), "Tracking number is required before marking as delivered");
        normalizeRequiredText(order.getShippingCarrier(), "Carrier is required before marking as delivered");
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }

        String normalized = keyword.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    // ─── Update Tracking ───────────────────────────────────────────────────────

    /**
     * Update tracking number with store ownership validation (vendor operation)
     */
    @Transactional
    public Order updateTrackingForStore(UUID orderId, UUID storeId, String trackingNumber) {
        Order order = findByIdForStore(orderId, storeId);
        if (!TRACKING_UPDATABLE_STATUSES.contains(order.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tracking can only be updated when order is PROCESSING or SHIPPED"
            );
        }
        order.setTrackingNumber(normalizeRequiredText(trackingNumber, "Tracking number is required"));
        return orderRepository.save(order);
    }

    @Transactional
    public AdminOrderResponse updateAdminOrderTracking(UUID orderId, String trackingNumber) {
        Order order = findById(orderId);
        if (order.isParentOrder()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot update tracking for parent marketplace order"
            );
        }
        if (order.getStatus() == Order.OrderStatus.CANCELLED) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot update tracking for cancelled order"
            );
        }

        order.setTrackingNumber(normalizeRequiredText(trackingNumber, "Tracking number is required"));
        Order saved = orderRepository.save(order);
        if (saved.isSubOrder()) {
            syncParentOrderStatus(saved.getParentOrder().getId());
        }
        return toAdminOrderResponse(saved);
    }

    @Transactional
    public VendorOrderDetailResponse updateVendorOrderTracking(UUID orderId, UUID storeId, String trackingNumber) {
        return toVendorOrderDetailResponse(updateTrackingForStore(orderId, storeId, trackingNumber));
    }

    private VendorOrderSummaryResponse toVendorOrderSummaryResponse(Order order) {
        return VendorOrderSummaryResponse.builder()
                .id(order.getId())
                .code(order.getOrderCode())
                .status(safeEnumName(order.getStatus()))
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .total(order.getTotal())
                .commissionFee(order.getCommissionFee())
                .vendorPayout(order.getVendorPayout())
                .itemCount(order.getItems() == null ? 0 : order.getItems().size())
                .customer(VendorOrderSummaryResponse.Customer.builder()
                        .name(order.getUser() != null ? order.getUser().getName() : null)
                        .email(order.getUser() != null ? order.getUser().getEmail() : null)
                        .phone(order.getUser() != null ? order.getUser().getPhone() : null)
                        .build())
                .trackingNumber(order.getTrackingNumber())
                .shippingCarrier(order.getShippingCarrier())
                .warehouseNote(order.getWarehouseNote())
                .build();
    }

    private VendorOrderDetailResponse toVendorOrderDetailResponse(Order order) {
        return VendorOrderDetailResponse.builder()
                .id(order.getId())
                .code(order.getOrderCode())
                .status(safeEnumName(order.getStatus()))
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .subtotal(order.getSubtotal())
                .shippingFee(order.getShippingFee())
                .discount(order.getDiscount())
                .total(order.getTotal())
                .paymentMethod(safeEnumName(order.getPaymentMethod()))
                .paymentStatus(safeEnumName(order.getPaymentStatus()))
                .note(order.getNote())
                .warehouseNote(order.getWarehouseNote())
                .trackingNumber(order.getTrackingNumber())
                .shippingCarrier(order.getShippingCarrier())
                .commissionFee(order.getCommissionFee())
                .vendorPayout(order.getVendorPayout())
                .customer(VendorOrderSummaryResponse.Customer.builder()
                        .name(order.getUser() != null ? order.getUser().getName() : null)
                        .email(order.getUser() != null ? order.getUser().getEmail() : null)
                        .phone(order.getUser() != null ? order.getUser().getPhone() : null)
                        .build())
                .shippingAddress(VendorOrderDetailResponse.ShippingAddress.builder()
                        .fullName(order.getShippingAddress() != null ? order.getShippingAddress().getFullName() : null)
                        .phone(order.getShippingAddress() != null ? order.getShippingAddress().getPhone() : null)
                        .address(order.getShippingAddress() != null ? order.getShippingAddress().getDetail() : null)
                        .ward(order.getShippingAddress() != null ? order.getShippingAddress().getWard() : null)
                        .district(order.getShippingAddress() != null ? order.getShippingAddress().getDistrict() : null)
                        .city(order.getShippingAddress() != null ? order.getShippingAddress().getProvince() : null)
                        .build())
                .items((order.getItems() == null ? List.<OrderItem>of() : order.getItems()).stream()
                        .map(item -> VendorOrderDetailResponse.Item.builder()
                                .id(item.getId())
                                .name(item.getProductName())
                                .sku(item.getVariant() != null && item.getVariant().getSku() != null
                                        ? item.getVariant().getSku()
                                        : (item.getId() != null ? item.getId().toString() : ""))
                                .variant(item.getVariantName())
                                .quantity(item.getQuantity())
                                .unitPrice(item.getUnitPrice())
                                .totalPrice(item.getTotalPrice())
                                .image(item.getProductImage())
                                .build())
                        .toList())
                .build();
    }

    private List<PreparedOrderItem> prepareOrderItems(List<OrderRequest.OrderItemRequest> items) {
        List<PreparedOrderItem> preparedItems = new ArrayList<>();

        for (OrderRequest.OrderItemRequest itemReq : items) {
            if (itemReq == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order item is required");
            }
            if (itemReq.getProductId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product ID is required");
            }
            Product product = productRepository.findPublicByIdForUpdate(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

            if (product.getStoreId() == null) {
                throw new ForbiddenException("Marketplace checkout only supports vendor-owned products");
            }

            if (itemReq.getQuantity() == null || itemReq.getQuantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be greater than 0");
            }

            ProductVariant variant = resolveVariantForCheckout(product, itemReq.getVariantId());
            reserveStock(product, variant, itemReq.getQuantity());

            // Always resolve price server-side to prevent client-side price tampering.
            BigDecimal unitPrice = resolveUnitPrice(product, variant);
            BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(itemReq.getQuantity()));

            preparedItems.add(new PreparedOrderItem(
                    product,
                    variant,
                    itemReq.getQuantity(),
                    unitPrice,
                    totalPrice,
                    product.getStoreId(),
                    product.getName(),
                    buildVariantName(variant),
                    resolvePrimaryImage(product)
            ));
        }

        return preparedItems;
    }

    private ProductVariant resolveVariantForCheckout(Product product, UUID variantId) {
        if (variantId != null) {
            return productVariantRepository.findByIdForUpdate(variantId)
                    .filter(found -> found.getProduct().getId().equals(product.getId()))
                    .filter(found -> Boolean.TRUE.equals(found.getIsActive()))
                    .orElseThrow(() -> new ResourceNotFoundException("Product variant not found"));
        }

        List<ProductVariant> activeVariants = productVariantRepository.findByProductIdAndIsActiveTrue(product.getId());
        if (activeVariants.size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select a product variant");
        }
        if (activeVariants.size() == 1) {
            UUID onlyVariantId = activeVariants.get(0).getId();
            return productVariantRepository.findByIdForUpdate(onlyVariantId)
                    .filter(found -> Boolean.TRUE.equals(found.getIsActive()))
                    .orElseThrow(() -> new ResourceNotFoundException("Product variant not found"));
        }
        return null;
    }

    private void reserveStock(Product product, ProductVariant variant, int quantity) {
        if (variant != null) {
            int available = safeInt(variant.getStockQuantity());
            if (available < quantity) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient stock for selected variant");
            }

            variant.setStockQuantity(available - quantity);

            Long activeVariantStock = productVariantRepository.sumActiveStockByProductId(product.getId());
            int productStock = activeVariantStock == null ? 0 : Math.max(0, activeVariantStock.intValue());
            product.setStockQuantity(productStock);
            return;
        }

        int available = safeInt(product.getStockQuantity());
        if (available < quantity) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient stock for product");
        }

        product.setStockQuantity(available - quantity);
    }

    private Map<UUID, StoreOrderGroup> groupItemsByStore(List<PreparedOrderItem> preparedItems) {
        Map<UUID, List<PreparedOrderItem>> grouped = new LinkedHashMap<>();

        for (PreparedOrderItem item : preparedItems) {
            grouped.computeIfAbsent(item.storeId(), ignored -> new ArrayList<>()).add(item);
        }

        Map<UUID, StoreOrderGroup> result = new LinkedHashMap<>();
        for (Map.Entry<UUID, List<PreparedOrderItem>> entry : grouped.entrySet()) {
            BigDecimal subtotal = entry.getValue().stream().map(PreparedOrderItem::totalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
            result.put(entry.getKey(), new StoreOrderGroup(entry.getKey(), entry.getValue(), subtotal));
        }
        return result;
    }

    private DiscountApplication resolveDiscountApplication(
            String rawCode,
            Map<UUID, StoreOrderGroup> groupedByStore
    ) {
        String normalizedCode = normalizeDiscountCode(rawCode);
        if (normalizedCode == null) {
            return DiscountApplication.none();
        }

        DiscountApplication voucherDiscount = resolveVoucherDiscount(normalizedCode, groupedByStore);
        if (voucherDiscount != null) {
            return voucherDiscount;
        }

        DiscountApplication couponDiscount = resolveLegacyCouponDiscount(normalizedCode, groupedByStore);
        if (couponDiscount != null) {
            return couponDiscount;
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid coupon code");
    }

    private DiscountApplication resolveVoucherDiscount(
            String normalizedCode,
            Map<UUID, StoreOrderGroup> groupedByStore
    ) {
        if (groupedByStore.isEmpty()) {
            return null;
        }

        List<Voucher> matchedVouchers = voucherRepository.findByCodeAndStoreIds(
                normalizedCode,
                groupedByStore.keySet()
        );
        if (matchedVouchers.isEmpty()) {
            return null;
        }
        if (matchedVouchers.size() > 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Voucher code is duplicated across multiple stores in cart"
            );
        }

        Voucher voucher = matchedVouchers.get(0);
        StoreOrderGroup targetGroup = groupedByStore.get(voucher.getStoreId());
        if (targetGroup == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher does not match cart stores");
        }

        validateVoucherForCheckout(voucher, targetGroup.subtotal());
        BigDecimal discount = calculateVoucherDiscount(voucher, targetGroup.subtotal());
        if (discount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher is not applicable for current order");
        }

        Map<UUID, BigDecimal> byStore = new LinkedHashMap<>();
        byStore.put(targetGroup.storeId(), discount);
        return new DiscountApplication(voucher.getCode(), discount, byStore, null, voucher);
    }

    private DiscountApplication resolveLegacyCouponDiscount(
            String normalizedCode,
            Map<UUID, StoreOrderGroup> groupedByStore
    ) {
        Coupon coupon = couponRepository.findByCode(normalizedCode).orElse(null);
        if (coupon == null) {
            return null;
        }
        if (!coupon.isValid()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coupon is expired or fully used");
        }

        BigDecimal subtotal = groupedByStore.values().stream()
                .map(StoreOrderGroup::subtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = BigDecimal.valueOf(coupon.calculateDiscount(subtotal.doubleValue()))
                .setScale(2, RoundingMode.HALF_UP);

        if (discount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order does not meet coupon conditions");
        }

        Map<UUID, BigDecimal> byStore = allocateDiscountByStore(groupedByStore, discount);
        return new DiscountApplication(coupon.getCode(), discount, byStore, coupon, null);
    }

    private void validateVoucherForCheckout(Voucher voucher, BigDecimal storeSubtotal) {
        if (voucher.getStatus() != Voucher.VoucherStatus.RUNNING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher is not active");
        }

        LocalDate today = LocalDate.now();
        if (voucher.getStartDate() != null && voucher.getStartDate().isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher is not active yet");
        }
        if (voucher.getEndDate() != null && voucher.getEndDate().isBefore(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher has expired");
        }

        int totalIssued = safeInt(voucher.getTotalIssued());
        int usedCount = safeInt(voucher.getUsedCount());
        if (totalIssued <= 0 || usedCount >= totalIssued) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voucher usage limit has been reached");
        }

        BigDecimal minOrderValue = safeAmount(voucher.getMinOrderValue());
        if (storeSubtotal.compareTo(minOrderValue) < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order does not meet minimum value required for this voucher"
            );
        }
    }

    private BigDecimal calculateVoucherDiscount(Voucher voucher, BigDecimal orderValue) {
        BigDecimal discountValue = safeAmount(voucher.getDiscountValue());
        if (voucher.getDiscountType() == Voucher.DiscountType.PERCENT) {
            return orderValue.multiply(discountValue)
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        }
        return discountValue.min(orderValue).setScale(2, RoundingMode.HALF_UP);
    }

    private Map<UUID, BigDecimal> allocateDiscountByStore(
            Map<UUID, StoreOrderGroup> groupedByStore,
            BigDecimal totalDiscount
    ) {
        Map<UUID, BigDecimal> byStore = new LinkedHashMap<>();
        if (groupedByStore.isEmpty() || totalDiscount.compareTo(BigDecimal.ZERO) <= 0) {
            return byStore;
        }

        BigDecimal subtotal = groupedByStore.values().stream()
                .map(StoreOrderGroup::subtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (groupedByStore.size() == 1 || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            StoreOrderGroup only = groupedByStore.values().iterator().next();
            byStore.put(only.storeId(), totalDiscount);
            return byStore;
        }

        BigDecimal allocated = BigDecimal.ZERO;
        int index = 0;
        int size = groupedByStore.size();
        for (StoreOrderGroup group : groupedByStore.values()) {
            index++;
            BigDecimal value;
            if (index == size) {
                value = totalDiscount.subtract(allocated);
            } else {
                value = totalDiscount.multiply(group.subtotal())
                        .divide(subtotal, 2, RoundingMode.HALF_UP);
                allocated = allocated.add(value);
            }
            byStore.put(group.storeId(), value.max(BigDecimal.ZERO));
        }
        return byStore;
    }

    private void incrementDiscountUsage(DiscountApplication discountApplication) {
        if (discountApplication.coupon() != null) {
            Coupon coupon = discountApplication.coupon();
            coupon.setUsedCount(safeInt(coupon.getUsedCount()) + 1);
            couponRepository.save(coupon);
        }

        if (discountApplication.voucher() != null) {
            Voucher voucher = discountApplication.voucher();
            voucher.setUsedCount(safeInt(voucher.getUsedCount()) + 1);
            voucherRepository.save(voucher);
        }
    }

    private String normalizeDiscountCode(String rawCode) {
        if (rawCode == null) {
            return null;
        }
        String normalized = rawCode.trim().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private BigDecimal safeAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.max(BigDecimal.ZERO);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    private Order createParentOrderWithSubOrders(
            User user,
            Address address,
            OrderRequest request,
            Order.PaymentMethod paymentMethod,
            List<PreparedOrderItem> preparedItems,
            Map<UUID, StoreOrderGroup> groupedByStore,
            DiscountApplication discountApplication
    ) {
        BigDecimal subtotal = preparedItems.stream().map(PreparedOrderItem::totalPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal shippingFee = groupedByStore.values().stream().map(this::calculateShippingFee).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal commissionFee = groupedByStore.values().stream().map(this::calculateCommissionFee).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal discount = discountApplication.totalDiscount();
        BigDecimal vendorPayout = subtotal.add(shippingFee).subtract(commissionFee).subtract(discount);

        Order parentOrder = Order.builder()
                .orderCode(publicCodeService.nextOrderCode())
                .user(user)
                .shippingAddress(address)
                .status(Order.OrderStatus.PENDING)
                .paymentMethod(paymentMethod)
                .paymentStatus(Order.PaymentStatus.UNPAID)
                .subtotal(subtotal)
                .shippingFee(shippingFee)
                .discount(discount)
                .couponCode(discountApplication.code())
                .note(buildParentOrderNote(request.getNote(), groupedByStore.size()))
                .commissionFee(commissionFee)
                .vendorPayout(vendorPayout)
                .build();
        parentOrder.calculateTotal();

        Order persistedParent = orderRepository.save(parentOrder);

        for (PreparedOrderItem item : preparedItems) {
            persistedParent.getItems().add(buildOrderItem(persistedParent, item));
        }
        persistedParent = orderRepository.save(persistedParent);

        for (StoreOrderGroup group : groupedByStore.values()) {
            BigDecimal storeDiscount = discountApplication.discountForStore(group.storeId());
            createStoreScopedOrder(
                    user,
                    address,
                    request,
                    paymentMethod,
                    group,
                    persistedParent,
                    discountApplication,
                    storeDiscount
            );
        }

        return persistedParent;
    }

    private Order createStoreScopedOrder(
            User user,
            Address address,
            OrderRequest request,
            Order.PaymentMethod paymentMethod,
            StoreOrderGroup group,
            Order parentOrder,
            DiscountApplication discountApplication,
            BigDecimal preCalculatedDiscount
    ) {
        BigDecimal shippingFee = calculateShippingFee(group);
        BigDecimal commissionFee = calculateCommissionFee(group);
        BigDecimal discount = preCalculatedDiscount;
        BigDecimal vendorPayout = group.subtotal().add(shippingFee).subtract(commissionFee).subtract(discount);

        Order order = Order.builder()
                .orderCode(publicCodeService.nextOrderCode())
                .user(user)
                .shippingAddress(address)
                .status(Order.OrderStatus.PENDING)
                .paymentMethod(paymentMethod)
                .paymentStatus(Order.PaymentStatus.UNPAID)
                .subtotal(group.subtotal())
                .shippingFee(shippingFee)
                .discount(discount)
                .couponCode(discountApplication.code())
                .note(request.getNote())
                .storeId(group.storeId())
                .parentOrder(parentOrder)
                .commissionFee(commissionFee)
                .vendorPayout(vendorPayout)
                .build();
        order.calculateTotal();

        Order savedOrder = orderRepository.save(order);
        for (PreparedOrderItem item : group.items()) {
            savedOrder.getItems().add(buildOrderItem(savedOrder, item));
        }
        return orderRepository.save(savedOrder);
    }

    private OrderItem buildOrderItem(Order order, PreparedOrderItem item) {
        return OrderItem.builder()
                .order(order)
                .product(item.product())
                .variant(item.variant())
                .productName(item.productName())
                .variantName(item.variantName())
                .productImage(item.productImage())
                .quantity(item.quantity())
                .unitPrice(item.unitPrice())
                .totalPrice(item.totalPrice())
                .storeId(item.storeId())
                .build();
    }

    private BigDecimal calculateShippingFee(StoreOrderGroup group) {
        return group.subtotal().compareTo(FREE_SHIPPING_THRESHOLD) >= 0 ? BigDecimal.ZERO : DEFAULT_SHIPPING_FEE;
    }

    private BigDecimal calculateCommissionFee(StoreOrderGroup group) {
        Store store = storeRepository.findById(group.storeId())
                .orElseThrow(() -> new ResourceNotFoundException("Store not found"));
        BigDecimal commissionRatePercent = resolveCommissionRatePercent(store.getCommissionRate());
        return group.subtotal()
                .multiply(commissionRatePercent)
                .divide(COMMISSION_RATE_DIVISOR, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveCommissionRatePercent(BigDecimal rawRate) {
        if (rawRate == null || rawRate.compareTo(BigDecimal.ZERO) <= 0) {
            return DEFAULT_COMMISSION_RATE_PERCENT;
        }
        return rawRate;
    }

    private BigDecimal resolveUnitPrice(Product product, ProductVariant variant) {
        BigDecimal resolvedPrice = variant != null ? variant.getPrice() : product.getEffectivePrice();
        if (resolvedPrice == null || resolvedPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product price is invalid");
        }
        return resolvedPrice;
    }

    private String resolvePrimaryImage(Product product) {
        if (product.getImages() == null || product.getImages().isEmpty()) {
            return null;
        }
        return product.getImages().stream()
                .sorted((left, right) -> Boolean.compare(Boolean.TRUE.equals(right.getIsPrimary()), Boolean.TRUE.equals(left.getIsPrimary())))
                .map(ProductImage::getUrl)
                .findFirst()
                .orElse(null);
    }

    private String buildVariantName(ProductVariant variant) {
        if (variant == null) {
            return null;
        }
        String color = variant.getColor() != null ? variant.getColor() : "";
        String size = variant.getSize() != null ? variant.getSize() : "";
        if (!color.isBlank() && !size.isBlank()) {
            return color + " / " + size;
        }
        if (!color.isBlank()) {
            return color;
        }
        return size.isBlank() ? null : size;
    }

    private String buildParentOrderNote(String originalNote, int vendorCount) {
        String splitNote = "Marketplace order split into " + vendorCount + " vendor sub-orders.";
        if (originalNote == null || originalNote.isBlank()) {
            return splitNote;
        }
        return originalNote + "\n" + splitNote;
    }

    private void cascadeCancelToSubOrders(Order parentOrder, String reason) {
        List<Order> subOrders = orderRepository.findByParentOrderOrderByCreatedAtDesc(parentOrder);
        for (Order subOrder : subOrders) {
            if (subOrder.getStatus() == Order.OrderStatus.PENDING) {
                subOrder.setStatus(Order.OrderStatus.CANCELLED);
                subOrder.setNote((subOrder.getNote() != null ? subOrder.getNote() : "") + "\nCancellation reason: " + reason);
                orderRepository.save(subOrder);
            }
        }
    }

    private Order syncParentOrderStatus(UUID parentOrderId) {
        Order parentOrder = findById(parentOrderId);
        List<Order> subOrders = orderRepository.findByParentOrderIdOrderByCreatedAtDesc(parentOrderId);
        if (subOrders.isEmpty()) {
            return parentOrder;
        }

        Order.OrderStatus aggregateStatus = deriveParentStatus(subOrders);
        parentOrder.setStatus(aggregateStatus);

        boolean allDelivered = subOrders.stream().allMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.DELIVERED);
        boolean allCancelled = subOrders.stream().allMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.CANCELLED);

        if (allDelivered) {
            parentOrder.setPaymentStatus(Order.PaymentStatus.PAID);
            if (parentOrder.getPaidAt() == null) {
                parentOrder.setPaidAt(LocalDateTime.now());
            }
        } else if (allCancelled) {
            parentOrder.setPaymentStatus(Order.PaymentStatus.FAILED);
        }

        return orderRepository.save(parentOrder);
    }

    private Order.OrderStatus deriveParentStatus(List<Order> subOrders) {
        boolean allCancelled = subOrders.stream().allMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.CANCELLED);
        if (allCancelled) {
            return Order.OrderStatus.CANCELLED;
        }

        boolean allDelivered = subOrders.stream()
                .filter(subOrder -> subOrder.getStatus() != Order.OrderStatus.CANCELLED)
                .allMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.DELIVERED);
        if (allDelivered) {
            return Order.OrderStatus.DELIVERED;
        }

        if (subOrders.stream().anyMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.SHIPPED
                || subOrder.getStatus() == Order.OrderStatus.DELIVERED)) {
            return Order.OrderStatus.SHIPPED;
        }

        if (subOrders.stream().anyMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.PROCESSING)) {
            return Order.OrderStatus.PROCESSING;
        }

        if (subOrders.stream().anyMatch(subOrder -> subOrder.getStatus() == Order.OrderStatus.CONFIRMED)) {
            return Order.OrderStatus.CONFIRMED;
        }

        return Order.OrderStatus.PENDING;
    }

    private String safeEnumName(Enum<?> value) {
        return value == null ? null : value.name();
    }

    public UUID resolveOrderId(String idOrCode) {
        if (idOrCode == null || idOrCode.isBlank()) {
            throw new ResourceNotFoundException("Order not found");
        }
        try {
            return UUID.fromString(idOrCode.trim());
        } catch (IllegalArgumentException ex) {
            return findByCode(idOrCode).getId();
        }
    }
}
