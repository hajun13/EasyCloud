import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  Image,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useRoute, useNavigation, RouteProp, NavigationProp } from '@react-navigation/native';
import { Video } from 'expo-av';
import { WebView } from 'react-native-webview';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
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
  path: string;
  [key: string]: any;
}

// 다운로드 결과 인터페이스
interface DownloadResult {
  uri: string;
  [key: string]: any;
}

// 파일 서비스 인터페이스
interface FileService {
  downloadFile: (path: string, progressCallback?: (progress: number) => void) => Promise<DownloadResult>;
  deleteFile: (path: string) => Promise<void>;
  getFileViewUrl: (path: string) => string | null;
}

// 라우트 파라미터 타입 정의
type RouteParams = {
  params: {
    file?: FileType;
  };
};

// 네비게이션 타입 정의
type RootStackParamList = {
  [Routes.FILE_SHARE]: { file: FileType };
  [key: string]: any;
};

const FileDetailScreen = () => {
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const originalFile = route.params?.file;
  
  // 파일 객체의 이름과 경로 디코딩
  const file = originalFile ? cloneAndDecodeFileNames(originalFile) : undefined;
  
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (file && originalFile) {
      // 파일 타입이 이미지/비디오/문서인 경우 미리보기 URL 설정
      if (['image', 'video', 'document'].includes(file.type)) {
        // 파일 서비스에서 미리보기 URL 가져오기 (원본 경로 사용)
        const fileService = fileServiceModule as unknown as FileService;
        const url = fileService.getFileViewUrl(originalFile.path);
        setViewUrl(url);
      }
    }
  }, [file, originalFile]);
  
  // 파일이 없는 경우 처리
  if (!file) {
    return (
      <View style={styles.container}>
        <Header title="파일 상세" showBackButton />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>파일 정보를 찾을 수 없습니다.</Text>
          <Button 
            title="뒤로 가기" 
            // @ts-ignore
            onPress={() => navigation.goBack()} 
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }
  
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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // 파일 공유
  const handleShare = () => {
    try {
      // @ts-ignore
      navigation.navigate(Routes.FILE_SHARE, { file: originalFile });
    } catch (error) {
      console.error('네비게이션 오류:', error);
      Alert.alert('오류', '파일 공유 화면으로 이동할 수 없습니다.');
    }
  };
  
  // 파일 다운로드
  const handleDownload = async () => {
    if (!originalFile) return;
    
    setLoading(true);
    setDownloadProgress(0);
    
    try {
      // 타입을 명시적으로 캐스팅
      const fileService = fileServiceModule as unknown as FileService;
      
      const result = await fileService.downloadFile(
        originalFile.path, // 원본 경로 사용해야 서버에서 파일을 찾을 수 있음
        (progress) => setDownloadProgress(progress)
      );
      
      setDownloadUrl(result.uri);
      
      Alert.alert(
        '다운로드 완료',
        Platform.OS === 'web' 
          ? '다운로드가 완료되었습니다.'
          : `파일 저장 위치: ${result.uri}`
      );
    } catch (error) {
      console.error('파일 다운로드 오류:', error);
      Alert.alert('오류', '파일 다운로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 파일 삭제
  const handleDelete = () => {
    if (!originalFile) return;
    
    Alert.alert(
      '파일 삭제',
      `${file.name} 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // 타입을 명시적으로 캐스팅
              const fileService = fileServiceModule as unknown as FileService;
              
              await fileService.deleteFile(originalFile.path); // 원본 경로 사용
              Alert.alert('삭제 완료', '파일이 삭제되었습니다.');
              // @ts-ignore
              navigation.goBack();
            } catch (error) {
              console.error('파일 삭제 오류:', error);
              Alert.alert('오류', '파일 삭제에 실패했습니다.');
            } finally {
              setLoading(false);
            }
          } 
        }
      ]
    );
  };
  
  // 파일 미리보기 렌더링
  const renderPreview = () => {
    if (loading) {
      return (
        <View style={styles.previewContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          {downloadProgress > 0 && (
            <Text style={styles.progressText}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          )}
        </View>
      );
    }
    
    if (file.type === 'image') {
      // 이미지 미리보기
      return (
        <View style={styles.previewContainer}>
          {viewUrl ? (
            <>
              {imageLoading && (
                <ActivityIndicator 
                  size="large" 
                  color={Colors.primary} 
                  style={styles.imageLoader}
                />
              )}
              <Image
                source={{ uri: viewUrl }}
                style={styles.imagePreview}
                resizeMode="contain"
                onLoadStart={() => setImageLoading(true)}
                onLoad={() => setImageLoading(false)}
                onError={(e) => {
                  console.error('이미지 로드 오류:', e.nativeEvent.error);
                  setImageLoading(false);
                }}
              />
            </>
          ) : (
            <TouchableOpacity 
              style={styles.previewPlaceholder}
              onPress={handleDownload}
            >
              <Text style={styles.previewPlaceholderText}>
                이미지를 불러올 수 없습니다
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    } else if (file.type === 'video') {
      // 비디오 미리보기
      return (
        <View style={styles.previewContainer}>
          {viewUrl ? (
            <Video
              source={{ uri: viewUrl }}
              style={styles.videoPreview}
              useNativeControls
              resizeMode="contain"
            />
          ) : (
            <TouchableOpacity 
              style={styles.previewPlaceholder}
              onPress={handleDownload}
            >
              <Text style={styles.previewPlaceholderText}>
                비디오를 불러올 수 없습니다
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    } else if (file.type === 'document') {
      // 문서 미리보기 - 웹 환경에서만 지원
      return (
        <View style={styles.previewContainer}>
          {viewUrl && Platform.OS === 'web' ? (
            <WebView
              source={{ uri: viewUrl }}
              style={styles.documentPreview}
            />
          ) : (
            <TouchableOpacity 
              style={styles.previewPlaceholder}
              onPress={handleDownload}
            >
              <Text style={styles.previewPlaceholderText}>
                {Platform.OS === 'web' 
                  ? '문서를 불러올 수 없습니다' 
                  : '문서 미리보기는 웹에서만 지원됩니다'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.previewContainer}>
          <Text style={styles.previewPlaceholderText}>미리보기를 지원하지 않는 파일 형식입니다</Text>
        </View>
      );
    }
  };
  
  return (
    <View style={styles.container}>
      <Header 
        title={file.name} 
        showBackButton 
        maxTitleLength={20}
        rightComponent={
          <TouchableOpacity
            onPress={handleShare}
            style={styles.shareButton}
            disabled={loading}
          >
            <Text style={styles.shareButtonText}>공유</Text>
          </TouchableOpacity>
        }
      />
      
      <ScrollView contentContainerStyle={styles.content}>
        {renderPreview()}
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>파일 정보</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이름</Text>
            <Text style={styles.infoValue}>{file.name}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>유형</Text>
            <Text style={styles.infoValue}>
              {file.type === 'image' ? '이미지' : file.type === 'video' ? '비디오' : '문서'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>크기</Text>
            <Text style={styles.infoValue}>{formatFileSize(file.size)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>수정일</Text>
            <Text style={styles.infoValue}>{formatDate(file.modified)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>경로</Text>
            <Text style={styles.infoValue} numberOfLines={2} ellipsizeMode="middle">
              {file.path}
            </Text>
          </View>
        </View>
        
        <View style={styles.actionsContainer}>
          <Button
            title="다운로드"
            onPress={handleDownload}
            style={styles.actionButton}
            // @ts-ignore
            loading={loading}
            // @ts-ignore
            disabled={loading}
          />
          
          <Button
            title="삭제"
            onPress={handleDelete}
            // @ts-ignore
            type="outline"
            style={styles.actionButton}
            // @ts-ignore
            disabled={loading}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  previewContainer: {
    aspectRatio: 4/3,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewPlaceholderText: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    position: 'absolute',
    zIndex: 10,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  documentPreview: {
    width: '100%',
    height: '100%',
  },
  progressText: {
    fontSize: 16,
    marginTop: 8,
    color: Colors.primary,
  },
  infoContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    width: 80,
    fontSize: 16,
    color: Colors.darkGray,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    marginBottom: 12,
  },
  shareButton: {
    padding: 8,
  },
  shareButtonText: {
    fontSize: 16,
    color: Colors.primary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: Colors.darkGray,
    marginBottom: 16,
  },
  errorButton: {
    minWidth: 150,
  },
});

export default FileDetailScreen;