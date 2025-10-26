import json
import os
from passlib.hash import pbkdf2_sha256
from datetime import datetime

USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'users.json')

def ensure_users_file():
    """사용자 파일이 없으면 생성합니다."""
    if not os.path.exists(os.path.dirname(USERS_FILE)):
        os.makedirs(os.path.dirname(USERS_FILE))
    
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump([], f)

def get_users():
    """모든 사용자 목록을 가져옵니다."""
    ensure_users_file()
    with open(USERS_FILE, 'r') as f:
        return json.load(f)

def save_users(users):
    """사용자 목록을 저장합니다."""
    ensure_users_file()
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

def find_user_by_email(email):
    """이메일로 사용자를 찾습니다."""
    users = get_users()
    for user in users:
        if user['email'].lower() == email.lower():
            return user
    return None

def find_user_by_id(user_id):
    """아이디로 사용자를 찾습니다."""
    users = get_users()
    for user in users:
        if user['id'] == user_id:
            return user
    return None

def create_user(email, password):
    """새 사용자를 생성합니다."""
    users = get_users()
    
    # 이메일 중복 확인
    if find_user_by_email(email):
        return None
    
    # 비밀번호 해싱
    password_hash = pbkdf2_sha256.hash(password)
    
    # 새 사용자 생성
    user_id = f'user_{len(users) + 1}'
    new_user = {
        'id': user_id,
        'email': email,
        'password_hash': password_hash,
        'created_at': datetime.now().isoformat(),
        'devices': []  # 연결된 기기 목록
    }
    
    users.append(new_user)
    save_users(users)
    
    # 비밀번호 해시는 제외하고 반환
    user_data = new_user.copy()
    user_data.pop('password_hash')
    return user_data

def verify_password(email, password):
    """사용자 인증을 수행합니다."""
    user = find_user_by_email(email)
    if user and pbkdf2_sha256.verify(password, user['password_hash']):
        # 비밀번호 해시는 제외하고 반환
        user_data = user.copy()
        user_data.pop('password_hash')
        return user_data
    return None

def add_device_to_user(user_id, device_id):
    """사용자에게 기기를 연결합니다."""
    users = get_users()
    for user in users:
        if user['id'] == user_id:
            if 'devices' not in user:
                user['devices'] = []
            
            if device_id not in user['devices']:
                user['devices'].append(device_id)
                save_users(users)
            return True
    return False