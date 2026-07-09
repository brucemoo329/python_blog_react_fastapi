import request from './request'

export function getMarketplaceFeed(params) {
  return request.get('/marketplace/feed', { params })
}

export function getMarketplaceSummary() {
  return request.get('/marketplace/summary')
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

export function toggleFavorite(listingId) {
  return request.post('/marketplace/favorites', { listing_id: listingId })
}

export function acceptServiceTask(taskId) {
  return request.post(`/marketplace/tasks/${taskId}/accept`)
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

export function toggleReaction(data) {
  return request.post('/marketplace/reactions', data)
}

export function shareContent(data) {
  return request.post('/marketplace/shares', data)
}

export function deleteContent(type, id) {
  return request.delete(`/marketplace/content/${type}/${id}`)
}
