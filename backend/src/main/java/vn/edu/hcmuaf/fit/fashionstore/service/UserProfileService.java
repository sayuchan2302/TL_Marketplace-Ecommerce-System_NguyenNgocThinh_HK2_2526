package vn.edu.hcmuaf.fit.fashionstore.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ChangePasswordRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.UpdateUserProfileRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.UserProfileResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.exception.ResourceNotFoundException;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;
import vn.edu.hcmuaf.fit.fashionstore.security.AuthContext;

import java.util.UUID;

@Service
public class UserProfileService {

    private final UserRepository userRepository;
    private final AuthContext authContext;
    private final PasswordEncoder passwordEncoder;

    public UserProfileService(
            UserRepository userRepository,
            AuthContext authContext,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.authContext = authContext;
        this.passwordEncoder = passwordEncoder;
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

    private User getCurrentUser(String authHeader) {
        UUID userId = authContext.fromAuthHeader(authHeader).getUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private UserProfileResponse toResponse(User user) {
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
                .role(user.getRole())
                .storeId(user.getStoreId())
                .build();
    }
}
