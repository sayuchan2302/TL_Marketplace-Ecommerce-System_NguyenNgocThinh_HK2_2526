package vn.edu.hcmuaf.fit.fashionstore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {

    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String avatar;
    private User.Gender gender;
    private LocalDate dateOfBirth;
    private Integer height;
    private Integer weight;
    private Long loyaltyPoints;
    private String role;
    private String status;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private UUID storeId;
    private String storeName;
    private String storeSlug;
    private String storeApprovalStatus;
    private String storeStatus;
}
