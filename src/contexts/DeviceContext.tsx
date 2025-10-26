import React, { createContext, useState, useEffect } from 'react';
import deviceService from '../services/deviceService';
import { loadDeviceURL } from '../utils/apiClient';
import { getSecureData } from '../utils/storage';
import { Platform, Alert } from 'react-native';

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

interface DeviceStatus {
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

interface DeviceContextType {
  isDeviceConnected: boolean;
  isWifiConfigured: boolean;
  deviceInfo: DeviceInfo | null;
  deviceStatus: DeviceStatus | null;
  loading: boolean;
  connectDevice: (qrData: any) => Promise<boolean>;
  setupWifi: (ssid: string, password: string) => Promise<boolean>;
  disconnectDevice: () => Promise<void>;
  refreshDeviceStatus: () => Promise<void>;
}

// 기본값으로 컨텍스트 생성
export const DeviceContext = createContext<DeviceContextType>({
  isDeviceConnected: false,
  isWifiConfigured: false,
  deviceInfo: null,
  deviceStatus: null,
  loading: true,
  connectDevice: async () => false,
  setupWifi: async () => false,
  disconnectDevice: async () => {},
  refreshDeviceStatus: async () => {},
});

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [isWifiConfigured, setIsWifiConfigured] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // 저장된 기기 정보 불러오기 (앱 시작 시)
  useEffect(() => {
    const loadDeviceInfo = async () => {
      try {
        // 웹에서 새로고침 시 홈 화면으로 바로 이동하기 위한 플래그 확인
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const directToHome = localStorage.getItem('directToHome');
          if (directToHome === 'true') {
            console.log('💭 새로고침 후 홈 화면으로 직접 접근 플래그 발견');
            // 추후 사용을 위해 플래그 유지
            // localStorage.removeItem('directToHome'); // 사용 후 삭제 여부 결정
            setIsDeviceConnected(true); // 홈 화면으로 이동하게 함
          }
        }

        // 저장된 디바이스 URL 로드
        const deviceUrl = await loadDeviceURL();
        if (!deviceUrl) {
          setLoading(false);
          return;
        }
        
        // 저장된 기기 정보 로드
        const savedDeviceInfo = await deviceService.getSavedDeviceInfo();
        if (!savedDeviceInfo) {
          setLoading(false);
          return;
        }
        
        // WiFi 설정 상태 확인
        try {
          // 웹 환경이라면 localStorage 확인
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const wifiConfigured = localStorage.getItem('wifiConfigured');
            setIsWifiConfigured(wifiConfigured === 'true');
          } else {
            // 네이티브 환경이라면 AsyncStorage 확인 로직 추가 필요
            const wifiConfigured = await getSecureData('wifiConfigured');
            setIsWifiConfigured(wifiConfigured === 'true');
          }
        } catch (error) {
          console.log('WiFi 설정 상태 확인 오류:', error);
          // 오류 발생 시 기본값으로 false 설정
          setIsWifiConfigured(false);
        }
        
        // 기기 연결 확인 및 상태 업데이트
        try {
          // 기기 정보 조회
          const deviceInfo = await deviceService.getDeviceInfo();
          setDeviceInfo(deviceInfo);
          
          // 기기 상태 조회
          const deviceStatus = await deviceService.getDeviceStatus();
          setDeviceStatus(deviceStatus);
          
          setIsDeviceConnected(true);
        } catch (error) {
          console.error('기기 연결 확인 오류:', error);
        }
      } catch (error) {
        console.error('기기 정보 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDeviceInfo();
  }, []);

  // QR 코드로 기기 연결
// src/contexts/DeviceContext.tsx의 connectDevice 함수
  const connectDevice = async (qrData: any) => {
    console.log("🔄 connectDevice 함수 시작:", qrData);
    setLoading(true);
    try {
      // 로컬 상태 업데이트 (메모리 내)
      setDeviceInfo(qrData);
      setIsDeviceConnected(true);
      
      // 브라우저 환경에서는 localStorage 사용
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          // 기기 정보를 JSON 문자열로 변환하여 저장
          localStorage.setItem('deviceInfo', JSON.stringify(qrData));
          console.log("✅ localStorage에 기기 정보 저장 완료");
          
          // API 기본 URL 설정
          const baseUrl = `http://${qrData.local_ip}:${qrData.port || 5000}`;
          localStorage.setItem('deviceURL', baseUrl);
          console.log("✅ localStorage에 기기 URL 저장 완료");
        } catch (storageError) {
          console.error("❌ localStorage 저장 오류:", storageError);
        }
      } else {
        console.log("⚠️ localStorage를 사용할 수 없는 환경입니다");
      }
      
      console.log("✅ connectDevice 성공 반환");
      return true;
    } catch (error) {
      console.error("❌ connectDevice 오류:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // WiFi 설정
  const setupWifi = async (ssid: string, password: string) => {
    setLoading(true);
    try {
      const response = await deviceService.setupWifi({ ssid, password });
      
      // WiFi 설정 성공 시 상태 저장
      if (response && response.success) {
        // isWifiConfigured 상태 업데이트
        setIsWifiConfigured(true);
        
        // 웹 환경이라면 localStorage에 저장
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          localStorage.setItem('wifiConfigured', 'true');
        } else {
          // 네이티브 환경이라면 AsyncStorage에 저장
          await storeData('wifiConfigured', 'true');
        }
      }
      
      return true;
    } catch (error) {
      console.error('WiFi 설정 오류:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 기기 연결 해제
  const disconnectDevice = async () => {
    setLoading(true);
    try {
      // 로컬 스토리지에서 기기 정보 삭제
      await Promise.all([
        localStorage.removeItem('deviceInfo'),
        localStorage.removeItem('deviceURL')
      ]);
      
      setDeviceInfo(null);
      setDeviceStatus(null);
      setIsDeviceConnected(false);
    } catch (error) {
      console.error('기기 연결 해제 오류:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 기기 상태 새로고침
  const refreshDeviceStatus = async () => {
    if (!isDeviceConnected) return;
    
    try {
      const status = await deviceService.getDeviceStatus();
      setDeviceStatus(status);
    } catch (error) {
      console.error('기기 상태 새로고침 오류:', error);
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        isDeviceConnected,
        isWifiConfigured,
        deviceInfo,
        deviceStatus,
        loading,
        connectDevice,
        setupWifi,
        disconnectDevice,
        refreshDeviceStatus
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};