import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import FileBrowserScreen from '../screens/files/FileBrowserScreen';
import FileDetailScreen from '../screens/files/FileDetailScreen';
import FileShareScreen from '../screens/files/FileShareScreen';
import SettingsScreen from '../screens/SettingsScreen';
// WifiSetupScreen 임포트 제거
import Routes from '../constants/routes';
import Colors from '../constants/colors';
import { Text, View } from 'react-native';

// 스택 및 탭 네비게이터의 파라미터 타입 정의
type FileStackParamList = {
  [Routes.FILE_BROWSER]: undefined;
  [Routes.FILE_DETAIL]: { file: any };
  [Routes.FILE_SHARE]: { file: any };
};

type TabParamList = {
  [Routes.HOME_TAB]: undefined;
  [Routes.FILES_TAB]: undefined;
  [Routes.SETTINGS_TAB]: undefined;
};

type MainStackParamList = {
  Tabs: undefined;
  [Routes.WIFI_SETUP]: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const FileStack = createStackNavigator<FileStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

const FileNavigator = () => {
  return (
    <FileStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <FileStack.Screen name={Routes.FILE_BROWSER} component={FileBrowserScreen} />
      <FileStack.Screen name={Routes.FILE_DETAIL} component={FileDetailScreen} />
      <FileStack.Screen name={Routes.FILE_SHARE} component={FileShareScreen} />
    </FileStack.Navigator>
  );
};

// 탭 아이콘 컴포넌트의 props 인터페이스 정의
interface TabIconProps {
  name: 'home' | 'files' | 'settings';
  focused: boolean;
}

// 간단한 탭 아이콘 컴포넌트
const TabIcon = ({ name, focused }: TabIconProps) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ 
      color: focused ? Colors.primary : Colors.darkGray,
      fontSize: 24,
      marginBottom: 2
    }}>
      {name === 'home' ? '🏠' : name === 'files' ? '📁' : '⚙️'}
    </Text>
    <Text style={{ 
      color: focused ? Colors.primary : Colors.darkGray,
      fontSize: 12
    }}>
      {name === 'home' ? '홈' : name === 'files' ? '파일' : '설정'}
    </Text>
  </View>
);

// 탭 네비게이터 커스텀 컴포넌트
const TabsScreen = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.darkGray,
        tabBarStyle: {
          height: 60,
          paddingVertical: 5,
        },
      }}
    >
      <Tab.Screen 
        name={Routes.HOME_TAB} 
        component={HomeScreen} 
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="home" focused={focused} />
        }}
      />
      <Tab.Screen 
        name={Routes.FILES_TAB} 
        component={FileNavigator} 
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="files" focused={focused} />
        }}
      />
      <Tab.Screen 
        name={Routes.SETTINGS_TAB} 
        component={SettingsScreen} 
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }: { focused: boolean }) => <TabIcon name="settings" focused={focused} />
        }}
      />
    </Tab.Navigator>
  );
};

// 메인 스택 네비게이터 (탭 포함)
const AppNavigator = () => {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={TabsScreen} />
      {/* WiFi 설정 화면 제거 */}
    </MainStack.Navigator>
  );
};

export default AppNavigator;