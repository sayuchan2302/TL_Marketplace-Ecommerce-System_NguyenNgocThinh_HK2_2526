package vn.edu.hcmuaf.fit.fashionstore.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.fashionstore.entity.CustomerWallet;
import vn.edu.hcmuaf.fit.fashionstore.entity.CustomerWalletTransaction;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.VendorWallet;
import vn.edu.hcmuaf.fit.fashionstore.entity.WalletTransaction;
import vn.edu.hcmuaf.fit.fashionstore.exception.ForbiddenException;
import vn.edu.hcmuaf.fit.fashionstore.exception.ResourceNotFoundException;
import vn.edu.hcmuaf.fit.fashionstore.repository.CustomerWalletRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.CustomerWalletTransactionRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.VendorWalletRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.WalletTransactionRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class WalletService {

    private final OrderRepository orderRepository;
    private final VendorWalletRepository vendorWalletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final CustomerWalletRepository customerWalletRepository;
    private final CustomerWalletTransactionRepository customerWalletTransactionRepository;
    private final PublicCodeService publicCodeService;

    public WalletService(OrderRepository orderRepository,
                         VendorWalletRepository vendorWalletRepository,
                         WalletTransactionRepository walletTransactionRepository,
                         CustomerWalletRepository customerWalletRepository,
                         CustomerWalletTransactionRepository customerWalletTransactionRepository,
                         PublicCodeService publicCodeService) {
        this.orderRepository = orderRepository;
        this.vendorWalletRepository = vendorWalletRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.customerWalletRepository = customerWalletRepository;
        this.customerWalletTransactionRepository = customerWalletTransactionRepository;
        this.publicCodeService = publicCodeService;
    }

    @Transactional
    public void creditVendorForOrder(Order order) {
        if (order == null || order.getId() == null) {
            return;
        }

        Order lockedOrder = orderRepository.findByIdForUpdate(order.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (lockedOrder.getStoreId() == null) {
            return; // Only credit orders that belong to a vendor store
        }

        if (walletTransactionRepository.existsByOrderIdAndType(
                lockedOrder.getId(),
                WalletTransaction.TransactionType.CREDIT
        )) {
            return; // Idempotent: payout already credited for this order
        }

        VendorWallet wallet = vendorWalletRepository.findByStoreId(lockedOrder.getStoreId())
                .orElseGet(() -> createWallet(lockedOrder.getStoreId()));

        BigDecimal amount = lockedOrder.getVendorPayout();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        wallet.setBalance(wallet.getBalance().add(amount));
        wallet.setLastUpdated(LocalDateTime.now());
        vendorWalletRepository.save(wallet);

        WalletTransaction transaction = WalletTransaction.builder()
                .transactionCode(publicCodeService.nextTransactionCode())
                .wallet(wallet)
                .orderId(lockedOrder.getId())
                .amount(amount)
                .type(WalletTransaction.TransactionType.CREDIT)
                .description("Payout for Order " + (lockedOrder.getOrderCode() != null ? lockedOrder.getOrderCode() : lockedOrder.getId()))
                .build();
        
        walletTransactionRepository.save(transaction);
    }

    @Transactional
    public void debitVendorForRefund(Order order) {
        if (order == null || order.getId() == null) {
            return;
        }

        Order lockedOrder = orderRepository.findByIdForUpdate(order.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (lockedOrder.getStoreId() == null) {
            return; // Only debit orders that belong to a vendor store
        }

        if (!walletTransactionRepository.existsByOrderIdAndType(
                lockedOrder.getId(),
                WalletTransaction.TransactionType.CREDIT
        )) {
            return; // No payout was credited, skip debit
        }

        if (walletTransactionRepository.existsByOrderIdAndType(
                lockedOrder.getId(),
                WalletTransaction.TransactionType.DEBIT
        )) {
            return; // Idempotent: refund already debited for this order
        }

        VendorWallet wallet = vendorWalletRepository.findByStoreId(lockedOrder.getStoreId())
                .orElseGet(() -> createWallet(lockedOrder.getStoreId()));

        BigDecimal amount = lockedOrder.getVendorPayout();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        wallet.setLastUpdated(LocalDateTime.now());
        vendorWalletRepository.save(wallet);

        WalletTransaction transaction = WalletTransaction.builder()
                .transactionCode(publicCodeService.nextTransactionCode())
                .wallet(wallet)
                .orderId(lockedOrder.getId())
                .amount(amount)
                .type(WalletTransaction.TransactionType.DEBIT)
                .description("Refund for Order " + (lockedOrder.getOrderCode() != null ? lockedOrder.getOrderCode() : lockedOrder.getId()))
                .build();
        
        walletTransactionRepository.save(transaction);
    }

    private VendorWallet createWallet(UUID storeId) {
        return vendorWalletRepository.save(VendorWallet.builder()
                .storeId(storeId)
                .balance(BigDecimal.ZERO)
                .lastUpdated(LocalDateTime.now())
                .build());
    }

    @Transactional(readOnly = true)
    public VendorWallet getWallet(UUID storeId) {
        return vendorWalletRepository.findByStoreId(storeId)
                .orElseGet(() -> createWallet(storeId));
    }

    @Transactional(readOnly = true)
    public java.util.List<VendorWallet> getAllWallets() {
        return vendorWalletRepository.findAll();
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<WalletTransaction> getTransactions(UUID storeId, org.springframework.data.domain.Pageable pageable) {
        VendorWallet wallet = getWallet(storeId);
        return walletTransactionRepository.findByWalletId(wallet.getId(), pageable);
    }

    @Transactional
    public WalletTransaction withdraw(UUID storeId, BigDecimal amount, String note) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be greater than zero");
        }

        VendorWallet wallet = vendorWalletRepository.findByStoreId(storeId)
                .orElseThrow(() -> new IllegalArgumentException("Wallet not found"));

        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient balance");
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        wallet.setLastUpdated(LocalDateTime.now());
        vendorWalletRepository.save(wallet);

        WalletTransaction transaction = WalletTransaction.builder()
                .transactionCode(publicCodeService.nextTransactionCode())
                .wallet(wallet)
                .amount(amount)
                .type(WalletTransaction.TransactionType.WITHDRAWAL)
                .description(note != null ? note : "Admin withdrawal")
                .build();

        return walletTransactionRepository.save(transaction);
    }

    @Transactional
    public void refundToCustomerFromEscrow(UUID returnRequestId, Order order, BigDecimal refundAmount, String reason) {
        if (returnRequestId == null || order == null || order.getId() == null) {
            return;
        }
        if (refundAmount == null || refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        Order lockedOrder = orderRepository.findByIdForUpdate(order.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (lockedOrder.getUser() == null || lockedOrder.getUser().getId() == null) {
            throw new ForbiddenException("Order does not contain a valid customer");
        }

        boolean alreadyProcessed = customerWalletTransactionRepository.existsByReturnRequestIdAndType(
                returnRequestId,
                CustomerWalletTransaction.TransactionType.CREDIT_REFUND
        );
        if (alreadyProcessed) {
            return;
        }

        CustomerWallet wallet = customerWalletRepository.findByUserId(lockedOrder.getUser().getId())
                .orElseGet(() -> createCustomerWallet(lockedOrder.getUser().getId()));

        wallet.setBalance(wallet.getBalance().add(refundAmount));
        wallet.setLastUpdated(LocalDateTime.now());
        customerWalletRepository.save(wallet);

        CustomerWalletTransaction transaction = CustomerWalletTransaction.builder()
                .transactionCode(publicCodeService.nextTransactionCode())
                .wallet(wallet)
                .orderId(lockedOrder.getId())
                .returnRequestId(returnRequestId)
                .amount(refundAmount)
                .type(CustomerWalletTransaction.TransactionType.CREDIT_REFUND)
                .description(reason == null || reason.isBlank()
                        ? "Refund from escrow for Order " + (lockedOrder.getOrderCode() != null ? lockedOrder.getOrderCode() : lockedOrder.getId())
                        : reason.trim())
                .build();
        customerWalletTransactionRepository.save(transaction);

        BigDecimal totalRefunded = customerWalletTransactionRepository.sumAmountByOrderIdAndType(
                lockedOrder.getId(),
                CustomerWalletTransaction.TransactionType.CREDIT_REFUND
        );
        BigDecimal orderTotal = lockedOrder.getTotal() == null ? BigDecimal.ZERO : lockedOrder.getTotal().max(BigDecimal.ZERO);

        if (orderTotal.compareTo(BigDecimal.ZERO) > 0 && totalRefunded.compareTo(orderTotal) >= 0) {
            lockedOrder.setPaymentStatus(Order.PaymentStatus.REFUNDED);
        } else {
            lockedOrder.setPaymentStatus(Order.PaymentStatus.REFUND_PENDING);
        }
        orderRepository.save(lockedOrder);
    }

    private CustomerWallet createCustomerWallet(UUID userId) {
        return customerWalletRepository.save(CustomerWallet.builder()
                .userId(userId)
                .balance(BigDecimal.ZERO)
                .lastUpdated(LocalDateTime.now())
                .build());
    }
}
