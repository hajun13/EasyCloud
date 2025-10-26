/**
 * P2P 서비스 모듈 - WebRTC와 소켓 연결 관리
 */
import { io } from 'socket.io-client';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { EventEmitter } from 'events';

// 이벤트 이미터 - 다른 컴포넌트에서 P2P 이벤트 수신용
export const p2pEvents = new EventEmitter();

// 기본 신호 서버 URL 설정
const DEFAULT_SIGNAL_SERVER_URL = 'http://3.34.99.176:3000';

class P2PService {
  constructor() {
    this.socket = null;
    this.peerConnection = null;
    this.deviceId = null;
    this.signalServerUrl = DEFAULT_SIGNAL_SERVER_URL;
    this.isConnected = false;
    this.dataChannel = null;
    this.isReconnecting = false;
    this.connectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // 이벤트 기록
    this.eventLog = [];
    
    // STUN/TURN 서버 설정
    this.iceServers = {
      iceServers: [
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
      ]
    };
    
    // 바인딩
    this.connectToSignalServer = this.connectToSignalServer.bind(this);
    this.connectToDevice = this.connectToDevice.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.reconnect = this.reconnect.bind(this);
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
      this.socket = io(serverUrl, {
        transports: ['websocket'],
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
          type: 'mobile-app',
          version: '1.0.0'
        });
        
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(true);
      });
      
      // 연결 실패
      this.socket.on('connect_error', (error) => {
        this._logEvent('connect-error', { error: error.message });
        
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
        
        reject(error);
      });
      
      // 연결 종료
      this.socket.on('disconnect', (reason) => {
        this._logEvent('disconnected', { reason });
        this.isConnected = false;
        
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
          this._logEvent('reconnect-failed', { error: error.message });
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
      this._logEvent('qr-connect-error', { error: error.message });
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
      
      this.deviceId = deviceId;
      this._logEvent('connecting-to-device', { deviceId });
      
      // 이미 연결이 있으면 정리
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }
      
      // 연결 요청
      this.socket.emit('connect-to-device', deviceId, {
        type: 'mobile-client',
        version: '1.0.0'
      });
      
      // WebRTC 연결 초기화
      this.initiatePeerConnection();
      
      // 30초 타임아웃
      const timeout = setTimeout(() => {
        this._logEvent('device-connect-timeout', { deviceId });
        reject(new Error('장치 연결 시간 초과'));
        this.peerConnection.close();
        this.peerConnection = null;
      }, 30000);
      
      // 연결 완료 리스너
      const connectionEstablished = () => {
        clearTimeout(timeout);
        this._logEvent('device-connected', { deviceId });
        resolve(true);
      };
      
      p2pEvents.once('dataChannel-open', connectionEstablished);
    });
  }
  
  /**
   * WebRTC 피어 연결 초기화
   * @private
   */
  initiatePeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    
    // 데이터 채널 설정
    this.dataChannel = this.peerConnection.createDataChannel('file-transfer');
    
    this.dataChannel.onopen = () => {
      this._logEvent('dataChannel-open');
      this.isConnected = true;
    };
    
    this.dataChannel.onclose = () => {
      this._logEvent('dataChannel-close');
      this.isConnected = false;
    };
    
    this.dataChannel.onmessage = (event) => {
      this._handleDataChannelMessage(event.data);
    };
    
    // ICE 후보 처리
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', this.deviceId, {
          type: 'ice-candidate',
          candidate: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          candidate: event.candidate.candidate
        });
      }
    };
    
    // 연결 상태 변경
    this.peerConnection.onconnectionstatechange = () => {
      this._logEvent('connection-state-change', { state: this.peerConnection.connectionState });
      
      if (this.peerConnection.connectionState === 'failed' ||
          this.peerConnection.connectionState === 'closed') {
        this.isConnected = false;
      }
    };
    
    // 데이터 채널 수신
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this._logEvent('received-data-channel', { label: channel.label });
      
      channel.onopen = () => {
        this._logEvent('remote-dataChannel-open');
        this.isConnected = true;
      };
      
      channel.onclose = () => {
        this._logEvent('remote-dataChannel-close');
        this.isConnected = false;
      };
      
      channel.onmessage = (event) => {
        this._handleDataChannelMessage(event.data);
      };
    };
    
    // 연결 오퍼 생성 및 전송
    this._createAndSendOffer();
  }
  
  /**
   * 오퍼 생성 및 전송
   * @private
   */
  async _createAndSendOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.socket.emit('signal', this.deviceId, {
        type: 'offer',
        sdp: this.peerConnection.localDescription.sdp
      });
      
      this._logEvent('offer-created');
    } catch (error) {
      this._logEvent('offer-creation-error', { error: error.message });
    }
  }
  
  /**
   * 신호 처리
   * @param {string} senderId 발신자 ID
   * @param {object} data 신호 데이터
   * @private
   */
  async _handleSignal(senderId, data) {
    try {
      if (data.type === 'device-info') {
        this._logEvent('device-info-received', data.data);
        p2pEvents.emit('device-info', data.data);
      } else if (data.type === 'offer') {
        await this._handleOffer(senderId, data);
      } else if (data.type === 'answer') {
        await this._handleAnswer(data);
      } else if (data.type === 'ice-candidate') {
        await this._handleIceCandidate(data);
      }
    } catch (error) {
      this._logEvent('signal-handling-error', { error: error.message });
    }
  }
  
  /**
   * 오퍼 처리
   * @param {string} senderId 발신자 ID
   * @param {object} data 오퍼 데이터
   * @private
   */
  async _handleOffer(senderId, data) {
    this._logEvent('offer-received', { senderId });
    
    try {
      // 피어 연결이 없는 경우 생성
      if (!this.peerConnection) {
        this.initiatePeerConnection();
      }
      
      // 원격 설명 설정
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: data.sdp })
      );
      
      // 응답 생성
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // 응답 전송
      this.socket.emit('signal', senderId, {
        type: 'answer',
        sdp: this.peerConnection.localDescription.sdp
      });
      
      this._logEvent('answer-created');
    } catch (error) {
      this._logEvent('offer-handling-error', { error: error.message });
    }
  }
  
  /**
   * 응답 처리
   * @param {object} data 응답 데이터
   * @private
   */
  async _handleAnswer(data) {
    this._logEvent('answer-received');
    
    try {
      // 원격 설명 설정
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: data.sdp })
      );
      this._logEvent('remote-description-set');
    } catch (error) {
      this._logEvent('answer-handling-error', { error: error.message });
    }
  }
  
  /**
   * ICE 후보 처리
   * @param {object} data ICE 후보 데이터
   * @private
   */
  async _handleIceCandidate(data) {
    try {
      await this.peerConnection.addIceCandidate(
        new RTCIceCandidate({
          sdpMid: data.candidate,
          sdpMLineIndex: data.sdpMLineIndex,
          candidate: data.candidate
        })
      );
      this._logEvent('ice-candidate-added');
    } catch (error) {
      this._logEvent('ice-candidate-error', { error: error.message });
    }
  }
  
  /**
   * 데이터 채널 메시지 처리
   * @param {string|ArrayBuffer} message 수신된 메시지
   * @private
   */
  _handleDataChannelMessage(message) {
    try {
      // 문자열 메시지 (JSON)
      if (typeof message === 'string') {
        const data = JSON.parse(message);
        this._logEvent('message-received', { type: data.type });
        
        // 이벤트 발생
        p2pEvents.emit(`message-${data.type}`, data);
        p2pEvents.emit('message', data);
      }
      // 바이너리 데이터
      else {
        this._logEvent('binary-received', { size: message.byteLength });
        p2pEvents.emit('binary', message);
      }
    } catch (error) {
      this._logEvent('message-handling-error', { error: error.message });
    }
  }
  
  /**
   * 장치에 메시지 전송
   * @param {object} data 전송할 데이터
   * @returns {boolean} 전송 성공 여부
   */
  sendMessage(data) {
    if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      this._logEvent('send-failed-not-connected');
      return false;
    }
    
    try {
      this.dataChannel.send(JSON.stringify(data));
      this._logEvent('message-sent', { type: data.type });
      return true;
    } catch (error) {
      this._logEvent('send-error', { error: error.message });
      return false;
    }
  }
  
  /**
   * P2P 연결 활성화 여부 확인
   * @returns {boolean} 연결 활성화 여부
   */
  isConnected() {
    return this.isConnected && this.dataChannel && this.dataChannel.readyState === 'open';
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
      this._logEvent('reconnect-error', { error: error.message });
      return false;
    }
  }
  
  /**
   * 연결 종료
   */
  disconnect() {
    try {
      // 데이터 채널 정리
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }
      
      // 피어 연결 정리
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      // 소켓 연결 종료
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.isConnected = false;
      this._logEvent('disconnected');
    } catch (error) {
      this._logEvent('disconnect-error', { error: error.message });
    }
  }
  
  /**
   * 연결 상태 확인
   * @returns {object} 연결 상태 정보
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      socketConnected: this.socket ? this.socket.connected : false,
      peerState: this.peerConnection ? this.peerConnection.connectionState : 'closed',
      dataChannelState: this.dataChannel ? this.dataChannel.readyState : 'closed',
      deviceId: this.deviceId,
      serverUrl: this.signalServerUrl,
      events: this.eventLog.slice(-10) // 최근 10개 이벤트
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const p2pService = new P2PService();
export default p2pService;
