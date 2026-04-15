import { notificationService } from './notificationService';

class ExhibitionService {
  async approvePhoto(userId: string, photoId: string): Promise<void> {
    // 1. DB Update logic (MOCK)
    console.log(`[Exhibition] Photo Approved: ${photoId} for user ${userId}`);

    // 2. Event-Driven Notification
    await notificationService.notifyExhibitionResult(userId, true);
  }

  async rejectPhoto(userId: string, photoId: string): Promise<void> {
    // 1. DB Update (MOCK)
    console.log(`[Exhibition] Photo Rejected: ${photoId} for user ${userId}`);

    // 2. Notification
    await notificationService.notifyExhibitionResult(userId, false);
  }

  async startNewCompetition(): Promise<void> {
    // 1. Competition Creation (MOCK)
    console.log(`[Competition] New round started.`);

    // 2. Broadcast to all
    await notificationService.notifyNewCompetition();
  }
}

export const exhibitionService = new ExhibitionService();
export default exhibitionService;
