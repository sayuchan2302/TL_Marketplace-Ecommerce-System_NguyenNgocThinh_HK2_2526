package vn.edu.hcmuaf.fit.fashionstore.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.VendorWallet;
import vn.edu.hcmuaf.fit.fashionstore.entity.WalletTransaction;
import vn.edu.hcmuaf.fit.fashionstore.repository.CustomerWalletRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.CustomerWalletTransactionRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.VendorWalletRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.WalletTransactionRepository;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.Optional;
import java.util.Queue;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private VendorWalletRepository vendorWalletRepository;

    @Mock
    private WalletTransactionRepository walletTransactionRepository;

    @Mock
    private CustomerWalletRepository customerWalletRepository;

    @Mock
    private CustomerWalletTransactionRepository customerWalletTransactionRepository;

    private WalletService walletService;
    private FixedPublicCodeService publicCodeService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        publicCodeService = new FixedPublicCodeService();
        walletService = new WalletService(
                orderRepository,
                vendorWalletRepository,
                walletTransactionRepository,
                customerWalletRepository,
                customerWalletTransactionRepository,
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
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.CREDIT))
                .thenReturn(false);

        walletService.debitVendorForRefund(lockedOrder);

        verify(vendorWalletRepository, never()).findByStoreId(any());
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
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.CREDIT))
                .thenReturn(true);
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.DEBIT))
                .thenReturn(true);

        walletService.debitVendorForRefund(lockedOrder);

        verify(vendorWalletRepository, never()).findByStoreId(any());
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
                .balance(new BigDecimal("500000"))
                .build();

        when(orderRepository.findByIdForUpdate(orderId)).thenReturn(Optional.of(lockedOrder));
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.CREDIT))
                .thenReturn(true);
        when(walletTransactionRepository.existsByOrderIdAndType(orderId, WalletTransaction.TransactionType.DEBIT))
                .thenReturn(false);
        when(vendorWalletRepository.findByStoreId(storeId)).thenReturn(Optional.of(wallet));
        when(vendorWalletRepository.save(any(VendorWallet.class))).thenAnswer(invocation -> invocation.getArgument(0));
        publicCodeService.pushTransactionCode("GD-260401-000001");

        walletService.debitVendorForRefund(lockedOrder);

        assertEquals(0, wallet.getBalance().compareTo(new BigDecimal("350000")));
        verify(walletTransactionRepository).save(argThat(transaction ->
                transaction.getType() == WalletTransaction.TransactionType.DEBIT
                        && orderId.equals(transaction.getOrderId())
                        && transaction.getAmount().compareTo(new BigDecimal("150000")) == 0
        ));
    }

    private static final class FixedPublicCodeService extends PublicCodeService {
        private final Queue<String> transactionCodes = new ArrayDeque<>();

        private FixedPublicCodeService() {
            super(null, null, null, null);
        }

        private void pushTransactionCode(String code) {
            transactionCodes.add(code);
        }

        @Override
        public String nextTransactionCode() {
            String code = transactionCodes.poll();
            return code != null ? code : "GD-TEST-000001";
        }
    }
}
