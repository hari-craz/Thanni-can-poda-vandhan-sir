"""
Simple OAuth2 password flow issuing JWTs for admin access.
"""
import time
import json
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from passlib.context import CryptContext
from .config import settings
from sqlalchemy.orm import Session
from .database import get_db, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


# Global in-memory fallback for live user sessions
_MEM_ACTIVE_USERS = {}  # email -> {email, name, role, last_active}


def track_active_user(email: str, name: str, role: str):
    """Register user session with Redis (TTL 45s) or in-memory fallback."""
    from .main import cache
    now_ts = time.time()
    user_info = {
        "email": email,
        "name": name,
        "role": role,
        "last_active": now_ts
    }
    if cache.client:
        try:
            key = f"active_user:{email}"
            cache.client.set(key, json.dumps(user_info), ex=45)
            return
        except Exception:
            pass
    _MEM_ACTIVE_USERS[email] = user_info


def get_active_users() -> list:
    """Fetch all active user sessions from Redis or in-memory fallback."""
    from .main import cache
    now_ts = time.time()
    if cache.client:
        try:
            keys = cache.client.keys("active_user:*")
            users = []
            for k in keys:
                val = cache.client.get(k)
                if val:
                    if isinstance(val, bytes):
                        val = val.decode('utf-8')
                    users.append(json.loads(val))
            return users
        except Exception:
            pass
    
    # In-memory fallback cleanup and retrieval
    expired = [email for email, info in _MEM_ACTIVE_USERS.items() if now_ts - info["last_active"] > 45]
    for email in expired:
        _MEM_ACTIVE_USERS.pop(email, None)
    return list(_MEM_ACTIVE_USERS.values())


def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)


def get_password_hash(password):
    return pwd_context.hash(password)


def authenticate_admin(db: Session, username: str, password: str) -> Optional[User]:
    # Query user from database
    user = db.query(User).filter(User.email == username.lower().strip()).first()
    if user and verify_password(password, user.hashed_password):
        return user
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=settings.jwt_expiration_hours))
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded


async def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("username")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    if role not in ["superadmin", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to administrators"
        )

    # Track activity
    try:
        user = db.query(User).filter(User.email == username.lower().strip()).first()
        name = user.name if (user and user.name) else username
        track_active_user(username, name, role)
    except Exception:
        pass

    return username


async def get_current_superadmin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("username")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    if role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to super-administrators only"
        )

    # Track activity
    try:
        user = db.query(User).filter(User.email == username.lower().strip()).first()
        name = user.name if (user and user.name) else username
        track_active_user(username, name, role)
    except Exception:
        pass

    return username


async def get_current_admin_optional(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Return username or None if token missing/invalid
    try:
        return await get_current_admin(token, db)
    except Exception:
        return None



# Token endpoint handler to be wired into FastAPI app
async def token_endpoint(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_admin(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token({
        "username": user.email,
        "role": user.role
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user.email,
            "role": user.role,
            "name": user.name or user.email
        }
    }
