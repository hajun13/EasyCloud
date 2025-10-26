import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { forceDiscoverServer } from '../utils/apiClient';

interface ServerDiscoveryButtonProps {
  onSuccess?: (url: string) => void;
  onFailure?: (error: string) => void;
  buttonText?: string;
  buttonStyle?: object;
  textStyle?: object;
  disableWhenSearching?: boolean;
}

const ServerDiscoveryButton: React.FC<ServerDiscoveryButtonProps> = ({
  onSuccess,
  onFailure,
  buttonText = '서버 자동 탐색',
  buttonStyle,
  textStyle,
  disableWhenSearching = true
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleDiscovery = async () => {
    if (isSearching && disableWhenSearching) return;
    
    setIsSearching(true);
    setStatusMessage('서버 탐색 중...');
    
    try {
      const result = await forceDiscoverServer();
      
      if (result.success) {
        setStatusMessage('서버 발견! 연결 중...');
        onSuccess && onSuccess(result.url);
        setTimeout(() => {
          setStatusMessage('연결 성공!');
          setTimeout(() => setStatusMessage(null), 2000);
        }, 1000);
      } else {
        setStatusMessage('서버를 찾을 수 없습니다.');
        onFailure && onFailure(result.error || '알 수 없는 오류');
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (error) {
      setStatusMessage('오류가 발생했습니다.');
      onFailure && onFailure(error.message);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          isSearching && disableWhenSearching ? styles.buttonDisabled : null,
          buttonStyle
        ]}
        onPress={handleDiscovery}
        disabled={isSearching && disableWhenSearching}
      >
        {isSearching ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={[styles.buttonText, textStyle]}>{buttonText}</Text>
        )}
      </TouchableOpacity>
      
      {statusMessage && (
        <Text style={styles.statusText}>{statusMessage}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#999999',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
  }
});

export default ServerDiscoveryButton;