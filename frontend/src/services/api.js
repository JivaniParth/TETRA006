const API_BASE = "https://badge-cosmetics-showers-clicks.trycloudflare.com";

export async function apiCall(endpoint, options = {}, onUnauthorized = null) {
  const headers = options.headers || {};
  
  // Retrieve token dynamically from localStorage in the browser
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("medguard_token");
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
    const token = localStorage.getItem("medguard_token");
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
