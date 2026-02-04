/**
 * Tidal API Proxy Worker
 * 
 * This Cloudflare Worker handles:
 * 1. CORS - Allows browser requests to Tidal API
 * 2. OAuth Device Flow - Proxies auth requests
 * 3. API Proxying - Forwards authenticated requests to Tidal
 */

export interface Env {
    ALLOWED_ORIGINS: string;
    TIDAL_CLIENT_ID: string;
    TIDAL_CLIENT_SECRET: string;
    // SESSIONS: KVNamespace; // Optional: for server-side session storage
}

// Tidal API constants
const TIDAL_AUTH_URL = 'https://auth.tidal.com/v1/oauth2';
const TIDAL_API_URL = 'https://api.tidal.com/v1';

// Helper to add CORS headers
function corsHeaders(origin: string, env: Env): HeadersInit {
    // Default to localhost if ALLOWED_ORIGINS is not set
    const allowedOrigins = (env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

// Handle preflight requests
function handleOptions(request: Request, env: Env): Response {
    const origin = request.headers.get('Origin') || '';
    return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
    });
}

// Device Authorization - Step 1: Get device code
async function handleDeviceAuth(env: Env, origin: string): Promise<Response> {
    const response = await fetch(`${TIDAL_AUTH_URL}/device_authorization`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: env.TIDAL_CLIENT_ID,
            scope: 'r_usr w_usr',
        }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
        },
    });
}

// Device Authorization - Step 2: Poll for token
async function handleTokenPoll(request: Request, env: Env, origin: string): Promise<Response> {
    const body = await request.json() as { device_code: string };

    const response = await fetch(`${TIDAL_AUTH_URL}/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: 'fX2JxdmntZWK0ixT',
            client_secret: '1Nn9AfDAjxrgJFJbKNWLeAyKGVGGmINuXPPLHVXAvxAg=',
            device_code: body.device_code,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            scope: 'r_usr w_usr',
        }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
        },
    });
}

// Refresh token
async function handleTokenRefresh(request: Request, env: Env, origin: string): Promise<Response> {
    const body = await request.json() as { refresh_token: string };

    const response = await fetch(`${TIDAL_AUTH_URL}/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: env.TIDAL_CLIENT_ID,
            client_secret: env.TIDAL_CLIENT_SECRET,
            refresh_token: body.refresh_token,
            grant_type: 'refresh_token',
        }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
        },
    });
}

// Proxy API requests to Tidal
async function handleApiProxy(request: Request, env: Env, origin: string, pathname: string): Promise<Response> {
    const url = new URL(request.url);
    const tidalUrl = `${TIDAL_API_URL}${pathname}${url.search}`;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    // Forward authorization header if present
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    const response = await fetch(tidalUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' ? await request.text() : undefined,
    });

    const data = await response.text();

    return new Response(data, {
        status: response.status,
        headers: {
            ...corsHeaders(origin, env),
            'Content-Type': response.headers.get('Content-Type') || 'application/json',
        },
    });
}

// Get stream URL for a track
async function handleStreamUrl(request: Request, env: Env, origin: string): Promise<Response> {
    const url = new URL(request.url);
    const trackId = url.searchParams.get('trackId');
    const quality = url.searchParams.get('quality') || 'LOSSLESS';
    const authHeader = request.headers.get('Authorization');

    if (!trackId || !authHeader) {
        return new Response(JSON.stringify({ error: 'Missing trackId or authorization' }), {
            status: 400,
            headers: {
                ...corsHeaders(origin, env),
                'Content-Type': 'application/json',
            },
        });
    }

    // Get playback info from Tidal
    const playbackUrl = `${TIDAL_API_URL}/tracks/${trackId}/playbackinfopostpaywall?audioquality=${quality}&playbackmode=STREAM&assetpresentation=FULL`;

    const response = await fetch(playbackUrl, {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
            ...corsHeaders(origin, env),
            'Content-Type': 'application/json',
        },
    });
}

// Main request handler
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleOptions(request, env);
        }

        // Route requests
        const pathname = url.pathname;

        try {
            // Health check
            if (pathname === '/health') {
                return new Response(JSON.stringify({ status: 'ok' }), {
                    headers: {
                        ...corsHeaders(origin, env),
                        'Content-Type': 'application/json',
                    },
                });
            }

            // Debug Environment
            if (pathname === '/debug-env') {
                const clientId = env.TIDAL_CLIENT_ID;
                const secret = env.TIDAL_CLIENT_SECRET;
                return new Response(JSON.stringify({
                    clientId: clientId,
                    secretLength: secret ? secret.length : 0,
                    secretStart: secret ? secret.substring(0, 5) : 'null',
                    secretEnd: secret ? secret.substring(secret.length - 5) : 'null',
                    secretB64: secret ? btoa(secret) : 'null', // safety check if it handles binary? no it's string.
                    allowedOrigins: env.ALLOWED_ORIGINS
                }), {
                    headers: {
                        ...corsHeaders(origin, env),
                        'Content-Type': 'application/json',
                    },
                });
            }

            // Auth endpoints
            if (pathname === '/auth/device') {
                return handleDeviceAuth(env, origin);
            }

            if (pathname === '/auth/token') {
                return handleTokenPoll(request, env, origin);
            }

            if (pathname === '/auth/refresh') {
                return handleTokenRefresh(request, env, origin);
            }

            // Stream URL endpoint
            if (pathname === '/stream') {
                return handleStreamUrl(request, env, origin);
            }

            // Cover art proxy endpoint
            if (pathname === '/cover') {
                const coverId = url.searchParams.get('id');
                const size = url.searchParams.get('size') || '640';

                if (!coverId) {
                    return new Response(JSON.stringify({ error: 'Missing cover id' }), {
                        status: 400,
                        headers: {
                            ...corsHeaders(origin, env),
                            'Content-Type': 'application/json',
                        },
                    });
                }

                const formattedId = coverId.replace(/-/g, '/');
                const coverUrl = `https://resources.tidal.com/images/${formattedId}/${size}x${size}.jpg`;

                const coverResponse = await fetch(coverUrl);

                if (!coverResponse.ok) {
                    return new Response(JSON.stringify({ error: 'Failed to fetch cover' }), {
                        status: coverResponse.status,
                        headers: {
                            ...corsHeaders(origin, env),
                            'Content-Type': 'application/json',
                        },
                    });
                }

                return new Response(coverResponse.body, {
                    headers: {
                        ...corsHeaders(origin, env),
                        'Content-Type': 'image/jpeg',
                        'Cache-Control': 'public, max-age=86400',
                    },
                });
            }

            // Proxy all other /api/* requests to Tidal
            if (pathname.startsWith('/api/')) {
                const tidalPath = pathname.replace('/api', '');
                return handleApiProxy(request, env, origin, tidalPath);
            }

            // 404 for unknown routes
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: {
                    ...corsHeaders(origin, env),
                    'Content-Type': 'application/json',
                },
            });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: {
                    ...corsHeaders(origin, env),
                    'Content-Type': 'application/json',
                },
            });
        }
    },
};
