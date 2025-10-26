// src/screens/setup/QRScanScreen.web.tsx

import React, { useEffect, useRef, useState, useContext } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import Header from '../../components/common/Header';
import Colors from '../../constants/colors';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import Routes from '../../constants/routes';
import { DeviceContext } from '../../contexts/DeviceContext';
import { AuthContext } from '../../contexts/AuthContext';
import { saveDeviceURL } from '../../utils/apiClient';  // 추가해야 함
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

interface QRData {
  device_id: string;
  local_ip: string;
  port: number;
  [key: string]: any;
}

type RootStackParamList = {
  [Routes.WIFI_SETUP]: undefined;
};

const QRScanScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { connectDevice } = useContext(DeviceContext);
  const { user } = useContext(AuthContext);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [scannerControls, setScannerControls] = useState<IScannerControls | null>(null);
  const scannedOnceRef = useRef(false);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();

    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current!, async (result, error, controls) => {
        if (result && !scannedOnceRef.current) {
          scannedOnceRef.current = true;
          console.log('✅ QR 인식됨:', result.getText());
          await handleQRCodeData(result.getText());

          // 스캔 멈춤
          controls.stop();
        }
      })
      .then((controls) => {
        setScannerControls(controls);
        console.log('📸 카메라 시작됨, 스캔 대기 중...');
      })
      .catch((err) => {
        console.error('❌ 카메라 접근 오류:', err);
        Alert.alert('오류', '카메라를 사용할 수 없습니다.');
      });

    return () => {
      scannerControls?.stop();
    };
  }, []);

  // QRScanScreen.web.tsx의 handleQRCodeData 함수 수정
  const handleQRCodeData = async (data: string) => {
    try {
      console.log("📦 QR 원문:", data);
      const qrData: QRData = JSON.parse(data);
    
      // 기기 정보 저장 및 지연된 홈 화면 이동 구현
      console.log('💬 QR 코드 인식 성공: 정보 저장 및 홈 화면 이동 준비');
      try {
        // 기기 정보 저장
        localStorage.setItem('deviceInfo', JSON.stringify(qrData));
        localStorage.setItem('qrScanned', 'true');
        // 새로고침 시 홈 화면으로 갔던 상태를 유지하기 위한 플래그 설정
        localStorage.setItem('directToHome', 'true');
        
        // 중요: API baseURL을 라즈베리파이 URL로 업데이트
        const deviceUrl = `http://${qrData.local_ip}:${qrData.port || 8000}`;
        await saveDeviceURL(deviceUrl);
        console.log('✅ API baseURL 라즈베리파이로 업데이트됨:', deviceUrl);
        
        // 기기 연결 처리 
        if (connectDevice) {
          const success = await connectDevice(qrData);
          console.log('✅ 기기 연결 결과:', success ? '성공' : '실패');
        }
        
        // 연결여부와 관계없이 성공 메시지 표시 및 홈 화면으로 2초 후 강제 이동
        Alert.alert(
          '기기 연결 성공',
          '이제 앱에서 기기를 사용할 수 있습니다. 잠시 후 홈 화면으로 이동합니다.',
          [{ text: '확인' }]
        );
        
        // 지연된 강제 이동 (2초 후) - 무조건 실행
        console.log('🕒 2초 후 홈 화면으로 강제 이동 상수메시지 설정');
        setTimeout(() => {
          console.log('🏠 홈 화면으로 지연된 강제 이동 실행');
          
          // 웹 환경에서는 직접 URL 변경 (가장 확실한 방법)
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = '/';
          } else {
            // 네이티브 환경에서는 네비게이션 리셋 
            try {
              navigation.reset({
                index: 0,
                routes: [{ name: 'HomeTab' }]
              });
            } catch (e) {
              console.error('❌ 네비게이션 오류:', e);
            }
          }
        }, 2000); // 2초 뒤 홈 화면으로 이동
      } catch (saveError) {
        console.error('❌ 정보 저장 오류:', saveError);
        Alert.alert('오류', '기기 정보 저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error("❌ QR 파싱 오류:", err);
      Alert.alert("오류", "유효하지 않은 QR 코드입니다.");
    }
  };

  return (
    <View style={styles.container}>
      <Header title="QR 코드 스캔 (웹)" />
      <View style={styles.content}>
        <Text style={styles.instructions}>QR 코드를 웹캠에 비추면 자동으로 인식됩니다.</Text>
        {user && <Text style={styles.userInfo}>로그인 사용자: {user.email}</Text>}
        <video ref={videoRef} style={styles.video} />
        <Text style={styles.tip}>💡 팁: 카메라 정면에서 QR을 확대해 보여주세요.</Text>
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
    textAlign: 'center',
    marginBottom: 24,
    color: Colors.darkGray,
    padding: 8,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
  },
  video: {
    width: '100%',
    height: 400,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#000',
  },
  tip: {
    fontSize: 14,
    marginTop: 16,
    color: Colors.darkGray,
    textAlign: 'center',
  },
});

export default QRScanScreen;
