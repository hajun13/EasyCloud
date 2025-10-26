from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from app.models.user import create_user, verify_password, find_user_by_id

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    """사용자 회원가입"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "이메일과 비밀번호가 필요합니다"}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    # 이메일 형식 검증 (간단한 형식)
    if '@' not in email or '.' not in email:
        return jsonify({"error": "유효한 이메일 형식이 아닙니다"}), 400
    
    # 비밀번호 길이 검증
    if len(password) < 6:
        return jsonify({"error": "비밀번호는 최소 6자 이상이어야 합니다"}), 400
    
    user = create_user(email, password)
    
    if not user:
        return jsonify({"error": "이미 사용 중인 이메일입니다"}), 400
    
    # 인증 토큰 생성
    access_token = create_access_token(identity=user['id'])
    
    return jsonify({
        "message": "회원가입이 완료되었습니다",
        "token": access_token,
        "user": user
    }), 201

@auth_bp.route('/token', methods=['POST'])
def login():
    """로그인 및 토큰 발급"""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "이메일과 비밀번호가 필요합니다"}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    user = verify_password(email, password)
    
    if not user:
        return jsonify({"error": "이메일 또는 비밀번호가 올바르지 않습니다"}), 401
    
    # 인증 토큰 생성
    access_token = create_access_token(identity=user['id'])
    
    return jsonify({
        "message": "로그인 성공",
        "token": access_token,
        "user": user
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """현재 인증된 사용자 정보 조회"""
    user_id = get_jwt_identity()
    user = find_user_by_id(user_id)
    
    if not user:
        return jsonify({"error": "사용자를 찾을 수 없습니다"}), 404
    
    # 비밀번호 해시는 제외
    user_data = user.copy()
    if 'password_hash' in user_data:
        user_data.pop('password_hash')
    
    return jsonify(user_data), 200