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
    private static final String STORE_LOGO_IMAGE = unsplashImage("photo-1441986300917-64674bd600d8", 512, 512);
    private static final String STORE_BANNER_IMAGE = unsplashImage("photo-1523381210434-271e8be1f52b", 1600, 600);
    private static final String CATEGORY_IMAGE = unsplashImage("photo-1441986300917-64674bd600d8", 800, 800);

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

    private static String unsplashImage(String photoId, int width, int height) {
        return "https://images.unsplash.com/"
                + photoId
                + "?w="
                + width
                + "&h="
                + height
                + "&fit=crop&fm=webp&q=80&auto=format";
    }

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

        // Category tree 3 tầng: Root (Nam/Nữ/Phụ kiện) -> Nhóm -> Danh mục lá
        // Lưu ý: Category.name đang unique toàn cục, nên tên có hậu tố nam/nữ để tránh trùng.
        Category namRoot = createCategory("Nam", "men", "Danh mục gốc cho thời trang nam.", null, 1);
        Category nuRoot = createCategory("Nữ", "women", "Danh mục gốc cho thời trang nữ.", null, 2);
        Category phuKienRoot = createCategory("Phụ kiện", "accessories", "Danh mục gốc cho phụ kiện.", null, 3);

        // Level 2 - Nam
        Category namAo = createCategory("Áo nam", "men-ao", "Nhóm áo dành cho nam.", namRoot, 10);
        Category namQuan = createCategory("Quần nam", "men-quan", "Nhóm quần dành cho nam.", namRoot, 20);
        Category namTheThao = createCategory("Đồ thể thao nam", "men-do-the-thao", "Nhóm đồ thể thao nam.", namRoot, 30);
        Category namMacNha = createCategory("Đồ mặc nhà nam", "men-do-mac-nha", "Nhóm đồ mặc nhà nam.", namRoot, 40);

        // Level 2 - Nữ
        Category nuAo = createCategory("Áo nữ", "women-ao", "Nhóm áo dành cho nữ.", nuRoot, 10);
        Category nuVayDam = createCategory("Váy đầm nữ", "women-vay-dam", "Nhóm váy đầm dành cho nữ.", nuRoot, 20);
        Category nuQuan = createCategory("Quần nữ", "women-quan", "Nhóm quần dành cho nữ.", nuRoot, 30);
        Category nuTheThao = createCategory("Đồ thể thao nữ", "women-do-the-thao", "Nhóm đồ thể thao nữ.", nuRoot, 40);
        Category nuMacNha = createCategory("Đồ mặc nhà nữ", "women-do-mac-nha", "Nhóm đồ mặc nhà nữ.", nuRoot, 50);

        // Level 2 - Phụ kiện
        Category pkTuiVaVi = createCategory("Túi và ví", "accessories-tui-va-vi", "Nhóm túi và ví.", phuKienRoot, 10);
        Category pkThoiTrang = createCategory("Phụ kiện thời trang", "accessories-phu-kien-thoi-trang", "Nhóm phụ kiện thời trang.", phuKienRoot, 20);
        Category pkKhac = createCategory("Phụ kiện khác", "accessories-phu-kien-khac", "Nhóm phụ kiện khác.", phuKienRoot, 30);

        // Level 3 - Nam > Áo
        Category menAoThun = createCategory("Áo thun nam", "men-ao-thun", "Áo thun nam.", namAo, 1);
        Category menAoPolo = createCategory("Áo polo nam", "men-ao-polo", "Áo polo nam.", namAo, 2);
        createCategory("Áo sơ mi nam", "men-ao-so-mi", "Áo sơ mi nam.", namAo, 3);
        createCategory("Áo hoodie nam", "men-ao-hoodie", "Áo hoodie nam.", namAo, 4);
        createCategory("Áo len nam", "men-ao-len", "Áo len nam.", namAo, 5);

        // Level 3 - Nam > Quần
        Category menQuanJeans = createCategory("Quần jeans nam", "men-quan-jeans", "Quần jeans nam.", namQuan, 1);
        createCategory("Quần tây nam", "men-quan-tay", "Quần tây nam.", namQuan, 2);
        Category menQuanKaki = createCategory("Quần kaki nam", "men-quan-kaki", "Quần kaki nam.", namQuan, 3);
        createCategory("Quần short nam", "men-quan-short", "Quần short nam.", namQuan, 4);
        createCategory("Quần jogger nam", "men-quan-jogger", "Quần jogger nam.", namQuan, 5);

        // Level 3 - Nam > Đồ thể thao
        createCategory("Áo thể thao nam", "men-ao-the-thao", "Áo thể thao nam.", namTheThao, 1);
        createCategory("Quần thể thao nam", "men-quan-the-thao", "Quần thể thao nam.", namTheThao, 2);
        createCategory("Set thể thao nam", "men-set-the-thao", "Set thể thao nam.", namTheThao, 3);

        // Level 3 - Nam > Đồ mặc nhà
        createCategory("Áo mặc nhà nam", "men-ao-mac-nha", "Áo mặc nhà nam.", namMacNha, 1);
        createCategory("Quần mặc nhà nam", "men-quan-mac-nha", "Quần mặc nhà nam.", namMacNha, 2);
        createCategory("Bộ mặc nhà nam", "men-bo-mac-nha", "Bộ mặc nhà nam.", namMacNha, 3);

        // Level 3 - Nữ > Áo
        createCategory("Áo thun nữ", "women-ao-thun", "Áo thun nữ.", nuAo, 1);
        createCategory("Áo kiểu nữ", "women-ao-kieu", "Áo kiểu nữ.", nuAo, 2);
        Category womenAoSoMi = createCategory("Áo sơ mi nữ", "women-ao-so-mi", "Áo sơ mi nữ.", nuAo, 3);
        createCategory("Áo croptop nữ", "women-ao-croptop", "Áo croptop nữ.", nuAo, 4);
        Category womenAoKhoac = createCategory("Áo khoác nữ", "women-ao-khoac", "Áo khoác nữ.", nuAo, 5);

        // Level 3 - Nữ > Váy/Đầm
        Category womenVayLien = createCategory("Váy liền nữ", "women-vay-lien", "Váy liền nữ.", nuVayDam, 1);
        createCategory("Váy dự tiệc nữ", "women-vay-du-tiec", "Váy dự tiệc nữ.", nuVayDam, 2);
        createCategory("Váy công sở nữ", "women-vay-cong-so", "Váy công sở nữ.", nuVayDam, 3);
        createCategory("Váy maxi nữ", "women-vay-maxi", "Váy maxi nữ.", nuVayDam, 4);

        // Level 3 - Nữ > Quần
        Category womenQuanJeans = createCategory("Quần jeans nữ", "women-quan-jeans", "Quần jeans nữ.", nuQuan, 1);
        createCategory("Quần short nữ", "women-quan-short", "Quần short nữ.", nuQuan, 2);
        createCategory("Quần tây nữ", "women-quan-tay", "Quần tây nữ.", nuQuan, 3);
        createCategory("Quần legging nữ", "women-quan-legging", "Quần legging nữ.", nuQuan, 4);

        // Level 3 - Nữ > Đồ thể thao
        createCategory("Áo thể thao nữ", "women-ao-the-thao", "Áo thể thao nữ.", nuTheThao, 1);
        createCategory("Quần thể thao nữ", "women-quan-the-thao", "Quần thể thao nữ.", nuTheThao, 2);
        createCategory("Set thể thao nữ", "women-set-the-thao", "Set thể thao nữ.", nuTheThao, 3);

        // Level 3 - Nữ > Đồ mặc nhà
        createCategory("Áo mặc nhà nữ", "women-ao-mac-nha", "Áo mặc nhà nữ.", nuMacNha, 1);
        createCategory("Quần mặc nhà nữ", "women-quan-mac-nha", "Quần mặc nhà nữ.", nuMacNha, 2);
        createCategory("Bộ mặc nhà nữ", "women-bo-mac-nha", "Bộ mặc nhà nữ.", nuMacNha, 3);

        // Level 3 - Phụ kiện
        createCategory("Túi xách", "tui-xach", "Túi xách.", pkTuiVaVi, 1);
        Category accessoryTuiDeoCheo = createCategory("Túi đeo chéo", "tui-deo-cheo", "Túi đeo chéo.", pkTuiVaVi, 2);
        Category accessoryBalo = createCategory("Balo", "balo", "Balo.", pkTuiVaVi, 3);
        Category accessoryVi = createCategory("Ví", "vi", "Ví.", pkTuiVaVi, 4);

        createCategory("Nón mũ", "non-mu", "Nón mũ.", pkThoiTrang, 1);
        createCategory("Thắt lưng", "that-lung", "Thắt lưng.", pkThoiTrang, 2);
        createCategory("Khăn", "khan", "Khăn.", pkThoiTrang, 3);
        createCategory("Tất", "tat", "Tất.", pkThoiTrang, 4);

        createCategory("Kính mắt", "kinh-mat", "Kính mắt.", pkKhac, 1);
        createCategory("Đồng hồ", "dong-ho", "Đồng hồ.", pkKhac, 2);
        createCategory("Trang sức", "trang-suc", "Trang sức.", pkKhac, 3);

        Product aoThunPremium = createProduct(
                storeAn, menAoThun, "Áo thun cotton premium", "ao-thun-cotton-premium",
                new BigDecimal("249000"), new BigDecimal("199000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                true, "Cotton compact 240gsm", "Regular fit", "Áo thun mềm mịn, thấm hút tốt, phù hợp mặc hằng ngày.",
                unsplashImage("photo-1521572163474-6864f9cf17ab", 672, 990), "Áo thun cotton premium"
        );
        Product quanJeanSlim = createProduct(
                storeAn, menQuanJeans, "Quần jean slim wash", "quan-jean-slim-wash",
                new BigDecimal("459000"), new BigDecimal("379000"), Product.Gender.MALE, Product.ProductStatus.ACTIVE,
                false, "Denim co giãn", "Slim fit", "Quần jean ôm vừa, màu wash hiện đại.",
                unsplashImage("photo-1542272604-787c3835535d", 672, 990), "Quần jean slim wash"
        );
        Product damMidi = createProduct(
                storeBinh, womenVayLien, "Đầm midi hoa nhí", "dam-midi-hoa-nhi",
                new BigDecimal("529000"), new BigDecimal("449000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                true, "Voan lụa", "Dáng xòe", "Đầm nhẹ, thoáng, phù hợp đi làm và dạo phố.",
                unsplashImage("photo-1496747611176-843222e1e57c", 672, 990), "Đầm midi hoa nhí"
        );
        Product blazerNu = createProduct(
                storeBinh, womenAoKhoac, "Áo blazer nữ basic", "ao-blazer-nu-basic",
                new BigDecimal("699000"), new BigDecimal("599000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                false, "Tweed pha", "Regular fit", "Blazer tối giản, phù hợp môi trường công sở.",
                unsplashImage("photo-1483985988355-763728e1935b", 672, 990), "Áo blazer nữ basic"
        );
        Product tuiDaMem = createProduct(
                storeBinh, accessoryTuiDeoCheo, "Túi đeo chéo da mềm", "tui-deo-cheo-da-mem",
                new BigDecimal("489000"), new BigDecimal("409000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                true, "Da PU cao cấp", "Đeo chéo", "Túi nhỏ gọn, có nhiều ngăn tiện lợi.",
                unsplashImage("photo-1542291026-7eec264c27ff", 672, 990), "Túi đeo chéo da mềm"
        );
        Product sanPhamNhap = createProduct(
                storeChoDuyet, menAoThun, "Áo thun local draft", "ao-thun-local-draft",
                new BigDecimal("199000"), BigDecimal.ZERO, Product.Gender.UNISEX, Product.ProductStatus.DRAFT,
                false, "Cotton 2 chiều", "Regular fit", "Sản phẩm nháp chờ gian hàng được duyệt.",
                unsplashImage("photo-1434389677669-e08b4cac3105", 672, 990), "Áo thun local draft"
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

        // Additional products for vendor testing (listing, filter, pagination, inventory states)
        Product aoPoloAirFlex = createProduct(
                storeAn, menAoPolo, "Ao polo air flex", "ao-polo-air-flex",
                new BigDecimal("329000"), new BigDecimal("279000"), Product.Gender.MALE, Product.ProductStatus.ACTIVE,
                true, "Cotton pique", "Slim fit", "Ao polo chat lieu thoang khi, phu hop di lam va di choi.",
                unsplashImage("photo-1617137984095-74e4e5e3613f", 672, 990), "Ao polo air flex"
        );
        Product aoThunOversize = createProduct(
                storeAn, menAoThun, "Ao thun oversize street", "ao-thun-oversize-street",
                new BigDecimal("289000"), new BigDecimal("239000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                false, "Cotton 2 chieu", "Oversize", "Form rong thoai mai, phoi do linh hoat.",
                unsplashImage("photo-1503342217505-b0a15ec3261c", 672, 990), "Ao thun oversize street"
        );
        Product quanKakiFlex = createProduct(
                storeAn, menQuanKaki, "Quan kaki flex tapered", "quan-kaki-flex-tapered",
                new BigDecimal("499000"), new BigDecimal("419000"), Product.Gender.MALE, Product.ProductStatus.ACTIVE,
                false, "Kaki co gian", "Tapered", "Quan kaki de mac, de phoi voi ao polo va so mi.",
                unsplashImage("photo-1473966968600-fa801b869a1a", 672, 990), "Quan kaki flex tapered"
        );
        Product quanJeansStraight = createProduct(
                storeAn, menQuanJeans, "Quan jeans straight dark", "quan-jeans-straight-dark",
                new BigDecimal("539000"), new BigDecimal("459000"), Product.Gender.MALE, Product.ProductStatus.ACTIVE,
                false, "Denim 12oz", "Straight", "Mau denim dam, hop phong cach toi gian.",
                unsplashImage("photo-1475180098004-ca77a66827be", 672, 990), "Quan jeans straight dark"
        );
        Product aoPoloSeasonOld = createProduct(
                storeAn, menAoPolo, "Ao polo old season", "ao-polo-old-season",
                new BigDecimal("299000"), new BigDecimal("199000"), Product.Gender.MALE, Product.ProductStatus.INACTIVE,
                false, "Cotton blend", "Regular", "Mau cu de test trang thai inactive tren dashboard vendor.",
                unsplashImage("photo-1562157873-818bc0726f68", 672, 990), "Ao polo old season"
        );

        Product aoSoMiLuaNu = createProduct(
                storeBinh, womenAoSoMi, "Ao so mi lua basic", "ao-so-mi-lua-basic",
                new BigDecimal("459000"), new BigDecimal("389000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                true, "Lua mem", "Regular", "Ao so mi thanh lich cho moi truong cong so.",
                unsplashImage("photo-1524504388940-b1c1722653e1", 672, 990), "Ao so mi lua basic"
        );
        Product quanJeansBaggyNu = createProduct(
                storeBinh, womenQuanJeans, "Quan jeans baggy nu", "quan-jeans-baggy-nu",
                new BigDecimal("499000"), new BigDecimal("429000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                false, "Denim mem", "Baggy", "Form baggy de mac, phu hop phong cach tre trung.",
                unsplashImage("photo-1541099649105-f69ad21f3246", 672, 990), "Quan jeans baggy nu"
        );
        Product damLinen = createProduct(
                storeBinh, womenVayLien, "Dam linen canh tien", "dam-linen-canh-tien",
                new BigDecimal("629000"), new BigDecimal("549000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                false, "Linen", "A-line", "Dam chat lieu linen nhe, mac mat trong mua he.",
                unsplashImage("photo-1515886657613-9f3515b0c78f", 672, 990), "Dam linen canh tien"
        );
        Product aoCardigan = createProduct(
                storeBinh, womenAoKhoac, "Ao cardigan knit", "ao-cardigan-knit",
                new BigDecimal("559000"), new BigDecimal("489000"), Product.Gender.FEMALE, Product.ProductStatus.ACTIVE,
                false, "Knit", "Regular", "Ao khoac mong nhe, phoi cung vay va quan jeans.",
                unsplashImage("photo-1445205170230-053b83016050", 672, 990), "Ao cardigan knit"
        );
        Product tuiMiniCross = createProduct(
                storeBinh, accessoryTuiDeoCheo, "Tui mini crossbody", "tui-mini-crossbody",
                new BigDecimal("429000"), new BigDecimal("359000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                false, "PU leather", "Crossbody", "Tui mini gon nhe, phu hop di choi va di cafe.",
                unsplashImage("photo-1584917865442-de89df76afd3", 672, 990), "Tui mini crossbody"
        );
        Product baloUrban = createProduct(
                storeBinh, accessoryBalo, "Balo urban daily", "balo-urban-daily",
                new BigDecimal("639000"), new BigDecimal("559000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                false, "Canvas", "Daily", "Balo dung laptop 14 inch, nhieu ngan tien loi.",
                unsplashImage("photo-1491637639811-60e2756cc1c7", 672, 990), "Balo urban daily"
        );
        Product viSlim = createProduct(
                storeBinh, accessoryVi, "Vi slim da mem", "vi-slim-da-mem",
                new BigDecimal("329000"), new BigDecimal("279000"), Product.Gender.UNISEX, Product.ProductStatus.ACTIVE,
                false, "PU leather", "Slim", "Vi mong gon, phu hop bo tui quan jean.",
                unsplashImage("photo-1627123424574-724758594e93", 672, 990), "Vi slim da mem"
        );
        Product damDraftSample = createProduct(
                storeBinh, womenVayLien, "Dam sample pending", "dam-sample-pending",
                new BigDecimal("399000"), BigDecimal.ZERO, Product.Gender.FEMALE, Product.ProductStatus.DRAFT,
                false, "Cotton blend", "Regular", "San pham nhap de test trang thai draft cua vendor.",
                unsplashImage("photo-1485230895905-ec40ba36b9bc", 672, 990), "Dam sample pending"
        );

        createVariant(aoPoloAirFlex, "AN-POLO-AIR-BLK-M", "Den", "M", 45, BigDecimal.ZERO, true);
        createVariant(aoPoloAirFlex, "AN-POLO-AIR-BLK-L", "Den", "L", 38, BigDecimal.ZERO, true);
        createVariant(aoThunOversize, "AN-TEE-OVR-CRM-M", "Kem", "M", 60, BigDecimal.ZERO, true);
        createVariant(aoThunOversize, "AN-TEE-OVR-CRM-L", "Kem", "L", 52, BigDecimal.ZERO, true);
        createVariant(quanKakiFlex, "AN-KAKI-FLX-BEI-30", "Be", "30", 31, BigDecimal.ZERO, true);
        createVariant(quanKakiFlex, "AN-KAKI-FLX-BEI-32", "Be", "32", 28, BigDecimal.ZERO, true);
        createVariant(quanJeansStraight, "AN-JEAN-STR-IND-30", "Indigo", "30", 27, BigDecimal.ZERO, true);
        createVariant(quanJeansStraight, "AN-JEAN-STR-IND-32", "Indigo", "32", 25, BigDecimal.ZERO, true);
        createVariant(aoPoloSeasonOld, "AN-POLO-OLD-GRY-M", "Xam", "M", 10, BigDecimal.ZERO, true);

        createVariant(aoSoMiLuaNu, "BINH-SHIRT-SIL-WHT-S", "Trang", "S", 35, BigDecimal.ZERO, true);
        createVariant(aoSoMiLuaNu, "BINH-SHIRT-SIL-WHT-M", "Trang", "M", 29, BigDecimal.ZERO, true);
        createVariant(quanJeansBaggyNu, "BINH-JEANS-BAG-BLU-S", "Xanh", "S", 24, BigDecimal.ZERO, true);
        createVariant(quanJeansBaggyNu, "BINH-JEANS-BAG-BLU-M", "Xanh", "M", 22, BigDecimal.ZERO, true);
        createVariant(damLinen, "BINH-DRESS-LIN-BEI-S", "Be", "S", 19, BigDecimal.ZERO, true);
        createVariant(damLinen, "BINH-DRESS-LIN-BEI-M", "Be", "M", 17, BigDecimal.ZERO, true);
        createVariant(aoCardigan, "BINH-CARDI-KNT-IVR-S", "Trang ngà", "S", 20, BigDecimal.ZERO, true);
        createVariant(aoCardigan, "BINH-CARDI-KNT-IVR-M", "Trang ngà", "M", 18, BigDecimal.ZERO, true);
        createVariant(tuiMiniCross, "BINH-BAG-MINI-BLK-F", "Den", "Free", 44, BigDecimal.ZERO, true);
        createVariant(baloUrban, "BINH-BALO-URB-BLK-F", "Den", "Free", 26, BigDecimal.ZERO, true);
        createVariant(viSlim, "BINH-WALLET-SLM-BRN-F", "Nau", "Free", 56, BigDecimal.ZERO, true);
        createVariant(damDraftSample, "BINH-DRESS-SMP-BEI-M", "Be", "M", 14, BigDecimal.ZERO, true);

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

        createReview(aoThunPremium, customerMinh, orderDaGiao, storeAn.getId(), 5, "Áo mặc rất thoải mái", "Chất vải mát, form đẹp, giao nhanh.", Review.ReviewStatus.APPROVED, "Cảm ơn bạn đã ủng hộ shop.", List.of(unsplashImage("photo-1521572163474-6864f9cf17ab", 672, 990)));
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
        jdbcTemplate.execute("""
                ALTER TABLE return_requests
                DROP CONSTRAINT IF EXISTS return_requests_status_check
                """);
        jdbcTemplate.execute("""
                ALTER TABLE return_requests
                ADD CONSTRAINT return_requests_status_check
                CHECK (
                    status IN (
                        'PENDING_VENDOR',
                        'ACCEPTED',
                        'SHIPPING',
                        'RECEIVED',
                        'COMPLETED',
                        'REJECTED',
                        'DISPUTED',
                        'CANCELLED'
                    )
                )
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
        store.setLogo(STORE_LOGO_IMAGE);
        store.setBanner(STORE_BANNER_IMAGE);
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
        category.setImage(CATEGORY_IMAGE);
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
        boolean isPublicReady =
                status == Product.ProductStatus.ACTIVE
                        && store.getApprovalStatus() == Store.ApprovalStatus.APPROVED
                        && store.getStatus() == Store.StoreStatus.ACTIVE;
        product.setApprovalStatus(isPublicReady ? Product.ApprovalStatus.APPROVED : Product.ApprovalStatus.PENDING);
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
