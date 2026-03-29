package vn.edu.hcmuaf.fit.fashionstore.entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    private String name;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private Role role = Role.CUSTOMER;

    @Column(name = "store_id")
    private UUID storeId;

    private String avatar;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private Gender gender = Gender.OTHER;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    private Integer height;

    private Integer weight;

    @Column(name = "loyalty_points")
    @Builder.Default
    private Long loyaltyPoints = 0L;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Address> addresses = new ArrayList<>();

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Cart cart;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Order> orders = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Wishlist> wishlists = new ArrayList<>();

    public enum Role {
        CUSTOMER, VENDOR, SUPER_ADMIN
    }

    public enum Gender {
        MALE, FEMALE, OTHER
    }
}
