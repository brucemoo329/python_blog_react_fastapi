import request from './request';

export function login(data) {
  return request.post('/login', data);
}

export function register(data) {
  return request.post('/users/', data);
}

/** 发送邮箱验证码：purpose = login | register | reset */
export function sendEmailCode(data) {
  return request.post('/auth/email/send-code', data);
}

/** 邮箱 + 验证码登录 */
export function loginWithEmailCode(data) {
  return request.post('/login/email', data);
}

/** 邮箱验证码注册 */
export function registerWithEmailCode(data) {
  return request.post('/users/email', data);
}

/** 邮箱验证码重置密码 */
export function resetPasswordWithEmail(data) {
  return request.post('/auth/email/reset-password', data);
}
