import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import QRScanScreen from './src/screens/setup/QRScanScreen.web';
// WifiSetupScreen 임포트 제거
import AppNavigator from './src/navigation/AppNavigator'; // 탭 네비게이터 포함
import { AuthProvider } from './src/contexts/AuthContext';
import { DeviceProvider } from './src/contexts/DeviceContext';
import { saveDeviceURL } from './src/utils/apiClient'; // ✅ 추가됨
import deviceService from './src/services/deviceService'; // 추가 필요
import { ServerConfig } from './src/config/serverConfig';

const Stack = createStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ✅ 앱 시작 시 로그인 서버 URL 초기화
  // App.js 또는 App.tsx의 useEffect에서
  // ✅ 앱 시작 시 로그인 서버 URL 초기화
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🔄 앱 초기화 시작...');
        
        // QR 스캔 완료 여부 확인
        const qrScanned = localStorage.getItem('qrScanned') === 'true';
        console.log('📋 QR 스캔 상태:', qrScanned ? '완료' : '미완료');
        
        if (qrScanned) {
          // QR 스캔 완료: 저장된 라즈베리파이 기기 정보 사용
          const deviceUrl = ServerConfig.getServerUrl('device');
          await saveDeviceURL(deviceUrl);
          console.log('✅ 기기 서버 URL 설정됨:', deviceUrl);
        } else {
          // QR 스캔 전: 로컬 로그인 서버 사용
          const authUrl = ServerConfig.getServerUrl('auth');
          await saveDeviceURL(authUrl);
          console.log('✅ 인증 서버 URL 설정됨:', authUrl);
        }
      } catch (error) {
        console.error('❌ 앱 초기화 오류:', error);
        // 오류 발생 시 기본 인증 서버 사용
        await saveDeviceURL(ServerConfig.authServer);
      }
    };
    
    initApp();
  }, []);

  // ✅ 로컬 스토리지에서 로그인 상태 확인
  useEffect(() => {
    const handleStorageChange = () => {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
      setIsLoggedIn(loggedIn);
    };

    window.addEventListener('storage', handleStorageChange);
    handleStorageChange();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ✅ 초기 라우트 설정
  useEffect(() => {
    try {
      const qrScanned = localStorage.getItem('qrScanned') === 'true';

      if (!isLoggedIn) {
        setInitialRoute('Login');
      } else if (!qrScanned) {
        setInitialRoute('QRScan');
      } else {
        setInitialRoute('Main');
      }
    } catch (error) {
      console.error('상태 확인 오류:', error);
      setInitialRoute('Login');
    }
  }, [isLoggedIn]);

  if (!initialRoute) return null;

  return (
    <AuthProvider>
      <DeviceProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="QRScan" component={QRScanScreen} />
            {/* WifiSetup 화면 제거 */}
            <Stack.Screen name="Main" component={AppNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
      </DeviceProvider>
    </AuthProvider>
  );
}
