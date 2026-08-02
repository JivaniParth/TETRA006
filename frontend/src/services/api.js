export const API_BASE = "https://launch-burst-implementation-condo.trycloudflare.com";

export function getWebSocketUrl(endpoint) {
  const wsProtocol = API_BASE.startsWith("https") ? "wss" : "ws";
  const baseHost = API_BASE.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${baseHost}${endpoint}`;
}

export async function apiCall(endpoint, options = {}, onUnauthorized = null) {
  const headers = options.headers || {};
  
  // Retrieve token dynamically from localStorage in the browser
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("swasthyasetu_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers
    }
  });
  
  if (response.status === 401) {
    if (onUnauthorized) {
      onUnauthorized();
    } else if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.reload();
    }
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}

export async function apiCallBlob(endpoint, options = {}, onUnauthorized = null) {
  const headers = options.headers || {};
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("swasthyasetu_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers
    }
  });
  
  if (response.status === 401) {
    if (onUnauthorized) {
      onUnauthorized();
    } else if (typeof window !== "undefined") {
      localStorage.clear();
      window.location.reload();
    }
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  
  return response.blob();
}

/**
 * Compress a file before upload.
 *
 * Strategy:
 *  - IMAGES (JPEG/PNG/WebP/GIF/BMP): drawn onto a Canvas, resized to a max
 *    dimension of 1920 px, then re-encoded as image/jpeg at 0.85 quality.
 *    85% JPEG quality keeps all text perfectly legible for backend OCR while
 *    cutting typical file size by 40–70%.
 *  - PDFs: returned as-is. PDFs already use internal zlib/deflate compression
 *    on their content streams. Any re-encoding would change the file format
 *    and break the backend's PDF parser.
 *
 * @param {File} file - the original File object from a file input / drop zone
 * @returns {Promise<File>} - the (possibly compressed) File object
 */
export async function compressFile(file) {
  const IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
  ];

  // PDFs: return unchanged — already compressed internally with zlib streams.
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return file;
  }

  // Non-image, non-PDF: return as-is (unknown format, don't risk corruption).
  if (!IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  const MAX_DIMENSION = 1920;  // px — sufficient for any high-res lab report scan
  const JPEG_QUALITY  = 0.85;  // 85% keeps lab report text crisp for OCR

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Compute new dimensions preserving aspect ratio.
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) {
          h = Math.round((h / w) * MAX_DIMENSION);
          w = MAX_DIMENSION;
        } else {
          w = Math.round((w / h) * MAX_DIMENSION);
          h = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      // White background so transparent PNGs convert cleanly to JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Only use compressed version if it is actually smaller.
          if (blob.size >= file.size) { resolve(file); return; }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const newName  = `${baseName}_compressed.jpg`;
          resolve(new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fall back to original on decode error.
    };

    img.src = objectUrl;
  });
}
