package vn.edu.hcmuaf.fit.marketplace.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DirectLineTokenResponse {
    private String token;
    private String conversationId;
    private String streamUrl;
    private Integer expiresIn;
}
