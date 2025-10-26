import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Platform, 
  TouchableOpacity,
  ActivityIndicator,
  Modal
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import fileService from '../../services/fileService';
import Colors from '../../constants/colors';

interface FileUploaderProps {
  onUploadComplete?: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadComplete }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 이미지 선택 및 업로드
  const pickImage = async () => {
    setModalVisible(false);
    
    // 권한 확인
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('갤러리 접근 권한이 필요합니다.');
        return;
      }
    }
    
    // 이미지 선택
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // 파일 URI에서 실제 파일명 추출 또는 URI의 마지막 부분 사용
      const fileName = asset.fileName || 
                      asset.uri.split('/').pop() || 
                      `image_${new Date().getTime()}.jpg`;
      
      console.log('선택한 파일명:', fileName);
      uploadFile(asset.uri, 'image', fileName);
    }
  };
  
  // 비디오 선택 및 업로드
  const pickVideo = async () => {
    setModalVisible(false);
    
    // 권한 확인
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('갤러리 접근 권한이 필요합니다.');
        return;
      }
    }
    
    // 비디오 선택
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // 파일 URI에서 실제 파일명 추출 또는 URI의 마지막 부분 사용
      const fileName = asset.fileName || 
                      asset.uri.split('/').pop() || 
                      `video_${new Date().getTime()}.mp4`;
      
      console.log('선택한 파일명:', fileName);
      uploadFile(asset.uri, 'video', fileName);
    }
  };
  
  // 문서 선택 및 업로드
  const pickDocument = async () => {
    setModalVisible(false);
    
    // 문서 선택
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    
    if (result.canceled === false && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = asset.name || 
                      asset.uri.split('/').pop() || 
                      `document_${new Date().getTime()}.pdf`;
      
      console.log('선택한 파일명:', fileName);
      uploadFile(asset.uri, 'document', fileName);
    }
  };
  
  // 파일 업로드 공통 함수
  const uploadFile = async (uri: string, type: 'image' | 'video' | 'document', name: string) => {
    setUploading(true);
    
    try {
      await fileService.uploadFile({ uri, type, name });
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <>
      <TouchableOpacity 
        style={styles.uploadButton}
        onPress={() => setModalVisible(true)}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={Colors.card} size="small" />
        ) : (
          <Text style={styles.uploadButtonText}>+</Text>
        )}
      </TouchableOpacity>
      
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>파일 업로드</Text>
            
            <TouchableOpacity 
              style={styles.option}
              onPress={pickImage}
            >
              <Text style={styles.optionIcon}>📷</Text>
              <Text style={styles.optionText}>이미지 업로드</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.option}
              onPress={pickVideo}
            >
              <Text style={styles.optionIcon}>🎬</Text>
              <Text style={styles.optionText}>비디오 업로드</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.option}
              onPress={pickDocument}
            >
              <Text style={styles.optionIcon}>📄</Text>
              <Text style={styles.optionText}>문서 업로드</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.option, styles.cancelOption]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  uploadButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 3px 6px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  uploadButtonText: {
    fontSize: 32,
    color: Colors.card,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginVertical: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    color: Colors.text,
  },
  cancelOption: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
  },
});

export default FileUploader;