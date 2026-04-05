package vn.edu.hcmuaf.fit.fashionstore.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.ParentOrderSummaryDto;
import vn.edu.hcmuaf.fit.fashionstore.service.OrderService;

import java.util.List;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    private final OrderService orderService;

    public AdminOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<ParentOrderSummaryDto>> listParentOrders() {
        return ResponseEntity.ok(orderService.getAdminParentOrderSummaries());
    }
}
