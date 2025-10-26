import apiClient from '../utils/apiClient';
import endpoints from '../constants/apiEndpoints';
import { storeData, getData } from '../utils/storage';
import { saveDeviceURL, setBaseURL } from '../utils/apiClient';
import { Platform } from 'react-native';
import { requestWithDeviceIP } from '../utils/apiClient';

interface DeviceInfo {
  device_id: string;
  local_ip: string;
  port: number;
  stun_info?: {
    nat_type: string;
    external_ip: string;
    external_port: number;
  };
}

interface PairDeviceParams {
  user_id: string;
  device_id: string;
}

interface WifiSetupParams {
  ssid: string;
  password: string;
}

interface WiFiSetupResult {
  success: boolean;
  message?: string;
  target_ssid?: string;
  previous_ssid?: string;
  steps?: string[];
  error?: string;
  timedOut?: boolean;
  data?: any;
}

interface WiFiSetupStatusResponse {
  success: boolean;
  ssid?: string;
  connected_ssid?: string;
  steps?: string[];
  timestamp?: number;
  current_wifi?: {
    connected: boolean;
    ssid: string | null;
    ip_address: string | null;
  };
}

interface DeviceStatusResponse {
  storage: {
    total: number;
    used: number;
    free: number;
  };
  cpu: number;
  memory: {
    total: number;
    used: number;
    free: number;
  };
}

interface WifiNetwork {
  ssid: string;
  signal_strength: number | null;
  security: string;
  channel: number | null;
  mac_address: string | null;
}

interface WifiScanResponse {
  success: boolean;
  networks?: WifiNetwork[];
  message?: string;
}

const deviceService = {
  // 기기 정보 조회
  getDeviceInfo: async () => {
    try {
      console.log('📡 기기 정보 요청 시작');
      const response = await apiClient.get<DeviceInfo>(endpoints.device.info);
      console.log('✅ 기기 정보 응답:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ 기기 정보 조회 오류:', error);
      return null;
    }
  },

  pairDevice: async (params: PairDeviceParams) => {
    try {
      const response = await apiClient.post(endpoints.device.pair, params);
      return response.data;
    } catch (error) {
      console.error('기기 페어링 오류:', error);
      return { success: false, error: 'connection_failed' };
    }
  },

  scanWifiNetworks: async () => {
    try {
      console.log('📡 주변 WiFi 네트워크 스캔 요청');

      // 저장된 기기 정보에서 local_ip와 port 추출
      let deviceInfo = null;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const raw = localStorage.getItem('deviceInfo');
        if (raw) deviceInfo = JSON.parse(raw);
      } else {
        deviceInfo = await getData('deviceInfo');
      }

      if (!deviceInfo || !deviceInfo.local_ip || !deviceInfo.port) {
        throw new Error('유효한 기기 정보가 없습니다');
      }

      const url = `http://${deviceInfo.local_ip}:${deviceInfo.port}/device/wifi-scan`;
      const response = await apiClient.get<WifiScanResponse>(url);
      console.log('✅ WiFi 스캔 결과:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ WiFi 스캔 오류:', error);
      return {
        success: false,
        message: '네트워크 스캔 중 오류가 발생했습니다',
        networks: []
      };
    }
  },

  // WiFi 설정 함수 - 비동기 타임아웃 처리 개선
  setupWifi: async (params: WifiSetupParams): Promise<WiFiSetupResult> => {
    try {
      console.log('📡 WiFi 설정 요청:', { ssid: params.ssid, password: params.password ? '********' : '' });
      
      // 타임아웃 설정을 위한 Promise.race 사용
      const setupPromise = requestWithDeviceIP('post', '/device/wifi-setup', params);
      
      // 타임아웃과 실제 요청 중 먼저 완료되는 것 사용
      const response = await Promise.race([
        setupPromise,
        // 15초 후 자동 성공으로 간주 (비동기 처리 전제)
        new Promise<any>((resolve) => setTimeout(() => resolve({
          success: true,
          message: `${params.ssid} 네트워크 설정이 진행 중입니다. 기기가 재연결되는 동안 잠시 기다려주세요.`,
          target_ssid: params.ssid,
          timedOut: true // 타임아웃 발생 표시
        }), 10000)) // 10초 타임아웃
      ]);
      
      // 타임아웃 발생 시
      if (response.timedOut) {
        console.log('WiFi 설정 요청 타임아웃 (정상 - 비동기 처리 중)');
        
        // 5초 후에 상태 확인 시도 (백그라운드)
        setTimeout(async () => {
          try {
            // 새 연결 확인
            const statusResponse = await deviceService.checkWiFiSetupStatus();
            console.log('WiFi 설정 상태 확인 결과:', statusResponse);
          } catch (error) {
            console.warn('WiFi 설정 상태 확인 실패 (정상 - 아직 재연결 중일 수 있음):', error);
          }
        }, 5000);
      }
      
      console.log('✅ WiFi 설정 서버 응답:', response);
      
      // 응답 구조 확인 및 유효성 검사
      if (!response) {
        console.error('❌ 서버 응답이 비어있습니다');
        return { success: false, error: 'empty_response' };
      }
      
      // 서버 응답에서 success 필드 확인
      if (response.success === true) {
        return { success: true, ...response };
      } else {
        console.error('❌ 서버에서 실패 응답:', response.message || 'Unknown error');
        return { 
          success: false, 
          error: response.message || 'server_failed',
          ...response
        };
      }
    } catch (error) {
      console.error('❌ WiFi 설정 오류:', error);
      
      // 네트워크 변경 중 연결 끊김 오류일 가능성이 높음
      if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
        return {
          success: true, // 일단 성공으로 처리 (비동기 처리 중)
          message: `${params.ssid} 네트워크 설정이 진행 중입니다. 연결이 재설정되는 동안 잠시 기다려주세요.`,
          steps: ["WiFi 설정 요청이 전송되었습니다", "연결 변경 중 네트워크가 재설정됩니다", "잠시 후 새 네트워크에 연결됩니다"]
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'connection_failed' 
      };
    }
  },
  
  // WiFi 설정 상태 확인 함수
  checkWiFiSetupStatus: async (): Promise<WiFiSetupStatusResponse> => {
    try {
      const result = await requestWithDeviceIP('get', '/device/wifi-setup-status');
      console.log('📡 WiFi 설정 상태:', result);
      return result;
    } catch (error) {
      console.error('❌ WiFi 설정 상태 확인 오류:', error);
      throw error;
    }
  },

  getDeviceStatus: async () => {
    try {
      const response = await apiClient.get<DeviceStatusResponse>(endpoints.device.status);
      return response.data;
    } catch (error) {
      console.error('기기 상태 조회 오류:', error);
      return null;
    }
  },

  connectDeviceWithQR: async (qrData: any) => {
    try {
      console.log('🔍 QR 데이터 분석:', qrData);
      
      // P2P 연결 방식 확인
      if (qrData.signaling_url && qrData.device_id) {
        console.log('📟 P2P 모드로 연결 시도:', qrData.signaling_url);
        // TODO: P2P 연결 로직 구현 예정
        
        // QR 데이터 저장 (P2P 정보 포함)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          localStorage.setItem('deviceInfo', JSON.stringify(qrData));
          console.log('💾 웹 로컬 스토리지에 P2P 기기 정보 저장됨');
        }
        await storeData('deviceInfo', qrData);
        
        // 일단은 기존 방식으로 연결 시도
        if (qrData.local_ip) {
          const baseUrl = `http://${qrData.local_ip}:${qrData.port || 8000}`;
          console.log('🌐 로컬 연결 시도 (임시 방법):', baseUrl);
          
          await saveDeviceURL(baseUrl);
          setBaseURL(baseUrl);
        }
        
        return true;
      } else {
        // 직접 연결 (기존 방식)
        const baseUrl = `http://${qrData.local_ip}:${qrData.port || 8000}`;
        console.log('🌐 직접 HTTP 연결 시도:', baseUrl);
        
        // 테스트 연결 시도
        try {
          console.log('💡 연결 테스트 시도 중...');
          // 비동기 테스트 연결 - 실패해도 계속 진행
          fetch(`${baseUrl}/status`, { mode: 'no-cors' })
            .then(() => console.log('✅ 서버 응답 확인'))
            .catch(err => console.warn('⚠️ 테스트 연결 실패 (무시하고 계속):', err));
        } catch (testError) {
          console.warn('⚠️ 연결 테스트 오류 (무시하고 계속):', testError);
          // 계속 진행
        }
        
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          localStorage.setItem('deviceInfo', JSON.stringify(qrData));
          console.log('💾 웹 로컬 스토리지에 기기 정보 저장됨');
        }

        await storeData('deviceInfo', qrData);
        await saveDeviceURL(baseUrl);
        setBaseURL(baseUrl);
        console.log('📟 API 기본 URL 설정:', baseUrl);

        try {
          const deviceInfo = await deviceService.getDeviceInfo();
          console.log('📥 [connectDeviceWithQR] 기기 정보:', deviceInfo);
          return deviceInfo !== null;
        } catch (testError) {
          console.error('📟 테스트 요청 실패:', testError);
          return true; // 에러가 발생해도 성공으로 처리 (사용자 경험 향상)
        }
      }
    } catch (error) {
      console.error('❌ [connectDeviceWithQR] 기기 연결 오류:', error);
      return false;
    }
  },

  getSavedDeviceInfo: async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const webStoredInfo = localStorage.getItem('deviceInfo');
        if (webStoredInfo) {
          const parsedInfo = JSON.parse(webStoredInfo);
          console.log('💾 웹 로컬 스토리지에서 기기 정보 로드됨:', parsedInfo);
          return parsedInfo;
        }
      }

      const deviceInfo = await getData('deviceInfo');
      if (deviceInfo) {
        console.log('💾 저장소에서 기기 정보 로드됨:', deviceInfo);
      }
      return deviceInfo;
    } catch (error) {
      console.error('저장된 기기 정보 조회 오류:', error);
      return null;
    }
  }
};

export default deviceService;
