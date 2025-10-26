/**
 * 한글 및 특수문자를 포함한 파일명 디코딩 함수
 * URL 인코딩, 언더스코어 변환 등 다양한 인코딩 문제 처리
 */
export const decodeFileName = (fileName: string): string => {
  if (!fileName) return '';
  
  try {
    // 여러 번 인코딩된 경우를 위해 반복 적용
    let decodedName = fileName;
    
    // URL 인코딩 처리 (%xx 형식)
    if (/%[0-9A-Fa-f]{2}/.test(decodedName)) {
      decodedName = decodeURIComponent(decodedName);
    }
    
    // 언더스코어(_)로 대체된 공백이나 특수문자 복원 시도
    // 서버에서 파일명에 공백이나 특수문자를 언더스코어로 변환했을 가능성 고려
    if (decodedName.includes('_')) {
      // 한글 언더스코어 패턴 감지 (예: "한글_파일명.jpg" -> "한글 파일명.jpg")
      // 한글 문자 사이의 언더스코어는 공백으로 변환
      decodedName = decodedName.replace(/([가-힣])_([가-힣])/g, '$1 $2');
      
      // 영문자와 한글 사이의 언더스코어도 공백으로 변환
      decodedName = decodedName.replace(/([A-Za-z])_([가-힣])/g, '$1 $2');
      decodedName = decodedName.replace(/([가-힣])_([A-Za-z])/g, '$1 $2');
      
      // 파일 확장자 앞의 언더스코어 처리 (예: "파일명_.jpg" -> "파일명.jpg")
      decodedName = decodedName.replace(/_\.([a-zA-Z0-9]+)$/, '.$1');
    }
    
    // 이스케이프된 문자 복원
    decodedName = decodedName.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
    
    return decodedName;
  } catch (error) {
    console.error('파일명 디코딩 오류:', error);
    return fileName; // 오류 발생 시 원본 반환
  }
};

/**
 * 객체 깊은 복사 함수 - 디코딩이 필요한 객체 전체를 처리할 때 사용
 */
export const cloneAndDecodeFileNames = <T extends object>(obj: T): T => {
  const clone = { ...obj } as T;
  
  Object.keys(clone).forEach(key => {
    const value = (clone as any)[key];
    
    if (typeof value === 'string' && (key === 'name' || key === 'path' || key.includes('name') || key.includes('path'))) {
      (clone as any)[key] = decodeFileName(value);
    } else if (typeof value === 'object' && value !== null) {
      (clone as any)[key] = cloneAndDecodeFileNames(value);
    }
  });
  
  return clone;
};
