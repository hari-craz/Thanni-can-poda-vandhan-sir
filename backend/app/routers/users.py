from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db, User, AuditLog
from ..schemas import UserCreate, UserResponse, UserBase
from ..security import get_current_admin, get_password_hash

router = APIRouter(prefix="/users", tags=["users"])

# Dependency to check if the current user is a superadmin
async def get_current_superadmin(current_user_email: str = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == current_user_email).first()
    if not user or user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to super-administrators."
        )
    return user

@router.get("", response_model=List[UserResponse])
async def list_users(
    superadmin: User = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """List all user accounts. Accessible to superadmins only."""
    return db.query(User).order_by(User.id).all()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    superadmin: User = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Create a new user account. Restricted to superadmin."""
    # Check if user already exists
    existing = db.query(User).filter(User.email == user_in.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists."
        )
    
    # Hash password
    hashed_password = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hashed_password,
        role=user_in.role,
        name=user_in.name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Log audit entry
    audit_entry = AuditLog(
        user_id=superadmin.email,
        action="create_user",
        resource_type="user",
        resource_id=new_user.email,
        details={"name": new_user.name, "role": new_user.role}
    )
    db.add(audit_entry)
    db.commit()
    
    return new_user

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserBase,
    superadmin: User = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Update user profile details or role. Restricted to superadmin."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    # Do not allow modifying the primary superadmin email/role
    if user.email == superadmin.email and user_in.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot downgrade your own superadmin role."
        )
    
    old_role = user.role
    user.email = user_in.email.lower().strip()
    user.name = user_in.name
    user.role = user_in.role
    db.commit()
    db.refresh(user)
    
    # Log audit entry
    audit_entry = AuditLog(
        user_id=superadmin.email,
        action="update_user",
        resource_type="user",
        resource_id=user.email,
        details={"old_role": old_role, "new_role": user.role}
    )
    db.add(audit_entry)
    db.commit()
    
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    superadmin: User = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Delete a user account. Restricted to superadmin."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    # Prevent self-deletion
    if user.email == superadmin.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account."
        )
    
    email = user.email
    db.delete(user)
    db.commit()
    
    # Log audit entry
    audit_entry = AuditLog(
        user_id=superadmin.email,
        action="delete_user",
        resource_type="user",
        resource_id=email,
        details={}
    )
    db.add(audit_entry)
    db.commit()

@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    user_id: int,
    password_data: dict,  # Expecting {"password": "new_password"}
    superadmin: User = Depends(get_current_superadmin),
    db: Session = Depends(get_db)
):
    """Reset a user's password. Restricted to superadmin."""
    new_password = password_data.get("password")
    if not new_password or len(new_password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters."
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    # Log audit entry
    audit_entry = AuditLog(
        user_id=superadmin.email,
        action="reset_password",
        resource_type="user",
        resource_id=user.email,
        details={}
    )
    db.add(audit_entry)
    db.commit()
    
    return {"message": "Password reset successfully."}
