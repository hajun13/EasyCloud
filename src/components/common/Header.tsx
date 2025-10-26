import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/colors';
import { decodeFileName } from '../../utils/stringUtils';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  rightComponent?: React.ReactNode;
  maxTitleLength?: number;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  rightComponent,
  maxTitleLength = 25
}) => {
  const navigation = useNavigation();

  // 긴 제목 처리 및 한글 디코딩
  const formattedTitle = React.useMemo(() => {
    // 제목 디코딩 (한글 URL 인코딩 문제 해결)
    const decodedTitle = decodeFileName(title);

    // 제목이 너무 길면 ... 처리
    if (decodedTitle.length > maxTitleLength) {
      return decodedTitle.substring(0, maxTitleLength - 3) + '...';
    }
    return decodedTitle;
  }, [title, maxTitleLength]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('QRScan'); // QRScan은 실제 등록된 route 이름이어야 함
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.leftContainer}>
        {showBackButton && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
          >
            <Text style={styles.backButtonText}>← 뒤로</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {formattedTitle}
        </Text>
      </View>

      <View style={styles.rightContainer}>
        {rightComponent}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  leftContainer: {
    width: 80,
    alignItems: 'flex-start',
    zIndex: 10,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  rightContainer: {
    width: 80,
    alignItems: 'flex-end',
    zIndex: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 16,
  },
});

export default Header;