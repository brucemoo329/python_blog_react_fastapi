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
