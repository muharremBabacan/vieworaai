const NOTIFICATION_SERVER_URL = process.env.NEXT_PUBLIC_NOTIFICATION_SERVER_URL || 'http://localhost:3001';

export class NotificationAPI {
  /**
   * Cihaz token'ını sunucuya kaydeder.
   */
  static async saveToken(userId: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/save-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.warn('[NotificationAPI] Notification Server is unreachable. Connection failed.');
      return false;
    }
  }

  /**
   * Konu (Topic) aboneliği yapar.
   */
  static async subscribeToTopic(token: string, topic: string): Promise<boolean> {
    try {
      const response = await fetch(`${NOTIFICATION_SERVER_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, topic }),
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.warn('[NotificationAPI] Notification Server is unreachable. Connection failed.');
      return false;
    }
  }

  /**
   * [TEST] Moderasyon sonucunu tetikle.
   */
  static async triggerModerationEvent(userId: string, photoId: string): Promise<void> {
    try {
      await fetch(`${NOTIFICATION_SERVER_URL}/api/test/approve-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, photoId }),
      });
    } catch (error) {
      console.warn('[NotificationAPI] Notification Server is unreachable. Connection failed.');
    }
  }

  /**
   * [TEST] Yeni yarışma tetikle.
   */
  static async triggerNewCompetitionEvent(): Promise<void> {
    try {
      await fetch(`${NOTIFICATION_SERVER_URL}/api/test/new-competition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.warn('[NotificationAPI] Notification Server is unreachable. Connection failed.');
    }
  }

  /**
   * [TEST] Yeni ders tetikle.
   */
  static async triggerNewLessonEvent(count: number): Promise<void> {
    try {
      await fetch(`${NOTIFICATION_SERVER_URL}/api/test/new-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
    } catch (error) {
      console.warn('[NotificationAPI] Notification Server is unreachable. Connection failed.');
    }
  }

  /**
   * [TEST] Admin mesajı gönder.
   */
  static async triggerAdminMessage(userId: string, title: string, body: string): Promise<void> {
    try {
      await fetch(`${NOTIFICATION_SERVER_URL}/api/test/admin-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body }),
      });
    } catch (error) {
      console.warn('[NotificationAPI] Notification Server is unreachable. Connection failed.');
    }
  }
}
