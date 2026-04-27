package vn.edu.hcmuaf.fit.marketplace.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.marketplace.entity.CommissionTier;
import vn.edu.hcmuaf.fit.marketplace.repository.CommissionTierRepository;

import java.util.List;
import java.util.UUID;

@Service
public class CommissionTierService {

    private final CommissionTierRepository commissionTierRepository;
    private final StoreService storeService;

    public CommissionTierService(CommissionTierRepository commissionTierRepository, StoreService storeService) {
        this.commissionTierRepository = commissionTierRepository;
        this.storeService = storeService;
    }

    public List<CommissionTier> findAllActive() {
        return commissionTierRepository.findByIsActiveTrueOrderBySortOrderAsc();
    }

    public CommissionTier findById(UUID id) {
        return commissionTierRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commission tier not found"));
    }

    public CommissionTier findBySlug(String slug) {
        return commissionTierRepository.findBySlug(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commission tier not found"));
    }

    public CommissionTier getDefaultTier() {
        return commissionTierRepository.findByIsDefaultTrue()
                .orElseGet(() -> commissionTierRepository.findByIsActiveTrueOrderBySortOrderAsc().stream().findFirst()
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No commission tiers configured")));
    }

    public CommissionTier determineTierForVendor(long monthlyRevenue, int orderCount) {
        List<CommissionTier> tiers = findAllActive();
        return tiers.stream()
                .filter(tier -> {
                    boolean meetsRevenue = tier.getMinMonthlyRevenue() == null || monthlyRevenue >= tier.getMinMonthlyRevenue();
                    boolean meetsOrders = tier.getMinOrderCount() == null || orderCount >= tier.getMinOrderCount();
                    return meetsRevenue && meetsOrders;
                })
                .max((left, right) -> Integer.compare(
                        left.getSortOrder() != null ? left.getSortOrder() : 0,
                        right.getSortOrder() != null ? right.getSortOrder() : 0
                ))
                .orElseGet(this::getDefaultTier);
    }

    @Transactional
    public void applyTierToStore(UUID tierId, UUID storeId, UUID adminId, String adminEmail) {
        CommissionTier tier = findById(tierId);
        storeService.updateCommissionRateAsAdmin(
                storeId,
                tier.getRate(),
                adminId,
                adminEmail,
                "Applied commission tier: " + tier.getName()
        );
    }

    @Transactional
    public CommissionTier create(String name, String description, BigDecimal rate, Long minMonthlyRevenue, Integer minOrderCount, Integer sortOrder) {
        String slug = generateSlug(name);
        validateUniqueSlug(slug, null);

        CommissionTier tier = CommissionTier.builder()
                .name(name)
                .slug(slug)
                .description(description)
                .rate(rate)
                .minMonthlyRevenue(minMonthlyRevenue)
                .minOrderCount(minOrderCount)
                .isDefault(false)
                .isActive(true)
                .sortOrder(sortOrder != null ? sortOrder : 0)
                .build();

        return commissionTierRepository.save(tier);
    }

    @Transactional
    public CommissionTier update(UUID id, String name, String description, BigDecimal rate, Long minMonthlyRevenue, Integer minOrderCount, Integer sortOrder) {
        CommissionTier tier = findById(id);
        String slug = generateSlug(name);
        validateUniqueSlug(slug, id);

        tier.setName(name);
        tier.setSlug(slug);
        tier.setDescription(description);
        tier.setRate(rate);
        tier.setMinMonthlyRevenue(minMonthlyRevenue);
        tier.setMinOrderCount(minOrderCount);
        tier.setSortOrder(sortOrder != null ? sortOrder : 0);

        return commissionTierRepository.save(tier);
    }

    @Transactional
    public void setDefault(UUID id) {
        commissionTierRepository.findByIsDefaultTrue().ifPresent(current -> {
            if (!current.getId().equals(id)) {
                current.setIsDefault(false);
                commissionTierRepository.save(current);
            }
        });

        CommissionTier tier = findById(id);
        tier.setIsDefault(true);
        tier.setIsActive(true);
        commissionTierRepository.save(tier);
    }

    @Transactional
    public void toggleActive(UUID id) {
        CommissionTier tier = findById(id);
        tier.setIsActive(!Boolean.TRUE.equals(tier.getIsActive()));
        commissionTierRepository.save(tier);
    }

    @Transactional
    public void delete(UUID id) {
        CommissionTier tier = findById(id);
        if (Boolean.TRUE.equals(tier.getIsDefault())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the default commission tier");
        }
        commissionTierRepository.delete(tier);
    }

    private String generateSlug(String name) {
        return name.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private void validateUniqueSlug(String slug, UUID excludeId) {
        commissionTierRepository.findBySlug(slug).ifPresent(existing -> {
            if (excludeId == null || !existing.getId().equals(excludeId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Commission tier with this name already exists");
            }
        });
    }
}
