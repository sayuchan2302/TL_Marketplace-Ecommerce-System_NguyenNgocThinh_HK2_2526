package vn.edu.hcmuaf.fit.fashionstore.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.entity.CustomerWallet;
import vn.edu.hcmuaf.fit.fashionstore.entity.CustomerWalletTransaction;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.PayoutRequest;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.entity.VendorWallet;
import vn.edu.hcmuaf.fit.fashionstore.entity.WalletTransaction;
import vn.edu.hcmuaf.fit.fashionstore.repository.CustomerWalletRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.CustomerWalletTransactionRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.PayoutRequestRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.VendorWalletRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.WalletTransactionRepository;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.Optional;
import java.util.Queue;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private VendorWalletRepository vendorWalletRepository;
    @Mock private WalletTransactionRepository walletTransactionRepository;
    @Mock private CustomerWalletRepository customerWalletRepository;
    @Mock private CustomerWalletTransactionRepository customerWalletTransactionRepository;
    @Mock private PayoutRequestRepository payoutRequestRepository;

    private WalletService walletService;
    private FixedPublicCodeService publicCodeService;

    @BeforeEach
    void setUp() {
        publicCodeService = new FixedPublicCodeService();
        walletService = new WalletService(
                orderRepository,
                vendorWalletRepository,
                walletTransactionRepository,
                customerWalletRepository,
                customerWalletTransactionRepository,
                payoutRequestRepository,
                publicCodeService
        );
    }

    @Test
    void debitVendorForRefundSkipsWhenNoCreditTransactionExists() {
        UUID orderId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        Order lockedOrder = Order.builder()
                .id(orderId)
                .storeId(storeId)
                .vendorPayout(new BigDecimal("150000"))
                .build();

        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.ESCROW_CREDIT))
                .thenReturn(false);

        walletService.debitVendorForRefund(lockedOrder);

        verify(vendorWalletRepository, never()).findByStoreIdForUpdate(any());
        verify(vendorWalletRepository, never()).save(any());
        verify(walletTransactionRepository, never()).save(any());
    }

    @Test
    void debitVendorForRefundIsIdempotentWhenDebitAlreadyExists() {
        UUID orderId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        Order lockedOrder = Order.builder()
                .id(orderId)
                .storeId(storeId)
                .vendorPayout(new BigDecimal("150000"))
                .build();

        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.ESCROW_CREDIT))
                .thenReturn(true);
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.REFUND_DEBIT))
                .thenReturn(true);

        walletService.debitVendorForRefund(lockedOrder);

        verify(vendorWalletRepository, never()).findByStoreIdForUpdate(any());
        verify(vendorWalletRepository, never()).save(any());
        verify(walletTransactionRepository, never()).save(any());
    }

    @Test
    void debitVendorForRefundCreatesDebitTransactionWhenEligible() {
        UUID orderId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        Order lockedOrder = Order.builder()
                .id(orderId)
                .orderCode("DH-260401-000010")
                .storeId(storeId)
                .vendorPayout(new BigDecimal("150000"))
                .build();

        VendorWallet wallet = VendorWallet.builder()
                .storeId(storeId)
                .availableBalance(new BigDecimal("500000"))
                .frozenBalance(new BigDecimal("0"))
                .build();

        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.ESCROW_CREDIT))
                .thenReturn(true);
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.REFUND_DEBIT))
                .thenReturn(false);
        when(vendorWalletRepository.findByStoreIdForUpdate(storeId)).thenReturn(Optional.of(wallet));
        when(vendorWalletRepository.save(any(VendorWallet.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(walletTransactionRepository.save(any(WalletTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));
        publicCodeService.push("GD-260401-000001");

        walletService.debitVendorForRefund(lockedOrder);

        assertEquals(0, wallet.getAvailableBalance().compareTo(new BigDecimal("350000")));
        verify(walletTransactionRepository).save(argThat(transaction ->
                transaction.getType() == WalletTransaction.TransactionType.REFUND_DEBIT
                        && orderId.equals(transaction.getOrderId())
                        && transaction.getAmount().compareTo(new BigDecimal("150000")) == 0
        ));
    }

    @Test
    void creditEscrowForOrderSkipsWalletMutationWhenDuplicateTransactionRaceOccurs() {
        UUID orderId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        Order lockedOrder = Order.builder()
                .id(orderId)
                .orderCode("DH-260401-000011")
                .storeId(storeId)
                .vendorPayout(new BigDecimal("100000"))
                .build();
        VendorWallet wallet = VendorWallet.builder()
                .storeId(storeId)
                .availableBalance(new BigDecimal("500000"))
                .frozenBalance(new BigDecimal("0"))
                .build();

        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.ESCROW_CREDIT))
                .thenReturn(false);
        when(vendorWalletRepository.findByStoreIdForUpdate(storeId)).thenReturn(Optional.of(wallet));
        when(walletTransactionRepository.save(any(WalletTransaction.class)))
                .thenThrow(new DataIntegrityViolationException("uq_wallet_tx_order_type"));

        walletService.creditEscrowForCompletedOrder(lockedOrder);

        assertEquals(0, wallet.getFrozenBalance().compareTo(new BigDecimal("0")));
        verify(vendorWalletRepository, never()).save(any(VendorWallet.class));
    }

    @Test
    void refundToCustomerFromEscrowSkipsWalletAndOrderMutationWhenDuplicateTransactionRaceOccurs() {
        UUID orderId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID returnRequestId = UUID.randomUUID();

        User user = User.builder()
                .id(userId)
                .email("buyer@example.com")
                .password("secret")
                .name("Buyer")
                .build();
        Order lockedOrder = Order.builder()
                .id(orderId)
                .orderCode("DH-260401-000012")
                .user(user)
                .total(new BigDecimal("300000"))
                .paymentStatus(Order.PaymentStatus.PAID)
                .build();
        CustomerWallet wallet = CustomerWallet.builder()
                .userId(userId)
                .balance(new BigDecimal("20000"))
                .build();

        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(customerWalletTransactionRepository.existsByReturnRequestIdAndType(
                returnRequestId,
                CustomerWalletTransaction.TransactionType.CREDIT_REFUND
        )).thenReturn(false);
        when(customerWalletRepository.findByUserId(userId)).thenReturn(Optional.of(wallet));
        when(customerWalletTransactionRepository.sumAmountByOrderIdAndType(
                orderId,
                CustomerWalletTransaction.TransactionType.CREDIT_REFUND
        )).thenReturn(BigDecimal.ZERO);
        when(customerWalletTransactionRepository.save(any(CustomerWalletTransaction.class)))
                .thenThrow(new DataIntegrityViolationException("uq_customer_wallet_tx_return_type"));

        walletService.refundToCustomerFromEscrow(
                returnRequestId,
                lockedOrder,
                new BigDecimal("100000"),
                "Refund by return"
        );

        assertEquals(0, wallet.getBalance().compareTo(new BigDecimal("20000")));
        assertEquals(Order.PaymentStatus.PAID, lockedOrder.getPaymentStatus());
        verify(customerWalletRepository, never()).save(any(CustomerWallet.class));
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void debitVendorForReturnRefundRejectsWhenInsufficientCombinedBalance() {
        UUID orderId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID returnRequestId = UUID.randomUUID();

        Order lockedOrder = Order.builder()
                .id(orderId)
                .storeId(storeId)
                .vendorPayout(new BigDecimal("120000"))
                .build();
        VendorWallet wallet = VendorWallet.builder()
                .storeId(storeId)
                .frozenBalance(new BigDecimal("10000"))
                .availableBalance(new BigDecimal("20000"))
                .build();

        when(walletTransactionRepository.existsByReturnRequestIdAndType(
                returnRequestId,
                WalletTransaction.TransactionType.RETURN_REFUND_DEBIT
        )).thenReturn(false, false);
        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(vendorWalletRepository.findByStoreIdForUpdate(storeId)).thenReturn(Optional.of(wallet));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> walletService.debitVendorForReturnRefund(
                        returnRequestId,
                        lockedOrder,
                        new BigDecimal("50000"),
                        "Return refund"
                )
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(walletTransactionRepository, never()).save(any(WalletTransaction.class));
        verify(vendorWalletRepository, never()).save(any(VendorWallet.class));
    }

    @Test
    void debitVendorForReturnRefundDebitsFrozenThenAvailableAndCreatesTransaction() {
        UUID orderId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID returnRequestId = UUID.randomUUID();

        Order lockedOrder = Order.builder()
                .id(orderId)
                .orderCode("DH-260401-000013")
                .storeId(storeId)
                .build();
        VendorWallet wallet = VendorWallet.builder()
                .storeId(storeId)
                .frozenBalance(new BigDecimal("30000"))
                .availableBalance(new BigDecimal("40000"))
                .build();

        when(walletTransactionRepository.existsByReturnRequestIdAndType(
                returnRequestId,
                WalletTransaction.TransactionType.RETURN_REFUND_DEBIT
        )).thenReturn(false, false);
        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(vendorWalletRepository.findByStoreIdForUpdate(storeId)).thenReturn(Optional.of(wallet));
        when(walletTransactionRepository.save(any(WalletTransaction.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(vendorWalletRepository.save(any(VendorWallet.class))).thenAnswer(invocation -> invocation.getArgument(0));
        publicCodeService.push("GD-260401-000002");

        walletService.debitVendorForReturnRefund(
                returnRequestId,
                lockedOrder,
                new BigDecimal("50000"),
                "Return refund"
        );

        assertEquals(0, wallet.getFrozenBalance().compareTo(BigDecimal.ZERO));
        assertEquals(0, wallet.getAvailableBalance().compareTo(new BigDecimal("20000")));
        verify(walletTransactionRepository).save(argThat(transaction ->
                transaction.getType() == WalletTransaction.TransactionType.RETURN_REFUND_DEBIT
                        && returnRequestId.equals(transaction.getReturnRequestId())
                        && orderId.equals(transaction.getOrderId())
                        && transaction.getAmount().compareTo(new BigDecimal("50000")) == 0
        ));
    }

    private static final class FixedPublicCodeService extends PublicCodeService {
        private final Queue<String> transactionCodes = new ArrayDeque<>();

        private FixedPublicCodeService() {
            super(null, null, null, null);
        }

        void push(String code) {
            transactionCodes.add(code);
        }

        @Override
        public String nextTransactionCode() {
            String code = transactionCodes.poll();
            return code != null ? code : "GD-TEST-000001";
        }
    }
}
