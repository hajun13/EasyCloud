import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import SetupNavigator from './SetupNavigator';
import { AuthContext } from '../contexts/AuthContext';
import { DeviceContext } from '../contexts/DeviceContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const RootNavigator = () => {
  const { isAuthenticated, loading: authLoading } = useContext(AuthContext);
  const { isDeviceConnected, loading: deviceLoading } = useContext(DeviceContext);
  const [isLoading, setIsLoading] = useState(true);
  
  // 다이렉트 홈 네비게이션을 위한 움직임 추적
  const [previousDeviceConnected, setPreviousDeviceConnected] = useState(false);
  
  useEffect(() => {
    if (!authLoading && !deviceLoading) {
      setIsLoading(false);
    }
  }, [authLoading, deviceLoading]);
  
  // 기기 연결 상태가 false에서 true로 변경되면 웹 페이지 새로고침
  useEffect(() => {
    if (isDeviceConnected && !previousDeviceConnected && !isLoading) {
      console.log('💬 기기 상태가 연결됨으로 변경됨 - 홈으로 수동 리디렉션');
      
      // 웹 환경일 경우 새로고침 시도 및 상태 저장
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.setItem('directToHome', 'true'); // 플래그 설정
        window.location.href = '/';
      }
    }
    setPreviousDeviceConnected(isDeviceConnected);
  }, [isDeviceConnected, previousDeviceConnected, isLoading]);
  
  // 웹 환경에서 WIFI 설정 화면 회피 및 홈 화면 직접 접근
  useEffect(() => {
    // 웹 환경에서만 적용
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const directToHome = localStorage.getItem('directToHome');
      const currentPath = window.location.pathname;
      
      // 새로고침 후 WiFi 설정 화면으로 가려고 할 때 홈으로 리디렉션
      if (directToHome === 'true' && currentPath.includes('wifi-setup')) {
        console.log('🏠 WiFi 설정 화면 회피 및 홈 화면으로 강제 이동');
        setTimeout(() => {
          window.location.href = '/';
        }, 100); // 짠 대기 후 이동
      }
    }
  }, []);

  if (isLoading) {
    return <LoadingSpinner message="앱을 로드하는 중..." />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {!isAuthenticated ? (
          <AuthNavigator />
        ) : !isDeviceConnected ? (
          <SetupNavigator />
        ) : (
          <AppNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default RootNavigator;