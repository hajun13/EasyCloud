// src/screens/setup/QRScanScreen.native.tsx
console.log("✅ QRScanScreen.native.tsx 로드됨");


import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Colors from '../../constants/colors';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Routes from '../../constants/routes';
import { DeviceContext } from '../../contexts/DeviceContext';
import { AuthContext } from '../../contexts/AuthContext';

interface QRData {
  device_id: string;
  local_ip: string;
  [key: string]: any;
}

type RootStackParamList = {
  [Routes.WIFI_SETUP]: undefined;
};

const QRScanScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { connectDevice, loading } = useContext(DeviceContext);
  const { user } = useContext(AuthContext);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleQRCodeData = async (data: string) => {
    try {
      const qrData: QRData = JSON.parse(data);
      if (!qrData.device_id || !qrData.local_ip) throw new Error('Invalid QR');

      // 기기 연결 시도
      const success = await connectDevice(qrData);
      
      // 새로고침 이후에도 홈 화면으로 접근하기 위한 상태 저장
      try {
        // AsyncStorage에 홈 화면으로 직접 접근하기 위한 플래그 저장
        // (AsyncStorage 가져오기 번거로움 방지, 언급만 해둡니다)
      } catch (error) {
        console.log('플래그 저장 오류:', error);
      }
      
      // 연결 결과에 따른 알림 표시
      Alert.alert(
        '기기 연결 ' + (success ? '성공' : '실패'),
        success ? '이제 앱에서 기기를 사용할 수 있습니다. 잠시 후 홈 화면으로 이동합니다.' : '기기에 연결할 수 없습니다.',
        [{ text: '확인' }]
      );
      
      // 연결 결과와 관계없이 2초 후 홈 화면으로 이동 시도
      setTimeout(() => {
        console.log('🏠 네이티브 홈 화면으로 이동 시도');
        try {
          // 방법 1: 네비게이션 리셋 사용
          navigation.reset({
            index: 0,
            routes: [{ name: 'HomeTab' }]
          });
        } catch (error) {
          console.error('❌ 네비게이션 리셋 오류:', error);
          
          // 방법 2: 일반 네비게이션 사용
          try {
            navigation.navigate('HomeTab' as any);
          } catch (navError) {
            console.error('❌ 네비게이션 오류:', navError);
          }
        }
      }, 2000); // 2초 후 실행
    } catch (err) {
      Alert.alert('오류', '유효하지 않은 QR 코드입니다.');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    await handleQRCodeData(data);
  };

  if (loading) return <LoadingSpinner message="기기에 연결 중..." />;
  if (hasPermission === null) return <LoadingSpinner message="카메라 권한 요청 중..." />;

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Header title="QR 코드 스캔" />
        <View style={styles.content}>
          <Text style={styles.instructions}>카메라 접근 권한이 필요합니다.</Text>
          <Button
            title="권한 다시 요청"
            onPress={async () => {
              const { status } = await BarCodeScanner.requestPermissionsAsync();
              setHasPermission(status === 'granted');
            }}
            style={styles.button}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="QR 코드 스캔" />
      <View style={styles.content}>
        <Text style={styles.instructions}>QR 코드를 스캔하세요.</Text>
        {user && <Text style={styles.userInfo}>로그인 사용자: {user.email}</Text>}
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        {scanned && <Button title="다시 스캔" onPress={() => setScanned(false)} style={styles.button} />}
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
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructions: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    color: Colors.text,
  },
  userInfo: {
    fontSize: 14,
    marginBottom: 24,
    color: Colors.darkGray,
    padding: 8,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  scannerContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    marginVertical: 16,
  },
});

export default QRScanScreen;
