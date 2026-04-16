package vn.edu.hcmuaf.fit.marketplace.chatbot.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.marketplace.config.ChatbotProperties;
import vn.edu.hcmuaf.fit.marketplace.dto.response.DirectLineTokenResponse;

import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;
import static org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE;

@Service
public class DirectLineTokenService {

    private final ChatbotProperties chatbotProperties;
    private final RestTemplate restTemplate;

    public DirectLineTokenService(ChatbotProperties chatbotProperties) {
        this.chatbotProperties = chatbotProperties;
        this.restTemplate = new RestTemplate();
    }

    public DirectLineTokenResponse generateToken(String userId) {
        String secret = chatbotProperties.getDirectLineSecret();
        if (!StringUtils.hasText(secret)) {
            throw new ResponseStatusException(
                    SERVICE_UNAVAILABLE,
                    "Chatbot is not configured. Direct Line secret is missing."
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(secret.trim());

        Map<String, Object> payload = Map.of(
                "user",
                Map.of("id", StringUtils.hasText(userId) ? userId.trim() : "web-anonymous")
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        ResponseEntity<DirectLineConversationApiResponse> response;

        try {
            response = restTemplate.exchange(
                    chatbotProperties.getDirectLineConversationEndpoint(),
                    HttpMethod.POST,
                    request,
                    DirectLineConversationApiResponse.class
            );
        } catch (RestClientException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Unable to start chatbot conversation.", ex);
        }

        DirectLineConversationApiResponse body = response.getBody();
        if (body == null || !StringUtils.hasText(body.getToken())) {
            throw new ResponseStatusException(BAD_GATEWAY, "Direct Line returned an invalid conversation response.");
        }

        return new DirectLineTokenResponse(
                body.getToken(),
                body.getConversationId(),
                body.getStreamUrl(),
                body.getExpiresIn()
        );
    }

    private static class DirectLineConversationApiResponse {
        private String token;
        private String conversationId;
        private String streamUrl;

        @JsonProperty("expires_in")
        private Integer expiresIn;

        public String getToken() {
            return token;
        }

        public String getConversationId() {
            return conversationId;
        }

        public String getStreamUrl() {
            return streamUrl;
        }

        public Integer getExpiresIn() {
            return expiresIn;
        }
    }
}
