# 🌩️ EasyCloud

**라즈베리파이 기반 개인 클라우드 스토리지 & P2P 파일 공유 시스템**

> React Native + Expo로 구현한 크로스 플랫폼 모바일 애플리케이션과 Flask 백엔드 서버

---

## 📋 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시스템 아키텍처](#-시스템-아키텍처)
- [설치 및 실행](#-설치-및-실행)
- [프로젝트 구조](#-프로젝트-구조)
- [개발 과정](#-개발-과정)
- [트러블슈팅](#-트러블슈팅)
- [향후 계획](#-향후-계획)

---

## 🎯 프로젝트 소개

EasyCloud는 라즈베리파이를 개인 클라우드 서버로 활용하여 파일을 안전하게 저장하고, P2P 기술로 직접 파일을 공유할 수 있는 모바일 애플리케이션입니다.

### 개발 동기

- 대용량 클라우드 서비스의 높은 구독료 문제 해결
- 개인 데이터의 프라이버시 보호
- 저전력 장치를 활용한 친환경적 개인 서버 구축
- P2P 기술을 통한 중앙 서버 부하 감소

### 개발 기간

2025년 4월 - 2025년 5월 (약 2개월)

---

## ✨ 주요 기능

### 1. 🔐 사용자 인증 시스템
- JWT 기반 회원가입 및 로그인
- Secure Store를 활용한 토큰 안전 관리
- 자동 로그인 및 세션 유지

### 2. 📱 QR 코드 기반 기기 등록
- QR 스캔을 통한 라즈베리파이 자동 연결
- 기기 정보 자동 저장 및 관리
- 웹과 모바일 환경 모두 지원

### 3. 📁 파일 관리 시스템
- 파일 업로드/다운로드
- 폴더 구조 탐색
- 파일 상세 정보 조회
- 다중 파일 선택 및 관리

### 4. 🔄 P2P 파일 공유
- WebRTC 기반 직접 연결
- Socket.io를 통한 시그널링 서버 구현
- 중앙 서버를 거치지 않는 파일 전송
- 실시간 연결 상태 모니터링

### 5. 🌐 크로스 플랫폼 지원
- iOS, Android 네이티브 앱
- 웹 브라우저 지원
- 일관된 사용자 경험 제공

---

## 🛠️ 기술 스택

### Frontend

| 분류 | 기술 스택 |
|------|----------|
| **Framework** | React Native 0.76.8, Expo 50.0.0 |
| **언어** | TypeScript 5.3.3 |
| **상태관리** | React Context API |
| **네비게이션** | React Navigation 6.x |
| **P2P 통신** | WebRTC, Simple-Peer, Socket.io-client |
| **QR 스캔** | Expo Barcode Scanner, html5-qrcode |
| **파일 처리** | Expo Document Picker, Expo Image Picker |
| **보안 저장소** | Expo Secure Store |
| **HTTP 클라이언트** | Axios |
| **번들링** | Webpack 5.x, Babel |

### Backend

| 분류 | 기술 스택 |
|------|----------|
| **Framework** | Flask 3.1.0 |
| **언어** | Python 3.x |
| **인증** | Flask-JWT-Extended 4.7.1 |
| **비밀번호 암호화** | Passlib 1.7.4 |
| **CORS** | Flask-CORS 5.0.1 |
| **서버** | WSGI (Gunicorn/uWSGI) |

### DevOps & Tools

- Git & GitHub (버전 관리)
- npm (패키지 관리)
- Expo CLI (개발 및 빌드)
- VS Code (IDE)

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐
│   모바일 앱     │
│  (React Native) │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
         ▼              ▼
┌─────────────┐  ┌──────────────┐
│ 인증 서버   │  │ 기기 서버    │
│  (Flask)    │  │ (라즈베리파이)│
└─────────────┘  └──────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐          ┌─────────────────┐
│   파일 저장소   │          │ P2P 시그널링    │
│  (로컬 스토리지)│          │  (Socket.io)    │
└─────────────────┘          └─────────────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │  WebRTC P2P 연결 │
                             │   (Peer to Peer) │
                             └─────────────────┘
```

### 동작 원리

1. **초기 설정**: 사용자가 앱에서 QR 코드를 스캔하여 라즈베리파이 정보 등록
2. **인증 처리**: Flask 인증 서버에서 JWT 토큰 발급 및 검증
3. **파일 관리**: 라즈베리파이 기기 서버와 통신하여 파일 CRUD 작업
4. **P2P 공유**: Socket.io 시그널링을 통해 피어 연결 후 WebRTC로 직접 파일 전송

---

## 🚀 설치 및 실행

### 사전 요구사항

- Node.js 18.x 이상
- Python 3.8 이상
- npm 또는 yarn
- Expo CLI (`npm install -g expo-cli`)
- 라즈베리파이 (선택사항, 테스트용으로는 로컬 서버 사용 가능)

### 1. 저장소 클론

```bash
git clone https://github.com/yourusername/easycloud.git
cd easycloud
```

### 2. Frontend 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm start

# 또는 특정 플랫폼으로 실행
npm run ios      # iOS 시뮬레이터
npm run android  # Android 에뮬레이터
npm run web      # 웹 브라우저
```

### 3. Backend 설정

```bash
cd easycloud-backend

# 가상환경 생성 (선택사항)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
export JWT_SECRET_KEY="your-secret-key"
export FLASK_APP=wsgi.py
export FLASK_ENV=development

# 서버 실행
flask run --host=0.0.0.0 --port=5000
```

### 4. 환경변수 설정

프로젝트 루트에 `.env.development` 파일 생성:

```env
AUTH_SERVER_URL=http://localhost:5000
DEVICE_SERVER_URL=http://192.168.x.x:5000
SIGNALING_SERVER_URL=http://192.168.x.x:3000
```

---

## 📂 프로젝트 구조

```
EasyCloud/
├── App.tsx                      # 앱 진입점
├── app.json                     # Expo 설정
├── package.json                 # 의존성 관리
├── tsconfig.json                # TypeScript 설정
│
├── src/
│   ├── components/              # 재사용 가능한 컴포넌트
│   │   ├── auth/               # 인증 관련 컴포넌트
│   │   ├── device/             # 기기 관련 컴포넌트
│   │   ├── files/              # 파일 관련 컴포넌트
│   │   └── common/             # 공통 컴포넌트
│   │
│   ├── screens/                 # 화면 컴포넌트
│   │   ├── auth/               # 로그인, 회원가입
│   │   ├── setup/              # QR 스캔, 기기 설정
│   │   ├── files/              # 파일 브라우저, 상세보기
│   │   ├── HomeScreen.tsx      # 홈 화면
│   │   ├── P2PConnectScreen.js # P2P 연결 화면
│   │   └── SettingsScreen.tsx  # 설정 화면
│   │
│   ├── contexts/                # Context API
│   │   ├── AuthContext.tsx     # 인증 상태 관리
│   │   └── DeviceContext.tsx   # 기기 정보 관리
│   │
│   ├── services/                # API 서비스 레이어
│   │   ├── authService.ts      # 인증 API
│   │   ├── deviceService.ts    # 기기 API
│   │   └── fileService.ts      # 파일 API
│   │
│   ├── navigation/              # 네비게이션 설정
│   │   ├── AppNavigator.tsx    # 메인 네비게이터
│   │   └── AuthNavigator.tsx   # 인증 네비게이터
│   │
│   ├── utils/                   # 유틸리티 함수
│   │   ├── storage.ts          # 로컬 저장소 관리
│   │   └── apiClient.ts        # HTTP 클라이언트
│   │
│   └── constants/               # 상수 정의
│       ├── colors.ts           # 컬러 팔레트
│       └── routes.ts           # 라우트 이름
│
└── easycloud-backend/           # Flask 백엔드
    ├── app/
    │   ├── __init__.py         # Flask 앱 초기화
    │   ├── models/             # 데이터 모델
    │   ├── routes/             # API 라우트
    │   │   └── auth.py        # 인증 엔드포인트
    │   └── config/             # 서버 설정
    ├── data/                    # 데이터 저장소
    ├── requirements.txt         # Python 의존성
    └── wsgi.py                  # WSGI 엔트리포인트
```

---

## 💡 개발 과정

### 1단계: 기획 및 설계 (1주)
- 사용자 요구사항 분석
- 시스템 아키텍처 설계
- 기술 스택 선정 및 검증
- UI/UX 프로토타이핑

### 2단계: 인증 시스템 구현 (1주)
- Flask JWT 인증 서버 구축
- 회원가입/로그인 API 개발
- React Native 인증 화면 구현
- Secure Store를 활용한 토큰 관리

### 3단계: 기기 연동 기능 (1.5주)
- QR 코드 생성 및 스캔 기능 구현
- 웹/모바일 환경별 스캔 로직 분기
- 기기 정보 저장 및 관리
- 동적 서버 URL 전환 메커니즘

### 4단계: 파일 시스템 (2주)
- 파일 업로드/다운로드 API 개발
- 폴더 구조 탐색 UI 구현
- 파일 미리보기 기능
- 진행률 표시 및 에러 핸들링

### 5단계: P2P 파일 공유 (2.5주)
- Socket.io 시그널링 서버 구축
- WebRTC 피어 연결 로직 구현
- 파일 청킹 및 전송 최적화
- 연결 상태 모니터링 UI

### 6단계: 테스트 및 최적화 (1주)
- 단위 테스트 및 통합 테스트
- 성능 프로파일링 및 최적화
- 크로스 플랫폼 호환성 검증
- 버그 수정 및 안정화

---

## 🔧 트러블슈팅

### 1. WebRTC 연결 실패 문제

**문제**: iOS 기기에서 WebRTC 피어 연결이 간헐적으로 실패

**원인**: NAT traversal 문제 및 ICE candidate 교환 타이밍 이슈

**해결방법**:
```javascript
// STUN/TURN 서버 설정 추가
const peerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

// ICE candidate 수집 완료 대기
peer.on('icecandidate', (event) => {
  if (event.candidate) {
    socket.emit('ice-candidate', event.candidate);
  }
});
```

### 2. 파일 업로드 시 메모리 부족

**문제**: 대용량 파일 업로드 시 메모리 오버플로우

**원인**: 파일 전체를 메모리에 로드하여 처리

**해결방법**:
```javascript
// 파일 청킹을 통한 스트리밍 업로드
const CHUNK_SIZE = 1024 * 1024; // 1MB
const chunks = Math.ceil(fileSize / CHUNK_SIZE);

for (let i = 0; i < chunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, fileSize);
  const chunk = file.slice(start, end);
  
  await uploadChunk(chunk, i, chunks);
}
```

### 3. QR 스캔 플랫폼별 동작 차이

**문제**: 웹과 모바일에서 QR 스캔 라이브러리가 다름

**원인**: Expo Barcode Scanner는 웹 미지원

**해결방법**:
```typescript
// 플랫폼별 조건부 import
import { Platform } from 'react-native';

const QRScanner = Platform.OS === 'web' 
  ? require('./QRScanScreen.web').default
  : require('./QRScanScreen.native').default;
```

### 4. JWT 토큰 갱신 로직

**문제**: 토큰 만료 시 사용자 경험 저하

**원인**: 자동 갱신 메커니즘 부재

**해결방법**:
```typescript
// Axios Interceptor를 통한 자동 토큰 갱신
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## 🎓 배운 점 및 성과

### 기술적 성장
- **P2P 네트워킹**: WebRTC와 시그널링 프로토콜에 대한 깊은 이해
- **크로스 플랫폼 개발**: React Native를 통한 효율적인 멀티 플랫폼 개발 경험
- **보안**: JWT 인증, 데이터 암호화 등 실전 보안 구현
- **상태 관리**: Context API를 활용한 전역 상태 관리 패턴

### 문제 해결 능력
- 플랫폼별 API 차이를 극복하는 추상화 레이어 설계
- 네트워크 불안정 상황에서의 에러 핸들링 및 재시도 로직
- 대용량 파일 처리를 위한 스트리밍 및 청킹 기법

### 프로젝트 관리
- Git을 활용한 버전 관리 및 브랜치 전략
- 컴포넌트 기반 설계를 통한 재사용성 향상
- 체계적인 폴더 구조와 명명 규칙 정립

---


## 📊 성능 지표

- **앱 크기**: ~15MB (최적화 후)
- **초기 로딩 시간**: < 2초
- **파일 업로드 속도**: ~5MB/s (WiFi 환경)
- **P2P 전송 속도**: ~10MB/s (로컬 네트워크)
- **메모리 사용량**: < 100MB (일반 사용 시)

---

## 📄 라이센스

이 프로젝트는 개인 포트폴리오용으로 제작되었습니다.

---

## 👨‍💻 개발자

**이름**: [정하준]
- Email: chhajun01@naver.com
- GitHub: [@hajun13](https://github.com/hajun13)

---

## 🙏 감사의 말

이 프로젝트를 진행하며 많은 오픈소스 라이브러리와 커뮤니티의 도움을 받았습니다. 특히 React Native, Expo, Flask 커뮤니티에 감사드립니다.
