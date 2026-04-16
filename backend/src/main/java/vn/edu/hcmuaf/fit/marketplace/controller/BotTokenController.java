package vn.edu.hcmuaf.fit.marketplace.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.hcmuaf.fit.marketplace.chatbot.service.DirectLineTokenService;
import vn.edu.hcmuaf.fit.marketplace.dto.request.DirectLineTokenRequest;
import vn.edu.hcmuaf.fit.marketplace.dto.response.DirectLineTokenResponse;

@RestController
@RequestMapping("/api/bot")
public class BotTokenController {

    private final DirectLineTokenService directLineTokenService;

    public BotTokenController(DirectLineTokenService directLineTokenService) {
        this.directLineTokenService = directLineTokenService;
    }

    @PostMapping("/token")
    public DirectLineTokenResponse createToken(@RequestBody(required = false) DirectLineTokenRequest request) {
        String userId = request == null ? null : request.getUserId();
        return directLineTokenService.generateToken(userId);
    }
}

