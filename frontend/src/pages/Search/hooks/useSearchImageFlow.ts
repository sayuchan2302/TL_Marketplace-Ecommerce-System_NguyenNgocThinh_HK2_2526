import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { ApiError } from '../../../services/apiClient';
import {
  marketplaceService,
  type MarketplaceStoreCard,
} from '../../../services/marketplaceService';
import type { Product } from '../../../types';
import {
  extractImageFileFromClipboard,
  imageSearchSession as pendingImageSearchSession,
} from '../../../utils/imageSearchSession';
import { validateImageSearchFile } from '../../../utils/imageSearchValidation';

export interface SearchImageSession {
  fileName: string;
  previewUrl: string;
  totalCandidates: number;
  inferredCategory?: string;
  inferredCategoryScore?: number;
  categoryFilterApplied?: string;
}

interface UseSearchImageFlowOptions {
  imageSearchToken: string;
  imageCategory: string;
  imageStore: string;
  setIsSearching: Dispatch<SetStateAction<boolean>>;
  setProductResults: Dispatch<SetStateAction<Product[]>>;
  setStoreResults: Dispatch<SetStateAction<MarketplaceStoreCard[]>>;
  clearSearchResults: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

export const useSearchImageFlow = ({
  imageSearchToken,
  imageCategory,
  imageStore,
  setIsSearching,
  setProductResults,
  setStoreResults,
  clearSearchResults,
}: UseSearchImageFlowOptions) => {
  const [imageSearchSession, setImageSearchSession] = useState<SearchImageSession | null>(null);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const consumedImageTokenRef = useRef<string | null>(null);
  const pasteTargetRef = useRef<HTMLDivElement | null>(null);
  const isImageSearchMode = Boolean(imageSearchSession);
  const isAwaitingImageSearch = Boolean(imageSearchToken)
    && !isImageSearchMode
    && pendingImageSearchSession.hasPendingFile();

  const clearImageSearchState = useCallback((clearResults = false) => {
    setImageSearchError(null);
    setImageSearchSession((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
    if (clearResults) {
      clearSearchResults();
    }
  }, [clearSearchResults]);

  const handleImageSearch = useCallback(async (file: File) => {
    const validation = validateImageSearchFile(file);
    if (!validation.ok) {
      setImageSearchError(validation.message);
      return false;
    }

    setIsSearching(true);
    setImageSearchError(null);
    const previewUrl = URL.createObjectURL(file);

    try {
      const response = await marketplaceService.searchProductsByImage(file, 120, {
        categorySlug: imageCategory || undefined,
        storeSlug: imageStore || undefined,
      });
      setProductResults(response.items);
      setStoreResults([]);
      setImageSearchSession({
        fileName: file.name,
        previewUrl,
        totalCandidates: response.totalCandidates,
        inferredCategory: response.inferredCategory,
        inferredCategoryScore: response.inferredCategoryScore,
        categoryFilterApplied: response.categoryFilterApplied,
      });
      return true;
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      clearSearchResults();
      setImageSearchSession(null);
      setImageSearchError(
        error instanceof ApiError
          ? error.message
          : 'Không thể tìm kiếm bằng ảnh lúc này.',
      );
      return false;
    } finally {
      setIsSearching(false);
    }
  }, [
    clearSearchResults,
    imageCategory,
    imageStore,
    setIsSearching,
    setProductResults,
    setStoreResults,
  ]);

  const handleImageInputChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    await handleImageSearch(file);
  }, [handleImageSearch]);

  const handleClipboardImage = useCallback(async (clipboardData: DataTransfer | null) => {
    const file = extractImageFileFromClipboard(clipboardData);
    if (!file) {
      return false;
    }

    return handleImageSearch(file);
  }, [handleImageSearch]);

  const handlePasteTargetPaste = useCallback(async (event: ReactClipboardEvent<HTMLDivElement>) => {
    const pasted = await handleClipboardImage(event.clipboardData);
    if (!pasted) {
      return;
    }

    event.preventDefault();
  }, [handleClipboardImage]);

  const triggerImagePicker = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const focusPasteTarget = useCallback(() => {
    pasteTargetRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!imageSearchToken || consumedImageTokenRef.current === imageSearchToken) {
      return;
    }

    const pendingFile = pendingImageSearchSession.consumePendingFile();
    if (!pendingFile) {
      return;
    }

    consumedImageTokenRef.current = imageSearchToken;
    void handleImageSearch(pendingFile);
  }, [handleImageSearch, imageSearchToken]);

  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const file = extractImageFileFromClipboard(event.clipboardData ?? null);
      if (!file) {
        return;
      }

      event.preventDefault();
      void handleImageSearch(file);
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [handleImageSearch]);

  useEffect(() => {
    return () => {
      if (imageSearchSession?.previewUrl) {
        URL.revokeObjectURL(imageSearchSession.previewUrl);
      }
    };
  }, [imageSearchSession?.previewUrl]);

  return {
    imageSearchSession,
    imageSearchError,
    imageInputRef,
    pasteTargetRef,
    isImageSearchMode,
    isAwaitingImageSearch,
    clearImageSearchState,
    triggerImagePicker,
    focusPasteTarget,
    handleImageSearch,
    handleImageInputChange,
    handleClipboardImage,
    handlePasteTargetPaste,
  };
};
