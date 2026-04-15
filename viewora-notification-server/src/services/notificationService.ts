import { messaging } from '../firebase';
import admin from 'firebase-admin';

type MulticastMessage = admin.messaging.MulticastMessage;

interface UserTokenMap {
  [userId: string]: Set<string>;
}

class NotificationService {
  private userTokens: UserTokenMap = {};
  private lastNotified: Map<string, number> = new Map(); // Simple dedup

  // 1. Token Yönetimi
  saveToken(userId: string, token: string): void {
    if (!this.userTokens[userId]) {
      this.userTokens[userId] = new Set();
    }
    this.userTokens[userId].add(token);
    console.log(`[Token Saved] User: ${userId}, Total Tokens: ${this.userTokens[userId].size}`);
  }

  getUserTokens(userId: string): string[] {
    return Array.from(this.userTokens[userId] || []);
  }

  getAllTokens(): UserTokenMap {
    return this.userTokens;
  }

  // 2. Topic Sistemi
  async subscribeToTopic(token: string, topic: string): Promise<void> {
    try {
      await messaging.subscribeToTopic(token, topic);
      console.log(`[Substribed] Token subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`[Error] Subscription failed for topic ${topic}:`, error);
    }
  }

  async sendToTopic(topic: string, title: string, body: string): Promise<void> {
    const message = {
      notification: { title, body },
      topic: topic,
    };

    try {
      const response = await messaging.send(message);
      console.log(`[Broadcast Success] Sent to topic ${topic}:`, response);
    } catch (error) {
      console.error(`[Error] Broadcast failed for topic ${topic}:`, error);
    }
  }

  // 3. User Bazlı Gönderim (Multi-device support)
  async sendToUser(userId: string, title: string, body: string): Promise<void> {
    const tokens = this.getUserTokens(userId);
    if (tokens.length === 0) return;

    // Basic Dedup (Anti-spam)
    const dedupKey = `${userId}:${title}`;
    const now = Date.now();
    if (this.lastNotified.has(dedupKey) && (now - (this.lastNotified.get(dedupKey) || 0) < 5000)) {
        console.log(`[Dedup] Skipping spam for user ${userId}`);
        return;
    }
    this.lastNotified.set(dedupKey, now);

    const message: MulticastMessage = {
      notification: { title, body },
      tokens: tokens,
    };

    try {
      // messaging.sendEachForMulticast is available in latest SDK
      const response = await messaging.sendEachForMulticast(message);
      
      // Geçersiz token temizliği
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success && (resp.error?.code === 'messaging/invalid-registration-token' || resp.error?.code === 'messaging/registration-token-not-registered')) {
            const invalidToken = tokens[idx];
            this.userTokens[userId].delete(invalidToken);
            console.warn(`[Cleanup] Removed invalid token for user ${userId}`);
          }
        });
      }
      console.log(`[Send Success] Sent to user ${userId} (${response.successCount} successful)`);
    } catch (error) {
      console.error(`[Error] Send to user ${userId} failed:`, error);
    }
  }

  // 4. Event-Driven Fonksiyonlar
  async notifyExhibitionResult(userId: string, accepted: boolean): Promise<void> {
    const title = accepted ? "Tebrikler! 🎉" : "Sergi Sonucu";
    const body = accepted 
      ? "Fotoğrafın sergiye kabul edildi! Hemen detaylara göz at." 
      : "Fotoğrafın bu sergi için uygun görülmedi. Yeni yarışmalara katılmayı unutma!";
    
    await this.sendToUser(userId, title, body);
  }

  async notifyNewCompetition(): Promise<void> {
    const title = "Yeni Yarışma Başladı! 🏆";
    const body = "Haftanın yeni konusu belli oldu. İlk sen keşfet ve katıl!";
    await this.sendToTopic('competitions', title, body);
  }

  async notifyGroupPost(groupId: string, message: string): Promise<void> {
    const title = "Grupta Yeni Paylaşım";
    const body = `Üyesi olduğun grupta yeni bir fotoğraf paylaşıldı: ${message.substring(0, 30)}...`;
    await this.sendToTopic(`group_${groupId}`, title, body);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
