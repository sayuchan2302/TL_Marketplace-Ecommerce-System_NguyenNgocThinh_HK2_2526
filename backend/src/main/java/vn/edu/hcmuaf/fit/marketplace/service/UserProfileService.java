package vn.edu.hcmuaf.fit.marketplace.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.hcmuaf.fit.marketplace.dto.request.ChangePasswordRequest;
import vn.edu.hcmuaf.fit.marketplace.dto.request.UpdateUserProfileRequest;
import vn.edu.hcmuaf.fit.marketplace.dto.response.FollowedStoreResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.UserProfileResponse;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.entity.StoreFollow;
import vn.edu.hcmuaf.fit.marketplace.entity.User;
import vn.edu.hcmuaf.fit.marketplace.exception.ResourceNotFoundException;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreFollowRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.UserRepository;
import vn.edu.hcmuaf.fit.marketplace.security.AuthContext;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserProfileService {

    private final UserRepository userRepository;
    private final StoreFollowRepository storeFollowRepository;
    private final AuthContext authContext;
    private final PasswordEncoder passwordEncoder;
    private final AvatarStorageService avatarStorageService;
    private final StorePerformanceMetricsService storePerformanceMetricsService;

    public UserProfileService(
            UserRepository userRepository,
            StoreFollowRepository storeFollowRepository,
            AuthContext authContext,
            PasswordEncoder passwordEncoder,
            AvatarStorageService avatarStorageService,
            StorePerformanceMetricsService storePerformanceMetricsService
    ) {
        this.userRepository = userRepository;
        this.storeFollowRepository = storeFollowRepository;
        this.authContext = authContext;
        this.passwordEncoder = passwordEncoder;
        this.avatarStorageService = avatarStorageService;
        this.storePerformanceMetricsService = storePerformanceMetricsService;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getMyProfile(String authHeader) {
        User user = getCurrentUser(authHeader);
        return toResponse(user);
    }

    @Transactional
    public UserProfileResponse updateMyProfile(String authHeader, UpdateUserProfileRequest request) {
        User user = getCurrentUser(authHeader);

        if (request.getName() != null) {
            String sanitizedName = request.getName().trim();
            user.setName(sanitizedName.isEmpty() ? null : sanitizedName);
        }
        if (request.getPhone() != null) {
            String sanitizedPhone = request.getPhone().trim();
            user.setPhone(sanitizedPhone.isEmpty() ? null : sanitizedPhone);
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }
        if (request.getDateOfBirth() != null) {
            user.setDateOfBirth(request.getDateOfBirth());
        }
        if (request.getHeight() != null) {
            user.setHeight(request.getHeight());
        }
        if (request.getWeight() != null) {
            user.setWeight(request.getWeight());
        }

        User saved = userRepository.save(user);
        return toResponse(saved);
    }

    @Transactional
    public UserProfileResponse uploadMyAvatar(String authHeader, MultipartFile file) {
        User user = getCurrentUser(authHeader);
        String avatarUrl = avatarStorageService.storeAvatar(file, user.getAvatar());
        user.setAvatar(avatarUrl);
        User saved = userRepository.save(user);
        return toResponse(saved);
    }

    @Transactional
    public void changePassword(String authHeader, ChangePasswordRequest request) {
        User user = getCurrentUser(authHeader);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BadCredentialsException("Current password is incorrect");
        }
        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must differ from current password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<FollowedStoreResponse> getMyFollowingStores(String authHeader) {
        User user = getCurrentUser(authHeader);

        List<StoreFollow> follows = storeFollowRepository.findPublicStoreFollowsByUserIdOrderByCreatedAtDesc(
                user.getId(),
                Store.ApprovalStatus.APPROVED,
                Store.StoreStatus.ACTIVE
        );
        if (follows.isEmpty()) {
            return List.of();
        }

        List<UUID> storeIds = follows.stream()
                .map(follow -> follow.getStore().getId())
                .distinct()
                .toList();

        Map<UUID, Long> followerCountByStoreId = storeFollowRepository.countFollowersByStoreIds(storeIds)
                .stream()
                .collect(Collectors.toMap(
                        StoreFollowRepository.StoreFollowerCountProjection::getStoreId,
                        StoreFollowRepository.StoreFollowerCountProjection::getFollowerCount,
                        (left, right) -> left
                ));

        return follows.stream()
                .map(follow -> toFollowedStoreResponse(follow, followerCountByStoreId))
                .toList();
    }

    private User getCurrentUser(String authHeader) {
        UUID userId = authContext.fromAuthHeader(authHeader).getUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private FollowedStoreResponse toFollowedStoreResponse(StoreFollow follow, Map<UUID, Long> followerCountByStoreId) {
        Store store = follow.getStore();
        if (store == null || store.getId() == null) {
            return FollowedStoreResponse.builder().build();
        }
        StorePerformanceMetricsService.StorePerformanceMetrics performanceMetrics =
                storePerformanceMetricsService.resolve(store.getId());

        return FollowedStoreResponse.builder()
                .storeId(store.getId())
                .storeName(store.getName())
                .storeSlug(store.getSlug())
                .storeLogo(store.getLogo())
                .rating(store.getRating() != null ? store.getRating() : 0.0)
                .totalOrders(performanceMetrics.totalOrders())
                .followerCount(followerCountByStoreId.getOrDefault(store.getId(), 0L))
                .followedAt(follow.getCreatedAt())
                .build();
    }

    private UserProfileResponse toResponse(User user) {
        long followingStoreCount = user.getId() == null
                ? 0L
                : storeFollowRepository.countByUserId(user.getId());

        return UserProfileResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatar(user.getAvatar())
                .gender(user.getGender())
                .dateOfBirth(user.getDateOfBirth())
                .height(user.getHeight())
                .weight(user.getWeight())
                .loyaltyPoints(user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0L)
                .followingStoreCount(followingStoreCount)
                .role(user.getRole())
                .storeId(user.getStoreId())
                .build();
    }
}
