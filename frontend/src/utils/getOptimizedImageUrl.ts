type OptimizeFormat = 'webp' | 'auto';

interface OptimizeOptions {
  width?: number;
  format?: OptimizeFormat;
  quality?: number;
}

const CDN_CGI_PREFIX = '/cdn-cgi/image/';

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const optimizeUnsplash = (url: URL, options: Required<OptimizeOptions>) => {
  url.searchParams.set('w', String(options.width));
  url.searchParams.set('q', String(options.quality));
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('auto', 'format');
  if (options.format === 'webp') {
    url.searchParams.set('fm', 'webp');
  }
  return url.toString();
};

const optimizeCloudflarePath = (url: URL, options: Required<OptimizeOptions>) => {
  const markerIndex = url.pathname.indexOf(CDN_CGI_PREFIX);
  if (markerIndex < 0) {
    return url.toString();
  }

  const afterPrefix = url.pathname.slice(markerIndex + CDN_CGI_PREFIX.length);
  const firstSlash = afterPrefix.indexOf('/');
  if (firstSlash < 0) {
    return url.toString();
  }

  const currentOptions = afterPrefix.slice(0, firstSlash);
  const resourcePath = afterPrefix.slice(firstSlash);
  const optionParts = currentOptions
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith('width=') && !part.startsWith('format=') && !part.startsWith('quality='));

  optionParts.unshift(`width=${options.width}`);
  optionParts.push(`quality=${options.quality}`);
  optionParts.push(`format=${options.format}`);

  const nextOptions = optionParts.join(',');
  url.pathname = `${url.pathname.slice(0, markerIndex)}${CDN_CGI_PREFIX}${nextOptions}${resourcePath}`;
  return url.toString();
};

export const getOptimizedImageUrl = (
  rawUrl: string | null | undefined,
  options?: OptimizeOptions,
): string => {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed || !isAbsoluteHttpUrl(trimmed)) return trimmed;

  const normalized: Required<OptimizeOptions> = {
    width: options?.width ?? 100,
    format: options?.format ?? 'webp',
    quality: options?.quality ?? 80,
  };

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('images.unsplash.com')) {
      return optimizeUnsplash(url, normalized);
    }
    if (url.pathname.includes(CDN_CGI_PREFIX)) {
      return optimizeCloudflarePath(url, normalized);
    }
    return trimmed;
  } catch {
    return trimmed;
  }
};
