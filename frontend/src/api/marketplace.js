import request from './request'

export function getMarketplaceFeed(params) {
  return request.get('/api/marketplace/feed', { params })
}

export function getMarketplaceSummary() {
  return request.get('/api/marketplace/summary')
}

export function getMapTasks() {
  return request.get('/api/marketplace/map/tasks')
}

export function createListing(data) {
  return request.post('/api/marketplace/listings', data)
}

export function createServiceTask(data) {
  return request.post('/api/marketplace/tasks', data)
}

export function createCommunityPost(data) {
  return request.post('/api/marketplace/community', data)
}

export function createWantedPost(data) {
  return request.post('/api/marketplace/wanted', data)
}

export function toggleFavorite(listingId) {
  return request.post('/api/marketplace/favorites', { listing_id: listingId })
}

export function acceptServiceTask(taskId) {
  return request.post(`/api/marketplace/tasks/${taskId}/accept`)
}
