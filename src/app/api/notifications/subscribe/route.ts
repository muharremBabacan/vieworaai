import { NextResponse } from 'next/server';

/**
 * Proxy POST requests to the Notification Server's subscribe endpoint.
 */
export async function POST(request: Request) {
  const SERVER_URL = process.env.NOTIFICATION_SERVER_URL || 'http://localhost:3001';
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${SERVER_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error subscribing to topic:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
