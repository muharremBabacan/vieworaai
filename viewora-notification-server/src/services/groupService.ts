import { notificationService } from './notificationService';

class GroupService {
  async userSharedPhoto(userId: string, groupId: string, photoId: string): Promise<void> {
    // 1. Photo Share Logic (MOCK)
    console.log(`[Group] User ${userId} shared photo ${photoId} in group ${groupId}`);

    // 2. Notify all group members (Topic-based)
    await notificationService.notifyGroupPost(groupId, "User shared a photo");
  }

  async userSubscribedToGroup(userId: string, groupId: string, token: string): Promise<void> {
    // 1. DB logic (MOCK)
    console.log(`[Group] User ${userId} subscribed (Topic: group_${groupId})`);

    // 2. Subscribe Token to topic
    await notificationService.subscribeToTopic(token, `group_${groupId}`);
  }
}

export const groupService = new GroupService();
export default groupService;
