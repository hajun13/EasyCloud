import endpoints from '../constants/apiEndpoints';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import mime from 'mime';
import p2pService from './p2p/P2PService';
import fileManager from './p2p/FileManager';
import { p2pEvents } from './p2p/P2PService';
// 중요: apiClient를 가져오기 추가
import apiClient from '../utils/apiClient'; // apiClient 가져오기 추가 필요!

interface FileListParams {
  type?: 'image' | 'video' | 'document' | 'all';
  path?: string;
}

interface FileListResponse {
  files: Array<{
    name: string;
    path: string;
    size: number;
    modified: string;
    type: 'image' | 'video' | 'document';
    metadata?: {
      originalFilename?: string;
      [key: string]: any;
    };
    originalName?: string;
    displayName?: string;
  }>;
}

interface ShareFileResponse {
  share_url: string;
  id: string;
  expires_at?: string;
}

interface UploadFileParams {
  uri: string;
  type: 'image' | 'video' | 'document';
  name: string;
}

// 한글 파일명 안전하게 처리하는 함수
const safeEncodeFileName = (fileName: string): string => {
  // 파일명과 확장자 분리
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    // 확장자가 없는 경우
    return encodeURIComponent(fileName);
  }
  
  const name = fileName.substring(0, lastDotIndex);
  const extension = fileName.substring(lastDotIndex);
  
  // 파일명만 인코딩하고 확장자는 그대로 유지
  return encodeURIComponent(name) + extension;
};

// 한글 경로 안전하게 처리하는 함수
const safeEncodePath = (path: string): string => {
  // 경로를 슬래시로 분리
  const parts = path.split('/');
  
  // 각 부분을 인코딩 (마지막 부분은 파일명이므로 safeEncodeFileName 사용)
  const encodedParts = parts.map((part, index) => {
    if (index === parts.length - 1 && part !== '') {
      return safeEncodeFileName(part);
    }
    return part ? encodeURIComponent(part) : '';
  });
  
  // 다시 경로로 합치기
  return encodedParts.join('/');
};

// P2P 연결 상태를 확인하는 함수 (안정적으로 구현)
const checkP2PConnection = (): boolean => {
  try {
    // p2pService가 정의되어 있고 isConnected 메소드가 존재하는지 확인
    if (p2pService && typeof p2pService.isConnected === 'function') {
      return p2pService.isConnected();
    }
    return false;
  } catch (error) {
    console.warn('⚠️ P2P 연결 상태 확인 중 오류:', error);
    return false;
  }
};

// base64를 안전하게 처리하는 함수
const safeAtob = (base64: string): string => {
  try {
    return atob(base64);
  } catch (error) {
    // Node.js 환경 또는 다른 환경에서 atob가 지원되지 않을 경우
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('binary');
    }
    throw new Error('base64 디코딩이 지원되지 않는 환경입니다');
  }
};

const safeBtoa = (text: string): string => {
  try {
    return btoa(text);
  } catch (error) {
    // Node.js 환경 또는 다른 환경에서 btoa가 지원되지 않을 경우
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(text, 'binary').toString('base64');
    }
    throw new Error('base64 인코딩이 지원되지 않는 환경입니다');
  }
};

// base64 데이터를 파일로 변환하여 업로드하는 함수
const uploadBase64Image = async (dataURI: string, type: 'image' | 'video' | 'document', fileName: string) => {
  try {
    console.log('업로드 파일명:', fileName);
    
    // data:image/png;base64, 형식에서 데이터 부분만 추출
    const base64Data = dataURI.split(',')[1];
    
    // 파일 확장자와 MIME 타입 추출
    const mimeType = dataURI.split(';')[0].split(':')[1];
    const fileExt = fileName.includes('.') 
      ? fileName.split('.').pop() // 원본 파일명에서 확장자 추출
      : mimeType.split('/')[1] || 'png'; // 없으면 MIME 타입에서 추출
    
    // 파일명 처리 - 확장자가 있으면 그대로 사용, 없으면 추가
    const processedFileName = fileName.includes('.')
      ? fileName // 이미 확장자가 있는 경우 그대로 사용
      : `${fileName}.${fileExt}`; // 확장자가 없는 경우 추가
    
    console.log('처리된 파일명:', processedFileName);
    console.log('한글 파일명 디버깅:', encodeURIComponent(processedFileName));
    console.log('MIME 타입:', mimeType);
    
    // FormData 생성
    const formData = new FormData();
    
    // 웹 환경에서의 파일 객체 생성 - Blob 사용
    const byteCharacters = safeAtob(base64Data);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: mimeType });
    
    // 한글 파일명 문제 해결을 위해 파일명 변경
    // 라즈베리파이에서 해결되지 않을 경우 임시 해결책
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
    
    // 확장자 추출
    const extension = processedFileName.split('.').pop() || 'png';
    
    // 타임스태프를 이용한 임시 파일명 생성 (ABC_20250405123045.png 형태)
    const safeFileName = `${timestamp}_${extension}`;
    
    // 원본 파일명은 별도 파라미터로 전송
    const file = new File([blob], safeFileName, { type: mimeType });
    
    // FormData에 파일 추가
    formData.append('file', file);
    formData.append('type', type);
    formData.append('originalFilename', processedFileName); // 원본 파일명 별도 전송
    
    console.log('새 파일명 사용:', safeFileName);
    console.log('원본 파일명 별도 전송:', processedFileName);
    
    // P2P 연결 먼저 시도
    if (checkP2PConnection()) {
      try {
        console.log('📡 P2P 채널을 통한 base64 이미지 업로드 시도...');
        
        // base64 데이터를 blob으로 변환
        const result = await fileManager.uploadFile(blob, '/', {
          originalFilename: processedFileName,
          type: type,
          mimeType: mimeType,
          uploadTime: new Date().toISOString()
        });
        
        console.log('✅ P2P 파일 업로드 성공:', result);
        return {
          success: true,
          file: {
            name: result.name || safeFileName,
            path: result.path || '',
            size: blob.size || 0,
            type: type,
            metadata: {
              originalFilename: processedFileName,
              uploadTime: new Date().toISOString()
            }
          }
        };
      } catch (p2pError) {
        console.warn('⚠️ P2P base64 이미지 업로드 실패:', p2pError);
        console.log('HTTP 요청으로 폴백...');
        // P2P 오류 시 HTTP로 폴백 (아래 코드 실행)
      }
    }
    
    // HTTP 업로드
    console.log('🔄 HTTP를 통한 base64 이미지 업로드...');
    
    // 업로드 요청에 CORS 오류 방지 설정
    const response = await apiClient.post(endpoints.files.upload, formData, {
      headers: {
        'Content-Type': undefined, // 자동 설정되도록 함
        'X-Original-Filename': encodeURIComponent(processedFileName), // 헤더에도 원본 파일명 인코딩해서 전송
        'Access-Control-Allow-Origin': '*' // CORS 허용
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Base64 업로드 오류:', error);
    throw error;
  }
};

const fileService = {
  // 📁 파일 목록 조회
  getFiles: async (params: FileListParams = {}) => {
    try {
      // P2P 연결이 활성화되어 있는지 확인
      if (checkP2PConnection()) {
        console.log('🔄 P2P 채널을 통한 파일 목록 요청...');
        try {
          // 경로가 있으면 사용, 없으면 기본 경로('/')
          const path = params.path || '/';
          // fileManager를 통해 P2P로 파일 목록 요청
          const files = await fileManager.getFileList(path);
          
          // 파일 타입 필터링 (필요한 경우)
          let filteredFiles = files;
          if (params.type && params.type !== 'all') {
            filteredFiles = files.filter(file => file.type === params.type);
          }
          
          // 파일 목록에 원본 파일명 처리
          const processedFiles = filteredFiles.map(file => ({
            ...file,
            displayName: file.name,
            originalName: file.name
          }));
          
          console.log(`✅ P2P로 ${processedFiles.length}개 파일 목록 받음`);
          return processedFiles;
        } catch (p2pError) {
          console.warn('⚠️ P2P 파일 목록 요청 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 파일 목록 요청 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 파일 목록 요청...');
      
      // 경로가 있으면 안전하게 인코딩
      const safeParams = { ...params };
      if (safeParams.path) {
        safeParams.path = safeEncodePath(safeParams.path);
      }
      
      // CORS 문제 대응 헤더 추가
      const response = await apiClient.get<FileListResponse>(endpoints.files.list, {
        params: safeParams,
        headers: {
          'Access-Control-Allow-Origin': '*' // CORS 허용
        }
      });
      
      // 파일 목록에 원본 파일명 처리
      // 타임스태프 파일명이 있는 경우 문자열 패턴을 확인하여 원본 파일명을 추출
      const processedFiles = response.data.files.map(file => {
        // 타임스태프 패턴의 파일명인지 확인 (YYYYMMDDHHMMSS.ext 형식)
        const isTimestampFilename = /^\d{14}\.[a-zA-Z0-9]+$/.test(file.name);
        
        // 파일 메타데이터에 originalFilename이 있는지 확인
        if (isTimestampFilename && file.metadata && file.metadata.originalFilename) {
          return {
            ...file,
            originalName: file.metadata.originalFilename, // 원본 파일명 별도 저장
            displayName: file.metadata.originalFilename // 표시용 이름
          };
        }
        
        // 타임스태프+확장자 형식인지 확인 (YYYYMMDDHHMMSS_ext 형식)
        const isTimestampFormatWithUnderscore = /^\d{14}_[a-zA-Z0-9]+$/.test(file.name);
        if (isTimestampFormatWithUnderscore && file.metadata && file.metadata.originalFilename) {
          return {
            ...file,
            originalName: file.metadata.originalFilename,
            displayName: file.metadata.originalFilename
          };
        }
        
        // 다른 형식의 타임스태프 또는 메타데이터가 없는 경우
        return {
          ...file,
          displayName: file.name // 디스플레이용 이름은 서버에서 받은 파일명과 동일
        };
      });
      
      return processedFiles;
    } catch (error) {
      console.error('파일 목록 조회 오류:', error);
      
      // 오프라인 모드 - 빈 배열 반환
      console.log('⚠️ 오프라인 모드로 빈 파일 목록 반환');
      return [];
    }
  },

  // 📤 파일 업로드
  uploadFile: async ({ uri, type, name }: UploadFileParams) => {
    try {
      console.log('원본 URI:', uri);
      console.log('업로드할 파일명:', name);
      console.log('한글 파일명 디버깅:', encodeURIComponent(name));
      
      // P2P 연결이 활성화되어 있는지 확인 (안정적인 방식으로)
      if (checkP2PConnection()) {
        console.log('📡 P2P 채널을 통한 파일 업로드 시도...');
        try {
          // 파일 데이터 준비
          let fileData;
          let fileType = type;
          let mimeType = mime.getType(name) || 'application/octet-stream';
          
          // URI가 data:로 시작하는지 확인 (웹 환경에서 base64 데이터 URI)
          if (uri.startsWith('data:')) {
            // data: URI에서 base64 데이터 추출
            const base64Data = uri.split(',')[1];
            const byteCharacters = safeAtob(base64Data);
            const byteArrays = [];
            
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
              }
              
              const byteArray = new Uint8Array(byteNumbers);
              byteArrays.push(byteArray);
            }
            
            // MIME 타입 추출
            mimeType = uri.split(';')[0].split(':')[1] || mimeType;
            
            // Blob 생성
            const blob = new Blob(byteArrays, { type: mimeType });
            fileData = blob;
          } else {
            // 네이티브 환경에서 파일 읽기
            const realUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
            
            // Expo FileSystem을 사용하여 파일 읽기
            const fileContent = await FileSystem.readAsStringAsync(realUri, {
              encoding: FileSystem.EncodingType.Base64
            });
            
            // Base64 데이터를 Blob으로 변환
            const byteCharacters = safeAtob(fileContent);
            const byteArrays = [];
            
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
              }
              
              const byteArray = new Uint8Array(byteNumbers);
              byteArrays.push(byteArray);
            }
            
            const blob = new Blob(byteArrays, { type: mimeType });
            fileData = blob;
          }
          
          // 파일 메타데이터 준비
          const metadata = {
            originalFilename: name,
            type: fileType,
            mimeType: mimeType,
            uploadTime: new Date().toISOString()
          };
          
          // P2P 파일 업로드 실행
          const result = await fileManager.uploadFile(fileData, '/', metadata);
          console.log('✅ P2P 파일 업로드 성공:', result);
          
          // 결과 반환
          return {
            success: true,
            file: {
              name: result.name || name,
              path: result.path || '',
              size: fileData.size || 0,
              type: fileType,
              metadata: metadata
            }
          };
        } catch (p2pError) {
          console.warn('⚠️ P2P 파일 업로드 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 파일 업로드 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 파일 업로드 시도...');
      
      // URI가 data:로 시작하는지 확인 (웹 환경에서 base64 데이터 URI)
      if (uri.startsWith('data:')) {
        // base64 데이터를 파일로 변환하는 함수 호출
        return await uploadBase64Image(uri, type, name);
      }
      
      // 일반 파일 업로드 처리 (네이티브 환경)
      const formData = new FormData();
      
      const realUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
      const mimeType = mime.getType(name) || 'application/octet-stream';
      
      // 한글 파일명 문제 해결을 위해 파일명 변경
      // 라즈베리파이에서 해결되지 않을 경우 임시 해결책
      const now = new Date();
      const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      
      // 확장자 추출
      const extension = name.split('.').pop() || '';
      
      // 타임스태프를 이용한 임시 파일명 생성 (20250405123045.png 형태)
      const safeFileName = extension ? `${timestamp}.${extension}` : timestamp;
      
      console.log('새 파일명 사용:', safeFileName);
      console.log('원본 파일명 별도 전송:', name);
      
      // 원본 파일명 사용
      formData.append('file', {
        uri: realUri,
        name: safeFileName, // 안전한 파일명 사용
        type: mimeType,
      } as any);
      
      formData.append('type', type);
      formData.append('originalFilename', name); // 원본 파일명 별도 전송
      
      // CORS 및 모바일 최적화를 위한 설정
      const uploadOptions = {
        headers: {
          'Content-Type': 'multipart/form-data', // 자동 설정되게 하지 않고 명시적 설정
          'X-Original-Filename': encodeURIComponent(name), // 헤더에도 원본 파일명 전송
          'Access-Control-Allow-Origin': '*' // CORS 허용
        },
        timeout: 30000, // 타임아웃 증가 (30초)
      };
      
      // 업로드 요청 시도 (여러 번 재시도 포함)
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const response = await apiClient.post(endpoints.files.upload, formData, uploadOptions);
          console.log('✅ 파일 업로드 성공:', response.status);
          return response.data;
        } catch (uploadError: any) {
          retryCount++;
          console.warn(`⚠️ 업로드 시도 ${retryCount}/${maxRetries} 실패:`, uploadError.message);
          
          if (retryCount < maxRetries) {
            // 약간의 지연 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            console.log(`🔄 업로드 재시도 ${retryCount}/${maxRetries}...`);
          } else {
            // 모든 시도 실패
            console.error('❌ 모든 업로드 시도 실패');
            throw uploadError;
          }
        }
      }
      
      throw new Error('업로드 시도가 모두 실패했습니다');
    } catch (error: any) {
      console.error('❌ 파일 업로드 오류:', error);
      if (error.response?.data) {
        console.error('🪵 서버 응답 내용:', error.response.data);
      }
      throw error;
    }
  },

  // 📥 파일 다운로드
  downloadFile: async (path: string, progressCallback?: (progress: number) => void) => {
    try {
      // P2P 연결이 활성화되어 있는지 확인
      if (checkP2PConnection()) {
        console.log('📡 P2P 채널을 통한 파일 다운로드 시도...');
        try {
          // fileManager를 통해 P2P로 파일 내용 요청
          const fileResult = await fileManager.getFileContent(path);
          
          if (fileResult && fileResult.data) {
            console.log('✅ P2P 파일 다운로드 성공:', path);
            
            // 웹 환경에서는 Blob URL 생성하여 반환
            if (Platform.OS === 'web') {
              const blob = new Blob([fileResult.data]);
              const url = URL.createObjectURL(blob);
              return { uri: url };
            }
            // 네이티브 환경에서는 파일 저장
            else {
              const fileName = path.split('/').pop() || 'download';
              const fileUri = `${FileSystem.documentDirectory}${fileName}`;
              
              // Uint8Array를 Base64 문자열로 변환
              let binaryStr = '';
              const bytes = new Uint8Array(fileResult.data);
              for (let i = 0; i < bytes.byteLength; i++) {
                binaryStr += String.fromCharCode(bytes[i]);
              }
              const base64Data = safeBtoa(binaryStr);
              
              // 파일 저장
              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64
              });
              
              return { uri: fileUri };
            }
          }
          throw new Error('P2P를 통한 파일 내용 요청 실패');
        } catch (p2pError) {
          console.warn('⚠️ P2P 파일 다운로드 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 파일 다운로드 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 파일 다운로드 시도...');
      
      // 경로 안전하게 인코딩
      const encodedPath = safeEncodePath(path);
      
      if (Platform.OS === 'web') {
        const downloadUrl = `${apiClient.defaults.baseURL}${endpoints.files.download(encodedPath)}`;
        window.open(downloadUrl);
        return { uri: downloadUrl };
      } else {
        const fileName = path.split('/').pop() || 'download';
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        const downloadResumable = FileSystem.createDownloadResumable(
          `${apiClient.defaults.baseURL}${endpoints.files.download(encodedPath)}`,
          fileUri,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            progressCallback?.(progress);
          }
        );

        const result = await downloadResumable.downloadAsync();
        return result;
      }
    } catch (error) {
      console.error('파일 다운로드 오류:', error);
      throw error;
    }
  },

  // 🖼️ 파일 미리보기 URL 가져오기 (다운로드 URL 활용)
  getFileViewUrl: (path: string) => {
    try {
      // 경로 안전하게 인코딩
      const encodedPath = safeEncodePath(path);
      return `${apiClient.defaults.baseURL}${endpoints.files.download(encodedPath)}`;
    } catch (error) {
      console.error('미리보기 URL 생성 오류:', error);
      return null;
    }
  },

  // 🔗 파일 공유 링크 생성
  shareFile: async (path: string, options?: { password?: string; expiration?: string }) => {
    try {
      // 경로 안전하게 인코딩
      const encodedPath = safeEncodePath(path);
      const response = await apiClient.post<ShareFileResponse>(
        endpoints.files.share(encodedPath),
        options
      );
      return response.data;
    } catch (error) {
      console.error('파일 공유 오류:', error);
      throw error;
    }
  },

  // 🗑️ 단일 파일 삭제
  deleteFile: async (path: string) => {
    try {
      console.log('🗑️ 삭제 요청 시작:', path);
      
      // 1. 경로에서 쿼리 파라미터나 특수 문자 처리
      let cleanPath = path;
      
      // 2. 필요한 경우 경로의 일부만 추출 (서버 구조에 따라 다름)
      // 예: 'images/2025-04-05/1.png'만 필요하면 전체 경로에서 추출
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
      
      // P2P 연결이 활성화되어 있는지 확인
      if (checkP2PConnection()) {
        console.log('📱 P2P 채널을 통한 파일 삭제 시도...');
        try {
          // fileManager를 통해 P2P로 파일 삭제 요청
          const result = await fileManager.requestFileDelete(cleanPath);
          console.log('✅ P2P 파일 삭제 성공:', result);
          return { success: true, message: '파일이 삭제되었습니다.' };
        } catch (p2pError) {
          console.warn('⚠️ P2P 파일 삭제 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 파일 삭제 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 파일 삭제 시도...');
      
      // 3. 한글 파일명이 포함된 경로 안전하게 인코딩
      const encodedPath = safeEncodePath(cleanPath);
      
      console.log('정리된 경로:', cleanPath);
      console.log('인코딩된 경로:', encodedPath);
      
      const deleteUrl = endpoints.files.delete(encodedPath);
      console.log('🔗 삭제 요청 URL:', `${apiClient.defaults.baseURL}${deleteUrl}`);
      
      // 삭제 요청 시도 (여러 번 재시도 포함)
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          // CORS 및 오류 처리 개선을 위한 옵션
          const deleteOptions = {
            headers: {
              'Access-Control-Allow-Origin': '*', // CORS 허용
              'Access-Control-Allow-Methods': 'DELETE', // DELETE 메서드 명시적 허용
            },
            timeout: 15000, // 15초 타임아웃
          };
          
          const response = await apiClient.delete(deleteUrl, deleteOptions);
          console.log('✅ 파일 삭제 성공:', response.status);
          return response.data;
        } catch (deleteError: any) {
          retryCount++;
          console.warn(`⚠️ 삭제 시도 ${retryCount}/${maxRetries} 실패:`, deleteError.message);
          
          if (retryCount < maxRetries) {
            // 약간의 지연 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            console.log(`🔄 삭제 재시도 ${retryCount}/${maxRetries}...`);
          } else {
            // 모든 시도 실패
            console.error('❌ 모든 삭제 시도 실패');
            throw deleteError;
          }
        }
      }
      
      throw new Error('삭제 시도가 모두 실패했습니다');
    } catch (error: any) {
      console.error('❌ 파일 삭제 오류:', error);
      if (error.response?.data) {
        console.error('🪵 서버 응답 내용:', error.response.data);
      }
      throw error;
    }
  },

  // 📂 모든 파일 삭제
  deleteAllFiles: async (progressCallback?: (current: number, total: number) => void) => {
    try {
      // 1. 모든 파일 목록 가져오기
      const allFiles = await fileService.getFiles();
      
      if (!allFiles || allFiles.length === 0) {
        return { success: true, deletedCount: 0, totalCount: 0 };
      }
      
      // 2. 각 파일별로 삭제 진행
      const results = {
        success: true,
        totalCount: allFiles.length,
        deletedCount: 0,
        failedCount: 0,
        failedFiles: [] as string[]
      };
      
      // 순차적으로 삭제 (동시 다수 요청으로 인한 서버 부하 방지)
      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        try {
          await fileService.deleteFile(file.path);
          results.deletedCount++;
        } catch (error) {
          // 개별 파일 삭제 실패는 무시하고 계속 진행
          console.warn(`⚠️ 파일 삭제 실패 (무시): ${file.path}`);
          results.failedCount++;
          results.failedFiles.push(file.path);
        }
        
        // 진행 상황 콜백
        if (progressCallback) {
          progressCallback(i + 1, allFiles.length);
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ 전체 파일 삭제 오류:', error);
      throw error;
    }
  },

  // 📋 파일 이름 변경
  renameFile: async (path: string, newName: string) => {
    try {
      console.log('🏷️ 파일 이름 변경 시작:', path, '→', newName);
      
      // 경로에서 디렉토리와 파일명 추출
      const pathParts = path.split('/');
      const fileName = pathParts.pop() || '';
      const directory = pathParts.join('/');
      
      // 새 경로 생성
      const newPath = directory ? `${directory}/${newName}` : newName;
      
      // P2P 연결이 활성화되어 있는지 확인
      if (checkP2PConnection()) {
        console.log('📱 P2P 채널을 통한 파일 이름 변경 시도...');
        try {
          // fileManager를 통해 P2P로 파일 이름 변경 요청
          const result = await fileManager.renameFile(path, newName);
          console.log('✅ P2P 파일 이름 변경 성공:', result);
          return { 
            success: true, 
            message: '파일 이름이 변경되었습니다.',
            oldPath: path,
            newPath: newPath
          };
        } catch (p2pError) {
          console.warn('⚠️ P2P 파일 이름 변경 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 파일 이름 변경 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 파일 이름 변경 시도...');
      
      // 안전하게 인코딩
      const encodedPath = safeEncodePath(path);
      const encodedNewName = safeEncodeFileName(newName);
      
      // 이름 변경 요청
      const response = await apiClient.put(endpoints.files.rename(encodedPath), {
        newName: encodedNewName
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*', // CORS 허용
          'X-New-Filename': encodedNewName // 헤더에도 새 파일명 전송
        }
      });
      
      console.log('✅ 파일 이름 변경 성공:', response.status);
      return {
        success: true,
        message: '파일 이름이 변경되었습니다.',
        oldPath: path,
        newPath: newPath,
        ...response.data
      };
    } catch (error: any) {
      console.error('❌ 파일 이름 변경 오류:', error);
      if (error.response?.data) {
        console.error('🪵 서버 응답 내용:', error.response.data);
      }
      throw error;
    }
  },

  // 📁 디렉토리 생성
  createDirectory: async (path: string) => {
    try {
      console.log('📁 디렉토리 생성 시작:', path);
      
      // P2P 연결이 활성화되어 있는지 확인
      if (checkP2PConnection()) {
        console.log('📱 P2P 채널을 통한 디렉토리 생성 시도...');
        try {
          // fileManager를 통해 P2P로 디렉토리 생성 요청
          const result = await fileManager.createDirectory(path);
          console.log('✅ P2P 디렉토리 생성 성공:', result);
          return { 
            success: true, 
            message: '디렉토리가 생성되었습니다.',
            path: path
          };
        } catch (p2pError) {
          console.warn('⚠️ P2P 디렉토리 생성 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 디렉토리 생성 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 디렉토리 생성 시도...');
      
      // 안전하게 인코딩
      const encodedPath = safeEncodePath(path);
      
      // 디렉토리 생성 요청
      const response = await apiClient.post(endpoints.files.createDirectory, {
        path: encodedPath
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*' // CORS 허용
        }
      });
      
      console.log('✅ 디렉토리 생성 성공:', response.status);
      return {
        success: true,
        message: '디렉토리가 생성되었습니다.',
        path: path,
        ...response.data
      };
    } catch (error: any) {
      console.error('❌ 디렉토리 생성 오류:', error);
      if (error.response?.data) {
        console.error('🪵 서버 응답 내용:', error.response.data);
      }
      throw error;
    }
  },

  // 📊 저장소 통계 가져오기
  getStorageStats: async () => {
    try {
      console.log('📊 저장소 통계 요청 시작');
      
      // P2P 연결이 활성화되어 있는지 확인
      if (checkP2PConnection()) {
        console.log('📱 P2P 채널을 통한 저장소 통계 요청 시도...');
        try {
          // fileManager를 통해 P2P로 저장소 통계 요청
          const stats = await fileManager.getStorageStats();
          console.log('✅ P2P 저장소 통계 요청 성공:', stats);
          return stats;
        } catch (p2pError) {
          console.warn('⚠️ P2P 저장소 통계 요청 실패:', p2pError);
          console.log('HTTP 요청으로 폴백...');
          // P2P 오류 시 HTTP로 폴백
        }
      }
      
      // HTTP를 통한 저장소 통계 요청 (P2P가 불가능하거나 실패한 경우)
      console.log('🔄 HTTP를 통한 저장소 통계 요청...');
      
      const response = await apiClient.get(endpoints.files.storageStats, {
        headers: {
          'Access-Control-Allow-Origin': '*' // CORS 허용
        }
      });
      
      console.log('✅ 저장소 통계 요청 성공:', response.status);
      return response.data;
    } catch (error) {
      console.error('❌ 저장소 통계 요청 오류:', error);
      
      // 오류 시 기본 통계 반환
      return {
        totalSpace: 0,
        usedSpace: 0,
        freeSpace: 0,
        fileCount: 0,
        error: '통계를 가져올 수 없습니다'
      };
    }
  },

  // 🔄 파일 동기화 (P2P와 HTTP 간 동기화)
  syncFiles: async (progressCallback?: (current: number, total: number) => void) => {
    try {
      console.log('🔄 파일 동기화 시작');
      
      // P2P 연결이 활성화되어 있는지 확인
      if (!checkP2PConnection()) {
        throw new Error('P2P 연결이 없어 동기화를 진행할 수 없습니다');
      }
      
      // 1. P2P에서 파일 목록 가져오기
      console.log('1️⃣ P2P에서 파일 목록 가져오기');
      const p2pFiles = await fileManager.getFileList('/');
      
      // 2. HTTP에서 파일 목록 가져오기
      console.log('2️⃣ HTTP에서 파일 목록 가져오기');
      const httpResponse = await apiClient.get<FileListResponse>(endpoints.files.list, {
        headers: {
          'Access-Control-Allow-Origin': '*' // CORS 허용
        }
      });
      const httpFiles = httpResponse.data.files;
      
      // 3. 동기화 필요한 파일 식별
      console.log('3️⃣ 동기화 필요한 파일 식별');
      
      // P2P에는 있지만 HTTP에는 없는 파일 찾기
      const p2pFilePaths = new Set(p2pFiles.map(file => file.path));
      const httpFilePaths = new Set(httpFiles.map(file => file.path));
      
      const filesToUploadToHttp = p2pFiles.filter(file => !httpFilePaths.has(file.path));
      const filesToDownloadToP2p = httpFiles.filter(file => !p2pFilePaths.has(file.path));
      
      console.log(`- HTTP에 업로드 필요: ${filesToUploadToHttp.length}개`);
      console.log(`- P2P에 다운로드 필요: ${filesToDownloadToP2p.length}개`);
      
      // 4. 동기화 진행
      const totalFiles = filesToUploadToHttp.length + filesToDownloadToP2p.length;
      let completedFiles = 0;
      
      // 4.1. P2P → HTTP 업로드
      for (const file of filesToUploadToHttp) {
        try {
          console.log(`P2P → HTTP 업로드 중: ${file.path}`);
          
          // P2P에서 파일 내용 가져오기
          const fileContent = await fileManager.getFileContent(file.path);
          
          if (fileContent && fileContent.data) {
            // 파일 내용을 HTTP로 업로드
            const formData = new FormData();
            
            // Blob 생성
            const blob = new Blob([fileContent.data], { 
              type: file.metadata?.mimeType || 'application/octet-stream' 
            });
            
            // 파일명 추출
            const fileName = file.path.split('/').pop() || 'file';
            
            // FormData 구성
            formData.append('file', new File([blob], fileName, { 
              type: file.metadata?.mimeType || 'application/octet-stream'
            }));
            formData.append('type', file.type || 'document');
            
            if (file.metadata?.originalFilename) {
              formData.append('originalFilename', file.metadata.originalFilename);
            }
            
            // HTTP로 업로드
            await apiClient.post(endpoints.files.upload, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Access-Control-Allow-Origin': '*'
              }
            });
            
            console.log(`✅ 업로드 성공: ${file.path}`);
          }
        } catch (error) {
          console.error(`❌ 업로드 실패: ${file.path}`, error);
        }
        
        completedFiles++;
        progressCallback?.(completedFiles, totalFiles);
      }
      
      // 4.2. HTTP → P2P 다운로드
      for (const file of filesToDownloadToP2p) {
        try {
          console.log(`HTTP → P2P 다운로드 중: ${file.path}`);
          
          // 경로 안전하게 인코딩
          const encodedPath = safeEncodePath(file.path);
          
          // HTTP에서 파일 내용 가져오기
          const fileUrl = `${apiClient.defaults.baseURL}${endpoints.files.download(encodedPath)}`;
          
          // 파일 다운로드
          const response = await fetch(fileUrl);
          const blob = await response.blob();
          
          // P2P에 저장
          const fileName = file.path.split('/').pop() || 'file';
          const directoryPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
          
          // 메타데이터 준비
          const metadata = {
            ...file.metadata,
            originalFilename: file.metadata?.originalFilename || fileName,
            type: file.type,
            mimeType: blob.type,
            downloadTime: new Date().toISOString()
          };
          
          // P2P에 파일 업로드
          await fileManager.uploadFile(blob, directoryPath, metadata);
          
          console.log(`✅ 다운로드 성공: ${file.path}`);
        } catch (error) {
          console.error(`❌ 다운로드 실패: ${file.path}`, error);
        }
        
        completedFiles++;
        progressCallback?.(completedFiles, totalFiles);
      }
      
      // 5. 동기화 결과 반환
      return {
        success: true,
        totalFiles,
        uploadedToHttp: filesToUploadToHttp.length,
        downloadedToP2p: filesToDownloadToP2p.length
      };
    } catch (error) {
      console.error('❌ 파일 동기화 오류:', error);
      throw error;
    }
  }
  };

export default fileService;