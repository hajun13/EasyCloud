/**
 * P2P 서비스 모듈 - WebRTC와 소켓 연결 관리 (웹 환경용)
 */
import { io } from 'socket.io-client';
import { EventEmitter } from 'events';
// Import SimplePeer with wrtc check
let SimplePeer;
try {
  SimplePeer = require('simple-peer');
} catch (e) {
  console.error('SimplePeer import error:', e);
}

// 이벤트 이미터 - 다른 컴포넌트에서 P2P 이벤트 수신용
export const p2pEvents = new EventEmitter();

// 기본 신호 서버 URL 설정
const DEFAULT_SIGNAL_SERVER_URL = 'http://3.34.99.176:3000';

class P2PService {
  constructor() {
    this.socket = null;
    this.peer = null;
    this.deviceId = null;
    this.signalServerUrl = DEFAULT_SIGNAL_SERVER_URL;
    this._isConnected = false;  // 변수명 변경: isConnected -> _isConnected
    this.isReconnecting = false;
    this.connectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // 이벤트 기록
    this.eventLog = [];
    
    // STUN/TURN 서버 설정
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // TURN 서버 추가
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
    
    // 바인딩
    this.connectToSignalServer = this.connectToSignalServer.bind(this);
    this.connectToDevice = this.connectToDevice.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.reconnect = this.reconnect.bind(this);
    this.isConnected = this.isConnected.bind(this);
  }
  
  /**
   * 이벤트 로깅
   * @param {string} eventName 이벤트 이름
   * @param {any} data 이벤트 데이터
   * @private
   */
  _logEvent(eventName, data = null) {
    const event = {
      time: new Date().toISOString(),
      event: eventName,
      data: data
    };
    this.eventLog.push(event);
    
    // 로그 크기 제한 (최근 100개 이벤트만 유지)
    if (this.eventLog.length > 100) {
      this.eventLog.shift();
    }
    
    console.log(`P2P 이벤트: ${eventName}`, data);
    
    // 외부 이벤트 발생
    p2pEvents.emit(eventName, data);
    p2pEvents.emit('any', { name: eventName, data });
  }
  
  /**
   * 신호 서버에 연결
   * @param {string} serverUrl 신호 서버 URL
   * @returns {Promise<boolean>} 연결 성공 여부
   */
  connectToSignalServer(serverUrl) {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        this._logEvent('already-connected', { serverUrl });
        resolve(true);
        return;
      }
      
      this.signalServerUrl = serverUrl;
      this._logEvent('connecting', { serverUrl });
      
      // 기존 연결 종료
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      
      // 타임아웃 설정
      this.connectTimeout = setTimeout(() => {
        this._logEvent('connection-timeout');
        reject(new Error('신호 서버 연결 시간 초과'));
      }, 10000);
      
      // 소켓 연결
      try {
        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],  // polling 추가
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000
        });
        
        // 연결 성공
        this.socket.on('connect', () => {
          clearTimeout(this.connectTimeout);
          this._logEvent('connected', { id: this.socket.id });
          
          // 클라이언트 등록
          this.socket.emit('register-client', {
            type: 'web-app',  // 웹 환경임을 명시
            version: '1.0.0'
          });
          
          this._isConnected = true;  // 변수명 변경
          this.reconnectAttempts = 0;
          resolve(true);
        });
        
        // 연결 실패
        this.socket.on('connect_error', (error) => {
          this._logEvent('connect-error', { error: error.message || 'Unknown error' });
          
          if (this.connectTimeout) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
          }
          
          reject(error);
        });
        
        // 연결 종료
        this.socket.on('disconnect', (reason) => {
          this._logEvent('disconnected', { reason });
          this._isConnected = false;  // 변수명 변경
          
          // 자동 재연결
          if (reason === 'io server disconnect' || reason === 'transport close') {
            this._attemptReconnect();
          }
        });
        
        // 신호 수신
        this.socket.on('signal', (senderId, data) => {
          this._logEvent('signal-received', { senderId, type: data.type });
          this._handleSignal(senderId, data);
        });
        
        // 장치 상태 변경
        this.socket.on('device-status-changed', (data) => {
          this._logEvent('device-status-changed', data);
          p2pEvents.emit('device-status', data);
        });
        
        // 연결 요청 전송됨
        this.socket.on('connection-request-sent', (deviceId) => {
          this._logEvent('connection-request-sent', { deviceId });
        });
        
        // 장치를 찾을 수 없음
        this.socket.on('device-not-found', (deviceId) => {
          this._logEvent('device-not-found', { deviceId });
        });
      } catch (err) {
        this._logEvent('socket-creation-error', { error: err.message || 'Unknown error' });
        clearTimeout(this.connectTimeout);
        reject(err);
      }
    });
  }
  
  /**
   * 재연결 시도
   * @private
   */
  _attemptReconnect() {
    if (this.isReconnecting || !this.signalServerUrl) return;
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this._logEvent('reconnect-max-attempts');
      this.isReconnecting = false;
      return;
    }
    
    this._logEvent('reconnecting', { attempt: this.reconnectAttempts });
    
    // 재연결 시도
    setTimeout(() => {
      this.connectToSignalServer(this.signalServerUrl)
        .then(() => {
          this._logEvent('reconnect-success');
          this.isReconnecting = false;
        })
        .catch((error) => {
          this._logEvent('reconnect-failed', { error: error.message || 'Unknown error' });
          this.isReconnecting = false;
          this._attemptReconnect();
        });
    }, Math.min(this.reconnectAttempts * 1000, 10000));
  }
  
  /**
   * QR 코드 데이터 파싱 및 장치 연결
   * @param {string} qrData QR 코드 데이터
   * @returns {Promise<boolean>} 연결 성공 여부
   */
  async connectWithQRCode(qrData) {
    try {
      let data;
      
      // 문자열이 아닌 경우
      if (typeof qrData !== 'string') {
        return false;
      }
      
      // JSON 파싱
      try {
        data = JSON.parse(qrData);
      } catch (e) {
        this._logEvent('qr-parse-error', { error: e.message });
        return false;
      }
      
      // device_id는 필수, signaling_url은 없으면 기본값 사용
      if (!data.device_id) {
        this._logEvent('invalid-qr-data', { data });
        return false;
      }
      
      // 신호 서버 URL이 없으면 기본값 사용
      if (!data.signaling_url) {
        data.signaling_url = DEFAULT_SIGNAL_SERVER_URL;
        this._logEvent('using-default-signal-server', { url: DEFAULT_SIGNAL_SERVER_URL });
      }
      
      // 신호 서버 연결
      const connected = await this.connectToSignalServer(data.signaling_url);
      if (!connected) {
        return false;
      }
      
      // 장치 연결
      return this.connectToDevice(data.device_id);
    } catch (error) {
      this._logEvent('qr-connect-error', { error: error.message || 'Unknown error' });
      return false;
    }
  }
  
  /**
   * 장치 ID로 연결
   * @param {string} deviceId 장치 ID
   * @returns {Promise<boolean>} 연결 성공 여부
   */
  connectToDevice(deviceId) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        this._logEvent('not-connected-to-server');
        reject(new Error('신호 서버에 연결되지 않았습니다'));
        return;
      }
      
      if (!SimplePeer) {
        this._logEvent('simple-peer-not-available');
        reject(new Error('WebRTC 라이브러리를 사용할 수 없습니다'));
        return;
      }
      
      this.deviceId = deviceId;
      this._logEvent('connecting-to-device', { deviceId });
      
      // 이미 연결이 있으면 정리
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      
      // 연결 요청
      this.socket.emit('connect-to-device', deviceId, {
        type: 'web-client',
        version: '1.0.0'
      });
      
      try {
        // SimplePeer 인스턴스 생성 (initiator)
        this.peer = new SimplePeer({
          initiator: true,
          trickle: true,
          objectMode: true,  // 웹에서 문제를 피하기 위해 추가
          config: {
            iceServers: this.iceServers
          }
        });
        
        // 신호 생성
        this.peer.on('signal', (data) => {
          this._logEvent('signal-generated', { type: data.type });
          this.socket.emit('signal', deviceId, data);
        });
        
        // 연결 성공
        this.peer.on('connect', () => {
          this._logEvent('peer-connected');
          this._isConnected = true;  // 변수명 변경
          p2pEvents.emit('dataChannel-open');
          resolve(true);
        });
        
        // 데이터 수신
        this.peer.on('data', (data) => {
          this._handleDataChannelMessage(data);
        });
        
        // 에러 처리
        this.peer.on('error', (err) => {
          this._logEvent('peer-error', { error: err.message || 'Unknown error' });
          this._isConnected = false;  // 변수명 변경
          reject(err);
        });
        
        // 연결 종료
        this.peer.on('close', () => {
          this._logEvent('peer-closed');
          this._isConnected = false;  // 변수명 변경
        });
        
        // 30초 타임아웃
        const timeout = setTimeout(() => {
          this._logEvent('device-connect-timeout', { deviceId });
          reject(new Error('장치 연결 시간 초과'));
          if (this.peer) {
            this.peer.destroy();
            this.peer = null;
          }
        }, 30000);
        
        // 연결 완료 리스너
        const connectionEstablished = () => {
          clearTimeout(timeout);
          this._logEvent('device-connected', { deviceId });
        };
        
        p2pEvents.once('dataChannel-open', connectionEstablished);
      } catch (err) {
        this._logEvent('peer-creation-error', { error: err.message || 'Unknown error' });
        reject(err);
      }
    });
  }
  
  /**
   * 신호 처리
   * @param {string} senderId 발신자 ID
   * @param {object} data 신호 데이터
   * @private
   */
  _handleSignal(senderId, data) {
    try {
      if (data.type === 'device-info') {
        this._logEvent('device-info-received', data.data);
        p2pEvents.emit('device-info', data.data);
      } else if (this.peer && (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate')) {
        this.peer.signal(data);
      }
    } catch (error) {
      this._logEvent('signal-handling-error', { error: error.message || 'Unknown error' });
    }
  }
  
  /**
   * 데이터 채널 메시지 처리
   * @param {Uint8Array|string} data 수신된 데이터
   * @private
   */
  _handleDataChannelMessage(data) {
    try {
      // 문자열로 변환 (ArrayBuffer 또는 Uint8Array일 수 있음)
      let message;
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        // 바이너리 데이터
        const size = data instanceof Uint8Array ? data.byteLength : data.byteLength;
        this._logEvent('binary-received', { size });
        p2pEvents.emit('binary', data);
        return;
      } else if (typeof data === 'string') {
        message = data;
      } else if (data && typeof data === 'object') {
        // SimplePeer의 objectMode에서는 이미 JSON으로 파싱된 객체일 수 있음
        this._logEvent('message-received', { type: data.type });
        p2pEvents.emit(`message-${data.type}`, data);
        p2pEvents.emit('message', data);
        return;
      } else {
        // 기타 형식은 텍스트로 변환 시도
        try {
          const textDecoder = new TextDecoder();
          message = textDecoder.decode(data);
        } catch (e) {
          this._logEvent('decode-error', { error: e.message || 'Unknown error' });
          return;
        }
      }
      
      // JSON 파싱
      try {
        const parsedData = JSON.parse(message);
        this._logEvent('message-received', { type: parsedData.type });
        
        // 이벤트 발생
        p2pEvents.emit(`message-${parsedData.type}`, parsedData);
        p2pEvents.emit('message', parsedData);
      } catch (e) {
        this._logEvent('json-parse-error', { error: e.message || 'Unknown error' });
      }
    } catch (error) {
      this._logEvent('message-handling-error', { error: error.message || 'Unknown error' });
    }
  }
  
  /**
   * 장치에 메시지 전송
   * @param {object} data 전송할 데이터
   * @returns {boolean} 전송 성공 여부
   */
  sendMessage(data) {
    if (!this.isConnected() || !this.peer || !this.peer.connected) {  // isConnected 메소드 호출로 변경
      this._logEvent('send-failed-not-connected');
      return false;
    }
    
    try {
      // objectMode가 true일 때는 직접 객체 전송 가능
      if (this.peer._objectMode) {
        this.peer.send(data);
      } else {
        this.peer.send(JSON.stringify(data));
      }
      this._logEvent('message-sent', { type: data.type });
      return true;
    } catch (error) {
      this._logEvent('send-error', { error: error.message || 'Unknown error' });
      return false;
    }
  }
  
  /**
   * P2P 연결 활성화 여부 확인
   * @returns {boolean} 연결 활성화 여부
   */
  isConnected() {
    return this._isConnected && this.peer && this.peer.connected;  // 변수명 변경
  }
  
  /**
   * 파일 목록 요청
   * @param {string} path 경로
   * @returns {boolean} 요청 성공 여부
   */
  requestFileList(path = '/') {
    return this.sendMessage({
      type: 'file-list-request',
      path: path
    });
  }
  
  /**
   * 파일 내용 요청
   * @param {string} path 파일 경로
   * @returns {boolean} 요청 성공 여부
   */
  requestFileContent(path) {
    return this.sendMessage({
      type: 'file-content-request',
      path: path
    });
  }
  
  /**
   * 파일 삭제 요청
   * @param {string} path 파일 경로
   * @returns {boolean} 요청 성공 여부
   */
  requestFileDelete(path) {
    return this.sendMessage({
      type: 'file-delete-request',
      path: path
    });
  }
  
  /**
   * 재연결
   * @returns {Promise<boolean>} 재연결 성공 여부
   */
  async reconnect() {
    if (!this.signalServerUrl || !this.deviceId) {
      this._logEvent('reconnect-failed-no-info');
      return false;
    }
    
    try {
      // 기존 연결 정리
      this.disconnect();
      
      // 신호 서버 재연결
      await this.connectToSignalServer(this.signalServerUrl);
      
      // 장치 재연결
      return await this.connectToDevice(this.deviceId);
    } catch (error) {
      this._logEvent('reconnect-error', { error: error.message || 'Unknown error' });
      return false;
    }
  }
  
  /**
   * 연결 종료
   */
  disconnect() {
    try {
      // peer 연결 정리
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      
      // 소켓 연결 종료
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this._isConnected = false;  // 변수명 변경
      this._logEvent('disconnected');
    } catch (error) {
      this._logEvent('disconnect-error', { error: error.message || 'Unknown error' });
    }
  }
  
  /**
   * 연결 상태 확인
   * @returns {object} 연결 상태 정보
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected(),  // 메소드 호출로 변경
      socketConnected: this.socket ? this.socket.connected : false,
      peerConnected: this.peer ? this.peer.connected : false,
      deviceId: this.deviceId,
      serverUrl: this.signalServerUrl,
      events: this.eventLog.slice(-10) // 최근 10개 이벤트
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const p2pService = new P2PService();
export default p2pService;
