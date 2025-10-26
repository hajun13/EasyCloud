// src/config/serverConfig.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 웹 환경에서는 localStorage를, 네이티브 환경에서는 AsyncStorage를 사용
const getStorageItem = async (key) => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  } else {
    return await AsyncStorage.getItem(key);
  }
};

export const ServerConfig = {
  // 로컬 서버 주소 (로그인 등 인증용)
  authServer: process.env.REACT_APP_AUTH_SERVER || 'http://localhost:8000',
  
  // 기본 라즈베리파이 서버 주소 (실제 연결 시 덮어씌워짐)
  defaultDeviceServer: process.env.REACT_APP_DEVICE_SERVER || 'http://localhost:8000',
  
  // 서버 탐색 설정
  useServerDiscovery: process.env.REACT_APP_USE_SERVER_DISCOVERY === 'true',
  discoveryPortStart: parseInt(process.env.REACT_APP_DISCOVERY_PORT_START || '8000'),
  discoveryPortEnd: parseInt(process.env.REACT_APP_DISCOVERY_PORT_END || '8010'),
  
  // 서버 타입에 따라 URL 결정 (async 메서드)
  getServerUrlAsync: async (serverType) => {
    switch(serverType) {
      case 'auth':
        return ServerConfig.authServer;
      case 'device':
        // 저장된 장치 정보가 있으면 사용, 없으면 기본값
        try {
          const deviceInfo = await getStorageItem('deviceInfo');
          if (deviceInfo) {
            const parsedInfo = JSON.parse(deviceInfo);
            return `http://${parsedInfo.local_ip}:${parsedInfo.port || 8000}`;
          }
        } catch (e) {
          console.error('기기 정보 파싱 오류:', e);
        }
        return ServerConfig.defaultDeviceServer;
      default:
        return ServerConfig.authServer;
    }
  },
  
  // 동기 버전 (이전 코드와 호환성 유지)
  getServerUrl: (serverType) => {
    switch(serverType) {
      case 'auth':
        return ServerConfig.authServer;
      case 'device':
        // 저장된 장치 정보가 있으면 사용, 없으면 기본값
        if (typeof window !== 'undefined' && window.localStorage) {
          const deviceInfo = localStorage.getItem('deviceInfo');
          if (deviceInfo) {
            try {
              const parsedInfo = JSON.parse(deviceInfo);
              return `http://${parsedInfo.local_ip}:${parsedInfo.port || 8000}`;
            } catch (e) {
              console.error('기기 정보 파싱 오류:', e);
            }
          }
        }
        return ServerConfig.defaultDeviceServer;
      default:
        return ServerConfig.authServer;
    }
  },
  
  // 서버 탐색 기능 - 동일 네트워크 상의 EasyCloud 서버를 찾는 기능
  discoverServer: async (timeoutMs = 5000) => {
    if (!ServerConfig.useServerDiscovery) {
      console.log('서버 탐색 기능이 비활성화되어 있습니다.');
      return null;
    }
    
    console.log('서버 탐색 시작...');
    
    // 로컬 네트워크 IP 범위 추정 (기본 게이트웨이 기반)
    let baseIp = null;
    const deviceInfo = await getStorageItem('deviceInfo');
    
    if (deviceInfo) {
      try {
        const parsedInfo = JSON.parse(deviceInfo);
        const ipParts = parsedInfo.local_ip.split('.');
        if (ipParts.length === 4) {
          baseIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
        }
      } catch (e) {
        console.error('IP 추출 오류:', e);
      }
    }
    
    // 기본 IP 범위
    const defaultNetworks = [
      '192.168.1', '192.168.0', '10.0.0', '10.0.1'
    ];
    
    // 기본 네트워크 목록에 현재 네트워크 추가
    if (baseIp && !defaultNetworks.includes(baseIp)) {
      defaultNetworks.unshift(baseIp);
    }
    
    // 여러 IP 주소에 대해 병렬로 ping 테스트
    const pingPromises = [];
    for (const network of defaultNetworks) {
      // 해당 네트워크의 기기만 검색 (1~20 범위)
      for (let i = 1; i <= 20; i++) {
        const ip = `${network}.${i}`;
        for (let port = ServerConfig.discoveryPortStart; port <= ServerConfig.discoveryPortEnd; port++) {
          pingPromises.push(ServerConfig.pingServer(ip, port));
        }
      }
    }
    
    // 타임아웃 추가
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ success: false, reason: 'timeout' }), timeoutMs);
    });
    
    // 첫 번째 응답 성공한 서버 반환
    try {
      const results = await Promise.all([...pingPromises, timeoutPromise]);
      const successfulPings = results.filter(result => result.success);
      
      if (successfulPings.length > 0) {
        console.log(`서버 탐색 완료: ${successfulPings.length}개 발견`);
        return successfulPings[0].url; // 첫 번째 발견된 서버 반환
      }
      
      console.log('사용 가능한 서버를 찾을 수 없습니다.');
      return null;
    } catch (error) {
      console.error('서버 탐색 중 오류 발생:', error);
      return null;
    }
  },
  
  // 단일 서버 ping 테스트
  pingServer: async (ip, port) => {
    const url = `http://${ip}:${port}/status`;
    try {
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 1000 // 1초 타임아웃
      });
      
      if (response.ok) {
        const data = await response.json();
        // EasyCloud 서버 확인 (status 응답에 'easycloud' 필드가 있는지)
        if (data && data.easycloud) {
          console.log(`서버 발견: ${url}`);
          return { success: true, url, data };
        }
      }
      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }
};