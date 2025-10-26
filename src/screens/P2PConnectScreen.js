/**
 * P2P 연결 화면 - QR 코드 스캔을 통한 P2P 연결 기능
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';

// P2P 서비스 가져오기
import { p2pService, p2pEvents } from '../services/p2p';

const P2PConnectScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  // 상태 관리
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [flashMode, setFlashMode] = useState(Camera.Constants.FlashMode.off);
  
  // 카메라 참조
  const cameraRef = useRef(null);
  
  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 스캔 중이고 연결이 완료되지 않은 경우 연결 취소
      if (scanned && connecting) {
        p2pService.disconnect();
      }
    };
  }, [scanned, connecting]);
  
  // 파일 브라우저로 이동 리스너
  useEffect(() => {
    const onDeviceConnected = () => {
      setConnecting(false);
      
      // 파일 브라우저 화면으로 이동
      navigation.navigate('P2PFileBrowser');
    };
    
    // 장치 연결 이벤트 리스너 등록
    p2pEvents.on('dataChannel-open', onDeviceConnected);
    
    return () => {
      p2pEvents.off('dataChannel-open', onDeviceConnected);
    };
  }, [navigation]);
  
  // 오류 처리 리스너
  useEffect(() => {
    const onError = (event) => {
      if (event.name.includes('error') || event.name.includes('failed')) {
        setConnecting(false);
        setScanned(false);
        
        Alert.alert(
          '연결 오류',
          '장치에 연결할 수 없습니다. 다시 시도해주세요.',
          [{ text: '확인' }]
        );
      }
    };
    
    p2pEvents.on('any', onError);
    
    return () => {
      p2pEvents.off('any', onError);
    };
  }, []);
  
  // QR 코드 스캔 처리
  const handleBarCodeScanned = async ({ type, data }) => {
    try {
      // 이미 스캔한 경우 중복 처리 방지
      if (scanned || connecting) return;
      
      setScanned(true);
      setConnecting(true);
      
      console.log(`QR 코드 스캔: ${data} (${type})`);
      
      // P2P 연결 시도
      const connected = await p2pService.connectWithQRCode(data);
      
      if (!connected) {
        setConnecting(false);
        Alert.alert(
          '연결 실패',
          'QR 코드를 확인하고 다시 시도해주세요.',
          [
            { 
              text: '다시 시도',
              onPress: () => {
                setScanned(false);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('QR 코드 처리 오류:', error);
      setConnecting(false);
      
      Alert.alert(
        '연결 오류',
        error.message || '알 수 없는 오류가 발생했습니다.',
        [
          { 
            text: '다시 시도',
            onPress: () => {
              setScanned(false);
            }
          }
        ]
      );
    }
  };
  
  // 플래시 토글
  const toggleFlash = () => {
    setFlashMode(
      flashMode === Camera.Constants.FlashMode.off
        ? Camera.Constants.FlashMode.torch
        : Camera.Constants.FlashMode.off
    );
  };
  
  // 권한 처리
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.text}>카메라 권한 요청 중...</Text>
      </View>
    );
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-off" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>카메라 접근 권한이 필요합니다</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {isFocused && (
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={Camera.Constants.Type.back}
          flashMode={flashMode}
          onBarCodeScanned={handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
          }}
        />
      )}
      
      <View style={styles.overlay}>
        {connecting ? (
          <View style={styles.connectingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.connectingText}>장치에 연결 중...</Text>
          </View>
        ) : (
          <View style={styles.scanContainer}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>
              QR 코드를 스캔하여 장치에 연결하세요
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={toggleFlash}
        >
          <Ionicons
            name={flashMode === Camera.Constants.FlashMode.off ? "flash-off" : "flash"}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 20,
    marginBottom: 20,
  },
  scanText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
  },
  connectingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 10,
  },
  connectingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default P2PConnectScreen;
