package vn.edu.hcmuaf.fit.fashionstore.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.OrderRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminOrderResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Address;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductImage;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductVariant;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.repository.AddressRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.CouponRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductVariantRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.VoucherRepository;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Optional;
import java.util.Queue;
import java.util.UUID;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AddressRepository addressRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private ProductVariantRepository productVariantRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private CouponRepository couponRepository;

    @Mock
    private VoucherRepository voucherRepository;

    private OrderService orderService;
    private RecordingWalletService walletService;
    private FixedPublicCodeService publicCodeService;

    private UUID orderId;
    private UUID storeId;

    @BeforeEach
    void setUp() {
        orderId = UUID.randomUUID();
        storeId = UUID.randomUUID();
        walletService = new RecordingWalletService();
        publicCodeService = new FixedPublicCodeService();
        orderService = new OrderService(
                orderRepository,
                userRepository,
                addressRepository,
                productRepository,
                productVariantRepository,
                walletService,
                storeRepository,
                couponRepository,
                voucherRepository,
                publicCodeService
        );
    }

    @Test
    void vendorCannotShipWithoutTrackingAndCarrier() {
        Order order = buildStoreOrder(Order.OrderStatus.PROCESSING);
        when(orderRepository.findByIdAndStoreId(orderId, storeId)).thenReturn(Optional.of(order));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> orderService.updateStatusForStore(orderId, storeId, Order.OrderStatus.SHIPPED, null, null, null)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Tracking number is required"));
    }

    @Test
    void vendorCanShipUsingExistingTrackingAndCarrier() {
        Order order = buildStoreOrder(Order.OrderStatus.PROCESSING);
        order.setTrackingNumber("GHN123456");
        order.setShippingCarrier("GHN");
        when(orderRepository.findByIdAndStoreId(orderId, storeId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order updated = orderService.updateStatusForStore(
                orderId,
                storeId,
                Order.OrderStatus.SHIPPED,
                null,
                null,
                null
        );

        assertEquals(Order.OrderStatus.SHIPPED, updated.getStatus());
        assertEquals("GHN123456", updated.getTrackingNumber());
        assertEquals("GHN", updated.getShippingCarrier());
    }

    @Test
    void vendorCancelRequiresReason() {
        Order order = buildStoreOrder(Order.OrderStatus.CONFIRMED);
        when(orderRepository.findByIdAndStoreId(orderId, storeId)).thenReturn(Optional.of(order));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> orderService.updateStatusForStore(
                        orderId,
                        storeId,
                        Order.OrderStatus.CANCELLED,
                        null,
                        null,
                        "   "
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Cancellation reason is required", ex.getReason());
    }

    @Test
    void deliveredRequiresTrackingData() {
        Order order = buildStoreOrder(Order.OrderStatus.SHIPPED);
        when(orderRepository.findByIdAndStoreId(orderId, storeId)).thenReturn(Optional.of(order));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> orderService.updateStatusForStore(orderId, storeId, Order.OrderStatus.DELIVERED, null, null, null)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Tracking number is required"));
    }

    @Test
    void trackingCanOnlyBeUpdatedFromProcessingOrShipped() {
        Order order = buildStoreOrder(Order.OrderStatus.PENDING);
        when(orderRepository.findByIdAndStoreId(orderId, storeId)).thenReturn(Optional.of(order));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> orderService.updateTrackingForStore(orderId, storeId, "GHN-999")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Tracking can only be updated when order is PROCESSING or SHIPPED", ex.getReason());
    }

    @Test
    void createSingleStoreOrderUsesStoreCommissionRateAndReservesStock() {
        UUID userId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID variantId = UUID.randomUUID();

        User user = User.builder()
                .id(userId)
                .email("buyer@example.com")
                .password("secret")
                .build();

        Address address = Address.builder()
                .id(addressId)
                .user(user)
                .fullName("Buyer")
                .phone("0900000000")
                .province("HCM")
                .district("Q1")
                .ward("Ben Nghe")
                .detail("1 Test Street")
                .build();

        Product product = Product.builder()
                .id(productId)
                .name("T-Shirt")
                .storeId(storeId)
                .basePrice(new BigDecimal("100000"))
                .salePrice(new BigDecimal("80000"))
                .stockQuantity(5)
                .build();
        product.setImages(List.of(
                ProductImage.builder()
                        .product(product)
                        .url("https://example.com/p.jpg")
                        .isPrimary(true)
                        .build()
        ));

        ProductVariant variant = ProductVariant.builder()
                .id(variantId)
                .product(product)
                .sku("TS-RED-M")
                .isActive(true)
                .stockQuantity(5)
                .priceAdjustment(BigDecimal.ZERO)
                .build();

        Store store = Store.builder()
                .id(storeId)
                .name("Store A")
                .commissionRate(new BigDecimal("10.0"))
                .build();

        OrderRequest request = OrderRequest.builder()
                .addressId(addressId)
                .paymentMethod("COD")
                .items(List.of(
                        OrderRequest.OrderItemRequest.builder()
                                .productId(productId)
                                .variantId(variantId)
                                .quantity(2)
                                .unitPrice(BigDecimal.ONE) // ignored by server-side pricing
                                .build()
                ))
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(addressRepository.findById(addressId)).thenReturn(Optional.of(address));
        when(productRepository.findPublicByIdForUpdate(productId)).thenReturn(Optional.of(product));
        when(productVariantRepository.findByIdForUpdate(variantId)).thenReturn(Optional.of(variant));
        when(productVariantRepository.sumActiveStockByProductId(productId)).thenReturn(3L);
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        publicCodeService.pushOrderCode("DH-260401-000001");
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminOrderResponse response = orderService.create(userId, request);

        assertEquals(0, response.getSubtotal().compareTo(new BigDecimal("160000")));
        assertEquals(0, response.getCommissionFee().compareTo(new BigDecimal("16000.00")));
        assertEquals(0, response.getVendorPayout().compareTo(new BigDecimal("174000.00")));
        assertEquals(3, variant.getStockQuantity());
        assertEquals(3, product.getStockQuantity());
    }

    @Test
    void createRequiresVariantSelectionWhenMultipleActiveVariants() {
        UUID userId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        User user = User.builder()
                .id(userId)
                .email("buyer@example.com")
                .password("secret")
                .build();

        Address address = Address.builder()
                .id(addressId)
                .user(user)
                .fullName("Buyer")
                .phone("0900000000")
                .province("HCM")
                .district("Q1")
                .ward("Ben Nghe")
                .detail("1 Test Street")
                .build();

        Product product = Product.builder()
                .id(productId)
                .name("Sneaker")
                .storeId(storeId)
                .basePrice(new BigDecimal("500000"))
                .stockQuantity(10)
                .build();
        ProductVariant variantA = ProductVariant.builder()
                .id(UUID.randomUUID())
                .product(product)
                .isActive(true)
                .stockQuantity(3)
                .build();
        ProductVariant variantB = ProductVariant.builder()
                .id(UUID.randomUUID())
                .product(product)
                .isActive(true)
                .stockQuantity(7)
                .build();

        OrderRequest request = OrderRequest.builder()
                .addressId(addressId)
                .paymentMethod("COD")
                .items(List.of(
                        OrderRequest.OrderItemRequest.builder()
                                .productId(productId)
                                .quantity(1)
                                .build()
                ))
                .build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(addressRepository.findById(addressId)).thenReturn(Optional.of(address));
        when(productRepository.findPublicByIdForUpdate(productId)).thenReturn(Optional.of(product));
        when(productVariantRepository.findByProductIdAndIsActiveTrue(productId)).thenReturn(List.of(variantA, variantB));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> orderService.create(userId, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Please select a product variant", ex.getReason());
    }

    @Test
    void adminCancelDeliveredOrderTriggersVendorRefundDebit() {
        Order order = buildStoreOrder(Order.OrderStatus.DELIVERED);
        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order updated = orderService.updateStatus(orderId, Order.OrderStatus.CANCELLED);

        assertEquals(Order.OrderStatus.CANCELLED, updated.getStatus());
        assertEquals(1, walletService.getDebitCallCount());
        assertEquals(updated.getId(), walletService.getLastDebitedOrderId());
    }

    private Order buildStoreOrder(Order.OrderStatus status) {
        return Order.builder()
                .id(orderId)
                .storeId(storeId)
                .status(status)
                .subtotal(new BigDecimal("100000"))
                .shippingFee(new BigDecimal("20000"))
                .discount(new BigDecimal("0"))
                .total(new BigDecimal("120000"))
                .paymentMethod(Order.PaymentMethod.COD)
                .paymentStatus(Order.PaymentStatus.UNPAID)
                .build();
    }

    private static final class RecordingWalletService extends WalletService {
        private int debitCallCount = 0;
        private UUID lastDebitedOrderId;

        private RecordingWalletService() {
            super(null, null, null, null);
        }

        @Override
        public void debitVendorForRefund(Order order) {
            debitCallCount++;
            lastDebitedOrderId = order == null ? null : order.getId();
        }

        @Override
        public void creditVendorForOrder(Order order) {
            // No-op for OrderService unit tests
        }

        private int getDebitCallCount() {
            return debitCallCount;
        }

        private UUID getLastDebitedOrderId() {
            return lastDebitedOrderId;
        }
    }

    private static final class FixedPublicCodeService extends PublicCodeService {
        private final Queue<String> orderCodes = new ArrayDeque<>();

        private FixedPublicCodeService() {
            super(null, null, null, null);
        }

        private void pushOrderCode(String code) {
            orderCodes.add(code);
        }

        @Override
        public String nextOrderCode() {
            String code = orderCodes.poll();
            return code != null ? code : "DH-TEST-000001";
        }
    }
}
