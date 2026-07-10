"""邮箱验证码服务：支持 QQ / Gmail / Outlook 等任意邮箱（通过 SMTP 投递）。

流程对齐开放平台「邮箱+验证码」思路：
1. 发送验证码 POST /auth/email/send-code
2. 登录 POST /login/email
3. 注册 POST /users/email
"""
from __future__ import annotations

import os
import random
import re
import smtplib
import ssl
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Literal, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
CODE_TTL_MINUTES = int(os.getenv("EMAIL_CODE_TTL_MINUTES", "10"))
# 冷却默认 30 秒，避免用户误点后久等；可用环境变量覆盖
SEND_COOLDOWN_SECONDS = int(os.getenv("EMAIL_SEND_COOLDOWN_SECONDS", "30"))
MAX_SENDS_PER_HOUR = int(os.getenv("EMAIL_MAX_SENDS_PER_HOUR", "20"))
MAX_VERIFY_ATTEMPTS = int(os.getenv("EMAIL_MAX_VERIFY_ATTEMPTS", "5"))

Purpose = Literal["login", "register", "reset"]


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_email_format(email: str) -> str:
    value = normalize_email(email)
    if not value or not EMAIL_RE.match(value):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    if len(value) > 120:
        raise HTTPException(status_code=400, detail="邮箱过长")
    return value


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def _dev_mode() -> bool:
    """未配置 SMTP 时允许开发调试；生产务必配置 SMTP 并将 EMAIL_DEV_MODE=0。"""
    flag = (os.getenv("EMAIL_DEV_MODE") or "").strip().lower()
    if flag in {"1", "true", "yes", "on"}:
        return True
    if flag in {"0", "false", "no", "off"}:
        return False
    return not _smtp_configured()


def generate_code(length: int = 6) -> str:
    return "".join(str(random.randint(0, 9)) for _ in range(length))


def send_email_message(to_email: str, subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = (os.getenv("SMTP_FROM") or user).strip()
    use_ssl = (os.getenv("SMTP_USE_SSL") or "").strip().lower() in {"1", "true", "yes", "on"}
    use_tls = (os.getenv("SMTP_USE_TLS") or "1").strip().lower() not in {"0", "false", "no", "off"}

    if not host or not user or not password:
        raise HTTPException(
            status_code=503,
            detail="邮件服务未配置。请在 .env 中设置 SMTP_HOST / SMTP_USER / SMTP_PASSWORD（支持 QQ/Gmail/Outlook 等）",
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    try:
        if use_ssl or port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, timeout=20, context=context) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                server.ehlo()
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                server.login(user, password)
                server.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=502, detail="邮件服务器认证失败，请检查 SMTP 账号与授权码")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"邮件发送失败：{exc}")


def _purpose_label(purpose: Purpose) -> str:
    return {"login": "登录", "register": "注册", "reset": "重置密码"}.get(purpose, "验证")


def create_and_send_code(
    db: Session,
    email: str,
    purpose: Purpose,
    client_ip: Optional[str] = None,
) -> dict:
    email = validate_email_format(email)
    now = datetime.utcnow()

    if purpose == "login":
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="该邮箱尚未注册，请先注册")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="账号已停用，请联系管理员")
    elif purpose == "register":
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            raise HTTPException(status_code=409, detail="该邮箱已注册，请直接登录")
    elif purpose == "reset":
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="该邮箱尚未注册")

    recent = (
        db.query(models.EmailVerificationCode)
        .filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.purpose == purpose,
            models.EmailVerificationCode.created_at >= now - timedelta(seconds=SEND_COOLDOWN_SECONDS),
        )
        .order_by(models.EmailVerificationCode.created_at.desc())
        .first()
    )
    if recent and recent.created_at:
        created = recent.created_at
        if created.tzinfo is not None:
            created = created.replace(tzinfo=None)
        elapsed = (now - created).total_seconds()
        wait = max(1, int(SEND_COOLDOWN_SECONDS - elapsed))
        raise HTTPException(
            status_code=429,
            detail=f"发送过于频繁，请 {wait} 秒后再试",
            headers={"Retry-After": str(wait)},
        )

    hour_count = (
        db.query(models.EmailVerificationCode)
        .filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.created_at >= now - timedelta(hours=1),
        )
        .count()
    )
    if hour_count >= MAX_SENDS_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"该邮箱一小时内验证码次数过多（最多 {MAX_SENDS_PER_HOUR} 次），请稍后再试",
        )

    code = generate_code(6)
    subject = f"【校园集市】{_purpose_label(purpose)}验证码"
    body = (
        f"你好，\n\n"
        f"你正在进行校园集市账号{_purpose_label(purpose)}。\n"
        f"验证码：{code}\n"
        f"有效期 {CODE_TTL_MINUTES} 分钟，请勿泄露给他人。\n\n"
        f"若非本人操作，请忽略本邮件。\n"
        f"— 校园交易平台\n"
    )

    response = {
        "message": f"验证码已发送至 {email}",
        "email": email,
        "purpose": purpose,
        "expires_in": CODE_TTL_MINUTES * 60,
        "cooldown": SEND_COOLDOWN_SECONDS,
    }

    # 先发信成功再落库，避免 SMTP 失败也占用冷却名额
    try:
        if _dev_mode() and not _smtp_configured():
            print(f"[EMAIL_DEV] {purpose} code for {email}: {code}")
            response["message"] = "开发模式：验证码已生成（未配置 SMTP，不会真实发信）"
            response["dev_code"] = code
        elif _dev_mode() and _smtp_configured():
            send_email_message(email, subject, body)
            response["dev_code"] = code
        else:
            send_email_message(email, subject, body)
    except HTTPException:
        raise

    row = models.EmailVerificationCode(
        email=email,
        code=code,
        purpose=purpose,
        expires_at=now + timedelta(minutes=CODE_TTL_MINUTES),
        used=False,
        attempts=0,
        client_ip=(client_ip or "")[:64] or None,
    )
    db.add(row)
    db.commit()
    return response


def consume_code(db: Session, email: str, code: str, purpose: Purpose) -> models.EmailVerificationCode:
    email = validate_email_format(email)
    code = (code or "").strip()
    if not code or len(code) < 4:
        raise HTTPException(status_code=400, detail="请输入邮箱验证码")

    now = datetime.utcnow()
    row = (
        db.query(models.EmailVerificationCode)
        .filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.purpose == purpose,
            models.EmailVerificationCode.used.is_(False),
            models.EmailVerificationCode.expires_at >= now,
        )
        .order_by(models.EmailVerificationCode.created_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=400, detail="验证码无效或已过期，请重新获取")

    if (row.attempts or 0) >= MAX_VERIFY_ATTEMPTS:
        row.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="验证码错误次数过多，请重新获取")

    if row.code != code:
        row.attempts = (row.attempts or 0) + 1
        db.commit()
        left = max(0, MAX_VERIFY_ATTEMPTS - row.attempts)
        raise HTTPException(status_code=400, detail=f"验证码错误，还可尝试 {left} 次")

    row.used = True
    db.commit()
    return row
