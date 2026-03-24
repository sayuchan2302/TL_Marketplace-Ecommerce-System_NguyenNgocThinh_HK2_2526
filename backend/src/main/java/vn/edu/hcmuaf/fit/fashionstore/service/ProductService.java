package vn.edu.hcmuaf.fit.fashionstore.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.ProductRequest;
import vn.edu.hcmuaf.fit.fashionstore.entity.Category;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product.Gender;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product.ProductStatus;
import vn.edu.hcmuaf.fit.fashionstore.repository.CategoryRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductRepository;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    public List<Product> findAll() {
        return productRepository.findAll();
    }

    public Product findById(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
    }

    public Product findBySlug(String slug) {
        return productRepository.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("Product not found"));
    }

    @Transactional
    public Product create(ProductRequest request) {
        Product product = Product.builder()
                .name(request.getName())
                .slug(request.getSlug())
                .description(request.getDescription())
                .basePrice(request.getBasePrice())
                .salePrice(request.getSalePrice())
                .material(request.getMaterial())
                .fit(request.getFit())
                .status(ProductStatus.ACTIVE)
                .build();

        if (request.getGender() != null) {
            product.setGender(Gender.valueOf(request.getGender().toUpperCase()));
        }

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new RuntimeException("Category not found"));
            product.setCategory(category);
        }

        return productRepository.save(product);
    }

    @Transactional
    public Product update(UUID id, ProductRequest request) {
        Product product = findById(id);

        if (request.getName() != null) product.setName(request.getName());
        if (request.getSlug() != null) product.setSlug(request.getSlug());
        if (request.getDescription() != null) product.setDescription(request.getDescription());
        if (request.getBasePrice() != null) product.setBasePrice(request.getBasePrice());
        if (request.getSalePrice() != null) product.setSalePrice(request.getSalePrice());
        if (request.getMaterial() != null) product.setMaterial(request.getMaterial());
        if (request.getFit() != null) product.setFit(request.getFit());
        if (request.getGender() != null) {
            product.setGender(Gender.valueOf(request.getGender().toUpperCase()));
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new RuntimeException("Category not found"));
            product.setCategory(category);
        }

        return productRepository.save(product);
    }

    @Transactional
    public void delete(UUID id) {
        Product product = findById(id);
        product.setStatus(ProductStatus.INACTIVE);
        productRepository.save(product);
    }
}
