/**
 * Authentication module for client-side Tidal OAuth
 * Uses Cloudflare Worker as CORS proxy
 */

// Token storage interface
export interface TidalToken {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number; // Unix timestamp when token expires
    user_id?: number;
}

export interface DeviceAuthResponse {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
}

export interface UserInfo {
    userId: number;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
}

const TOKEN_STORAGE_KEY = 'tidal-dl-ng-token';
const USER_STORAGE_KEY = 'tidal-dl-ng-user';

// Get Worker URL from environment or default to localhost for development
function getWorkerUrl(): string {
    if (typeof window !== 'undefined') {
        // Check for environment variable (set during build)
        const envUrl = (window as any).__NEXT_PUBLIC_WORKER_URL__;
        if (envUrl) return envUrl;
    }
    // Default to localhost worker for development
    return process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
}

/**
 * Get stored token from localStorage
 */
export function getStoredToken(): TidalToken | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to get stored token:', error);
    }
    return null;
}

/**
 * Store token in localStorage
 */
export function storeToken(token: TidalToken): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
    } catch (error) {
        console.error('Failed to store token:', error);
    }
}

/**
 * Get stored user info from localStorage
 */
export function getStoredUser(): UserInfo | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(USER_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to get stored user:', error);
    }
    return null;
}

/**
 * Store user info in localStorage
 */
export function storeUser(user: UserInfo): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
        console.error('Failed to store user:', error);
    }
}

/**
 * Clear all auth data from localStorage
 */
export function clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(token: TidalToken): boolean {
    const now = Date.now();
    const expiresAt = token.expires_at * 1000; // Convert to milliseconds
    const buffer = 5 * 60 * 1000; // 5 minutes buffer
    return now >= (expiresAt - buffer);
}

/**
 * Start device authorization flow
 */
export async function startDeviceAuth(): Promise<DeviceAuthResponse> {
    const workerUrl = getWorkerUrl();

    const response = await fetch(`${workerUrl}/auth/device`, {
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error('Failed to start device authorization');
    }

    const data = await response.json();

    return {
        deviceCode: data.deviceCode,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        verificationUriComplete: data.verificationUriComplete,
        expiresIn: data.expiresIn,
        interval: data.interval,
    };
}

/**
 * Poll for authorization completion
 * Returns token if successful, null if pending, throws on error
 */
export async function pollForToken(deviceCode: string): Promise<TidalToken | null> {
    const workerUrl = getWorkerUrl();

    const response = await fetch(`${workerUrl}/auth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_code: deviceCode }),
    });

    const data = await response.json();

    // Authorization pending
    if (data.error === 'authorization_pending') {
        return null;
    }

    // Error occurred
    if (data.error) {
        throw new Error(data.error_description || data.error);
    }

    // Success - create token object
    const token: TidalToken = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        user_id: data.user?.userId,
    };

    storeToken(token);
    return token;
}

/**
 * Refresh an expired token
 */
export async function refreshToken(currentToken: TidalToken): Promise<TidalToken> {
    const workerUrl = getWorkerUrl();

    const response = await fetch(`${workerUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: currentToken.refresh_token }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    const newToken: TidalToken = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || currentToken.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        user_id: currentToken.user_id,
    };

    storeToken(newToken);
    return newToken;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidToken(): Promise<string | null> {
    let token = getStoredToken();

    if (!token) {
        return null;
    }

    if (isTokenExpired(token)) {
        try {
            token = await refreshToken(token);
        } catch (error) {
            console.error('Failed to refresh token:', error);
            clearAuth();
            return null;
        }
    }

    return token.access_token;
}

/**
 * Check if user is currently authenticated
 */
export function isAuthenticated(): boolean {
    const token = getStoredToken();
    return token !== null;
}

/**
 * Fetch user info from Tidal
 */
export async function fetchUserInfo(): Promise<UserInfo | null> {
    const token = await getValidToken();
    if (!token) return null;

    const workerUrl = getWorkerUrl();

    try {
        const response = await fetch(`${workerUrl}/api/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        const user: UserInfo = {
            userId: data.id,
            email: data.email,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            username: data.username,
        };

        storeUser(user);
        return user;
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        return null;
    }
}
