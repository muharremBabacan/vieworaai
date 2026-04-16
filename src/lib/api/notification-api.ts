// 🔔 Use Internal Proxy (root-level /api)
const NOTIFICATION_SERVER_URL = '';

const buildUrl = (path: string) => {
  return path;
};

const safeFetch = async (url: string | null, options: RequestInit) => {
  if (!url) {
    console.warn('[NotificationAPI] Skipped request: URL not defined');
    return null;
  }

  try {
    const response = await fetch(url, options);

    // 🛡️ response kontrolü
    if (!response.ok) {
      console.warn('[NotificationAPI] Non-200 response:', response.status);
      return null;
    }

    // JSON parse güvenli
    try {
      return await response.json();
    } catch {
      return null;
    }

  } catch (error) {
    console.warn('[NotificationAPI] Server unreachable:', url);
    return null;
  }
};

export class NotificationAPI {

  static async saveToken(userId: string, token: string): Promise<boolean> {
    if (!NOTIFICATION_SERVER_URL) return false;
    const data = await safeFetch(
      buildUrl('/api/save-token'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
      }
    );

    return !!data?.success;
  }

  static async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    if (!NOTIFICATION_SERVER_URL) return false;
    const data = await safeFetch(
      buildUrl('/api/subscribe'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, topic }),
      }
    );

    return !!data?.success;
  }

  static async triggerModerationEvent(userId: string, photoId: string): Promise<void> {
    await safeFetch(
      buildUrl('/api/test/approve-photo'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, photoId }),
      }
    );
  }

  static async triggerNewCompetitionEvent(): Promise<void> {
    await safeFetch(
      buildUrl('/api/test/new-competition'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  static async triggerNewLessonEvent(count: number): Promise<void> {
    await safeFetch(
      buildUrl('/api/test/new-lesson'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      }
    );
  }

  static async triggerAdminMessage(userId: string, title: string, body: string): Promise<void> {
    await safeFetch(
      buildUrl('/api/test/admin-message'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body }),
      }
    );
  }
}