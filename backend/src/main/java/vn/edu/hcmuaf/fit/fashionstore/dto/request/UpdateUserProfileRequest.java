package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserProfileRequest {

    @Size(max = 100, message = "Name must not exceed 100 characters")
    private String name;

    @Size(max = 20, message = "Phone must not exceed 20 characters")
    private String phone;

    private User.Gender gender;

    @Past(message = "Date of birth must be in the past")
    private LocalDate dateOfBirth;

    @Min(value = 50, message = "Height must be at least 50cm")
    @Max(value = 250, message = "Height must not exceed 250cm")
    private Integer height;

    @Min(value = 20, message = "Weight must be at least 20kg")
    @Max(value = 300, message = "Weight must not exceed 300kg")
    private Integer weight;
}
