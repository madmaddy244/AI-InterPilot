export async function apiRequest(baseUrl, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 45000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.detail || `Backend returned HTTP ${response.status}.`);
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The backend request timed out.');
    if (error instanceof TypeError) {
      throw new Error(`Could not reach ${baseUrl}. Start the FastAPI backend locally.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
