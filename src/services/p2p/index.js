/**
 * P2P 서비스 모듈 인덱스 - 플랫폼별 구현 스위치
 */
import { Platform } from 'react-native';
import fileManager from './FileManager';

// 플랫폼별로 적절한 모듈 가져오기 - 정적 import 방식
let p2pServiceModule, p2pEventsExport;

if (Platform.OS === 'web') {
  try {
    // 웹 환경용 모듈
    const webModule = require('./P2PService.web');
    p2pServiceModule = webModule.default;
    p2pEventsExport = webModule.p2pEvents;
  } catch (e) {
    console.error('Failed to load web P2P module:', e);
    // 폴백: 더미 구현
    p2pServiceModule = createDummyImplementation();
    p2pEventsExport = createDummyEventEmitter();
  }
} else {
  try {
    // 네이티브 환경용 모듈
    const nativeModule = require('./P2PService.native');
    p2pServiceModule = nativeModule.default;
    p2pEventsExport = nativeModule.p2pEvents;
  } catch (e) {
    console.error('Failed to load native P2P module:', e);
    // 폴백: 더미 구현
    p2pServiceModule = createDummyImplementation();
    p2pEventsExport = createDummyEventEmitter();
  }
}

// 더미 이벤트 이미터 생성
function createDummyEventEmitter() {
  return {
    on: () => {},
    once: () => {},
    emit: () => {},
    removeListener: () => {},
    removeAllListeners: () => {}
  };
}

// 더미 P2P 서비스 구현
function createDummyImplementation() {
  return {
    connectToSignalServer: () => Promise.resolve(false),
    connectToDevice: () => Promise.resolve(false),
    connectWithQRCode: () => Promise.resolve(false),
    sendMessage: () => false,
    isConnected: () => false,
    requestFileList: () => false,
    requestFileContent: () => false,
    requestFileDelete: () => false,
    reconnect: () => Promise.resolve(false),
    disconnect: () => {},
    getConnectionState: () => ({
      isConnected: false,
      socketConnected: false,
      peerConnected: false,
      deviceId: null,
      serverUrl: null,
      events: []
    })
  };
}

// 모듈 내보내기
export const p2pService = p2pServiceModule;
export const p2pEvents = p2pEventsExport;
export { fileManager };

// 기본 내보내기
export default p2pServiceModule;
