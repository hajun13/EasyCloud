import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import QRScanScreen from '../screens/setup/QRScanScreen.web';
// WifiSetupScreen 임포트 제거
import Routes from '../constants/routes';
import { Platform } from 'react-native';

const Stack = createStackNavigator();

const SetupNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={Routes.QR_SCAN}
    >
      <Stack.Screen name={Routes.QR_SCAN} component={QRScanScreen} />
      {/* WiFi 설정 화면 완전히 제거 */}
    </Stack.Navigator>
  );
};

export default SetupNavigator;