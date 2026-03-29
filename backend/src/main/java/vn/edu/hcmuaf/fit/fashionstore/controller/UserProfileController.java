package vn.edu.hcmuaf.fit.fashionstore.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ChangePasswordRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.UpdateUserProfileRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.UserProfileResponse;
import vn.edu.hcmuaf.fit.fashionstore.service.UserProfileService;

@RestController
@RequestMapping("/api/users")
public class UserProfileController {

    private final UserProfileService userProfileService;

    public UserProfileController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(@RequestHeader("Authorization") String authHeader) {
        return ResponseEntity.ok(userProfileService.getMyProfile(authHeader));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateMyProfile(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody UpdateUserProfileRequest request
    ) {
        return ResponseEntity.ok(userProfileService.updateMyProfile(authHeader, request));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        userProfileService.changePassword(authHeader, request);
        return ResponseEntity.noContent().build();
    }
}

