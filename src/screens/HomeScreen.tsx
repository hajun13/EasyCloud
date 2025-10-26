import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import { AuthContext } from '../contexts/AuthContext';
import { DeviceContext } from '../contexts/DeviceContext';
import Colors from '../constants/colors';
import Routes from '../constants/routes';
import fileServiceModule from '../services/fileService';

interface FileType {
  id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
  modified?: string;
  [key: string]: any;
}

interface User {
  email: string;
  [key: string]: any;
}

interface DeviceInfo {
  device_id: string;
  local_ip: string;
  port: number;
  [key: string]: any;
}

interface DeviceStatus {
  storage: {
    total: number;
    used: number;
  };
  cpu: number;
  memory: {
    total: number;
    used: number;
  };
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
}

interface DeviceContextType {
  deviceInfo: DeviceInfo | null;
  deviceStatus: DeviceStatus | null;
  refreshDeviceStatus: () => Promise<void>;
  isWifiConfigured?: boolean; // WiFi 설정 상태 추가
}

type RootStackParamList = {
  [Routes.FILES_TAB]: {
    screen: string;
    params?: any;
  };
  [Routes.HOME_TAB]: undefined;
  [Routes.SETTINGS_TAB]: undefined;
  [Routes.WIFI_SETUP]: undefined; // WiFi 설정 화면 추가
  [key: string]: any; // 추가: 다른 라우트를 위한 인덱스 시그니처
};

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useContext(AuthContext) as AuthContextType;
  const { deviceInfo, deviceStatus, refreshDeviceStatus } = useContext(DeviceContext) as DeviceContextType;

  const [recentFiles, setRecentFiles] = useState<FileType[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isWifiConfigured, setIsWifiConfigured] = useState<boolean | undefined>(undefined);
  
  // WiFi 구성 여부 확인 - 랜선 연결만 지원하도록 변경했으므로 필요 없음
  // useEffect(() => {
  //   const checkWifiStatus = async () => {
  //     try {
  //       // QR 코드 스캔 후 홈 화면으로 바로 접근하는 경우 유지
  //       if (Platform.OS === 'web' && typeof window !== 'undefined') {
  //         const directToHome = localStorage.getItem('directToHome') === 'true';
  //         const wifiConfigured = localStorage.getItem('wifiConfigured');

  //         // QR 스캔 후 바로 홈 화면으로 왔는데 WiFi 구성이 안되어 있는 경우
  //         if (directToHome && wifiConfigured !== 'true') {
  //           // WiFi 설정이 안되어 있다고 표시
  //           setIsWifiConfigured(false);
  //         } else {
  //           setIsWifiConfigured(wifiConfigured === 'true');
  //         }
  //       } else {
  //         // 네이티브용 코드 (이 파일에서는 구현하지 않음)
  //       }
  //     } catch (error) {
  //       console.error('WiFi 상태 확인 오류:', error);
  //     }
  //   };
    
  //   checkWifiStatus();
  // }, []);

  const loadRecentFiles = async () => {
    try {
      const files = await fileServiceModule.getFiles();
      if (Array.isArray(files)) {
        setRecentFiles((files as FileType[]).slice(0, 3));
      } else {
        console.error('파일 목록이 배열이 아닙니다:', files);
        setRecentFiles([]);
      }
    } catch (error) {
      console.error('최근 파일 조회 오류:', error);
      setRecentFiles([]);
    }
  };

  useEffect(() => {
    loadRecentFiles();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshDeviceStatus(), loadRecentFiles()]);
    } catch (error) {
      console.error('새로고침 오류:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatStorage = (bytes: number | undefined): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  };

  const calculateUsagePercent = (): number => {
    const used = deviceStatus?.storage?.used ?? 0;
    const total = deviceStatus?.storage?.total ?? 1;
    return Math.round((used / total) * 100);
  };
  
  // WiFi 설정 페이지로 이동 함수 제거 - 랜선 연결만 지원

  return (
    <View style={styles.container}>
      <Header title="EasyCloud" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <Text style={styles.welcomeText}>
            안녕하세요, {user?.email}님!
          </Text>

          {/* WiFi 설정 알림 카드 제거 - 랜선 연결만 지원 */}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>기기 정보</Text>
            {deviceInfo ? (
              <>
                <Text style={styles.infoText}>기기 ID: {deviceInfo.device_id}</Text>
                <Text style={styles.infoText}>IP 주소: {deviceInfo.local_ip}</Text>
                <Text style={styles.infoText}>포트: {deviceInfo.port}</Text>
              </>
            ) : (
              <Text style={styles.infoText}>연결된 기기가 없습니다.</Text>
            )}
          </View>

          {deviceStatus?.storage && (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>저장소 상태</Text>
              <View style={styles.storageBarContainer}>
                <View
                  style={[styles.storageBar, { width: `${calculateUsagePercent()}%` }]}
                />
              </View>
              <Text style={styles.infoText}>
                {formatStorage(deviceStatus.storage.used)} / {formatStorage(deviceStatus.storage.total)} 사용 중 ({calculateUsagePercent()}%)
              </Text>
              {deviceStatus.memory && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.infoText}>CPU: {deviceStatus.cpu}%</Text>
                  <Text style={styles.infoText}>
                    메모리: {formatStorage(deviceStatus.memory.used)} / {formatStorage(deviceStatus.memory.total)}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.actionsContainer}>
            <Text style={styles.infoTitle}>빠른 작업</Text>
            <View style={styles.actionButtons}>
              <Button
                title="파일 보기"
                onPress={() =>
                  navigation.navigate(Routes.FILES_TAB, {
                    screen: Routes.FILE_BROWSER,
                  })
                }
                style={styles.actionButton}
              />
              <Button
                title="사진 업로드"
                onPress={() =>
                  navigation.navigate(Routes.FILES_TAB, {
                    screen: Routes.FILE_BROWSER,
                  })
                }
                style={styles.actionButton}
              />
            </View>
          </View>

          {recentFiles.length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.recentHeader}>
                <Text style={styles.infoTitle}>최근 파일</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate(Routes.FILES_TAB, {
                      screen: Routes.FILE_BROWSER,
                    })
                  }
                >
                  <Text style={styles.seeAllText}>모두 보기</Text>
                </TouchableOpacity>
              </View>

              {recentFiles.map((file, index) => (
                <TouchableOpacity
                  key={file.id || index}
                  style={styles.recentFileItem}
                  onPress={() => {
                    navigation.navigate(Routes.FILES_TAB, {
                      screen: Routes.FILE_DETAIL,
                      params: { file },
                    });
                  }}
                >
                  <View style={styles.recentFileIcon}>
                    <Text style={styles.recentFileIconText}>
                      {file.type === 'image'
                        ? '🖼️'
                        : file.type === 'video'
                        ? '🎬'
                        : '📄'}
                    </Text>
                  </View>
                  <View style={styles.recentFileInfo}>
                    <Text style={styles.recentFileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.recentFileDetails}>{formatStorage(file.size)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  // WiFi 관련 스타일 제거 - 랜선 연결만 지원
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 24,
  },
  infoCard: {
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
    color: Colors.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  storageBarContainer: {
    height: 12,
    backgroundColor: Colors.lightGray,
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  storageBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
  },
  recentFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recentFileIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentFileIconText: {
    fontSize: 18,
  },
  recentFileInfo: {
    flex: 1,
  },
  recentFileName: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  recentFileDetails: {
    fontSize: 14,
    color: Colors.darkGray,
  },
});

export default HomeScreen;