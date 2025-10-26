import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>; // void에서 boolean으로 변경
}

// 기본값으로 컨텍스트 생성
export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  loading: true,
  login: async () => false,
  register: async () => false,
  logout: async () => false, // {}에서 false로 변경
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 저장된 사용자 정보 확인 (앱 시작 시)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('인증 확인 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 로그인 함수
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('로그인 오류:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 함수
  const register = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await authService.register(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('회원가입 오류:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      
      // 상태 초기화
      setUser(null);
      setIsAuthenticated(false);
      
      // 네비게이션 리디렉션은 이 함수를 호출하는 컴포넌트에서 처리해야 합니다
      // 로그아웃 성공 여부를 반환하여 컴포넌트에서 처리할 수 있게 합니다
      return true;
    } catch (error) {
      console.error('로그아웃 오류:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};