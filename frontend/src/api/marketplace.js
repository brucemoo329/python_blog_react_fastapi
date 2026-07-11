import request from './request'

export function getInboxUnread() {
  return request.get('/marketplace/inbox/unread')
}

export function getMarketplaceSummary(params = {}) {
  return request.get('/marketplace/summary', { params, timeout: 15000 })
}

export function getMarketplaceFeed(params) {
  return request.get('/marketplace/feed', { params, timeout: 20000 })
}

export function getMapTasks() {
  return request.get('/marketplace/map/tasks')
}

export function createListing(data) {
  return request.post('/marketplace/listings', data)
}

export function createServiceTask(data) {
  return request.post('/marketplace/tasks', data)
}

export function createCommunityPost(data) {
  return request.post('/marketplace/community', data)
}

export function createWantedPost(data) {
  return request.post('/marketplace/wanted', data)
}

export function toggleFavorite(type, id) {
  if (id === undefined) {
    return request.post('/marketplace/favorites', { target_type: 'listing', target_id: type })
  }
  return request.post('/marketplace/favorites', { target_type: type, target_id: id })
}

export function acceptServiceTask(taskId, data = {}) {
  return request.post(`/marketplace/tasks/${taskId}/accept`, data)
}

export function getActiveErrands() {
  return request.get('/marketplace/tasks/active')
}

export function getTaskTracking(taskId) {
  return request.get(`/marketplace/tasks/${taskId}/tracking`)
}

export function updateTaskRunnerLocation(taskId, data) {
  return request.post(`/marketplace/tasks/${taskId}/location`, data)
}

export function markTaskPickedUp(taskId, data = null) {
  return request.post(`/marketplace/tasks/${taskId}/picked-up`, data)
}

export function completeServiceTask(taskId, data = null) {
  return request.post(`/marketplace/tasks/${taskId}/complete`, data)
}

export function updateTaskDesiredTime(taskId, desired_delivery_at) {
  return request.patch(`/marketplace/tasks/${taskId}/desired-time`, { desired_delivery_at })
}

export function complainLateTask(taskId) {
  return request.post(`/marketplace/tasks/${taskId}/late-complaint`)
}

export function updateTaskTravelMode(taskId, data) {
  return request.post(`/marketplace/tasks/${taskId}/travel-mode`, data)
}

export function getUserProfile() {
  return request.get('/marketplace/profile')
}

export function updateUserProfile(data) {
  return request.put('/marketplace/profile', data)
}

export function checkInProfile() {
  return request.post('/marketplace/profile/check-in')
}

export function updateAccountSecurity(data) {
  return request.put('/marketplace/profile/security', data)
}

export function createUserAddress(data) {
  return request.post('/marketplace/profile/addresses', data)
}

export function createPaymentMethod(data) {
  return request.post('/marketplace/profile/payment-methods', data)
}

export function recordBrowsingHistory(data) {
  return request.post('/marketplace/profile/history', data)
}

export function getContentDetail(type, id) {
  return request.get(`/marketplace/detail/${type}/${id}`)
}

export function createComment(data) {
  return request.post('/marketplace/comments', data)
}

export function deleteComment(commentId) {
  return request.delete(`/marketplace/comments/${commentId}`)
}

export function toggleReaction(data) {
  return request.post('/marketplace/reactions', data)
}

export function shareContent(data) {
  return request.post('/marketplace/shares', data)
}

export function deleteContent(type, id) {
  return request.delete(`/marketplace/content/${type}/${id}`)
}

export function toggleFollow(userId) {
  return request.post(`/marketplace/relationships/follow/${userId}`)
}

export function toggleUserModeration(action, userId) {
  return request.post(`/marketplace/relationships/${action}/${userId}`)
}

export function reportTarget(data) {
  return request.post('/marketplace/reports', data)
}

export function getNotifications() {
  return request.get('/marketplace/notifications')
}

export function markNotificationRead(notificationId) {
  return request.post(`/marketplace/notifications/${notificationId}/read`)
}

export function markAllNotificationsRead() {
  return request.post('/marketplace/notifications/read-all')
}

export function getPublicUserProfile(userId) {
  return request.get(`/marketplace/users/${userId}`)
}

export function startConversation(data) {
  return request.post('/marketplace/conversations/start', data)
}

export function getConversations() {
  return request.get('/marketplace/conversations', { params: { limit: 40 } })
}

export function getConversationMessages(conversationId) {
  return request.get(`/marketplace/conversations/${conversationId}/messages`, {
    params: { limit: 100 },
    timeout: 20000,
  })
}

export function sendConversationMessage(conversationId, data) {
  // Images as base64 can be large — allow longer timeout than default 10s
  return request.post(`/marketplace/conversations/${conversationId}/messages`, data, {
    timeout: 60000,
  })
}

export function toggleMessageReaction(messageId, emoji) {
  return request.post(`/marketplace/messages/${messageId}/reactions`, { emoji })
}

export function createListingOrder(listingId, data = {}) {
  return request.post(`/marketplace/orders/listing/${listingId}`, data)
}

export function getMyOrders(params) {
  return request.get('/marketplace/orders', { params })
}

export function getOrderDetail(orderId) {
  return request.get(`/marketplace/orders/${orderId}`)
}

export function payOrder(orderId, data = {}) {
  return request.post(`/marketplace/orders/${orderId}/pay`, data)
}

export function shipOrder(orderId, data = {}) {
  return request.post(`/marketplace/orders/${orderId}/ship`, data)
}

export function receiveOrder(orderId) {
  return request.post(`/marketplace/orders/${orderId}/receive`)
}

export function cancelOrder(orderId, reason = '双方协商取消') {
  return request.post(`/marketplace/orders/${orderId}/cancel`, { reason }, { params: { reason } })
}

export function reviewOrder(orderId, data) {
  return request.post(`/marketplace/orders/${orderId}/review`, data)
}

export function skipOrderReview(orderId) {
  return request.post(`/marketplace/orders/${orderId}/skip-review`)
}

export function deleteOrderRecord(orderId) {
  return request.post(`/marketplace/orders/${orderId}/delete-record`)
}

export function appealOrder(orderId, data) {
  return request.post(`/marketplace/orders/${orderId}/appeal`, data)
}

export function applyAfterSale(orderId, data) {
  return request.post(`/marketplace/orders/${orderId}/after-sales`, data)
}

export function respondAfterSale(orderId, data) {
  return request.post(`/marketplace/orders/${orderId}/after-sales/respond`, data)
}

export function createSupportTicket(data) {
  return request.post('/marketplace/support/tickets', data)
}

export function getMySupportTickets() {
  return request.get('/marketplace/support/tickets')
}

export function clearConversationMessages(conversationId) {
  return request.delete(`/marketplace/conversations/${conversationId}/messages`)
}

export function deleteConversation(conversationId) {
  return request.delete(`/marketplace/conversations/${conversationId}`)
}

export function deleteNotification(notificationId) {
  return request.delete(`/marketplace/notifications/${notificationId}`)
}

export function clearAllNotifications() {
  return request.delete('/marketplace/notifications')
}

export function getUserShopItems(userId) {
  return request.get(`/marketplace/users/${userId}/shop-items`)
}

export function getAdminOverview() {
  return request.get('/marketplace/admin/overview')
}

export function getAdminContents(params) {
  return request.get('/marketplace/admin/contents', { params })
}

export function updateAdminContent(type, id, data) {
  return request.put(`/marketplace/admin/contents/${type}/${id}`, data)
}

export function deleteAdminContent(type, id) {
  return request.delete(`/marketplace/admin/contents/${type}/${id}`)
}

export function getAdminReports(params) {
  return request.get('/marketplace/admin/reports', { params })
}

export function handleAdminReport(reportId, data) {
  return request.post(`/marketplace/admin/reports/${reportId}/handle`, data)
}

export function getAdminUsers(params) {
  return request.get('/marketplace/admin/users', { params })
}

export function updateAdminUserPenalties(userId, data) {
  return request.put(`/marketplace/admin/users/${userId}/penalties`, data)
}

export function deleteAdminUser(userId) {
  return request.delete(`/marketplace/admin/users/${userId}`)
}

/** Permanently scrub soft-deleted user from admin list (keeps comment FKs). */
export function purgeAdminUserRecord(userId) {
  return request.delete(`/marketplace/admin/users/${userId}/record`)
}

export function getAdminAfterSales(params) {
  return request.get('/marketplace/admin/after-sales', { params })
}

export function handleAdminAfterSale(requestId, data) {
  return request.post(`/marketplace/admin/after-sales/${requestId}/handle`, data)
}

export function sendOfficialNotice(data) {
  return request.post('/marketplace/admin/notices', data)
}

export function getAdminAppeals(params) {
  return request.get('/marketplace/admin/appeals', { params })
}

export function handleAdminAppeal(appealId, data) {
  return request.post(`/marketplace/admin/appeals/${appealId}/handle`, data)
}

export function getAdminSupportTickets(params) {
  return request.get('/marketplace/admin/support-tickets', { params })
}

export function handleAdminSupportTicket(ticketId, data) {
  return request.post(`/marketplace/admin/support-tickets/${ticketId}/handle`, data)
}
