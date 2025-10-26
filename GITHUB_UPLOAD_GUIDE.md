# 🚀 GitHub 업로드 가이드

EasyCloud 프로젝트를 GitHub에 업로드하는 상세 가이드입니다.

---

## 📋 사전 준비사항

1. **Git 설치 확인**
   ```bash
   git --version
   ```
   - 설치되지 않았다면: https://git-scm.com/downloads

2. **GitHub 계정**
   - 계정이 없다면: https://github.com/join

3. **GitHub CLI 설치 (선택사항)**
   ```bash
   # macOS
   brew install gh
   
   # Windows
   winget install --id GitHub.cli
   ```

---

## 🔐 Step 1: 민감한 정보 확인

업로드 전에 민감한 정보가 Git에 포함되지 않도록 확인합니다.

### 확인할 파일들:
- ✅ `.env.development` → `.gitignore`에 포함됨
- ✅ `node_modules/` → `.gitignore`에 포함됨
- ✅ `__pycache__/` → `.gitignore`에 포함됨
- ✅ `easycloud-backend/data/` → `.gitignore`에 포함됨

### 환경변수 설정:
프로젝트에 `.env.example` 파일이 생성되었습니다. 실제 사용자는 이를 복사하여 사용합니다:
```bash
cp .env.example .env.development
```

---

## 📦 Step 2: Git 초기화 (이미 초기화되었다면 건너뛰기)

```bash
# 프로젝트 디렉토리로 이동
cd /Users/hajun/Projects/EasyCloud

# Git 초기화 (이미 되어있다면 건너뛰기)
git init

# Git 사용자 정보 설정 (처음 한번만)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

---

## 🌐 Step 3: GitHub 저장소 생성

### 방법 1: GitHub 웹사이트 사용

1. https://github.com/new 접속
2. Repository name: `EasyCloud` (또는 원하는 이름)
3. Description: `라즈베리파이 기반 개인 클라우드 스토리지 & P2P 파일 공유 시스템`
4. Public/Private 선택
5. ⚠️ **"Initialize this repository with a README" 체크 해제** (이미 README가 있음)
6. "Create repository" 클릭

### 방법 2: GitHub CLI 사용 (추천)

```bash
# GitHub CLI 로그인
gh auth login

# 저장소 생성 (public)
gh repo create EasyCloud --public --source=. --remote=origin

# 또는 private로 생성
gh repo create EasyCloud --private --source=. --remote=origin
```

---

## 📤 Step 4: 파일 추가 및 커밋

```bash
# 현재 상태 확인
git status

# 모든 파일 스테이징 (.gitignore에 의해 제외될 파일은 자동으로 무시됨)
git add .

# 첫 커밋
git commit -m "Initial commit: EasyCloud 프로젝트 첫 업로드

- React Native + Expo 기반 크로스 플랫폼 앱
- Flask 백엔드 서버
- WebRTC P2P 파일 공유 기능
- QR 코드 기반 기기 등록
- JWT 인증 시스템"

# 현재 브랜치 이름 확인 (main 또는 master)
git branch

# master를 main으로 변경하려면 (선택사항)
git branch -M main
```

---

## 🔗 Step 5: GitHub에 푸시

### 방법 1: GitHub CLI로 생성했다면

```bash
# 바로 푸시
git push -u origin main
```

### 방법 2: 웹에서 생성했다면

```bash
# 원격 저장소 추가
git remote add origin https://github.com/YOUR_USERNAME/EasyCloud.git

# 원격 저장소 확인
git remote -v

# 푸시
git push -u origin main
```

---

## ✅ Step 6: 업로드 확인

1. 브라우저에서 GitHub 저장소 접속
2. 파일이 정상적으로 업로드되었는지 확인
3. README.md가 제대로 표시되는지 확인

---

## 🔄 이후 변경사항 업데이트

프로젝트를 수정한 후 GitHub에 업데이트하는 방법:

```bash
# 변경사항 확인
git status

# 변경된 파일 추가
git add .

# 커밋 (의미있는 메시지 작성)
git commit -m "기능 추가: 파일 암호화 기능 구현"

# 푸시
git push
```

---

## 🎨 추가 팁

### 1. GitHub Topics 추가
저장소 페이지에서 Settings → Topics에 다음 추가:
- `react-native`
- `expo`
- `flask`
- `webrtc`
- `p2p`
- `cloud-storage`
- `raspberry-pi`
- `typescript`
- `python`

### 2. About 섹션 작성
저장소 메인 페이지 우측 상단 톱니바퀴 클릭:
- Description: "라즈베리파이 기반 개인 클라우드 스토리지 & P2P 파일 공유 시스템"
- Website: (데모 사이트가 있다면 추가)
- Topics 추가

### 3. 라이센스 추가
```bash
# MIT 라이센스 예시
curl -o LICENSE https://raw.githubusercontent.com/licenses/license-templates/master/templates/mit.txt
# 파일 편집하여 연도와 이름 수정
git add LICENSE
git commit -m "Add MIT License"
git push
```

### 4. .github 폴더 생성 (선택사항)
```bash
mkdir -p .github

# Issue 템플릿
mkdir .github/ISSUE_TEMPLATE

# Pull Request 템플릿
touch .github/PULL_REQUEST_TEMPLATE.md
```

---

## ⚠️ 주의사항

### 절대 커밋하면 안되는 것들:
- ❌ `.env` 파일 (환경변수)
- ❌ API 키, 비밀번호
- ❌ `node_modules/`
- ❌ 데이터베이스 파일
- ❌ 로그 파일
- ❌ 개인 정보

### 실수로 커밋했다면:
```bash
# 가장 최근 커밋 취소 (파일은 유지)
git reset HEAD~1

# .gitignore 수정 후 다시 커밋
git add .gitignore
git add .
git commit -m "Fix: 민감한 정보 제거"

# force push (주의: 이미 공개된 저장소라면 위험)
git push -f
```

---

## 🐛 문제 해결

### 1. "Permission denied (publickey)" 오류
```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your.email@example.com"

# SSH 키를 GitHub에 추가
cat ~/.ssh/id_ed25519.pub
# 출력된 내용을 GitHub Settings → SSH and GPG keys에 추가
```

### 2. "remote: Repository not found" 오류
```bash
# 원격 저장소 URL 확인
git remote -v

# 잘못되었다면 수정
git remote set-url origin https://github.com/YOUR_USERNAME/EasyCloud.git
```

### 3. 대용량 파일 오류
```bash
# Git LFS 사용 (100MB 이상 파일)
git lfs install
git lfs track "*.psd"
git add .gitattributes
```

---

## 📚 유용한 Git 명령어

```bash
# 커밋 히스토리 보기
git log --oneline --graph --all

# 브랜치 생성 및 전환
git checkout -b feature/new-feature

# 변경사항 임시 저장
git stash

# 특정 파일만 커밋 취소
git reset HEAD <file>

# 원격 저장소 최신 상태 가져오기
git pull
```

---

## 🎉 완료!

축하합니다! EasyCloud 프로젝트가 성공적으로 GitHub에 업로드되었습니다.

저장소 URL:
```
https://github.com/YOUR_USERNAME/EasyCloud
```

이제 포트폴리오, 이력서, 또는 다른 곳에서 이 링크를 공유할 수 있습니다!
