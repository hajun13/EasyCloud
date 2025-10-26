import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ServerConfig } from '../config/serverConfig';

// 웹 환경에서는 localStorage를, 네이티브 환경에서는 AsyncStorage를 사용
const getStorageItem = async (key: string) => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    return await AsyncStorage.getItem(key);
  }
};

const setStorageItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
};

// API 클라이언트 생성 (초기값은 로컬 로그인 서버 URL)
const apiClient = axios.create({
  baseURL: ServerConfig.authServer,  // 환경 설정에서 가져온 값 사용
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 현재 연결 모드 추적 (로컬 또는 기기)
let currentMode = 'local';
let connectionRetryCount = 0;
const MAX_RETRY_COUNT = 3;

// 요청 인터셉터 - 토큰 추가 및 로깅
apiClient.interceptors.request.use(
  async (config) => {
    // 요청 경로에 따라 서버 결정
    if (config.url && (config.url.includes('/auth/') || config.url.includes('/login') || config.url.includes('/token'))) {
      // 인증 서버 사용
      const authUrl = await ServerConfig.getServerUrlAsync('auth');
      config.baseURL = authUrl;
      currentMode = 'auth';
    } else if (config.url && (config.url.includes('/device/') || config.url.includes('/file/'))) {
      // 기기 서버 사용
      const deviceUrl = await ServerConfig.getServerUrlAsync('device');
      config.baseURL = deviceUrl;
      currentMode = 'device';
    }
    
    // 디버깅용 로그
    console.log(`🔄 API 요청 (${currentMode} 모드): ${config.method?.toUpperCase()} ${config.url}`);
    console.log(`🌐 현재 baseURL: ${config.baseURL || apiClient.defaults.baseURL}`);
    console.log(`🔍 요청 헤더:`, config.headers);
    
    if (config.data) {
      console.log(`📬 요청 데이터:`, config.data);
    };
    
    // 토큰 추가
    let token = null;
    try {
      token = await getStorageItem('userToken');
    } catch (error) {
      console.error("토큰 조회 오류:", error);
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 연결 오류 처리 및 재시도
apiClient.interceptors.response.use(
  (response) => {
    // 성공적인 응답은 그대로 전달
    connectionRetryCount = 0; // 성공 시 재시도 카운트 초기화
    return response;
  },
  async (error) => {
    // 네트워크 오류 또는 서버 오류인 경우
    if (
      !error.response || 
      error.code === 'ECONNREFUSED' || 
      error.code === 'ECONNABORTED' || 
      error.code === 'ETIMEDOUT'
    ) {
      const originalRequest = error.config;
      
      // 기기 모드에서 오류 발생 시 서버 탐색 시도
      if (currentMode === 'device' && connectionRetryCount < MAX_RETRY_COUNT) {
        connectionRetryCount++;
        console.log(`⚠️ 기기 연결 실패 (${connectionRetryCount}/${MAX_RETRY_COUNT}): 서버 재탐색 시도 중...`);
        
        try {
          // 서버 자동 탐색 시도
          const discoveredUrl = await ServerConfig.discoverServer();
          
          if (discoveredUrl) {
            console.log(`✅ 새 서버 발견: ${discoveredUrl}`);
            
            // 새 기기 정보 저장
            const ipPortMatch = discoveredUrl.match(/http:\/\/([^:]+):(\d+)/);
            
            if (ipPortMatch && ipPortMatch.length >= 3) {
              const ip = ipPortMatch[1];
              const port = ipPortMatch[2];
              
              // 기존 deviceInfo 가져오기
              const existingInfoStr = await getStorageItem('deviceInfo');
              const updatedInfo = existingInfoStr 
                ? JSON.parse(existingInfoStr) 
                : { name: 'Discovered Device' };
              
              // IP 및 포트 업데이트
              updatedInfo.local_ip = ip;
              updatedInfo.port = port;
              
              // 업데이트된 정보 저장
              await setStorageItem('deviceInfo', JSON.stringify(updatedInfo));
              await saveDeviceURL(discoveredUrl);
              
              // 원래 요청 재시도 (baseURL 업데이트)
              originalRequest.baseURL = discoveredUrl;
              return axios(originalRequest);
            }
          }
        } catch (discoveryError) {
          console.error('서버 재탐색 중 오류 발생:', discoveryError);
        }
      }
      
      // 모든 재시도 실패 또는 인증 서버 연결 실패
      console.error(`❌ 서버 연결 실패 (${currentMode} 모드):`, error.message);
      
      // 로컬 모드로 폴백 (기기 모드 실패 시)
      if (currentMode === 'device') {
        console.log('⚠️ 로컬 모드로 전환 시도...');
        originalRequest.baseURL = ServerConfig.authServer;
        try {
          return await axios(originalRequest);
        } catch (fallbackError) {
          console.error('❌ 로컬 모드 폴백 실패:', fallbackError.message);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// baseURL 설정 함수
export const setBaseURL = (url: string, mode = 'device') => {
  apiClient.defaults.baseURL = url;
  currentMode = mode;
  console.log(`🔧 API baseURL 설정 (${mode} 모드):`, url);
};

// 기기 연결 후 URL 저장 및 모드 변경
export const saveDeviceURL = async (url: string) => {
  console.log(`🔄 기기 URL 저장 시도: ${url}`);
  try {
    await setStorageItem('deviceURL', url);
    apiClient.defaults.baseURL = url; // apiClient의 baseURL 직접 변경
    currentMode = 'device';
    connectionRetryCount = 0; // 재시도 카운트 초기화
    console.log(`✅ API baseURL 업데이트 (device 모드): ${url}`);
    return url;
  } catch (error) {
    console.error('❌ 기기 URL 저장 오류:', error);
    throw error;
  }
};

// 저장된 기기 URL 불러오기
export const loadDeviceURL = async () => {
  try {
    const url = await getStorageItem('deviceURL');
    if (url) {
      setBaseURL(url, 'device');
      console.log(`🔄 저장된 기기 URL 로드: ${url}`);
      return url;
    }
    console.log('⚠️ 저장된 기기 URL 없음');
    return null;
  } catch (error) {
    console.error('❌ 기기 URL 로드 오류:', error);
    return null;
  }
};

// 기기 상태 확인을 위한 특수 함수
export const checkDeviceConnection = async () => {
  try {
    const deviceInfoStr = await getStorageItem('deviceInfo');
    if (!deviceInfoStr) {
      console.log('⚠️ 기기 정보 없음 - 연결 확인 불가');
      return false;
    }

    const deviceInfo = JSON.parse(deviceInfoStr);
    const testUrl = `http://${deviceInfo.local_ip}:${deviceInfo.port || 8000}/status`;
    
    console.log(`🔄 기기 연결 테스트: ${testUrl}`);
    const response = await axios.get(testUrl, { timeout: 5000 });
    
    console.log('✅ 기기 연결 테스트 성공:', response.data);
    return true;
  } catch (error) {
    console.error('❌ 기기 연결 테스트 실패:', error);
    
    // 연결 실패 시 서버 탐색 시도
    try {
      console.log('🔍 서버 자동 탐색 시도 중...');
      const discoveredUrl = await ServerConfig.discoverServer();
      
      if (discoveredUrl) {
        console.log(`✅ 새 서버 발견: ${discoveredUrl}`);
        // 새 정보로 업데이트 및 즉시 테스트
        const ipPortMatch = discoveredUrl.match(/http:\/\/([^:]+):(\d+)/);
        
        if (ipPortMatch && ipPortMatch.length >= 3) {
          const ip = ipPortMatch[1];
          const port = ipPortMatch[2];
          
          // 기존 deviceInfo 가져오기
          const deviceInfo = deviceInfoStr ? JSON.parse(deviceInfoStr) : {};
          
          // IP 및 포트 업데이트
          deviceInfo.local_ip = ip;
          deviceInfo.port = port;
          
          // 업데이트된 정보 저장
          await setStorageItem('deviceInfo', JSON.stringify(deviceInfo));
          await saveDeviceURL(discoveredUrl);
          
          // 새 연결 즉시 테스트
          const newTestUrl = `${discoveredUrl}/status`;
          const testResponse = await axios.get(newTestUrl, { timeout: 5000 });
          
          if (testResponse.status === 200) {
            console.log('✅ 새 기기 연결 테스트 성공');
            return true;
          }
        }
      }
    } catch (discoveryError) {
      console.error('❌ 자동 서버 탐색 실패:', discoveryError);
    }
    
    return false;
  }
};

// WiFi 설정용 특수 함수 - 기기 IP를 직접 지정하여 요청
export const requestWithDeviceIP = async (method: string, url: string, data: any = null) => {
  try {
    // 기기 정보 가져오기
    let deviceInfo = null;
    const deviceInfoStr = await getStorageItem('deviceInfo');
    
    if (deviceInfoStr) {
      deviceInfo = JSON.parse(deviceInfoStr);
    }
    
    if (!deviceInfo || !deviceInfo.local_ip) {
      throw new Error('유효한 기기 정보가 없습니다');
    }
    
    // 기기 IP로 완전한 URL 구성
    const fullUrl = `http://${deviceInfo.local_ip}:${deviceInfo.port || 8000}${url}`;
    console.log(`🌐 직접 기기 요청: ${method.toUpperCase()} ${fullUrl}`);
    
    // axios로 직접 요청 (baseURL 사용하지 않음)
    const config = {
      method,
      url: fullUrl,
      data: method.toLowerCase() !== 'get' ? data : undefined,
      params: method.toLowerCase() === 'get' ? data : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000
    };
    
    const response = await axios(config);
    console.log(`✅ 직접 기기 요청 성공:`, {
      status: response.status,
      url: fullUrl
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ 기기 직접 요청 오류:', error);
    
    // 연결 실패 시 서버 탐색 시도 (재귀적으로 호출하지 않도록 주의)
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      try {
        await checkDeviceConnection(); // 연결 확인 및 새 서버 탐색
        // 다시 한 번만 시도 (무한 루프 방지)
        return await requestWithDeviceIP(method, url, data);
      } catch (retryError) {
        console.error('❌ 자동 재시도 실패');
      }
    }
    
    throw error;
  }
};

// 열거형 세션 ID로 서버 연결 시도 (강제 IP 재탐색용)
export const forceDiscoverServer = async () => {
  console.log('🔍 서버 강제 재탐색 시작...');
  connectionRetryCount = 0;
  
  try {
    const discoveredUrl = await ServerConfig.discoverServer(10000); // 10초 타임아웃
    
    if (discoveredUrl) {
      console.log(`✅ 새 서버 발견: ${discoveredUrl}`);
      
      // 새 기기 정보 저장
      const ipPortMatch = discoveredUrl.match(/http:\/\/([^:]+):(\d+)/);
      
      if (ipPortMatch && ipPortMatch.length >= 3) {
        const ip = ipPortMatch[1];
        const port = ipPortMatch[2];
        
        // 기존 deviceInfo 가져오기
        const existingInfoStr = await getStorageItem('deviceInfo');
        const updatedInfo = existingInfoStr 
          ? JSON.parse(existingInfoStr) 
          : { name: 'Discovered Device' };
        
        // IP 및 포트 업데이트
        updatedInfo.local_ip = ip;
        updatedInfo.port = port;
        
        // 업데이트된 정보 저장
        await setStorageItem('deviceInfo', JSON.stringify(updatedInfo));
        await saveDeviceURL(discoveredUrl);
        
        return { success: true, url: discoveredUrl };
      }
    }
    
    console.log('❌ 서버를 찾을 수 없습니다');
    return { success: false, error: '서버를 찾을 수 없습니다' };
  } catch (error) {
    console.error('❌ 서버 탐색 오류:', error);
    return { success: false, error: error.message };
  }
};

export default apiClient;