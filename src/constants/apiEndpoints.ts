// API 기본 경로는 기기 연결 후 동적으로 설정됩니다
export default {
  auth: {
    login: '/auth/token',
    register: '/auth/register',
  },
  device: {
    info: '/device/info',
    qrcode: '/device/qrcode',
    pair: '/device/pair',
    wifiSetup: '/device/wifi-setup',
    wifiScan: '/device/wifi-scan', // 새로 추가된 WiFi 스캔 엔드포인트
    status: '/device/status'
  },
  files: {
    list: '/files',
    upload: '/files/upload',
    download: (path: string) => `/files/download/${path}`,
    share: (path: string) => `/files/share/${path}`,
    shared: (id: string) => `/files/shared/${id}`,
    delete: (path: string) => `/files/delete/${path}`
  }
};