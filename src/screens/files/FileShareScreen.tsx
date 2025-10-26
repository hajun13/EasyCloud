import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Share, 
  TextInput, 
  Switch,
  Alert,
  Clipboard,
  Platform
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Colors from '../../constants/colors';
import fileService from '../../services/fileService';

// 파일 타입 정의
interface FileType {
  id: string;
  name: string;
  type: string;
  path: string;
  [key: string]: any;
}

// 라우트 파라미터 타입 정의
type RouteParams = {
  params: {
    file?: FileType;
  };
};

const FileShareScreen = () => {
  const route = useRoute<RouteProp<RouteParams, 'params'>>();
  const navigation = useNavigation();
  const file = route.params?.file;
  
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [expiration, setExpiration] = useState('never'); // 'never', '1day', '7days', '30days'
  
  // 파일이 없는 경우 처리
  if (!file) {
    return (
      <View style={styles.container}>
        <Header title="파일 공유" showBackButton />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>파일 정보를 찾을 수 없습니다.</Text>
          <Button 
            title="뒤로 가기" 
            onPress={() => navigation.goBack()} 
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }
  
  // 공유 링크 생성
  const generateShareLink = async () => {
    setLoading(true);
    try {
      // 공유 설정
      const options: any = {};
      
      // 비밀번호 설정
      if (isPasswordProtected && password) {
        options.password = password;
      }
      
      // 만료 기간 설정
      if (expiration !== 'never') {
        options.expiration = expiration;
      }
      
      // 공유 링크 생성
      const shareResponse = await fileService.shareFile(file.path, options);
      
      setShareLink(shareResponse.share_url);
    } catch (error) {
      console.error('공유 링크 생성 오류:', error);
      Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 공유 링크 복사
  const copyToClipboard = () => {
    if (!shareLink) return;
    
    Clipboard.setString(shareLink);
    Alert.alert('복사 완료', '공유 링크가 클립보드에 복사되었습니다.');
  };
  
  // 공유 링크 공유
  const handleShare = async () => {
    if (!shareLink) return;
    
    try {
      await Share.share({
        message: `EasyCloud에서 공유한 파일: ${file.name}\n${shareLink}`,
        url: shareLink, // iOS only
      });
    } catch (error) {
      console.error('공유 오류:', error);
      Alert.alert('오류', '파일 공유에 실패했습니다.');
    }
  };
  
  // 만료 기간 선택 UI
  const renderExpirationOptions = () => (
    <View style={styles.expirationContainer}>
      <Text style={styles.expirationTitle}>만료 기간</Text>
      <View style={styles.expirationOptions}>
        <TouchableOpacity
          style={[styles.expirationOption, expiration === 'never' && styles.expirationOptionSelected]}
          onPress={() => setExpiration('never')}
        >
          <Text style={[styles.expirationOptionText, expiration === 'never' && styles.expirationOptionTextSelected]}>
            만료 없음
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.expirationOption, expiration === '1day' && styles.expirationOptionSelected]}
          onPress={() => setExpiration('1day')}
        >
          <Text style={[styles.expirationOptionText, expiration === '1day' && styles.expirationOptionTextSelected]}>
            1일
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.expirationOption, expiration === '7days' && styles.expirationOptionSelected]}
          onPress={() => setExpiration('7days')}
        >
          <Text style={[styles.expirationOptionText, expiration === '7days' && styles.expirationOptionTextSelected]}>
            7일
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.expirationOption, expiration === '30days' && styles.expirationOptionSelected]}
          onPress={() => setExpiration('30days')}
        >
          <Text style={[styles.expirationOptionText, expiration === '30days' && styles.expirationOptionTextSelected]}>
            30일
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
  if (loading) {
    return <LoadingSpinner message="공유 링크 생성 중..." />;
  }
  
  return (
    <View style={styles.container}>
      <Header title="파일 공유" showBackButton />
      
      <View style={styles.content}>
        <View style={styles.fileInfoContainer}>
          <View style={styles.fileIcon}>
            <Text style={styles.fileIconText}>
              {file.type === 'image' ? '🖼️' : file.type === 'video' ? '🎬' : '📄'}
            </Text>
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.fileType}>
              {file.type === 'image' ? '이미지' : file.type === 'video' ? '비디오' : '문서'}
            </Text>
          </View>
        </View>
        
        {shareLink ? (
          <View style={styles.linkContainer}>
            <Text style={styles.linkLabel}>공유 링크</Text>
            <View style={styles.linkRow}>
              <TextInput
                style={styles.linkInput}
                value={shareLink}
                editable={false}
              />
              <TouchableOpacity
                style={styles.copyButton}
                onPress={copyToClipboard}
              >
                <Text style={styles.copyButtonText}>복사</Text>
              </TouchableOpacity>
            </View>
            
            <Button
              title="공유"
              onPress={handleShare}
              style={styles.shareButton}
            />
            
            <Button
              title="새 링크 생성"
              onPress={() => setShareLink('')}
              type="outline"
              style={styles.newLinkButton}
            />
          </View>
        ) : (
          <View>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>비밀번호 보호</Text>
              <Switch
                value={isPasswordProtected}
                onValueChange={setIsPasswordProtected}
                trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                thumbColor={Colors.card}
              />
            </View>
            
            {isPasswordProtected && (
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호 입력"
                secureTextEntry
              />
            )}
            
            {renderExpirationOptions()}
            
            <Button
              title="공유 링크 생성"
              onPress={generateShareLink}
              style={styles.generateButton}
            />
          </View>
        )}
      </View>
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
  fileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  fileIconText: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 4,
  },
  fileType: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: Colors.card,
    marginBottom: 24,
  },
  expirationContainer: {
    marginBottom: 24,
  },
  expirationTitle: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  expirationOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  expirationOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expirationOptionSelected: {
    backgroundColor: Colors.primary,
  },
  expirationOptionText: {
    fontSize: 14,
    color: Colors.text,
  },
  expirationOptionTextSelected: {
    color: Colors.card,
  },
  generateButton: {
    marginTop: 8,
  },
  linkContainer: {
    marginBottom: 24,
  },
  linkLabel: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: Colors.card,
  },
  copyButton: {
    marginLeft: 12,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.card,
  },
  shareButton: {
    marginBottom: 12,
  },
  newLinkButton: {
    marginBottom: 8,
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

export default FileShareScreen;