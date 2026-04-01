package vn.edu.hcmuaf.fit.fashionstore.seeder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.fashionstore.entity.Address;
import vn.edu.hcmuaf.fit.fashionstore.entity.Cart;
import vn.edu.hcmuaf.fit.fashionstore.entity.CartItem;
import vn.edu.hcmuaf.fit.fashionstore.entity.Category;
import vn.edu.hcmuaf.fit.fashionstore.entity.ContentPage;
import vn.edu.hcmuaf.fit.fashionstore.entity.Order;
import vn.edu.hcmuaf.fit.fashionstore.entity.OrderItem;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductImage;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductVariant;
import vn.edu.hcmuaf.fit.fashionstore.entity.ReturnRequest;
import vn.edu.hcmuaf.fit.fashionstore.entity.Review;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.entity.User;
import vn.edu.hcmuaf.fit.fashionstore.entity.Voucher;
import vn.edu.hcmuaf.fit.fashionstore.repository.AddressRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.CartRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.CategoryRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ContentPageRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.OrderRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductVariantRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ReturnRequestRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ReviewRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.UserRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.VoucherRepository;
import vn.edu.hcmuaf.fit.fashionstore.service.PublicCodeService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true", matchIfMissing = false)
public class MarketplaceSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceSeeder.class);
    private static final String TEST_PASSWORD = "Test@123";
    private static final String SEED_ACTOR = "seed-system";

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final CartRepository cartRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final AddressRepository addressRepository;
    private final OrderRepository orderRepository;
    private final ReturnRequestRepository returnRequestRepository;
    private final VoucherRepository voucherRepository;
    private final ContentPageRepository contentPageRepository;
    private final ReviewRepository reviewRepository;
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final PublicCodeService publicCodeService;

    public MarketplaceSeeder(
            UserRepository userRepository,
            StoreRepository storeRepository,
            CartRepository cartRepository,
            CategoryRepository categoryRepository,
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository,
            AddressRepository addressRepository,
            OrderRepository orderRepository,
            ReturnRequestRepository returnRequestRepository,
            VoucherRepository voucherRepository,
            ContentPageRepository contentPageRepository,
            ReviewRepository reviewRepository,
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            PublicCodeService publicCodeService
    ) {
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
        this.cartRepository = cartRepository;
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
        this.addressRepository = addressRepository;
        this.orderRepository = orderRepository;
        this.returnRequestRepository = returnRequestRepository;
        this.voucherRepository = voucherRepository;
        this.contentPageRepository = contentPageRepository;
        this.reviewRepository = reviewRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.publicCodeService = publicCodeService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        truncateAllData();
        seedMarketplace();
    }

    private void seedMarketplace() {
        log.info("Bat dau nap du lieu mau marketplace...");

        User admin = createUser("admin@fashion.local", "Quản trị hệ thống", "0900000001", User.Role.SUPER_ADMIN, User.Gender.OTHER, LocalDate.of(1990, 1, 1), 0L);
        User vendorAn = createUser("an.shop@fashion.local", "Nguyễn Hoàng An", "0900000002", User.Role.VENDOR, User.Gender.MALE, LocalDate.of(1994, 5, 12), 0L);
        User vendorBinh = createUser("binh.store@fashion.local", "Trần Gia Bình", "0900000003", User.Role.VENDOR, User.Gender.FEMALE, LocalDate.of(1995, 8, 22), 0L);
        User vendorDuyet = createUser("duyet.vendor@fashion.local", "Lê Thanh Duyệt", "0900000004", User.Role.VENDOR, User.Gender.MALE, LocalDate.of(1992, 11, 6), 0L);
        User customerMinh = createUser("minh.customer@fashion.local", "Phạm Minh Khang", "0901000001", User.Role.CUSTOMER, User.Gender.MALE, LocalDate.of(2000, 3, 14), 4200L);
        User customerLan = createUser("lan.customer@fashion.local", "Đỗ Ngọc Lan", "0901000002", User.Role.CUSTOMER, User.Gender.FEMALE, LocalDate.of(1999, 9, 9), 5100L);
        User customerHuy = createUser("huy.customer@fashion.local", "Vũ Đức Huy", "0901000003", User.Role.CUSTOMER, User.Gender.MALE, LocalDate.of(2001, 1, 25), 1600L);

        Store storeAn = createStore(
                vendorAn, "An Urban", "an-urban",
                "Chuyên thời trang nam tối giản, chất liệu cao cấp.",
                "45 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh",
                Store.StoreStatus.ACTIVE, Store.ApprovalStatus.APPROVED,
                new BigDecimal("6.0"), 4.8, 148, new BigDecimal("128900000"),
                LocalDateTime.now().minusDays(30), admin.getEmail(), null
        );
        Store storeBinh = createStore(
                vendorBinh, "Bình Boutique", "binh-boutique",
                "Thời trang nữ công sở và dự tiệc, phong cách thanh lịch.",
                "117 Hai Bà Trưng, Quận 3, TP. Hồ Chí Minh",
                Store.StoreStatus.ACTIVE, Store.ApprovalStatus.APPROVED,
                new BigDecimal("5.5"), 4.6, 96, new BigDecimal("84200000"),
                LocalDateTime.now().minusDays(15), admin.getEmail(), null
        );
        Store storeChoDuyet = createStore(
                vendorDuyet, "Duyệt Local Brand", "duyet-local-brand",
                "Gian hàng mới đăng ký, đang chờ đội ngũ kiểm duyệt.",
                "22 Lý Tự Trọng, Quận 1, TP. Hồ Chí Minh",
                Store.StoreStatus.INACTIVE, Store.ApprovalStatus.PENDING,
                new BigDecimal("5.0"), 0.0, 0, BigDecimal.ZERO,
                null, null, "Đang chờ bổ sung giấy phép kinh doanh."
        );
        linkVendorStore(vendorAn, storeAn);
        linkVendorStore(vendorBinh, storeBinh);
        linkVendorStore(vendorDuyet, storeChoDuyet);

        Category nam = createCategory("Thời trang nam", "thoi-trang-nam", "Danh mục sản phẩm dành cho nam.", null, 1);
        Category nu = createCategory("Thời trang nữ", "thoi-trang-nu", "Danh mục sản phẩm dành cho nữ.", null, 2);
        Category phuKien = createCategory("Phụ kiện", "phu-kien", "Phụ kiện thời trang đi kèm.", null, 3);
        Category aoThun = createCategory("Áo thun", "ao-thun", "Áo thun cơ bản và nâng cao.", nam, 10);
        Category quanJean = createCategory("Quần jean", "quan-jean", "Quần jean nhiều phom dáng.", nam, 20);
        Category damVay = createCategory("Đầm váy", "dam-vay", "Đầm và váy nữ tính.", nu, 10);
        Category tuiXach = createCategory("Túi xách", "tui-xach", "Túi đeo chéo, tote, clutch.", phuKien, 10);

        Product aoThunPremium = createProduct(
                storeAn, aoThun, "Áo thun cotton premium", "ao-thun-cotton-premium",
                new BigDecimal("249000"), new BigDecimal("199000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                true, "Cotton compact 240gsm", "Regular fit", "Áo thun mềm mịn, thấm hút tốt, phù hợp mặc hằng ngày.",
                "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab", "Áo thun cotton premium"
        );
        Product quanJeanSlim = createProduct(
                storeAn, quanJean, "Quần jean slim wash", "quan-jean-slim-wash",
                new BigDecimal("459000"), new BigDecimal("379000"), Product.Gender.MALE, Product.ProductStatus.ACTIVE,
                false, "Denim co giãn", "Slim fit", "Quần jean ôm vừa, màu wash hiện đại.",
                "https://images.unsplash.com/photo-1542272604-787c3835535d", "Quần jean slim wash"
        );
        Product damMidi = createProduct(
                storeBinh, damVay, "Đầm midi hoa nhí", "dam-midi-hoa-nhi",
                new BigDecimal("529000"), new BigDecimal("449000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                true, "Voan lụa", "Dáng xòe", "Đầm nhẹ, thoáng, phù hợp đi làm và dạo phố.",
                "https://images.unsplash.com/photo-1496747611176-843222e1e57c", "Đầm midi hoa nhí"
        );
        Product blazerNu = createProduct(
                storeBinh, damVay, "Áo blazer nữ basic", "ao-blazer-nu-basic",
                new BigDecimal("699000"), new BigDecimal("599000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                false, "Tweed pha", "Regular fit", "Blazer tối giản, phù hợp môi trường công sở.",
                "https://images.unsplash.com/photo-1483985988355-763728e1935b", "Áo blazer nữ basic"
        );
        Product tuiDaMem = createProduct(
                storeBinh, tuiXach, "Túi đeo chéo da mềm", "tui-deo-cheo-da-mem",
                new BigDecimal("489000"), new BigDecimal("409000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                true, "Da PU cao cấp", "Đeo chéo", "Túi nhỏ gọn, có nhiều ngăn tiện lợi.",
                "https://images.unsplash.com/photo-1542291026-7eec264c27ff", "Túi đeo chéo da mềm"
        );
        Product sanPhamNhap = createProduct(
                storeChoDuyet, aoThun, "Áo thun local draft", "ao-thun-local-draft",
                new BigDecimal("199000"), BigDecimal.ZERO, Product.Gender.UNISEX, Product.ProductStatus.DRAFT,
                false, "Cotton 2 chiều", "Regular fit", "Sản phẩm nháp chờ gian hàng được duyệt.",
                "https://images.unsplash.com/photo-1434389677669-e08b4cac3105", "Áo thun local draft"
        );

        ProductVariant aoThunDenM = createVariant(aoThunPremium, "AN-TEE-PRM-BLK-M", "Đen", "M", 90, BigDecimal.ZERO, true);
        ProductVariant aoThunTrangL = createVariant(aoThunPremium, "AN-TEE-PRM-WHT-L", "Trắng", "L", 70, new BigDecimal("5000"), true);
        ProductVariant jeanXanh30 = createVariant(quanJeanSlim, "AN-JEAN-SLIM-BLU-30", "Xanh", "30", 40, BigDecimal.ZERO, true);
        ProductVariant jeanXanh32 = createVariant(quanJeanSlim, "AN-JEAN-SLIM-BLU-32", "Xanh", "32", 55, BigDecimal.ZERO, true);
        ProductVariant damKemS = createVariant(damMidi, "BINH-DRESS-FLR-S", "Kem", "S", 26, BigDecimal.ZERO, true);
        ProductVariant damKemM = createVariant(damMidi, "BINH-DRESS-FLR-M", "Kem", "M", 34, BigDecimal.ZERO, true);
        ProductVariant blazerBeM = createVariant(blazerNu, "BINH-BLAZER-BEI-M", "Be", "M", 22, BigDecimal.ZERO, true);
        ProductVariant blazerDenL = createVariant(blazerNu, "BINH-BLAZER-BLK-L", "Đen", "L", 18, new BigDecimal("15000"), true);
        ProductVariant tuiDenFree = createVariant(tuiDaMem, "BINH-BAG-CRS-BLK-F", "Đen", "Free", 64, BigDecimal.ZERO, true);
        createVariant(sanPhamNhap, "DUYET-TEE-DRF-WHT-M", "Trắng", "M", 12, BigDecimal.ZERO, true);

        Address addressMinh = createAddress(customerMinh, "Phạm Minh Khang", "0901000001", "TP. Hồ Chí Minh", "Quận 1", "Phường Bến Nghé", "18 Nguyễn Huệ", true, "Nhà riêng");
        Address addressLan = createAddress(customerLan, "Đỗ Ngọc Lan", "0901000002", "TP. Hồ Chí Minh", "Quận 3", "Phường Võ Thị Sáu", "212 Nam Kỳ Khởi Nghĩa", true, "Công ty");
        Address addressHuy = createAddress(customerHuy, "Vũ Đức Huy", "0901000003", "Đà Nẵng", "Hải Châu", "Phường Thạch Thang", "55 Trần Phú", true, "Nhà riêng");

        createCart(customerMinh, List.of(new CartLine(quanJeanSlim, jeanXanh32, 1), new CartLine(blazerNu, blazerBeM, 1)));
        createCart(customerLan, List.of(new CartLine(tuiDaMem, tuiDenFree, 1), new CartLine(aoThunPremium, aoThunTrangL, 2)));
        createCart(customerHuy, List.of(new CartLine(damMidi, damKemS, 1)));

        Order orderDaGiao = createOrder(customerMinh, addressMinh, storeAn, Order.OrderStatus.DELIVERED, Order.PaymentMethod.BANK_TRANSFER, Order.PaymentStatus.PAID, "DH-SEED-DELIVERED-001", "GHN100000001", "GHN", new BigDecimal("25000"), new BigDecimal("20000"), LocalDateTime.now().minusDays(6));
        OrderItem itemDaGiao = addOrderItem(orderDaGiao, aoThunPremium, aoThunDenM, 2, new BigDecimal("199000"), storeAn.getId());
        addOrderItem(orderDaGiao, quanJeanSlim, jeanXanh30, 1, new BigDecimal("379000"), storeAn.getId());

        Order orderXuLy = createOrder(customerMinh, addressMinh, storeAn, Order.OrderStatus.PROCESSING, Order.PaymentMethod.COD, Order.PaymentStatus.UNPAID, "DH-SEED-PROCESSING-001", null, null, new BigDecimal("30000"), BigDecimal.ZERO, null);
        addOrderItem(orderXuLy, aoThunPremium, aoThunTrangL, 1, new BigDecimal("204000"), storeAn.getId());

        Order orderDangGiao = createOrder(customerLan, addressLan, storeBinh, Order.OrderStatus.SHIPPED, Order.PaymentMethod.MOMO, Order.PaymentStatus.PAID, "DH-SEED-SHIPPED-001", "GHTK200000001", "GHTK", new BigDecimal("22000"), new BigDecimal("15000"), LocalDateTime.now().minusDays(2));
        addOrderItem(orderDangGiao, damMidi, damKemM, 1, new BigDecimal("449000"), storeBinh.getId());
        addOrderItem(orderDangGiao, tuiDaMem, tuiDenFree, 1, new BigDecimal("409000"), storeBinh.getId());

        Order orderDaHuy = createOrder(customerHuy, addressHuy, storeBinh, Order.OrderStatus.CANCELLED, Order.PaymentMethod.VNPAY, Order.PaymentStatus.FAILED, "DH-SEED-CANCELLED-001", null, null, new BigDecimal("25000"), BigDecimal.ZERO, null);
        addOrderItem(orderDaHuy, blazerNu, blazerDenL, 1, new BigDecimal("614000"), storeBinh.getId());

        createReturnRequest(orderDaGiao, customerMinh, itemDaGiao, ReturnRequest.ReturnReason.SIZE, ReturnRequest.ReturnResolution.EXCHANGE, ReturnRequest.ReturnStatus.PENDING_VENDOR, "Khách muốn đổi size M sang L.", "Đã tiếp nhận và chờ cửa hàng xác nhận tồn kho.");

        createReview(aoThunPremium, customerMinh, orderDaGiao, storeAn.getId(), 5, "Áo mặc rất thoải mái", "Chất vải mát, form đẹp, giao nhanh.", Review.ReviewStatus.APPROVED, "Cảm ơn bạn đã ủng hộ shop.", List.of("https://images.unsplash.com/photo-1521572163474-6864f9cf17ab"));
        createReview(damMidi, customerLan, orderDangGiao, storeBinh.getId(), 5, "Đầm lên dáng xinh", "Vải nhẹ, không nhăn nhiều.", Review.ReviewStatus.PENDING, null, List.of());
        createReview(blazerNu, customerHuy, null, storeBinh.getId(), 3, "Áo đẹp nhưng hơi dày", "Nên mặc phòng lạnh sẽ hợp hơn.", Review.ReviewStatus.APPROVED, "Shop ghi nhận góp ý để cải tiến chất liệu.", List.of());

        createVoucher(storeAn.getId(), "CHAOAN10", "Giảm 10% đơn đầu tiên", "Áp dụng cho khách mới, tối đa giảm 40.000đ.", Voucher.DiscountType.PERCENT, new BigDecimal("10"), new BigDecimal("299000"), 1500, 320, Voucher.VoucherStatus.RUNNING, LocalDate.now().minusDays(15), LocalDate.now().plusDays(45));
        createVoucher(storeAn.getId(), "FREESHIP30", "Hỗ trợ phí ship 30k", "Giảm trực tiếp 30.000đ vào phí vận chuyển.", Voucher.DiscountType.FIXED, new BigDecimal("30000"), new BigDecimal("199000"), 900, 440, Voucher.VoucherStatus.RUNNING, LocalDate.now().minusDays(5), LocalDate.now().plusDays(20));
        createVoucher(storeBinh.getId(), "BINHNEW12", "Chào mừng khách mới", "Giảm 12% toàn bộ sản phẩm của gian hàng.", Voucher.DiscountType.PERCENT, new BigDecimal("12"), new BigDecimal("399000"), 1100, 210, Voucher.VoucherStatus.RUNNING, LocalDate.now().minusDays(20), LocalDate.now().plusDays(35));
        createVoucher(storeBinh.getId(), "BINH50K", "Giảm trực tiếp 50k", "Giảm 50.000đ cho đơn từ 699.000đ.", Voucher.DiscountType.FIXED, new BigDecimal("50000"), new BigDecimal("699000"), 500, 127, Voucher.VoucherStatus.DRAFT, LocalDate.now().plusDays(2), LocalDate.now().plusDays(60));

        createContentPage(ContentPage.ContentType.FAQ, "Thời gian xử lý đơn hàng", "Đơn hàng thường được xác nhận trong 2-6 giờ làm việc và bàn giao đơn vị vận chuyển trong 24 giờ.", 1);
        createContentPage(ContentPage.ContentType.FAQ, "Tôi có thể đổi size như thế nào?", "Bạn có thể gửi yêu cầu đổi trả trong vòng 7 ngày kể từ khi nhận hàng tại mục Đơn hàng của tôi.", 2);
        createContentPage(ContentPage.ContentType.POLICY, "Chính sách đổi trả", "Marketplace hỗ trợ đổi/trả cho sản phẩm lỗi hoặc sai mô tả. Sản phẩm cần còn tem nhãn và chưa qua sử dụng.", 1);
        createContentPage(ContentPage.ContentType.POLICY, "Chính sách hoàn tiền", "Tiền hoàn sẽ được xử lý trong 3-7 ngày làm việc tùy phương thức thanh toán ban đầu.", 2);

        log.info("Seed hoan tat: {} users, {} stores, {} products, {} orders, {} reviews.",
                userRepository.count(), storeRepository.count(), productRepository.count(), orderRepository.count(), reviewRepository.count());
    }

    private void truncateAllData() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    review_images,
                    return_items,
                    wallet_transactions,
                    vendor_wallets,
                    customer_wallet_transactions,
                    customer_wallets,
                    inventory_ledger,
                    wishlists,
                    notifications,
                    loyalty_points,
                    coupons,
                    commission_tiers,
                    return_requests,
                    reviews,
                    order_items,
                    orders,
                    cart_items,
                    carts,
                    vouchers,
                    product_variants,
                    product_images,
                    products,
                    categories,
                    content_pages,
                    addresses,
                    stores,
                    users
                RESTART IDENTITY CASCADE
                """);
        log.info("Da xoa toan bo du lieu cu truoc khi seed.");
    }

    private User createUser(
            String email,
            String name,
            String phone,
            User.Role role,
            User.Gender gender,
            LocalDate dateOfBirth,
            Long loyaltyPoints
    ) {
        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(TEST_PASSWORD));
        user.setName(name);
        user.setPhone(phone);
        user.setRole(role);
        user.setGender(gender);
        user.setDateOfBirth(dateOfBirth);
        user.setLoyaltyPoints(loyaltyPoints != null ? loyaltyPoints : 0L);
        user.setStoreId(null);
        user.setIsActive(true);
        return userRepository.save(user);
    }

    private void linkVendorStore(User vendor, Store store) {
        vendor.setStoreId(store.getId());
        userRepository.save(vendor);
    }

    private Store createStore(
            User owner,
            String name,
            String slug,
            String description,
            String address,
            Store.StoreStatus status,
            Store.ApprovalStatus approvalStatus,
            BigDecimal commissionRate,
            double rating,
            int totalOrders,
            BigDecimal totalSales,
            LocalDateTime approvedAt,
            String approvedBy,
            String rejectionReason
    ) {
        Store store = new Store();
        store.setOwner(owner);
        store.setName(name);
        store.setSlug(slug);
        store.setDescription(description);
        store.setLogo("https://images.unsplash.com/photo-1441986300917-64674bd600d8");
        store.setBanner("https://images.unsplash.com/photo-1523381210434-271e8be1f52b");
        store.setContactEmail(owner.getEmail());
        store.setPhone(owner.getPhone());
        store.setAddress(address);
        store.setBankName("Vietcombank");
        store.setBankAccountNumber("1234567890");
        store.setBankAccountHolder(owner.getName().toUpperCase());
        store.setBankVerified(true);
        store.setNotifyNewOrder(true);
        store.setNotifyOrderStatusChange(true);
        store.setNotifyLowStock(true);
        store.setNotifyPayoutComplete(true);
        store.setNotifyPromotions(false);
        store.setShipGhn(true);
        store.setShipGhtk(true);
        store.setShipExpress(false);
        store.setWarehouseAddress(address);
        store.setWarehouseContact(owner.getName());
        store.setWarehousePhone(owner.getPhone());
        store.setCommissionRate(commissionRate);
        store.setStatus(status);
        store.setApprovalStatus(approvalStatus);
        store.setApprovedAt(approvedAt);
        store.setApprovedBy(approvedBy);
        store.setRejectionReason(rejectionReason);
        store.setTotalSales(totalSales);
        store.setTotalOrders(totalOrders);
        store.setRating(rating);
        return storeRepository.save(store);
    }

    private Category createCategory(String name, String slug, String description, Category parent, int sortOrder) {
        Category category = new Category();
        category.setName(name);
        category.setSlug(slug);
        category.setDescription(description);
        category.setParent(parent);
        category.setSortOrder(sortOrder);
        category.setImage("https://images.unsplash.com/photo-1441986300917-64674bd600d8");
        return categoryRepository.save(category);
    }

    private Product createProduct(
            Store store,
            Category category,
            String name,
            String slug,
            BigDecimal basePrice,
            BigDecimal salePrice,
            Product.Gender gender,
            Product.ProductStatus status,
            boolean featured,
            String material,
            String fit,
            String description,
            String imageUrl,
            String imageAlt
    ) {
        Product product = new Product();
        product.setName(name);
        product.setSlug(slug);
        product.setStoreId(store.getId());
        product.setCategory(category);
        product.setBasePrice(basePrice);
        product.setSalePrice(salePrice);
        product.setGender(gender);
        product.setStatus(status);
        product.setIsFeatured(featured);
        product.setMaterial(material);
        product.setFit(fit);
        product.setDescription(description);

        ProductImage image = new ProductImage();
        image.setProduct(product);
        image.setUrl(imageUrl);
        image.setAlt(imageAlt);
        image.setSortOrder(0);
        image.setIsPrimary(true);
        product.setImages(new ArrayList<>(List.of(image)));
        product.setVariants(new ArrayList<>());
        return productRepository.save(product);
    }

    private ProductVariant createVariant(
            Product product,
            String sku,
            String color,
            String size,
            int stockQuantity,
            BigDecimal priceAdjustment,
            boolean isActive
    ) {
        ProductVariant variant = new ProductVariant();
        variant.setProduct(product);
        variant.setSku(sku);
        variant.setColor(color);
        variant.setSize(size);
        variant.setStockQuantity(stockQuantity);
        variant.setPriceAdjustment(priceAdjustment);
        variant.setIsActive(isActive);
        return productVariantRepository.save(variant);
    }

    private Address createAddress(
            User user,
            String fullName,
            String phone,
            String province,
            String district,
            String ward,
            String detail,
            boolean isDefault,
            String label
    ) {
        Address address = new Address();
        address.setUser(user);
        address.setFullName(fullName);
        address.setPhone(phone);
        address.setProvince(province);
        address.setDistrict(district);
        address.setWard(ward);
        address.setDetail(detail);
        address.setIsDefault(isDefault);
        address.setLabel(label);
        return addressRepository.save(address);
    }

    private void createCart(User user, List<CartLine> lines) {
        Cart cart = new Cart();
        cart.setUser(user);
        cart.setItems(new ArrayList<>());
        for (CartLine line : lines) {
            CartItem item = new CartItem();
            item.setCart(cart);
            item.setProduct(line.product());
            item.setVariant(line.variant());
            item.setQuantity(line.quantity());
            item.setUnitPrice(line.variant() != null ? line.variant().getPrice() : line.product().getEffectivePrice());
            cart.getItems().add(item);
        }
        cart.calculateTotal();
        cartRepository.save(cart);
    }

    private Order createOrder(
            User customer,
            Address shippingAddress,
            Store store,
            Order.OrderStatus status,
            Order.PaymentMethod paymentMethod,
            Order.PaymentStatus paymentStatus,
            String note,
            String trackingNumber,
            String shippingCarrier,
            BigDecimal shippingFee,
            BigDecimal discount,
            LocalDateTime paidAt
    ) {
        Order order = new Order();
        order.setUser(customer);
        order.setOrderCode(publicCodeService.nextOrderCode());
        order.setShippingAddress(shippingAddress);
        order.setStoreId(store.getId());
        order.setStatus(status);
        order.setPaymentMethod(paymentMethod);
        order.setPaymentStatus(paymentStatus);
        order.setNote(note);
        order.setTrackingNumber(trackingNumber);
        order.setShippingCarrier(shippingCarrier);
        order.setShippingFee(shippingFee);
        order.setDiscount(discount);
        order.setParentOrder(null);
        order.setItems(new ArrayList<>());
        order.setSubtotal(BigDecimal.ZERO);
        order.calculateTotal();
        order.setCommissionFee(BigDecimal.ZERO);
        order.setVendorPayout(BigDecimal.ZERO);
        order.setPaidAt(paidAt);
        return orderRepository.save(order);
    }

    private OrderItem addOrderItem(
            Order order,
            Product product,
            ProductVariant variant,
            int quantity,
            BigDecimal unitPrice,
            UUID storeId
    ) {
        OrderItem item = new OrderItem();
        item.setOrder(order);
        item.setProduct(product);
        item.setVariant(variant);
        item.setProductName(product.getName());
        item.setVariantName((variant.getColor() != null ? variant.getColor() : "") + " / " + (variant.getSize() != null ? variant.getSize() : ""));
        item.setProductImage(product.getImages() != null && !product.getImages().isEmpty() ? product.getImages().get(0).getUrl() : null);
        item.setQuantity(quantity);
        item.setUnitPrice(unitPrice);
        item.setTotalPrice(unitPrice.multiply(BigDecimal.valueOf(quantity)));
        item.setStoreId(storeId);
        order.getItems().add(item);

        BigDecimal subtotal = order.getItems().stream()
                .map(OrderItem::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setSubtotal(subtotal);
        order.calculateTotal();
        BigDecimal commission = order.getTotal().multiply(new BigDecimal("0.05"));
        order.setCommissionFee(commission);
        order.setVendorPayout(order.getTotal().subtract(commission));
        orderRepository.save(order);
        return item;
    }

    private void createReturnRequest(
            Order order,
            User user,
            OrderItem orderItem,
            ReturnRequest.ReturnReason reason,
            ReturnRequest.ReturnResolution resolution,
            ReturnRequest.ReturnStatus status,
            String note,
            String adminNote
    ) {
        ReturnRequest request = new ReturnRequest();
        request.setOrder(order);
        request.setReturnCode(publicCodeService.nextReturnCode());
        request.setUser(user);
        request.setStoreId(orderItem.getStoreId());
        request.setReason(reason);
        request.setResolution(resolution);
        request.setStatus(status);
        request.setNote(note);
        request.setAdminNote(adminNote);
        request.setUpdatedBy(SEED_ACTOR);
        request.setItems(new ArrayList<>(List.of(
                new ReturnRequest.ReturnItemSnapshot(
                        orderItem.getId(),
                        orderItem.getProductName(),
                        orderItem.getVariantName(),
                        orderItem.getProductImage(),
                        null,
                        1,
                        orderItem.getUnitPrice()
                )
        )));
        returnRequestRepository.save(request);
    }

    private void createReview(
            Product product,
            User user,
            Order order,
            UUID storeId,
            int rating,
            String title,
            String content,
            Review.ReviewStatus status,
            String shopReply,
            List<String> imageUrls
    ) {
        Review review = new Review();
        review.setProduct(product);
        review.setUser(user);
        review.setOrder(order);
        review.setStoreId(storeId);
        review.setRating(rating);
        review.setTitle(title);
        review.setContent(content);
        review.setStatus(status);
        review.setHelpful(Math.max(0, rating - 1));
        review.setShopReply(shopReply);
        review.setImages(new ArrayList<>(imageUrls));
        if (shopReply != null && !shopReply.isBlank()) {
            review.setShopReplyAt(LocalDateTime.now().minusDays(1));
        }
        reviewRepository.save(review);
    }

    private void createVoucher(
            UUID storeId,
            String code,
            String name,
            String description,
            Voucher.DiscountType discountType,
            BigDecimal discountValue,
            BigDecimal minOrderValue,
            int totalIssued,
            int usedCount,
            Voucher.VoucherStatus status,
            LocalDate startDate,
            LocalDate endDate
    ) {
        Voucher voucher = new Voucher();
        voucher.setStoreId(storeId);
        voucher.setCode(code);
        voucher.setName(name);
        voucher.setDescription(description);
        voucher.setDiscountType(discountType);
        voucher.setDiscountValue(discountValue);
        voucher.setMinOrderValue(minOrderValue);
        voucher.setTotalIssued(totalIssued);
        voucher.setUsedCount(usedCount);
        voucher.setStatus(status);
        voucher.setStartDate(startDate);
        voucher.setEndDate(endDate);
        voucher.setUpdatedBy(SEED_ACTOR);
        voucherRepository.save(voucher);
    }

    private void createContentPage(
            ContentPage.ContentType type,
            String title,
            String body,
            int displayOrder
    ) {
        ContentPage page = new ContentPage();
        page.setType(type);
        page.setTitle(title);
        page.setBody(body);
        page.setDisplayOrder(displayOrder);
        page.setUpdatedBy(SEED_ACTOR);
        contentPageRepository.save(page);
    }

    private record CartLine(Product product, ProductVariant variant, int quantity) {
    }
}
