import jwt
import datetime
from flask import Blueprint, request, jsonify
from config import Config
from db.user_repo import create_user, verify_user

auth_bp = Blueprint('auth', __name__)

def generate_token(user_id):
    payload = {
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
        'iat': datetime.datetime.utcnow(),
        'sub': str(user_id)
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    full_name = data.get('full_name')
    password = data.get('password')
    
    if not email or not full_name or not password:
        return jsonify({'error': 'Email, full name, and password are required'}), 400
        
    user = create_user(email, full_name, password)
    if not user:
        return jsonify({'error': 'Email already exists'}), 409
        
    token = generate_token(user['id'])
    return jsonify({'message': 'User registered successfully', 'token': token, 'user': user}), 201

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
        
    user = verify_user(email, password)
    if not user:
        return jsonify({'error': 'Invalid email or password'}), 401
        
    token = generate_token(user['id'])
    return jsonify({'message': 'Login successful', 'token': token, 'user': user}), 200

from middleware import token_required

@auth_bp.route('/api/auth/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify({'user': current_user}), 200
