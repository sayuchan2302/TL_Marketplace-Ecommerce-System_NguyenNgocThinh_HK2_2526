package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.hcmuaf.fit.fashionstore.entity.CustomerWallet;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerWalletRepository extends JpaRepository<CustomerWallet, UUID> {
    Optional<CustomerWallet> findByUserId(UUID userId);
}
