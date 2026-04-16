import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { MessageCircle, RotateCcw, X } from 'lucide-react';
import './ChatWidget.css';
import { chatbotService } from '../../services/chatbotService';
import { ApiError } from '../../services/apiClient';

const VISITOR_ID_KEY = 'fashmarket-chat-visitor-id-v2';
const DIRECT_LINE_USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const buildVisitorId = () => {
  if (typeof window === 'undefined') {
    return 'web-anonymous';
  }

  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing && DIRECT_LINE_USER_ID_PATTERN.test(existing) && !existing.startsWith('dl_')) {
    return existing;
  }

  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const generated = `web_${randomId}`.replace(/[^a-zA-Z0-9_-]/g, '');
  window.localStorage.setItem(VISITOR_ID_KEY, generated);
  return generated;
};

const resolveErrorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.message.trim()) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Không thể kết nối chatbot lúc này. Vui lòng thử lại sau.';
};

const ChatWidget = () => {
  const [ReactWebChatComponent, setReactWebChatComponent] = useState<ComponentType<{
    directLine: unknown;
    locale: string;
    styleOptions: Record<string, string | number | boolean>;
  }> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [directLine, setDirectLine] = useState<{ end?: () => void } | null>(null);

  const visitorId = useMemo(buildVisitorId, []);

  const styleOptions = useMemo(() => ({
    botAvatarInitials: 'FM',
    userAvatarInitials: 'Bạn',
    bubbleBackground: '#f6f8ff',
    bubbleBorderRadius: 14,
    bubbleFromUserBackground: '#2f5acf',
    bubbleFromUserTextColor: '#ffffff',
    bubbleFromUserBorderRadius: 14,
    hideUploadButton: true,
    sendBoxButtonColor: '#2f5acf',
    sendBoxTextColor: '#111827',
    sendBoxBorderTop: '1px solid #e5e7eb',
    suggestedActionBackgroundColor: '#ffffff',
    suggestedActionBorderColor: '#bfdbfe',
    suggestedActionTextColor: '#1e3a8a',
    suggestedActionBorderRadius: 9999,
    accent: '#2f5acf',
  }), []);

  const initDirectLine = useCallback(async () => {
    if (directLine || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const webChatModule = await import('botframework-webchat');
      const tokenData = await chatbotService.createDirectLineToken(visitorId);

      if (!ReactWebChatComponent) {
        setReactWebChatComponent(() => webChatModule.default);
      }

      const createdDirectLine = webChatModule.createDirectLine({
        token: tokenData.token,
        conversationId: tokenData.conversationId,
        streamUrl: tokenData.streamUrl,
      }) as { end?: () => void; setUserId?: (id: string) => void };

      // Web Chat may try to call setUserId after Direct Line is already online.
      // Ignore this specific non-fatal SDK exception to prevent javascripterror activity.
      if (typeof createdDirectLine.setUserId === 'function') {
        const originalSetUserId = createdDirectLine.setUserId.bind(createdDirectLine);
        createdDirectLine.setUserId = (id: string) => {
          try {
            originalSetUserId(id);
          } catch (error) {
            if (error instanceof Error && error.message.includes('It is connected, we cannot set user id')) {
              return;
            }
            throw error;
          }
        };
      }

      setDirectLine(createdDirectLine);
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [ReactWebChatComponent, directLine, isLoading, visitorId]);

  useEffect(() => {
    if (isOpen && !directLine && !isLoading) {
      void initDirectLine();
    }
  }, [directLine, initDirectLine, isLoading, isOpen]);

  useEffect(() => () => {
    if (directLine && typeof directLine.end === 'function') {
      directLine.end();
    }
  }, [directLine]);

  return (
    <div className="chat-widget" aria-live="polite">
      {isOpen && (
        <div id="chat-widget-panel" className="chat-widget__panel" role="dialog" aria-label="Hỗ trợ khách hàng FashMarket">
          <div className="chat-widget__header">
            <div className="chat-widget__title-wrap">
              <h3 className="chat-widget__title">FashMarket Support Bot</h3>
              <span className="chat-widget__status">Đang trực tuyến</span>
            </div>
            <button
              type="button"
              className="chat-widget__icon-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng cửa sổ chat"
            >
              <X size={18} />
            </button>
          </div>

          <div className="chat-widget__body">
            {isLoading && (
              <div className="chat-widget__state">
                <p>Đang kết nối chatbot...</p>
              </div>
            )}

            {!isLoading && errorMessage && (
              <div className="chat-widget__state">
                <p>{errorMessage}</p>
                <button type="button" className="chat-widget__retry" onClick={() => void initDirectLine()}>
                  <RotateCcw size={14} />
                  <span>Thử lại</span>
                </button>
              </div>
            )}

            {!isLoading && !errorMessage && directLine && ReactWebChatComponent && (
              <ReactWebChatComponent
                directLine={directLine}
                locale="vi-VN"
                styleOptions={styleOptions}
              />
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="chat-widget__launcher"
        onClick={() => setIsOpen(open => !open)}
        aria-expanded={isOpen}
        aria-controls="chat-widget-panel"
        aria-label={isOpen ? 'Thu nhỏ chat' : 'Mở chat hỗ trợ'}
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  );
};

export default ChatWidget;
