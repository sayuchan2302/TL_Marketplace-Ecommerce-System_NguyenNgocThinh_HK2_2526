package vn.edu.hcmuaf.fit.fashionstore.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.fashionstore.dto.request.CategoryRequest;
import vn.edu.hcmuaf.fit.fashionstore.entity.Category;
import vn.edu.hcmuaf.fit.fashionstore.repository.CategoryRepository;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public List<Category> findAll() {
        return categoryRepository.findAll();
    }

    public Category findById(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found"));
    }

    @Transactional
    public Category create(CategoryRequest request) {
        Category category = Category.builder()
                .name(request.getName())
                .slug(request.getSlug())
                .description(request.getDescription())
                .image(request.getImage())
                .sortOrder(request.getSortOrder())
                .build();

        if (request.getParentId() != null) {
            Category parent = findById(request.getParentId());
            category.setParent(parent);
        }

        return categoryRepository.save(category);
    }

    @Transactional
    public Category update(UUID id, CategoryRequest request) {
        Category category = findById(id);

        if (request.getName() != null) category.setName(request.getName());
        if (request.getSlug() != null) category.setSlug(request.getSlug());
        if (request.getDescription() != null) category.setDescription(request.getDescription());
        if (request.getImage() != null) category.setImage(request.getImage());
        if (request.getSortOrder() != null) category.setSortOrder(request.getSortOrder());
        if (request.getParentId() != null) {
            Category parent = findById(request.getParentId());
            category.setParent(parent);
        }

        return categoryRepository.save(category);
    }

    @Transactional
    public void delete(UUID id) {
        Category category = findById(id);
        categoryRepository.delete(category);
    }
}
