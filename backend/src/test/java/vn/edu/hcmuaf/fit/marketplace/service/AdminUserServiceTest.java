package vn.edu.hcmuaf.fit.marketplace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.marketplace.dto.response.AdminUserResponse;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.entity.User;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private AdminUserService adminUserService;

    private User customer;
    private User pendingVendor;
    private User lockedVendor;
    private User superAdmin;
    private Store pendingStore;
    private Store activeVendorStore;

    @BeforeEach
    void setUp() {
        customer = buildUser("customer@test.local", User.Role.CUSTOMER, true, LocalDateTime.now().minusDays(4));
        pendingVendor = buildUser("pending@test.local", User.Role.CUSTOMER, true, LocalDateTime.now().minusDays(3));
        lockedVendor = buildUser("vendor@test.local", User.Role.VENDOR, false, LocalDateTime.now().minusDays(2));
        superAdmin = buildUser("admin@test.local", User.Role.SUPER_ADMIN, true, LocalDateTime.now().minusDays(1));

        pendingStore = Store.builder()
                .id(UUID.randomUUID())
                .owner(pendingVendor)
                .name("Pending Vendor Store")
                .slug("pending-vendor-store")
                .approvalStatus(Store.ApprovalStatus.PENDING)
                .status(Store.StoreStatus.INACTIVE)
                .build();

        activeVendorStore = Store.builder()
                .id(UUID.randomUUID())
                .owner(lockedVendor)
                .name("Locked Vendor Store")
                .slug("locked-vendor-store")
                .approvalStatus(Store.ApprovalStatus.APPROVED)
                .status(Store.StoreStatus.ACTIVE)
                .build();
    }

    @Test
    void listUsersMapsStatusesAndSupportsFilters() {
        when(userRepository.findAll()).thenReturn(List.of(customer, pendingVendor, lockedVendor, superAdmin));
        when(storeRepository.findAll()).thenReturn(List.of(pendingStore, activeVendorStore));
        when(orderRepository.calculateDeliveredSpendingByUserIds(any())).thenReturn(List.of());

        List<AdminUserResponse> allRows = adminUserService.listUsers(null, null, null);
        assertEquals(4, allRows.size());

        AdminUserResponse pendingRow = allRows.stream()
                .filter(item -> "pending@test.local".equals(item.getEmail()))
                .findFirst()
                .orElseThrow();
        assertEquals("PENDING_VENDOR", pendingRow.getStatus());
        assertEquals("Pending Vendor Store", pendingRow.getStoreName());

        AdminUserResponse lockedRow = allRows.stream()
                .filter(item -> "vendor@test.local".equals(item.getEmail()))
                .findFirst()
                .orElseThrow();
        assertEquals("LOCKED", lockedRow.getStatus());

        List<AdminUserResponse> lockedOnly = adminUserService.listUsers(null, null, "LOCKED");
        assertEquals(1, lockedOnly.size());
        assertEquals("vendor@test.local", lockedOnly.get(0).getEmail());

        List<AdminUserResponse> queryRows = adminUserService.listUsers("pending vendor store", null, null);
        assertEquals(1, queryRows.size());
        assertEquals("pending@test.local", queryRows.get(0).getEmail());
    }

    @Test
    void cannotUpdateActiveStatusForSuperAdmin() {
        when(userRepository.findById(superAdmin.getId())).thenReturn(Optional.of(superAdmin));

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> adminUserService.updateUserActive(superAdmin.getId(), false)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("SUPER_ADMIN"));
    }

    @Test
    void updateUserActiveIsIdempotentAndReturnsLatestRow() {
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(storeRepository.findAll()).thenReturn(List.of());

        AdminUserResponse response = adminUserService.updateUserActive(customer.getId(), false);
        assertEquals("LOCKED", response.getStatus());
        assertEquals(false, response.getIsActive());
        verify(userRepository).save(customer);
    }

    private User buildUser(String email, User.Role role, boolean isActive, LocalDateTime createdAt) {
        return User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .password("hashed")
                .name(email.split("@")[0])
                .role(role)
                .isActive(isActive)
                .createdAt(createdAt)
                .build();
    }
}
