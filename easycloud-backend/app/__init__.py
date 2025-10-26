from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import os
from datetime import timedelta

def create_app():
    app = Flask(__name__)
    
    # CORS 설정
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # JWT 설정
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
    jwt = JWTManager(app)
    
    # 라우트 등록
    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')
    
    @app.route('/')
    def index():
        return {'message': 'EasyCloud Auth API is running'}
    
    return app