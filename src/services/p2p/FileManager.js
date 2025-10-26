/**
 * P2P 기반 파일 관리 모듈
 */
import { p2pEvents } from './P2PService';
import p2pService from './P2PService';

// 파일 타입 매핑
const FILE_TYPES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'json', 'csv'],
  archive: ['zip', 'rar', 'tar', 'gz', '7z'],
  code: ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'rb', 'go', 'swift', 'kt'],
};

// 진행 중인 파일 전송
const activeTransfers = {};

class FileManager {
  constructor() {
    this.currentPath = '/';
    this.fileCache = {};
    this.transferListeners = [];
    
    // 파일 전송 이벤트 리스너 등록
    this._setupEventListeners();
  }
  
  /**
   * 이벤트 리스너 설정
   * @private
   */
  _setupEventListeners() {
    // 파일 목록 응답 처리
    p2pEvents.on('message-file-list-response', (data) => {
      if (data && data.path && Array.isArray(data.files)) {
        // 파일 목록 캐싱
        this.fileCache[data.path] = {
          files: this._processFileList(data.files),
          timestamp: Date.now()
        };
        
        // 이벤트 발생
        p2pEvents.emit('files-updated', {
          path: data.path,
          files: this.fileCache[data.path].files
        });
      }
    });
    
    // 파일 전송 시작 이벤트
    p2pEvents.on('message-file-transfer-start', (data) => {
      if (data && data.transfer_id) {
        activeTransfers[data.transfer_id] = {
          id: data.transfer_id,
          filename: data.filename,
          path: data.path,
          size: data.size,
          mime: data.mime,
          received: 0,
          progress: 0,
          status: 'starting',
          chunks: [],
          startTime: Date.now()
        };
        
        this._notifyTransferUpdate(data.transfer_id);
      }
    });
    
    // 파일 전송 진행 상태 업데이트
    p2pEvents.on('message-file-transfer-progress', (data) => {
      if (data && data.transfer_id && activeTransfers[data.transfer_id]) {
        const transfer = activeTransfers[data.transfer_id];
        transfer.progress = data.progress;
        transfer.status = 'transferring';
        
        this._notifyTransferUpdate(data.transfer_id);
      }
    });
    
    // 파일 전송 완료
    p2pEvents.on('message-file-transfer-complete', (data) => {
      if (data && data.transfer_id && activeTransfers[data.transfer_id]) {
        const transfer = activeTransfers[data.transfer_id];
        transfer.status = 'assembling';
        transfer.progress = 100;
        
        // 파일 조립
        this._assembleFile(data.transfer_id)
          .then((fileData) => {
            transfer.data = fileData;
            transfer.status = 'complete';
            transfer.endTime = Date.now();
            
            this._notifyTransferUpdate(data.transfer_id);
            
            // 캐시에서 완료된 전송 제거 (5분 후)
            setTimeout(() => {
              delete activeTransfers[data.transfer_id];
            }, 300000);
          })
          .catch((error) => {
            transfer.status = 'error';
            transfer.error = error.message;
            this._notifyTransferUpdate(data.transfer_id);
          });
      }
    });
    
    // 파일 전송 오류
    p2pEvents.on('message-file-transfer-error', (data) => {
      if (data && data.transfer_id && activeTransfers[data.transfer_id]) {
        const transfer = activeTransfers[data.transfer_id];
        transfer.status = 'error';
        transfer.error = data.error || '알 수 없는 오류';
        
        this._notifyTransferUpdate(data.transfer_id);
      }
    });
    
    // 바이너리 데이터 수신 (파일 청크)
    p2pEvents.on('binary', (data) => {
      // 활성 전송 중 가장 최근 것을 찾음
      const activeTransferIds = Object.keys(activeTransfers);
      if (activeTransferIds.length === 0) return;
      
      // 가장 최근 전송
      const transferId = activeTransferIds[activeTransferIds.length - 1];
      const transfer = activeTransfers[transferId];
      
      if (transfer && transfer.status === 'starting' || transfer.status === 'transferring') {
        // 청크 추가
        transfer.chunks.push(data);
        transfer.received += data.byteLength;
        
        // 진행률 계산
        if (transfer.size > 0) {
          transfer.progress = Math.floor((transfer.received / transfer.size) * 100);
        }
        
        this._notifyTransferUpdate(transferId);
      }
    });
  }
  
  /**
   * 파일 목록 처리
   * @param {Array} files 서버에서 받은 파일 목록
   * @returns {Array} 처리된 파일 목록
   * @private
   */
  _processFileList(files) {
    return files.map(file => {
      // 확장자 추출
      const extension = file.name.split('.').pop().toLowerCase();
      
      // 파일 타입 결정
      let type = 'unknown';
      for (const [fileType, extensions] of Object.entries(FILE_TYPES)) {
        if (extensions.includes(extension)) {
          type = fileType;
          break;
        }
      }
      
      // 폴더인 경우
      if (file.isDirectory) {
        type = 'folder';
      }
      
      return {
        ...file,
        type,
        extension: extension || '',
        fullPath: `${this.currentPath === '/' ? '' : this.currentPath}/${file.name}`
      };
    });
  }
  
  /**
   * 파일 조립
   * @param {string} transferId 전송 ID
   * @returns {Promise<ArrayBuffer>} 조립된 파일 데이터
   * @private
   */
  async _assembleFile(transferId) {
    const transfer = activeTransfers[transferId];
    if (!transfer || !transfer.chunks || transfer.chunks.length === 0) {
      throw new Error('유효하지 않은 파일 전송');
    }
    
    // 모든 청크 합치기
    const totalLength = transfer.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of transfer.chunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    return result.buffer;
  }
  
  /**
   * 전송 상태 변경 알림
   * @param {string} transferId 전송 ID
   * @private
   */
  _notifyTransferUpdate(transferId) {
    const transfer = activeTransfers[transferId];
    if (!transfer) return;
    
    // 전송 리스너에게 알림
    this.transferListeners.forEach(listener => {
      try {
        listener(transfer);
      } catch (error) {
        console.error('전송 리스너 오류:', error);
      }
    });
    
    // 전송 상태 이벤트 발생
    p2pEvents.emit('transfer-update', transfer);
  }
  
  /**
   * 현재 경로 설정
   * @param {string} path 새 경로
   */
  setCurrentPath(path) {
    this.currentPath = path;
  }
  
  /**
   * 현재 경로 가져오기
   * @returns {string} 현재 경로
   */
  getCurrentPath() {
    return this.currentPath;
  }
  
  /**
   * 지정된 경로의 파일 목록 가져오기
   * @param {string} path 경로
   * @param {boolean} forceRefresh 강제 새로고침 여부
   * @returns {Promise<Array>} 파일 목록
   */
  async getFileList(path = '/', forceRefresh = false) {
    // 이미 캐싱된 데이터가 있고 강제 새로고침이 아닌 경우
    if (!forceRefresh && 
        this.fileCache[path] && 
        Date.now() - this.fileCache[path].timestamp < 30000) {
      return this.fileCache[path].files;
    }
    
    // 현재 경로 업데이트
    this.currentPath = path;
    
    // 파일 목록 요청
    if (!p2pService.requestFileList(path)) {
      throw new Error('파일 목록을 요청할 수 없습니다. 연결을 확인하세요.');
    }
    
    // 응답 대기 (최대 10초)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('파일 목록 요청 시간 초과'));
      }, 10000);
      
      const handleUpdate = (data) => {
        if (data.path === path) {
          clearTimeout(timeout);
          p2pEvents.off('files-updated', handleUpdate);
          resolve(data.files);
        }
      };
      
      p2pEvents.on('files-updated', handleUpdate);
    });
  }
  
  /**
   * 파일 내용 요청 및 다운로드
   * @param {string} path 파일 경로
   * @returns {Promise<object>} 전송 상태 객체
   */
  async requestFile(path) {
    // 파일 내용 요청
    if (!p2pService.requestFileContent(path)) {
      throw new Error('파일을 요청할 수 없습니다. 연결을 확인하세요.');
    }
    
    // 마지막 슬래시 이후를 파일 이름으로 추출
    const filename = path.split('/').pop();
    
    // 응답 대기 (최대 60초)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('파일 요청 시간 초과'));
      }, 60000);
      
      const handleStart = (data) => {
        if (data.path === path || data.filename === filename) {
          clearTimeout(timeout);
          resolve(data);
          
          // 이벤트 리스너 정리
          p2pEvents.off('message-file-transfer-start', handleStart);
          p2pEvents.off('message-file-transfer-error', handleError);
        }
      };
      
      const handleError = (data) => {
        if (data.path === path) {
          clearTimeout(timeout);
          reject(new Error(data.error || '파일 요청 실패'));
          
          // 이벤트 리스너 정리
          p2pEvents.off('message-file-transfer-start', handleStart);
          p2pEvents.off('message-file-transfer-error', handleError);
        }
      };
      
      p2pEvents.on('message-file-transfer-start', handleStart);
      p2pEvents.on('message-file-transfer-error', handleError);
    });
  }
  
  /**
   * 전송 진행 상태 구독
   * @param {Function} listener 전송 상태 리스너
   * @returns {Function} 구독 취소 함수
   */
  subscribeToTransfers(listener) {
    this.transferListeners.push(listener);
    
    // 현재 활성 전송 상태 즉시 알림
    Object.values(activeTransfers).forEach(transfer => {
      listener(transfer);
    });
    
    // 구독 취소 함수 반환
    return () => {
      const index = this.transferListeners.indexOf(listener);
      if (index !== -1) {
        this.transferListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * 전송 상태 가져오기
   * @param {string} transferId 전송 ID
   * @returns {object|null} 전송 상태
   */
  getTransferStatus(transferId) {
    return activeTransfers[transferId] || null;
  }
  
  /**
   * 모든 활성 전송 가져오기
   * @returns {Array} 활성 전송 목록
   */
  getAllTransfers() {
    return Object.values(activeTransfers);
  }
  
  /**
   * 파일 삭제 요청
   * @param {string} path 파일 경로
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async requestFileDelete(path) {
    console.log(`🗑️ P2P 채널을 통한 파일 삭제 요청: ${path}`);
    
    // 파일 삭제 요청
    if (!p2pService.sendMessage({
      type: 'file-delete-request',
      path: path
    })) {
      throw new Error('파일 삭제를 요청할 수 없습니다. 연결을 확인하세요.');
    }
    
    // 응답 대기 (최대 10초)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('파일 삭제 요청 시간 초과'));
      }, 10000);
      
      const handleResponse = (data) => {
        if (data.type === 'file-delete-response' && data.path === path) {
          clearTimeout(timeout);
          p2pEvents.off('message', handleResponse);
          
          if (data.success) {
            resolve(true);
          } else {
            reject(new Error(data.message || '파일 삭제 실패'));
          }
        }
      };
      
      p2pEvents.on('message', handleResponse);
    });
  }
  
  /**
   * 파일 업로드 요청
   * @param {File|Blob} file 업로드할 파일
   * @param {string} targetPath 대상 경로
   * @param {Object} metadata 추가 메타데이터
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadFile(file, targetPath = '/', metadata = {}) {
    console.log(`📤 P2P 채널을 통한 파일 업로드 시작: ${file.name}`);
    
    // P2P 연결 확인
    if (!p2pService.isConnected) {
      throw new Error('P2P 연결이 활성화되지 않았습니다.');
    }
    
    // 전송 ID 생성
    const transferId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 업로드 시작 알림
    p2pService.sendMessage({
      type: 'file-upload-start',
      transfer_id: transferId,
      filename: file.name,
      path: targetPath,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      metadata: metadata
    });
    
    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    // 청크로 분할하여 전송
    const CHUNK_SIZE = 16384; // 16KB
    
    for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
      const chunk = fileData.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE);
      
      // 바이너리 데이터 전송
      await new Promise(resolve => {
        // 데이터 채널 버퍼링을 위해 짤마간 대기
        setTimeout(() => {
          p2pService.dataChannel.send(chunk.buffer);
          resolve();
        }, 10);
      });
      
      // 상태 메시지 (10개의 청크마다)
      if (chunkIndex % 10 === 0 || i + CHUNK_SIZE >= fileData.length) {
        const progress = Math.min(100, Math.floor((i + chunk.length) * 100 / fileData.length));
        p2pService.sendMessage({
          type: 'file-upload-progress',
          transfer_id: transferId,
          progress: progress
        });
      }
    }
    
    // 전송 완료 메시지
    p2pService.sendMessage({
      type: 'file-upload-complete',
      transfer_id: transferId
    });
    
    // 업로드 완료 응답 대기
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('파일 업로드 응답 시간 초과'));
      }, 30000);
      
      const handleResponse = (data) => {
        if (data.type === 'file-upload-response' && data.transfer_id === transferId) {
          clearTimeout(timeout);
          p2pEvents.off('message', handleResponse);
          
          if (data.success) {
            resolve(data.file || { path: targetPath, name: file.name });
          } else {
            reject(new Error(data.message || '파일 업로드 실패'));
          }
        }
      };
      
      p2pEvents.on('message', handleResponse);
    });
  }
  
  /**
   * 파일 데이터를 Blob으로 변환
   * @param {string} transferId 전송 ID
   * @returns {Blob|null} 파일 Blob
   */
  getFileBlob(transferId) {
    const transfer = activeTransfers[transferId];
    if (!transfer || !transfer.data || transfer.status !== 'complete') {
      return null;
    }
    
    return new Blob([transfer.data], { type: transfer.mime || 'application/octet-stream' });
  }
  
  /**
   * 다운로드 URL 생성
   * @param {string} transferId 전송 ID
   * @returns {string|null} 다운로드 URL
   */
  createDownloadUrl(transferId) {
    const blob = this.getFileBlob(transferId);
    if (!blob) return null;
    
    return URL.createObjectURL(blob);
  }
  
  /**
   * 다운로드 트리거
   * @param {string} transferId 전송 ID
   * @returns {boolean} 성공 여부
   */
  triggerDownload(transferId) {
    const url = this.createDownloadUrl(transferId);
    const transfer = activeTransfers[transferId];
    
    if (!url || !transfer) return false;
    
    // 다운로드 링크 생성 및 클릭
    const a = document.createElement('a');
    a.href = url;
    a.download = transfer.filename || 'download';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // 정리
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    return true;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const fileManager = new FileManager();
export default fileManager;
