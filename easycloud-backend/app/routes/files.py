from flask import Blueprint, request, jsonify, current_app, send_file
import os
import json
from datetime import datetime
from werkzeug.utils import secure_filename
import uuid
import urllib.parse

bp = Blueprint('files', __name__, url_prefix='/files')

# 파일 확장자별 타입 매핑
EXTENSIONS = {
    'image': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'],
    'video': ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'],
    'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt']
}

def get_file_type(filename):
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    for file_type, exts in EXTENSIONS.items():
        if ext in exts:
            return file_type
    return 'document'  # 기본값

@bp.route('', methods=['GET'])
def get_files():
    """파일 목록 조회 API"""
    file_type = request.args.get('type', '')
    
    if file_type in ['image', 'video', 'document']:
        path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_type + 's')
    elif file_type == '':
        # 모든 타입 조회
        all_files = []
        for t in ['images', 'videos', 'documents']:
            path = os.path.join(current_app