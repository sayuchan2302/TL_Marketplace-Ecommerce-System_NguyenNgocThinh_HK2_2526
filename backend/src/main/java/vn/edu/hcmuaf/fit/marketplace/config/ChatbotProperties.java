package vn.edu.hcmuaf.fit.marketplace.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.chatbot")
public class ChatbotProperties {
    private boolean aiFallbackEnabled = false;
    private String directLineSecret;
    private String directLineTokenEndpoint = "https://directline.botframework.com/v3/directline/tokens/generate";
    private String directLineConversationEndpoint = "https://directline.botframework.com/v3/directline/conversations";
}
