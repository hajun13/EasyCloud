import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// 일반 데이터 저장
export const storeData = async (key: string, value: any) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    return true;
  } catch (e) {
    console.error('저장 오류:', e);
    return false;
  }
};

// 일반 데이터 불러오기
export const getData = async (key: string) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('불러오기 오류:', e);
    return null;
  }
};

// 보안 데이터 저장 (토큰 등)
export const storeSecureData = async (key: string, value: string) => {
  try {
    // 웹 환경에서는 localStorage 사용
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`secure_${key}`, value);
        return true;
      }
      return false;
    }
    
    // 네이티브 환경에서는 SecureStore 사용
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch (e) {
    console.error('보안 저장 오류:', e);
    return false;
  }
};

// 보안 데이터 불러오기
export const getSecureData = async (key: string) => {
  try {
    // 웹 환경에서는 localStorage 사용
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = localStorage.getItem(`secure_${key}`);
        return value;
      }
      return null;
    }
    
    // 네이티브 환경에서는 SecureStore 사용
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.error('보안 불러오기 오류:', e);
    return null;
  }
};

// 데이터 삭제
export const removeData = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('삭제 오류:', e);
    return false;
  }
};

// 보안 데이터 삭제
export const removeSecureData = async (key: string) => {
  try {
    // 웹 환경에서는 localStorage 사용
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`secure_${key}`);
        return true;
      }
      return false;
    }
    
    // 네이티브 환경에서는 SecureStore 사용
    await SecureStore.deleteItemAsync(key);
    return true;
  } catch (e) {
    console.error('보안 삭제 오류:', e);
    return false;
  }
};