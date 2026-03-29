package vn.edu.hcmuaf.fit.fashionstore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
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
    private User.Role role;
    private UUID storeId;
}
