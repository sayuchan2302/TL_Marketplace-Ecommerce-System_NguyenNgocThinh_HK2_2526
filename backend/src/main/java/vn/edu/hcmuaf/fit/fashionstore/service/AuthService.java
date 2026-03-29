package vn.edu.hcmuaf.fit.fashionstore.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.LoginRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.RegisterRequest;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.AuthResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Cart;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;
import vn.edu.hcmuaf.fit.fashionstore.security.JwtService;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final StoreRepository storeRepository;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtService jwtService, AuthenticationManager authenticationManager,
                       UserDetailsService userDetailsService, StoreRepository storeRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.userDetailsService = userDetailsService;
        this.storeRepository = storeRepository;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            logger.warn("Register attempt with existing email={}", request.getEmail());
            throw new BadCredentialsException("Email already registered");
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .phone(request.getPhone())
                .role(User.Role.CUSTOMER)
                .gender(User.Gender.OTHER)
                .loyaltyPoints(0L)
                .isActive(true)
                .build();

        Cart cart = Cart.builder()
                .user(user)
                .build();
        user.setCart(cart);

        userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String token = jwtService.generateTokenWithUserContext(
                user.getId().toString(),
                user.getRole().name(),
                user.getStoreId() != null ? user.getStoreId().toString() : null,
                userDetails
        );
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        return buildAuthResponse(user, token, refreshToken);
    }

    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (BadCredentialsException ex) {
            logger.warn("Login failed for email={} : {}", request.getEmail(), ex.getMessage());
            throw new BadCredentialsException("Invalid credentials");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());
        String token = jwtService.generateTokenWithUserContext(
                user.getId().toString(),
                user.getRole().name(),
                user.getStoreId() != null ? user.getStoreId().toString() : null,
                userDetails
        );
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        return buildAuthResponse(user, token, refreshToken);
    }

    public AuthResponse refreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            logger.warn("Refresh token request rejected: token is blank");
            throw new BadCredentialsException("Invalid refresh token");
        }

        try {
            String email = jwtService.extractUsername(refreshToken);
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);

            if (!jwtService.isTokenValid(refreshToken, userDetails)) {
                logger.warn("Refresh token invalid for email={}", email);
                throw new BadCredentialsException("Invalid refresh token");
            }

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));

            String newToken = jwtService.generateTokenWithUserContext(
                    user.getId().toString(),
                    user.getRole().name(),
                    user.getStoreId() != null ? user.getStoreId().toString() : null,
                    userDetails
            );
            String newRefreshToken = jwtService.generateRefreshToken(userDetails);

            return buildAuthResponse(user, newToken, newRefreshToken);
        } catch (BadCredentialsException ex) {
            throw ex;
        } catch (Exception ex) {
            logger.warn("Refresh token validation failed: {}", ex.getMessage());
            throw new BadCredentialsException("Invalid refresh token");
        }
    }

    private AuthResponse buildAuthResponse(User user, String token, String refreshToken) {
        boolean approvedVendor = false;
        if (user.getStoreId() != null) {
            approvedVendor = storeRepository.findById(user.getStoreId())
                    .map(store -> store.getApprovalStatus() == Store.ApprovalStatus.APPROVED
                            && store.getStatus() == Store.StoreStatus.ACTIVE)
                    .orElse(false);
        }

        return AuthResponse.builder()
                .token(token)
                .refreshToken(refreshToken)
                .email(user.getEmail())
                .name(user.getName())
                .role(user.getRole().name())
                .storeId(user.getStoreId())
                .approvedVendor(approvedVendor)
                .build();
    }
}
