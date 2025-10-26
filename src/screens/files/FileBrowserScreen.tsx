import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Platform } from 'react-native';
import { useNavigation, useFocusEffect, NavigationProp } from '@react-navigation/native';
import Header from '../../components/common/Header';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FileUploader from '../../components/files/FileUploader';
import Colors from '../../constants/colors';
import Routes from '../../constants/routes';
import fileServiceModule from '../../services/fileService';
import { decodeFileName, cloneAndDecodeFileNames } from '../../utils/stringUtils';

// 파일 인터페이스 정의
interface FileType {
  id: string;
  name: string;
  type: string;
  size: number;
  modified: string;
  path: string; // keyExtractor에서 사용
  originalName?: string; // 원본 파일명 저장
  displayName?: string; // 화면에 표시할 이름
  metadata?: any; // 추가 메타데이터
  [key: string]: any; // 추가 속성이 있을 수 있음
}

// fileService 타입 정의
interface FileService {
  getFiles: (options?: { type?: string }) => Promise<FileType[]>;
}

// 네비게이션 타입 정의
type RootStackParamList = {
  [Routes.FILE_DETAIL]: { file: FileType };
  // 다른 라우트 추가 가능
};

const FileBrowserScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video' | 'document'>('all');
  const [files, setFiles] = useState<FileType[]>([]);
  
  // 파일 목록 불러오기
  const loadFiles = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    
    try {
        const fileType = activeTab === 'all' ? undefined : activeTab;
        const fileList = await fileServiceModule.getFiles({ type: fileType });
        
        // 반환 값이 FileType[] 타입인지 확인하고 명시적 타입 변환
        if (Array.isArray(fileList)) {
          // 파일 이름 디코딩하여 저장
          const decodedFiles = fileList.map(file => {
            // 각 파일 객체의 모든 문자열 필드에 디코딩 적용
            return cloneAndDecodeFileNames(file);
          });
          
          setFiles(decodedFiles as FileType[]);
        } else {
          console.error('파일 목록이 배열 형식이 아닙니다');
          setFiles([]);
        }
      } catch (error) {
        console.error('파일 목록 조회 오류:', error);
        Alert.alert('오류', '파일 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
  }, [activeTab]);
  
  // 화면이 포커스될 때마다 파일 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      loadFiles();
    }, [loadFiles])
  );
  
  // 탭 변경 시 파일 목록 업데이트
  useEffect(() => {
    loadFiles();
  }, [activeTab, loadFiles]);
  
  // 당겨서 새로고침
  const handleRefresh = () => {
    setRefreshing(true);
    loadFiles(true);
  };
  
  // 파일 업로드 완료 후 리스트 새로고침
  const handleUploadComplete = () => {
    loadFiles();
  };
  
// Alert 대신 직접 버튼으로 삭제 구현
  const handleDeleteFile = (file: FileType, event?: any) => {
    if (event) {
      event.stopPropagation();
    }
    
    console.log('삭제 시도:', file.path);
    
    // 여기서 바로 삭제 실행
    console.log('삭제 직접 실행');
    setLoading(true);
    
    // 원본 경로 사용 (디코딩된 버전이 아닌)
    const originalPath = file.path;
    
    fileServiceModule.deleteFile(originalPath)
      .then(result => {
        console.log('삭제 성공:', result);
        setFiles(prev => prev.filter(f => f.path !== file.path));
        loadFiles();
      })
      .catch(error => {
        console.error('삭제 실패:', error);
        console.error('에러 상세:', JSON.stringify(error));
        Alert.alert('오류', '파일 삭제 중 문제가 발생했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  };
  
  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
  };
  
  // 날짜 포맷팅
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // 파일 항목 렌더링
  const renderFileItem = ({ item }: { item: FileType }) => {
    return (
      <TouchableOpacity 
        style={styles.fileItem}
        onPress={() => {
          try {
            // 원본 파일 객체와 디코딩된 파일 객체 모두 전달
            const originalFile = files.find(f => f.path === item.path);
            
            // @ts-ignore 타입 체크 우회
            navigation.navigate(Routes.FILE_DETAIL as any, { file: originalFile } as any);
          } catch (error) {
            console.error('네비게이션 오류:', error);
            Alert.alert('오류', '파일 상세 화면으로 이동할 수 없습니다.');
          }
        }}
      >
        <View style={styles.fileIcon}>
          <Text style={styles.fileIconText}>
            {item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎬' : '📄'}
          </Text>
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.displayName || item.originalName || item.name}</Text>
          <Text style={styles.fileDetails}>
            {formatFileSize(item.size)} • {formatDate(item.modified)}
          </Text>
        </View>
        
        {/* 삭제 버튼 추가 */}
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={(event) => handleDeleteFile(item, event)}
        >
          <Text style={styles.deleteButtonText}>❌</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  
  if (loading && !refreshing) {
    return <LoadingSpinner message="파일을 불러오는 중..." />;
  }
  
  return (
    <View style={styles.container}>
      <Header title="파일" />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>전체</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'image' && styles.activeTab]}
          onPress={() => setActiveTab('image')}
        >
          <Text style={[styles.tabText, activeTab === 'image' && styles.activeTabText]}>이미지</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'video' && styles.activeTab]}
          onPress={() => setActiveTab('video')}
        >
          <Text style={[styles.tabText, activeTab === 'video' && styles.activeTabText]}>동영상</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'document' && styles.activeTab]}
          onPress={() => setActiveTab('document')}
        >
          <Text style={[styles.tabText, activeTab === 'document' && styles.activeTabText]}>문서</Text>
        </TouchableOpacity>
      </View>
      
      {files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>파일이 없습니다.</Text>
          <Text style={styles.emptySubtext}>
            + 버튼을 눌러 파일을 업로드해보세요.
          </Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFileItem}
          keyExtractor={(item) => item.path}
          contentContainerStyle={styles.fileList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      )}
      
      <FileUploader onUploadComplete={handleUploadComplete} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  fileList: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIconText: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    color: Colors.error,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.darkGray,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
  },
});

export default FileBrowserScreen;