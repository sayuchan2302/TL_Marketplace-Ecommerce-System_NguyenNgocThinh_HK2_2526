package vn.edu.hcmuaf.fit.fashionstore.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReturnAdminVerdictRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ReturnSubmitRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.ReturnRequestResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.OrderItem;
import vn.edu.hcmuaf.fit.fashionstore.entity.ReturnRequest;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ReturnRequestRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReturnRequestServiceTest {

    @Mock
    private ReturnRequestRepository returnRequestRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private StoreRepository storeRepository;

    private WalletService walletService;

    private ReturnRequestService returnRequestService;
    private FixedPublicCodeService publicCodeService;
    private RecordingWalletService recordingWalletService;

    @BeforeEach
    void setUp() {
        publicCodeService = new FixedPublicCodeService();
        recordingWalletService = new RecordingWalletService();
        walletService = recordingWalletService;
        returnRequestService = new ReturnRequestService(
                returnRequestRepository,
                orderRepository,
                storeRepository,
                publicCodeService,
                walletService
        );
    }

    @Test
    void submitRejectsWhenOrderNotDelivered() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        User user = buildUser(userId);
        Order order = buildOrder(orderId, user, Order.OrderStatus.SHIPPED, List.of());

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        ReturnSubmitRequest payload = buildSubmitPayload(orderId, List.of(buildItemPayload(UUID.randomUUID(), 1)));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> returnRequestService.submit(userId, payload)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Returns are only allowed for delivered orders", ex.getReason());
    }

    @Test
    void submitRejectsDuplicateOrderItemsInSamePayload() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID orderItemId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        User user = buildUser(userId);
        OrderItem orderItem = buildOrderItem(orderItemId, storeId, 2, new BigDecimal("120000"));
        Order order = buildOrder(orderId, user, Order.OrderStatus.DELIVERED, List.of(orderItem));

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));

        ReturnSubmitRequest payload = buildSubmitPayload(
                orderId,
                List.of(
                        buildItemPayload(orderItemId, 1),
                        buildItemPayload(orderItemId, 1)
                )
        );

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> returnRequestService.submit(userId, payload)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Duplicate order item in return request", ex.getReason());
    }

    @Test
    void submitRejectsWhenAnOpenReturnAlreadyExistsForSameItem() {
        UUID userId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID orderItemId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        User user = buildUser(userId);
        OrderItem orderItem = buildOrderItem(orderItemId, storeId, 2, new BigDecimal("120000"));
        Order order = buildOrder(orderId, user, Order.OrderStatus.DELIVERED, List.of(orderItem));

        ReturnRequest existingOpenRequest = ReturnRequest.builder()
                .id(UUID.randomUUID())
                .order(order)
                .user(user)
                .status(ReturnRequest.ReturnStatus.ACCEPTED)
                .items(List.of(new ReturnRequest.ReturnItemSnapshot(
                        orderItemId,
                        "Polo Shirt",
                        "M",
                        "https://example.com/item.jpg",
                        null,
                        1,
                        new BigDecimal("120000")
                )))
                .build();

        when(orderRepository.findById(orderId)).thenReturn(Optional.of(order));
        when(returnRequestRepository.findByOrderId(orderId)).thenReturn(List.of(existingOpenRequest));

        ReturnSubmitRequest payload = buildSubmitPayload(orderId, List.of(buildItemPayload(orderItemId, 1)));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> returnRequestService.submit(userId, payload)
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("One or more items already have an active return request", ex.getReason());
    }

    @Test
    void openDisputeRejectsWhenAdminHasFinalizedCase() {
        UUID returnId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User user = buildUser(userId);
        Order order = buildOrder(UUID.randomUUID(), user, Order.OrderStatus.DELIVERED, List.of());
        ReturnRequest request = ReturnRequest.builder()
                .id(returnId)
                .order(order)
                .user(user)
                .status(ReturnRequest.ReturnStatus.REJECTED)
                .adminFinalized(true)
                .items(List.of())
                .build();

        when(returnRequestRepository.findById(returnId)).thenReturn(Optional.of(request));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> returnRequestService.openDispute(returnId, userId, "I want to escalate", "customer@local")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Return request has been finalized by admin", ex.getReason());
    }

    @Test
    void finalVerdictReleaseToVendorMarksCaseAsAdminFinalized() {
        UUID returnId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User user = buildUser(userId);
        Order order = buildOrder(UUID.randomUUID(), user, Order.OrderStatus.DELIVERED, List.of());
        ReturnRequest disputedRequest = ReturnRequest.builder()
                .id(returnId)
                .order(order)
                .user(user)
                .status(ReturnRequest.ReturnStatus.DISPUTED)
                .items(List.of())
                .build();

        when(returnRequestRepository.findById(returnId)).thenReturn(Optional.of(disputedRequest));
        when(returnRequestRepository.save(any(ReturnRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReturnRequestResponse response = returnRequestService.finalVerdict(
                returnId,
                ReturnAdminVerdictRequest.VerdictAction.RELEASE_TO_VENDOR,
                "   ",
                UUID.randomUUID(),
                "admin@local"
        );

        assertEquals(ReturnRequest.ReturnStatus.REJECTED, response.getStatus());
        assertEquals("Final verdict: release to vendor", response.getAdminNote());

        ArgumentCaptor<ReturnRequest> captor = ArgumentCaptor.forClass(ReturnRequest.class);
        verify(returnRequestRepository).save(captor.capture());
        assertTrue(Boolean.TRUE.equals(captor.getValue().getAdminFinalized()));
        assertEquals(0, recordingWalletService.getRefundCallCount());
    }

    @Test
    void confirmReceiptDebitsVendorBeforeCreditingCustomer() {
        UUID returnId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        User user = buildUser(userId);
        Order order = buildOrder(UUID.randomUUID(), user, Order.OrderStatus.DELIVERED, List.of());
        ReturnRequest request = ReturnRequest.builder()
                .id(returnId)
                .order(order)
                .user(user)
                .storeId(storeId)
                .status(ReturnRequest.ReturnStatus.RECEIVED)
                .items(List.of(new ReturnRequest.ReturnItemSnapshot(
                        UUID.randomUUID(),
                        "Polo Shirt",
                        "M",
                        "https://example.com/item.jpg",
                        null,
                        1,
                        new BigDecimal("120000")
                )))
                .build();

        when(returnRequestRepository.findById(returnId)).thenReturn(Optional.of(request));
        when(returnRequestRepository.save(any(ReturnRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReturnRequestResponse response = returnRequestService.confirmReceipt(returnId, storeId, "vendor@local");

        assertEquals(ReturnRequest.ReturnStatus.COMPLETED, response.getStatus());
        assertEquals(List.of("debit", "refund"), recordingWalletService.getCallSequence());
    }

    private User buildUser(UUID userId) {
        return User.builder()
                .id(userId)
                .email("buyer@example.com")
                .password("secret")
                .name("Buyer")
                .build();
    }

    private Order buildOrder(UUID orderId, User user, Order.OrderStatus status, List<OrderItem> items) {
        Order order = Order.builder()
                .id(orderId)
                .user(user)
                .status(status)
                .subtotal(new BigDecimal("240000"))
                .shippingFee(new BigDecimal("20000"))
                .discount(BigDecimal.ZERO)
                .total(new BigDecimal("260000"))
                .paymentMethod(Order.PaymentMethod.COD)
                .paymentStatus(Order.PaymentStatus.UNPAID)
                .items(items)
                .build();
        items.forEach(item -> item.setOrder(order));
        return order;
    }

    private OrderItem buildOrderItem(UUID orderItemId, UUID storeId, int quantity, BigDecimal unitPrice) {
        return OrderItem.builder()
                .id(orderItemId)
                .productName("Polo Shirt")
                .variantName("M")
                .productImage("https://example.com/item.jpg")
                .quantity(quantity)
                .unitPrice(unitPrice)
                .totalPrice(unitPrice.multiply(BigDecimal.valueOf(quantity)))
                .storeId(storeId)
                .build();
    }

    private ReturnSubmitRequest buildSubmitPayload(UUID orderId, List<ReturnSubmitRequest.ReturnItemPayload> items) {
        ReturnSubmitRequest payload = new ReturnSubmitRequest();
        payload.setOrderId(orderId);
        payload.setReason(ReturnRequest.ReturnReason.SIZE);
        payload.setResolution(ReturnRequest.ReturnResolution.REFUND);
        payload.setItems(items);
        return payload;
    }

    private ReturnSubmitRequest.ReturnItemPayload buildItemPayload(UUID orderItemId, int quantity) {
        ReturnSubmitRequest.ReturnItemPayload payload = new ReturnSubmitRequest.ReturnItemPayload();
        payload.setOrderItemId(orderItemId);
        payload.setQuantity(quantity);
        payload.setEvidenceUrl("https://example.com/evidence.jpg");
        return payload;
    }

    private static final class FixedPublicCodeService extends PublicCodeService {
        private FixedPublicCodeService() {
            super(null, null, null, null);
        }

        @Override
        public String nextReturnCode() {
            return "RT-TEST-000001";
        }
    }

    private static final class RecordingWalletService extends WalletService {
        private int refundCallCount = 0;
        private final List<UUID> returnRequestIds = new ArrayList<>();
        private final List<String> callSequence = new ArrayList<>();

        private RecordingWalletService() {
            super(null, null, null, null, null, null, null);
        }

        @Override
        public void debitVendorForReturnRefund(UUID returnRequestId, Order order, BigDecimal refundAmount, String reason) {
            callSequence.add("debit");
        }

        @Override
        public void refundToCustomerFromEscrow(UUID returnRequestId, Order order, BigDecimal refundAmount, String reason) {
            callSequence.add("refund");
            refundCallCount++;
            returnRequestIds.add(returnRequestId);
        }

        private int getRefundCallCount() {
            return refundCallCount;
        }

        private List<String> getCallSequence() {
            return callSequence;
        }
    }
}
