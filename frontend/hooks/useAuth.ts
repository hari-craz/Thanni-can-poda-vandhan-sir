import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export const useAuth = () => {
  const auth = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Check if token exists in localStorage on mount
    const token = localStorage.getItem('auth_token');
    if (!token && auth.isAuthenticated) {
      router.push('/login');
    }
  }, []);

  return auth;
};
