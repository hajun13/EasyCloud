import React, { useState, useContext, useEffect } from 'react'; // useEffect 추가
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { AuthContext } from '../../contexts/AuthContext';
import Colors from '../../constants/colors';
import Routes from '../../constants/routes';
import apiClient, { saveDeviceURL } from '../../utils/apiClient';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login, loading } = useContext(AuthContext);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });

    // 컴포넌트 마운트 시 로그인 상태 확인
  useEffect(() => {
    // 이미 로그인된 상태인지 확인
    const checkLoginStatus = () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
          // QR 스캔 상태 확인
          const qrScanned = localStorage.getItem('qrScanned') === 'true';
          if (qrScanned) {
            // QR 스캔 완료 상태면 바로 홈 화면으로 이동
            console.log('🏠 QR 스캔 완료 상태 - 홈 화면으로 직접 이동');
            navigation.navigate('Main' as never);
          } else {
            // 로그인만 된 상태면 QR 스캔 화면으로 이동
            navigation.navigate('QRScan' as never);
          }
        }
      }
    };
    
    checkLoginStatus();
  }, [navigation]);
  
  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: '', password: '' };
    
    if (!email) {
      newErrors.email = '이메일을 입력해주세요';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '유효한 이메일 주소를 입력해주세요';
      isValid = false;
    }
    
    if (!password) {
      newErrors.password = '비밀번호를 입력해주세요';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  // LoginScreen.tsx의 handleLogin 함수 수정
  const handleLogin = async () => {
    console.log('🔄 로그인 시도...');
    
    if (!validateForm()) {
      console.log('❌ 폼 유효성 검사 실패');
      return;
    }
    
    try {
      // 로그인 시도 전에 명시적으로 로컬 서버 URL 설정
      apiClient.defaults.baseURL = 'http://192.168.35.3:8000';
      console.log('🔧 로그인 전 baseURL 명시적 설정:', apiClient.defaults.baseURL);
      
      // 로그인 URL 확인 (디버깅)
      console.log('🌐 현재 API 기본 URL:', apiClient.defaults.baseURL);
      
      const success = await login(email, password);
      
      if (!success) {
        console.log('❌ 로그인 실패');
        setErrors({
          email: '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.',
          password: ''
        });
      } else {
        console.log('✅ 로그인 성공');
        
        // 로그인 성공 시 로컬 스토리지에 상태 저장
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', email);
        console.log('💾 로그인 상태 저장됨');
        
        // baseURL을 계속 로컬 서버로 유지
        await saveDeviceURL('http://192.168.35.3:8000');
        console.log('🌐 API URL 로컬 서버로 유지: http://192.168.35.3:8000');
        
        // QR 스캔 화면으로 이동
        console.log('🔄 QR 스캔 화면으로 이동...');
        navigation.navigate('QRScan' as never);
      }
    } catch (error) {
      console.error('❌ 로그인 처리 오류:', error);
      setErrors({
        email: '서버 연결에 실패했습니다. 네트워크 연결을 확인해주세요.',
        password: ''
      });
    };
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>EasyCloud</Text>
          <Text style={styles.subtitle}>라즈베리파이 개인 클라우드</Text>
          
          <View style={styles.form}>
            <Input
              label="이메일"
              value={email}
              onChangeText={setEmail}
              placeholder="이메일 주소를 입력하세요"
              keyboardType="email-address"
              error={errors.email}
            />
            
            <Input
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호를 입력하세요"
              secureTextEntry
              error={errors.password}
            />
            
            <Button
              title="로그인"
              onPress={handleLogin}
              style={styles.loginButton}
            />
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>계정이 없으신가요?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate(Routes.REGISTER as never)}
            >
              <Text style={styles.registerText}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    marginBottom: 24,
  },
  loginButton: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: Colors.text,
  },
  registerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 8,
  },
});

export default LoginScreen;