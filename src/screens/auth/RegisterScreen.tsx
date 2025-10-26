import React, { useState, useContext } from 'react';
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

const RegisterScreen = () => {
  const navigation = useNavigation();
  const { register, loading } = useContext(AuthContext);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({ 
    email: '', 
    password: '',
    confirmPassword: '' 
  });
  
  const validateForm = () => {
    let isValid = true;
    const newErrors = { 
      email: '', 
      password: '',
      confirmPassword: '' 
    };
    
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
    } else if (password.length < 6) {
      newErrors.password = '비밀번호는 최소 6자 이상이어야 합니다';
      isValid = false;
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  const handleRegister = async () => {
    if (!validateForm()) return;
    
    const success = await register(email, password);
    if (!success) {
      setErrors({
        ...errors,
        email: '회원가입에 실패했습니다. 다시 시도해주세요.'
      });
    }
  };
  
  if (loading) {
    return <LoadingSpinner message="회원가입 중..." />;
  }
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>EasyCloud 사용을 위한 계정을 만드세요</Text>
          
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
            
            <Input
              label="비밀번호 확인"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="비밀번호를 다시 입력하세요"
              secureTextEntry
              error={errors.confirmPassword}
            />
            
            <Button
              title="회원가입"
              onPress={handleRegister}
              style={styles.registerButton}
            />
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>이미 계정이 있으신가요?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate(Routes.LOGIN as never)}
            >
              <Text style={styles.loginText}>로그인</Text>
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
  registerButton: {
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
  loginText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 8,
  },
});

export default RegisterScreen;