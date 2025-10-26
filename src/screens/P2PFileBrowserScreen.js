/**
 * P2P 파일 브라우저 화면 - WebRTC 연결을 통한 파일 접근
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// P2P 서비스
import { p2pService, p2pEvents, fileManager } from '../services/p2p';

// 파일 아이콘 매핑
const FILE_ICONS = {
  folder: { name: 'folder', color: '#FFD700' },
  image: { name: 'image', color: '#4CD964' },
  video: { name: 'videocam', color: '#FF3B30' },
  audio: { name: 'musical-notes', color: '#FF9500' },
  document: { name: 'document-text', color: '#007AFF' },
  archive: { name: 'archive', color: '#5856D6' },
  code: { name: 'code-slash', color: '#34C759' },
  unknown: { name: 'document', color: '#8E8E93' }
};

const P2PFileBrowserScreen = () => {
  const navigation = useNavigation();
  
  // 상태 관리
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [pathSegments, setPathSegments] = useState([]);
  const [connectionState, setConnectionState] = useState({});
  const [error, setError] = useState(null);
  
  // 현재 경로 세그먼트 계산
  useEffect(() => {
    const segments = currentPath
      .split('/')
      .filter(segment => segment !== '');
    
    setPathSegments(segments);
  }, [currentPath]);
  
  // 연결 상태 확인
  useEffect(() => {
    const checkConnection = () => {
      const state = p2pService.getConnectionState();
      setConnectionState(state);
      
      if (!state.isConnected) {
        // 연결이 끊어진 경우 오류 표시
        setError('연결이 끊어졌습니다. 다시 연결해주세요.');
      }
    };
    
    // 초기 상태 확인
    checkConnection();
    
    // 이벤트 리스너 등록
    const connectionEventHandler = () => {
      checkConnection();
    };
    
    p2pEvents.on('connection-state-change', connectionEventHandler);
    p2pEvents.on('dataChannel-close', connectionEventHandler);
    
    return () => {
      p2pEvents.off('connection-state-change', connectionEventHandler);
      p2pEvents.off('dataChannel-close', connectionEventHandler);
    };
  }, []);
  
  // 화면이 포커스될 때 파일 목록 로드
  useFocusEffect(
    useCallback(() => {
      loadFiles(currentPath);
      
      // 정리 함수
      return () => {
        // 화면에서 벗어날 때 필요한 정리 작업
      };
    }, [currentPath])
  );
  
  // 파일 목록 업데이트 이벤트 리스너
  useEffect(() => {
    const handleFilesUpdated = (data) => {
      if (data.path === currentPath) {
        setFiles(data.files);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      }
    };
    
    p2pEvents.on('files-updated', handleFilesUpdated);
    
    return () => {
      p2pEvents.off('files-updated', handleFilesUpdated);
    };
  }, [currentPath]);
  
  // 파일 목록 로드 함수
  const loadFiles = async (path = '/') => {
    if (!connectionState.isConnected) {
      setError('장치에 연결되어 있지 않습니다.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 파일 매니저를 통해 파일 목록 가져오기
      const fileList = await fileManager.getFileList(path, true);
      setFiles(fileList);
    } catch (error) {
      console.error('파일 목록 로드 오류:', error);
      setError(`파일 목록을 가져올 수 없습니다: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // 새로고침 처리
  const handleRefresh = () => {
    setRefreshing(true);
    loadFiles(currentPath);
  };
  
  // 파일 또는 폴더 터치 처리
  const handleItemPress = async (item) => {
    // 폴더인 경우
    if (item.isDirectory) {
      // 새 경로 계산
      const newPath = `${currentPath === '/' ? '' : currentPath}/${item.name}`;
      setCurrentPath(newPath);
      setLoading(true);
      
      // 파일 목록 로드
      loadFiles(newPath);
    }
    // 파일인 경우
    else {
      handleFileAction(item);
    }
  };
  
  // 파일 작업 다이얼로그
  const handleFileAction = (item) => {
    const filePath = `${currentPath === '/' ? '' : currentPath}/${item.name}`;
    
    Alert.alert(
      item.name,
      '파일로 수행할 작업을 선택하세요',
      [
        {
          text: '다운로드',
          onPress: () => downloadFile(filePath),
        },
        {
          text: '미리보기',
          onPress: () => previewFile(item, filePath),
        },
        {
          text: '취소',
          style: 'cancel',
        },
      ]
    );
  };
  
  // 파일 다운로드
  const downloadFile = async (filePath) => {
    try {
      Alert.alert(
        '다운로드 시작',
        '파일 다운로드를 시작합니다. 파일 크기에 따라 시간이 소요될 수 있습니다.',
        [{ text: '확인' }]
      );
      
      // 파일 요청
      const transfer = await fileManager.requestFile(filePath);
      
      // 전송 상태 구독
      const unsubscribe = fileManager.subscribeToTransfers((status) => {
        if (status.id === transfer.id) {
          if (status.status === 'complete') {
            unsubscribe();
            Alert.alert(
              '다운로드 완료',
              `${status.filename} 파일이 성공적으로 다운로드되었습니다.`,
              [{ text: '확인' }]
            );
            
            // 다운로드 트리거
            fileManager.triggerDownload(status.id);
          } else if (status.status === 'error') {
            unsubscribe();
            Alert.alert(
              '다운로드 오류',
              `다운로드 중 오류가 발생했습니다: ${status.error}`,
              [{ text: '확인' }]
            );
          }
        }
      });
    } catch (error) {
      Alert.alert(
        '다운로드 시작 실패',
        `파일 다운로드를 시작할 수 없습니다: ${error.message}`,
        [{ text: '확인' }]
      );
    }
  };
  
  // 파일 미리보기
  const previewFile = (item, filePath) => {
    // 미리보기 가능한 파일 타입 확인
    const previewableTypes = ['image', 'video', 'audio', 'document'];
    
    if (previewableTypes.includes(item.type)) {
      // 미리보기 화면으로 이동
      navigation.navigate('FilePreview', {
        filePath,
        fileName: item.name,
        fileType: item.type,
        mimeType: item.mime
      });
    } else {
      Alert.alert(
        '미리보기 불가',
        '이 파일 형식은 미리보기를 지원하지 않습니다.',
        [{ text: '확인' }]
      );
    }
  };
  
  // 상위 디렉토리로 이동
  const navigateUp = () => {
    if (currentPath === '/') return;
    
    const segments = currentPath.split('/').filter(segment => segment !== '');
    segments.pop();
    const newPath = segments.length ? `/${segments.join('/')}` : '/';
    
    setCurrentPath(newPath);
    loadFiles(newPath);
  };
  
  // 특정 경로 세그먼트로 이동
  const navigateToPathSegment = (index) => {
    const segments = currentPath.split('/').filter(segment => segment !== '');
    const newSegments = segments.slice(0, index + 1);
    const newPath = newSegments.length ? `/${newSegments.join('/')}` : '/';
    
    setCurrentPath(newPath);
    loadFiles(newPath);
  };
  
  // 연결 재시도
  const handleReconnect = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const reconnected = await p2pService.reconnect();
      
      if (reconnected) {
        // 재연결 성공 - 파일 목록 다시 로드
        loadFiles(currentPath);
      } else {
        // 재연결 실패
        setError('재연결에 실패했습니다. QR 코드를 다시 스캔해주세요.');
        setLoading(false);
      }
    } catch (error) {
      setError(`재연결 오류: ${error.message}`);
      setLoading(false);
    }
  };
  
  // 경로 탐색 바 렌더링
  const renderPathBar = () => (
    <View style={styles.pathBar}>
      <TouchableOpacity 
        style={styles.pathSegment}
        onPress={() => {
          setCurrentPath('/');
          loadFiles('/');
        }}
      >
        <Ionicons name="home" size={18} color="#007AFF" />
      </TouchableOpacity>
      
      {pathSegments.map((segment, index) => (
        <View key={index} style={styles.pathSegmentContainer}>
          <Text style={styles.pathSeparator}>/</Text>
          <TouchableOpacity 
            style={styles.pathSegment}
            onPress={() => navigateToPathSegment(index)}
          >
            <Text 
              style={styles.pathSegmentText}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {segment}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
  
  // 파일 항목 렌더링
  const renderFileItem = ({ item }) => {
    const iconInfo = FILE_ICONS[item.type] || FILE_ICONS.unknown;
    
    return (
      <TouchableOpacity
        style={styles.fileItem}
        onPress={() => handleItemPress(item)}
      >
        <View style={styles.fileIconContainer}>
          <Ionicons name={iconInfo.name} size={24} color={iconInfo.color} />
        </View>
        <View style={styles.fileInfo}>
          <Text
            style={styles.fileName}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {item.name}
          </Text>
          <Text style={styles.fileDetails}>
            {item.isDirectory
              ? `${item.childCount || 0}개 항목`
              : `${item.size ? formatFileSize(item.size) : 'N/A'}`}
          </Text>
        </View>
        {item.isDirectory && (
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        )}
      </TouchableOpacity>
    );
  };
  
  // 파일 크기 포맷팅 함수
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  // 메인 렌더링
  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>원격 파일</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh"
            size={24} 
            color={refreshing ? '#8E8E93' : '#007AFF'} 
          />
        </TouchableOpacity>
      </View>
      
      {/* 경로 탐색 바 */}
      {renderPathBar()}
      
      {/* 연결 상태 배너 (연결이 끊어진 경우) */}
      {!connectionState.isConnected && (
        <View style={styles.connectionBanner}>
          <Text style={styles.connectionText}>연결이 끊어졌습니다</Text>
          <TouchableOpacity
            style={styles.reconnectButton}
            onPress={handleReconnect}
          >
            <Text style={styles.reconnectText}>재연결</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* 파일 목록 */}
      {error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadFiles(currentPath)}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>파일 불러오는 중...</Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="folder-open" size={48} color="#8E8E93" />
          <Text style={styles.emptyText}>이 폴더는 비어 있습니다</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFileItem}
          keyExtractor={(item) => `${item.name}-${item.isDirectory}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#007AFF']}
            />
          }
          contentContainerStyle={styles.fileList}
        />
      )}
      
      {/* 상위 디렉토리 버튼 (루트가 아닌 경우) */}
      {currentPath !== '/' && (
        <TouchableOpacity
          style={styles.upButton}
          onPress={navigateUp}
        >
          <Ionicons name="arrow-up-circle" size={50} color="#007AFF" />
        </TouchableOpacity>
      )}
      
      {/* 연결 상태 디버그 정보 */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            연결 상태: {connectionState.isConnected ? '연결됨' : '연결 끊김'}
          </Text>
          <Text style={styles.debugText}>
            데이터 채널: {connectionState.dataChannelState}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    flexWrap: 'wrap',
  },
  pathSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathSegment: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pathSegmentText: {
    color: '#007AFF',
    fontSize: 14,
    maxWidth: 120,
  },
  pathSeparator: {
    color: '#8E8E93',
    marginHorizontal: 2,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFD700',
    padding: 8,
  },
  connectionText: {
    color: '#000000',
    fontSize: 14,
  },
  reconnectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  reconnectText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  fileList: {
    paddingBottom: 80,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    backgroundColor: '#FFFFFF',
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  fileDetails: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  upButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
  },
  debugInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
});

export default P2PFileBrowserScreen;
