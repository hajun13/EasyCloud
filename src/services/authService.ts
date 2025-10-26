import apiClient from '../utils/apiClient';
import endpoints from '../constants/apiEndpoints';
import { storeSecureData, getSecureData, removeSecureData } from '../utils/storage';
import axios from 'axios';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

const authService = {
  // 로그인
    // authService.ts의 login 함수 수정
  login: async (email: string, password: string) => {
    try {
      console.log('🔄 로그인 시도:', { email });
      console.log('🌐 로그인 요청 URL:', apiClient.defaults.baseURL + '/auth/token');

      // 요청 데이터 로깅 (비밀번호는 마스킹)
      const requestData = { email, password };
      console.log('📤 요청 데이터:', { email, password: '********' });

      const response = await apiClient.post('/auth/token', requestData);
      
      console.log('✅ 로그인 성공:', {
        status: response.status,
        hasToken: !!response.data.token,
        hasUser: !!response.data.user
      });
      
      // 토큰 및 사용자 정보 저장
      await storeSecureData('userToken', response.data.token);
      await storeSecureData('userData', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error) {
      console.error('❌ 로그인 오류:', error);
      
      // 오류 상세 정보 확인
      if (axios.isAxiosError(error) && error.response) {
        console.error('🔍 서버 응답 오류 데이터:', error.response.data);
      }
      
      throw error;
    }
  },
  
  // 회원가입
  register: async (email: string, password: string) => {
    try {
      const response = await apiClient.post<LoginResponse>(endpoints.auth.register, {
        email,
        password
      });
      
      // 토큰 및 사용자 정보 저장
      await storeSecureData('userToken', response.data.token);
      await storeSecureData('userData', JSON.stringify(response.data.user));
      
      return response.data;
    } catch (error) {
      console.error('회원가입 오류:', error);
      throw error;
    }
  },
  
  // 로그아웃
  logout: async () => {
    try {
      // 현재 빈 문자열로 설정하는 대신 완전히 삭제하도록 변경
      await Promise.all([
        removeSecureData('userToken'),
        removeSecureData('userData')
      ]);
      
      // 서버에 로그아웃 요청 추가 (선택적)
      // 서버에 로그아웃 API 엔드포인트가 있는 경우
      // try {
      //   await apiClient.post(endpoints.auth.logout);
      // } catch (logoutError) {
      //   console.warn('서버 로그아웃 오류:', logoutError);
      //   // 로컬 로그아웃은 계속 진행
      // }
      
      return true;
    } catch (error) {
      console.error('로그아웃 오류:', error);
      throw error;
    }
  },
  
  // 현재 사용자 정보 가져오기
  getCurrentUser: async () => {
    try {
      const userData = await getSecureData('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
      return null;
    }
  }
};

export default authService;