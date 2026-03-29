package vn.edu.hcmuaf.fit.fashionstore.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AdminUserResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.exception.ResourceNotFoundException;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    public enum AdminUserStatus {
        ACTIVE,
        LOCKED,
        PENDING_VENDOR
    }

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;

    public AdminUserService(UserRepository userRepository, StoreRepository storeRepository) {
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(String q, User.Role role, String statusRaw) {
        AdminUserStatus expectedStatus = parseStatus(statusRaw);
        String normalizedQuery = normalizeQuery(q);
        List<User> users = userRepository.findAll();
        Map<UUID, Store> storesByOwnerId = buildStoresByOwnerId();
        Map<UUID, Store> storesById = buildStoresById(storesByOwnerId);

        return users.stream()
                .map(user -> toResponse(user, resolveStore(user, storesByOwnerId, storesById)))
                .filter(row -> role == null || role.name().equals(row.getRole()))
                .filter(row -> expectedStatus == null || expectedStatus.name().equals(row.getStatus()))
                .filter(row -> normalizedQuery.isEmpty() || matchesQuery(row, normalizedQuery))
                .sorted(Comparator.comparing(AdminUserResponse::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .collect(Collectors.toList());
    }

    @Transactional
    public AdminUserResponse updateUserActive(UUID userId, boolean active) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (user.getRole() == User.Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot update active status for SUPER_ADMIN");
        }

        user.setIsActive(active);
        User saved = userRepository.save(user);
        Store store = resolveStore(saved, buildStoresByOwnerId(), null);
        return toResponse(saved, store);
    }

    private Map<UUID, Store> buildStoresByOwnerId() {
        return storeRepository.findAll().stream()
                .filter(store -> store.getOwner() != null && store.getOwner().getId() != null)
                .collect(Collectors.toMap(store -> store.getOwner().getId(), store -> store, (left, right) -> right));
    }

    private Map<UUID, Store> buildStoresById(Map<UUID, Store> storesByOwnerId) {
        return storesByOwnerId.values().stream()
                .collect(Collectors.toMap(Store::getId, store -> store, (left, right) -> right));
    }

    private Store resolveStore(User user, Map<UUID, Store> storesByOwnerId, Map<UUID, Store> storesById) {
        if (user.getStoreId() != null && storesById != null) {
            Store byStoreId = storesById.get(user.getStoreId());
            if (byStoreId != null) {
                return byStoreId;
            }
        }
        return storesByOwnerId.get(user.getId());
    }

    private AdminUserResponse toResponse(User user, Store store) {
        String status;
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            status = AdminUserStatus.LOCKED.name();
        } else if (store != null && store.getApprovalStatus() == Store.ApprovalStatus.PENDING) {
            status = AdminUserStatus.PENDING_VENDOR.name();
        } else {
            status = AdminUserStatus.ACTIVE.name();
        }

        return AdminUserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .gender(user.getGender())
                .dateOfBirth(user.getDateOfBirth())
                .loyaltyPoints(user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0L)
                .role(user.getRole() != null ? user.getRole().name() : User.Role.CUSTOMER.name())
                .status(status)
                .isActive(Boolean.TRUE.equals(user.getIsActive()))
                .createdAt(safeCreatedAt(user.getCreatedAt()))
                .storeId(store != null ? store.getId() : user.getStoreId())
                .storeName(store != null ? store.getName() : null)
                .storeApprovalStatus(store != null ? store.getApprovalStatus().name() : null)
                .storeStatus(store != null ? store.getStatus().name() : null)
                .build();
    }

    private static LocalDateTime safeCreatedAt(LocalDateTime value) {
        return value != null ? value : LocalDateTime.of(1970, 1, 1, 0, 0);
    }

    private static String normalizeQuery(String q) {
        return q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean matchesQuery(AdminUserResponse row, String query) {
        String text = (safe(row.getName()) + " " + safe(row.getEmail()) + " " + safe(row.getPhone()) + " " + safe(row.getStoreName()))
                .toLowerCase(Locale.ROOT);
        return text.contains(query);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static AdminUserStatus parseStatus(String rawStatus) {
        if (rawStatus == null || rawStatus.isBlank()) {
            return null;
        }

        try {
            return AdminUserStatus.valueOf(rawStatus.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported status: " + rawStatus);
        }
    }
}
