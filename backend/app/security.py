"""
Simple OAuth2 password flow issuing JWTs for admin access.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)


def get_password_hash(password):
    return pwd_context.hash(password)


def authenticate_admin(username: str, password: str) -> Optional[dict]:
    # In-memory check for role-based credentials.
    normalized_username = username.lower().strip()
    
    # 1. Superadmin check
    if normalized_username in ["superadmin", "superadmin@hydronix.com"] and password == "superadmin":
        return {
            "username": "superadmin@hydronix.com",
            "role": "superadmin",
            "name": "Super Administrator"
        }
    
    # 2. Admin check (defaults or settings override)
    if (normalized_username in ["admin", "admin@hydronix.com"] and password == "admin") or \
       (username == settings.admin_username and password == settings.admin_password):
        return {
            "username": settings.admin_username + "@hydronix.com" if "@" not in settings.admin_username else settings.admin_username,
            "role": "admin",
            "name": "System Administrator"
        }
        
    # 3. Standard User check
    if normalized_username in ["user", "user@hydronix.com"] and password == "user":
        return {
            "username": "user@hydronix.com",
            "role": "user",
            "name": "Water Quality Viewer"
        }
        
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=settings.jwt_expiration_hours))
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded


async def get_current_admin(token: str = Depends(oauth2_scheme)):
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
    return username


async def get_current_admin_optional(token: str = Depends(oauth2_scheme)):
    # Return username or None if token missing/invalid
    try:
        return await get_current_admin(token)
    except Exception:
        return None


# Token endpoint handler to be wired into FastAPI app
async def token_endpoint(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_admin(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token({
        "username": user["username"],
        "role": user["role"]
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user["username"],
            "role": user["role"],
            "name": user["name"]
        }
    }
