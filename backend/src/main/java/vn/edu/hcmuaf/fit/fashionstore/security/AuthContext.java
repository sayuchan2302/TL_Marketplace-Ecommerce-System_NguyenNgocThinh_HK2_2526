package vn.edu.hcmuaf.fit.fashionstore.security;

import lombok.Getter;
import org.springframework.stereotype.Component;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.exception.ForbiddenException;
import vn.edu.hcmuaf.fit.fashionstore.exception.ResourceNotFoundException;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;

import java.util.UUID;

/**
 * Helper class to extract user context from JWT token.
 * Use this in controllers to get userId, storeId, and role for authorization checks.
 */
@Component
public class AuthContext {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final StoreRepository storeRepository;

    public AuthContext(JwtService jwtService, UserRepository userRepository, StoreRepository storeRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
    }

    /**
     * Represents the current authenticated user's context
     */
    @Getter
    public static class UserContext {
        private final UUID userId;
        private final UUID storeId;
        private final User.Role role;
        private final String email;

        public UserContext(UUID userId, UUID storeId, User.Role role, String email) {
            this.userId = userId;
            this.storeId = storeId;
            this.role = role;
            this.email = email;
        }

        public boolean isVendor() {
            return role == User.Role.VENDOR;
        }

        public boolean isAdmin() {
            return role == User.Role.SUPER_ADMIN;
        }

        public boolean isCustomer() {
            return role == User.Role.CUSTOMER;
        }

        public boolean hasStoreAccess() {
            return storeId != null && (isVendor() || isAdmin());
        }
    }

    /**
     * Extract user context from Authorization header
     * @param authHeader The Authorization header value (e.g., "Bearer xxx")
     * @return UserContext with userId, storeId, role
     * @throws ForbiddenException if token is invalid
     */
    public UserContext fromAuthHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ForbiddenException("Invalid or missing authorization token");
        }

        String token = authHeader.substring(7);
        String email = jwtService.extractUsername(token);
        if (email == null) {
            throw new ForbiddenException("Invalid token: missing subject (email)");
        }
        
        // Always load latest user from DB via email to prevent stale UUID issues in dev
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
                
        // Extract storeId and role from DB directly as source of truth
        UUID storeId = user.getStoreId();
        User.Role role = user.getRole();

        return new UserContext(user.getId(), storeId, role, user.getEmail());
    }

    /**
     * Extract user context and verify vendor role with store access
     * @throws ForbiddenException if user is not a vendor or has no store
     */
    public UserContext requireVendor(String authHeader) {
        UserContext ctx = fromAuthHeader(authHeader);
        
        if (!ctx.isVendor() && !ctx.isAdmin()) {
            throw new ForbiddenException("This action requires vendor or admin role");
        }
        
        if (ctx.getStoreId() == null && ctx.isVendor()) {
            throw new ForbiddenException("Vendor must have an associated store");
        }

        if (ctx.isVendor()) {
            var store = storeRepository.findById(ctx.getStoreId())
                    .orElseThrow(() -> new ResourceNotFoundException("Store not found"));

            if (store.getApprovalStatus() != vn.edu.hcmuaf.fit.fashionstore.entity.Store.ApprovalStatus.APPROVED) {
                throw new ForbiddenException("Vendor store has not been approved yet");
            }

            if (store.getStatus() != vn.edu.hcmuaf.fit.fashionstore.entity.Store.StoreStatus.ACTIVE) {
                throw new ForbiddenException("Vendor store is not active");
            }
        }
        
        return ctx;
    }

    /**
     * Extract user context and verify admin role
     * @throws ForbiddenException if user is not an admin
     */
    public UserContext requireAdmin(String authHeader) {
        UserContext ctx = fromAuthHeader(authHeader);
        
        if (!ctx.isAdmin()) {
            throw new ForbiddenException("This action requires admin role");
        }
        
        return ctx;
    }

    /**
     * Get storeId for vendor operations. Admin can optionally specify a storeId.
     * @param ctx User context
     * @param requestedStoreId Optional storeId from request (admin can operate on any store)
     * @return The storeId to use for the operation
     */
    public UUID resolveStoreId(UserContext ctx, UUID requestedStoreId) {
        if (ctx.isAdmin() && requestedStoreId != null) {
            return requestedStoreId; // Admin can operate on any store
        }
        
        if (ctx.getStoreId() == null) {
            throw new ForbiddenException("No store associated with this account");
        }
        
        return ctx.getStoreId();
    }

    /**
     * Resolve storeId for vendor-scoped APIs.
     * SUPER_ADMIN must explicitly provide storeId to avoid ambiguous scope.
     */
    public UUID resolveRequiredStoreId(UserContext ctx, UUID requestedStoreId) {
        if (ctx.isAdmin() && requestedStoreId == null) {
            throw new IllegalArgumentException("storeId is required for SUPER_ADMIN");
        }
        return resolveStoreId(ctx, requestedStoreId);
    }
}
