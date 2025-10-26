import React, { useContext, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Switch,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import { AuthContext } from '../contexts/AuthContext';
import { DeviceContext } from '../contexts/DeviceContext';
import Colors from '../constants/colors';
import fileService from '../services/fileService';

const SettingsScreen = () => {
  const { user, logout } = useContext(AuthContext);
  const { deviceInfo, deviceStatus } = useContext(DeviceContext);
  const navigation = useNavigation();
  
  // 설정 상태
  const [autoBackup, setAutoBackup] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  
  // 데이터 삭제 상태
  const [isDeletingFiles, setIsDeletingFiles] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState({ current: 0, total: 0 });
  
  // 로그아웃 함수 수정 - Alert 대화상자 없이 직접 실행
  const handleLogout = async () => {
    try {
      console.log('로그아웃 실행');
      // 로그아웃 처리
      await logout();
      
      // 로컬 스토리지 초기화 (모든 관련 데이터 삭제)
      localStorage.clear(); // 또는 특정 키만 삭제
      localStorage.setItem('isLoggedIn', 'false');
      
      // 웹 환경에서는 페이지 강제 새로고침
      if (Platform.OS === 'web') {
        // 강제 새로고침 (캐시 무시)
        window.location.replace('/');
      }
    } catch (error) {
      console.error('로그아웃 처리 중 오류:', error);
      Alert.alert('오류', '로그아웃 처리 중 문제가 발생했습니다.');
    }
  };
  
  // 모든 파일 삭제 처리
  const handleDeleteAllFiles = () => {
    Alert.alert(
      '모든 파일 삭제',
      '정말로 모든 파일을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            setIsDeletingFiles(true);
            setDeletionProgress({ current: 0, total: 0 });
            
            try {
              const result = await fileService.deleteAllFiles((current, total) => {
                setDeletionProgress({ current, total });
              });
              
              console.log('전체 삭제 결과:', result);
              
              // 삭제 결과 표시
              if (result.failedCount > 0) {
                Alert.alert(
                  '삭제 완료',
                  `총 ${result.totalCount}개 파일 중 ${result.deletedCount}개가 삭제되었습니다.\n${result.failedCount}개 파일 삭제 실패`
                );
              } else {
                Alert.alert(
                  '삭제 완료',
                  `총 ${result.totalCount}개 파일이 모두 삭제되었습니다.`
                );
              }
            } catch (error) {
              console.error('전체 파일 삭제 오류:', error);
              Alert.alert(
                '삭제 오류',
                '파일 삭제 중 문제가 발생했습니다. 다시 시도해 주세요.'
              );
            } finally {
              setIsDeletingFiles(false);
            }
          } 
        }
      ]
    );
  };
  
  return (
    <View style={styles.container}>
      <Header title="설정" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>계정 정보</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.infoText}>이메일: {user?.email || '-'}</Text>
              <Text style={styles.infoText}>ID: {user?.id || '-'}</Text>
            </View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기기 정보</Text>
            <View style={styles.sectionContent}>
              {deviceInfo ? (
                <>
                  <Text style={styles.infoText}>기기 ID: {deviceInfo.device_id}</Text>
                  <Text style={styles.infoText}>IP 주소: {deviceInfo.local_ip}</Text>
                  <Text style={styles.infoText}>포트: {deviceInfo.port}</Text>
                  {deviceStatus && (
                    <>
                      <Text style={styles.infoText}>
                        저장 공간: {Math.round((deviceStatus.storage.used / deviceStatus.storage.total) * 100)}% 사용 중
                      </Text>
                    </>
                  )}
                </>
              ) : (
                <Text style={styles.infoText}>연결된 기기가 없습니다.</Text>
              )}
            </View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>일반 설정</Text>
            <View style={styles.sectionContent}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>자동 백업</Text>
                <Switch
                  value={autoBackup}
                  onValueChange={setAutoBackup}
                  trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                  thumbColor={Colors.card}
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>다크 모드</Text>
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                  thumbColor={Colors.card}
                />
              </View>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>알림</Text>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: Colors.lightGray, true: Colors.primary }}
                  thumbColor={Colors.card}
                />
              </View>
            </View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>데이터 관리</Text>
            <View style={styles.sectionContent}>
              {isDeletingFiles ? (
                <View style={styles.progressContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.progressText}>
                    파일 삭제 중... {deletionProgress.current}/{deletionProgress.total}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.dangerButton} 
                  onPress={handleDeleteAllFiles}
                >
                  <Text style={styles.dangerButtonText}>모든 파일 삭제</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>앱 정보</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.infoText}>버전: 1.0.0</Text>
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => {
                  Alert.alert(
                    '오픈소스 라이선스',
                    'EasyCloud는 다음 오픈소스 프로젝트를 사용합니다:\n\n' +
                    '- React Native\n' +
                    '- Expo\n' +
                    '- React Navigation\n' +
                    '- Axios\n' +
                    '- PapaParse\n'
                  );
                }}
              >
                <Text style={styles.linkText}>오픈소스 라이선스</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => {
                  Alert.alert(
                    '개발자 정보',
                    'EasyCloud 프로젝트',
                    [
                      { text: '확인' }
                    ]
                  );
                }}
              >
                <Text style={styles.linkText}>개발자 정보</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Button
            title="로그아웃"
            onPress={handleLogout}
            type="outline"
            style={styles.logoutButton}
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
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
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
  infoText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  actionButton: {
    marginTop: 8,
  },
  linkButton: {
    marginVertical: 8,
  },
  linkText: {
    fontSize: 16,
    color: Colors.primary,
  },
  logoutButton: {
    marginTop: 24,
  },
  dangerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.error,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 16,
    color: Colors.text,
  }
});

export default SettingsScreen;