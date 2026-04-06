package vn.edu.hcmuaf.fit.fashionstore.service;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import vn.edu.hcmuaf.fit.fashionstore.entity.AdminAuditLog;
import vn.edu.hcmuaf.fit.fashionstore.repository.AdminAuditLogRepository;

import java.util.UUID;

@Service
public class AdminAuditLogService {
    private static final Logger logger = LoggerFactory.getLogger(AdminAuditLogService.class);

    private final AdminAuditLogRepository adminAuditLogRepository;

    public AdminAuditLogService(AdminAuditLogRepository adminAuditLogRepository) {
        this.adminAuditLogRepository = adminAuditLogRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAction(
            UUID actorId,
            String actorEmail,
            String domain,
            String action,
            UUID targetId,
            boolean success,
            String note
    ) {
        try {
            RequestMetadata metadata = resolveRequestMetadata();
            AdminAuditLog log = AdminAuditLog.builder()
                    .actorId(actorId)
                    .actorEmail(actorEmail)
                    .domain(domain)
                    .action(action)
                    .targetId(targetId)
                    .requestMethod(metadata.requestMethod())
                    .requestPath(metadata.requestPath())
                    .ipAddress(metadata.ipAddress())
                    .userAgent(metadata.userAgent())
                    .success(success)
                    .note(note)
                    .build();
            adminAuditLogRepository.save(log);
        } catch (Exception ex) {
            logger.warn("Failed to write admin audit log for domain={} action={}", domain, action, ex);
        }
    }

    private RequestMetadata resolveRequestMetadata() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return new RequestMetadata(null, null, null, null);
        }

        HttpServletRequest request = attributes.getRequest();
        if (request == null) {
            return new RequestMetadata(null, null, null, null);
        }

        String forwardedFor = request.getHeader("X-Forwarded-For");
        String ipAddress = extractClientIp(forwardedFor);
        if (ipAddress == null || ipAddress.isBlank()) {
            ipAddress = request.getRemoteAddr();
        }

        return new RequestMetadata(
                request.getMethod(),
                request.getRequestURI(),
                ipAddress,
                request.getHeader("User-Agent")
        );
    }

    private String extractClientIp(String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return null;
        }
        String[] parts = forwardedFor.split(",");
        if (parts.length == 0) {
            return null;
        }
        return parts[0].trim();
    }

    private record RequestMetadata(String requestMethod, String requestPath, String ipAddress, String userAgent) {
    }
}
