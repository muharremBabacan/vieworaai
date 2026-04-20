import { NextResponse } from 'next/server';

/**
 * Proxy POST requests to the Notification Server's save-token endpoint.
 * This handles CORS and keeps the external server URL private in the backend.
 */
export async function POST(request: Request) {
  const SERVER_URL = process.env.NOTIFICATION_SERVER_URL || 'https://localhost:3001';
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${SERVER_URL}/api/save-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error saving token:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
