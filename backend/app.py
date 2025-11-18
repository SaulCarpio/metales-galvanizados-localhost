# =========================
# IMPORTS Y CONFIGURACIÓN
# =========================
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from dotenv import load_dotenv
import os
import random
import string
from models import db, User, Role, CodigosVerificacion
from flask_bcrypt import Bcrypt
import datetime
import joblib
import numpy as np
import osmnx as ox
import networkx as nx
from models import db, User, Role, CodigosVerificacion, Cotizacion, Pedido, PedidoDetalle
from ml.ruta_modelo import load_graph_z16, shortest_route_stats, ensure_edge_speeds

# =========================
# VARIABLES GLOBALES Y ML
# =========================
G_CACHED = None
MODEL_CACHED = None

def load_ml_model():
    """Carga y cachea el modelo ML."""
    global MODEL_CACHED
    if MODEL_CACHED is None:
        try:
            MODEL_CACHED = joblib.load('ml/model_rf.pkl')
            print("Modelo ML cargado exitosamente")
        except Exception as e:
            print(f"Error cargando modelo ML: {e}")
    return MODEL_CACHED

def init_graph():
    """Inicializa y cachea el grafo para reutilizarlo."""
    global G_CACHED
    if G_CACHED is None:
        try:
            # Intenta cargar el grafo pre-guardado
            G_CACHED = ox.load_graphml('ml/graph_gpkg.graphml')
            ensure_edge_speeds(G_CACHED, fallback_kph=30.0)
            print("Grafo cargado desde archivo local")
        except Exception as e:
            print(f"Error cargando grafo local: {e}")
            print("Descargando grafo desde OSM...")
            G_CACHED = load_graph_z16(use_cache=True)
            ensure_edge_speeds(G_CACHED, fallback_kph=30.0)
    return G_CACHED

def predict_route_time_ml(data):
    """Predice tiempo de ruta usando modelo pre-entrenado."""
    model = load_ml_model()
    if not model:
        return {'predicted_time_min': data['base_time_sec'] / 60.0}
    try:
        X = np.array([[
            data['dist_m'],
            data['base_time_sec'],
            data['is_thursday']
        ]])
        pred_sec = model.predict(X)[0]
        return {
            'predicted_time_sec': float(pred_sec),
            'predicted_time_min': round(float(pred_sec) / 60.0, 2)
        }
    except Exception as e:
        print(f"Error en predicción: {e}")
        return {'predicted_time_min': data['base_time_sec'] / 60.0}

# =========================
# INICIALIZACIÓN DE LA APP
# =========================
load_dotenv()
app = Flask(__name__)
bcrypt = Bcrypt(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')

db.init_app(app)
mail = Mail(app)

# =========================
# FUNCIONES AUXILIARES
# =========================

def generate_temp_password(length=10):
    """Genera una contraseña temporal aleatoria."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def send_temp_password(email, temp_password):
    """Envía la contraseña temporal al correo del usuario."""
    msg = Message('Tu contraseña temporal', sender=app.config['MAIL_USERNAME'], recipients=[email])
    msg.body = f"Tu contraseña temporal es: {temp_password}\nPor favor cámbiala al iniciar sesión."
    mail.send(msg)

def generate_username(email):
    """Genera un nombre de usuario a partir del email."""
    local = email.split('@')[0]
    return local.replace(' ', '').replace('_', '').replace('-', '').replace('.', '')

def create_tables():
    """
    Crea las tablas y los usuarios/roles iniciales si no existen.
    """
    with app.app_context():
        db.create_all()
        # Crear roles y usuarios iniciales si no existen
        if not Role.query.filter_by(nombre='admin').first():
            admin_role = Role(nombre='admin')
            user_role = Role(nombre='usuario')
            db.session.add(admin_role)
            db.session.add(user_role)
            db.session.commit()
        if not User.query.filter_by(nombre='app.megacero').first():
            admin = User(
                nombre='app.megacero',
                email='admin@megacero.com',
                rol_id=Role.query.filter_by(nombre='admin').first().id,
                activo=True
            )
            admin.set_password('qwerty12345')
            db.session.add(admin)
            db.session.commit()
        if not User.query.filter_by(nombre='usuario.megacero').first():
            user = User(
                nombre='usuario.megacero',
                email='usuario@megacero.com',
                rol_id=Role.query.filter_by(nombre='usuario').first().id,
                activo=True
            )
            user.set_password('usuario123')
            db.session.add(user)
            db.session.commit()

# =========================
# ENDPOINTS DE AUTENTICACIÓN Y USUARIOS
# =========================

@app.route('/api/login', methods=['POST'])
def login():
    """Endpoint para login de usuario."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(nombre=username).first()
    
    if not user or not user.activo:
        return jsonify({'success': False, 'message': 'Usuario no existe o está deshabilitado'}), 401
    
    if user.check_password(password):
        # Determinar redirección según rol_id
        if user.rol_id == 1:  # Admin
            redirect_url = '/dashboard'  # o la ruta que uses para admin
        elif user.rol_id == 2:  # Usuario
            redirect_url = '/map'  # o la ruta que uses para usuario normal
        else:
            redirect_url = '/'  # Ruta por defecto
        
        return jsonify({
            'success': True,
            'message': 'Login exitoso',
            'user': username,
            'role': user.role.nombre,
            'rol_id': user.rol_id,
            'redirect_url': redirect_url,
            'change_required': getattr(user, 'temp_password', False)
        })
    
    return jsonify({'success': False, 'message': 'Credenciales inválidas'}), 401

@app.route('/api/change-password', methods=['POST'])
def change_password():
    """Endpoint para cambiar usuario y contraseña."""
    data = request.get_json()
    username = data.get('username')
    new_username = data.get('new_username')
    new_password = data.get('new_password')
    user = User.query.filter_by(nombre=username).first()
    if not user:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
    user.nombre = new_username
    user.set_password(new_password)
    user.temp_password = False
    db.session.commit()
    return jsonify({'success': True, 'message': 'Usuario y contraseña actualizados'})

@app.route('/api/users', methods=['GET'])
def get_users():
    """Endpoint para obtener la lista de usuarios."""
    users = User.query.all()
    return jsonify({'success': True, 'users': [
        {
            'id': u.id,
            'username': u.nombre,
            'email': u.email,
            'role': u.role.nombre,
            'is_active': u.activo
        } for u in users
    ]})

@app.route('/api/users', methods=['POST'])
def create_user():
    """Endpoint para crear un nuevo usuario."""
    data = request.get_json()
    email = data.get('email')
    role_name = data.get('role')
    role = Role.query.filter_by(nombre=role_name).first()
    if not role:
        return jsonify({'success': False, 'message': 'Rol no válido'}), 400
    username = generate_username(email)
    temp_password = generate_temp_password()
    clean_email = email.strip().lower()
    user = User(nombre=username, email=clean_email, rol_id=role.id, activo=True)
    user.set_password(temp_password)
    user.temp_password = True
    db.session.add(user)
    db.session.commit()
    try:
        send_temp_password(clean_email, temp_password)
        return jsonify({'success': True, 'message': 'Usuario creado y contraseña enviada', 'username': username, 'change_required': True})
    except Exception as e:
        return jsonify({'success': True, 'message': f'Usuario creado pero no se pudo enviar el correo: {str(e)}', 'username': username, 'change_required': True}), 200

# =========================
# ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA
# =========================

@app.route('/api/request-password-reset', methods=['POST'])
def request_password_reset():
    """Endpoint para solicitar recuperación de contraseña."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    user = User.query.filter(db.func.lower(db.func.trim(User.email)) == email).first()
    if not user:
        return jsonify({'success': False, 'message': 'No existe un usuario con ese email'}), 404
    code = ''.join(random.choices(string.digits, k=6))
    expiracion = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    codigo = CodigosVerificacion(usuario_id=user.id, codigo=code, expiracion=expiracion)
    db.session.add(codigo)
    db.session.commit()
    try:
        msg = Message('Código de recuperación de contraseña', sender=app.config['MAIL_USERNAME'], recipients=[email])
        msg.body = f"Tu código de recuperación es: {code}\nEste código expira en 10 minutos."
        mail.send(msg)
        return jsonify({'success': True, 'message': 'Código enviado al correo'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'No se pudo enviar el correo: {str(e)}'}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    """Endpoint para restablecer la contraseña usando el código enviado por email."""
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    code = data.get('code')
    new_password = data.get('new_password')
    user = User.query.filter(db.func.lower(db.func.trim(User.email)) == email).first()
    if not user:
        return jsonify({'success': False, 'message': 'No existe un usuario con ese email'}), 404
    codigo = CodigosVerificacion.query.filter_by(usuario_id=user.id, codigo=code, usado=False).first()
    if not codigo:
        return jsonify({'success': False, 'message': 'Código inválido'}), 400
    if codigo.expiracion < datetime.datetime.utcnow():
        return jsonify({'success': False, 'message': 'Código expirado'}), 400
    user.set_password(new_password)
    db.session.commit()
    codigo.usado = True
    db.session.commit()
    return jsonify({'success': True, 'message': 'Contraseña restablecida correctamente'})

# =========================
# ENDPOINTS DE ADMINISTRACIÓN DE USUARIOS
# =========================

@app.route('/api/users/<int:user_id>/toggle', methods=['POST'])
def toggle_user(user_id):
    """Endpoint para habilitar/deshabilitar un usuario."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
    user.activo = not user.activo
    db.session.commit()
    return jsonify({'success': True, 'activo': user.activo})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Endpoint para eliminar un usuario."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Usuario eliminado'})

# =========================
# ENDPOINTS DE MACHINE LEARNING - RUTAS
# =========================

@app.route('/api/predict-route-time', methods=['POST'])
def predict_route_time():
    """
    Endpoint que recibe los datos de una ruta y retorna la predicción de tiempo de entrega usando el modelo ML.
    Espera un JSON con: dist_m, base_time_sec, is_thursday
    """
    data = request.get_json()
    dist_m = data.get('dist_m')
    base_time_sec = data.get('base_time_sec')
    is_thursday = data.get('is_thursday', 0)

    # Validar datos de entrada
    if dist_m is None or base_time_sec is None:
        return jsonify({'success': False, 'message': 'Se requieren dist_m y base_time_sec'}), 400

    # Cargar el modelo entrenado
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error cargando el modelo: {str(e)}'}), 500

    # Preparar datos para predicción
    X = np.array([[dist_m, base_time_sec, is_thursday]])
    try:
        pred = model.predict(X)[0]
        return jsonify({
            'success': True, 
            'predicted_time_sec': float(pred),
            'predicted_time_min': round(float(pred) / 60.0, 2)
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error en la predicción: {str(e)}'}), 500

@app.route('/api/train-route-model', methods=['POST'])
def train_route_model():
    """
    Endpoint para reentrenar el modelo ML con nuevos datos.
    """
    try:
        # Ejecuta el pipeline principal de ruta_modelo.py
        from ml import ruta_modelo
        ruta_modelo.main()
        return jsonify({'success': True, 'message': 'Modelo reentrenado y guardado.'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error al entrenar el modelo: {str(e)}'}), 500

# =========================
# ENDPOINTS DE DASHBOARD Y OTROS
# =========================

@app.route('/api/dashboard', methods=['POST'])
def get_dashboard():
    """Endpoint para obtener datos del dashboard (solo admin) o mostrar el mapa (usuario)."""
    data = request.get_json()
    username = data.get('username')
    user = User.query.filter_by(nombre=username).first()
    if not user:
        return jsonify({'success': False, 'message': 'Usuario no encontrado'}), 404
    if user.role.nombre == 'admin':
        dashboard_data = {
            "on_time_delivery": random.randint(85, 98),
            "avg_delivery_time": random.randint(25, 45),
            "fuel_consumption": random.randint(580, 680),
            "mileage_per_route": random.randint(300, 350),
            "weekly_performance": [random.randint(60, 100) for _ in range(7)],
            "route_comparison": [
                {"name": "Ruta A", "efficiency": 85},
                {"name": "Ruta B", "efficiency": 92},
                {"name": "Ruta C", "efficiency": 78},
                {"name": "Ruta D", "efficiency": 88}
            ],
            "delivery_status": [
                {"route": "Ruta Norte", "status": "A tiempo", "time": "09:30 AM"},
                {"route": "Ruta Norte", "status": "Retrasada", "time": "10:45 AM"},
                {"route": "Ruta Norte", "status": "Retrasada", "time": "11:15 AM"},
                {"route": "Ruta Norte", "status": "A tiempo", "time": "09:50 AM"},
                {"route": "Ruta Norte", "status": "A tiempo", "time": "10:20 AM"},
                {"route": "Ruta Norte", "status": "Retrasada", "time": "11:30 AM"}
            ]
        }
        return jsonify({'success': True, 'data': dashboard_data, 'show_map': False})
    else:
        return jsonify({'success': True, 'show_map': True})

@app.route('/api/routes', methods=['GET'])
def get_routes():
    """Endpoint para obtener información de rutas (mock)."""
    routes = [
        {"id": 1, "name": "Ruta Norte", "driver": "Juan Pérez", "status": "En camino"},
        {"id": 2, "name": "Ruta Sur", "driver": "María García", "status": "Completada"},
        {"id": 3, "name": "Ruta Este", "driver": "Carlos López", "status": "Pendiente"},
        {"id": 4, "name": "Ruta Oeste", "driver": "Ana Martínez", "status": "En camino"}
    ]
    return jsonify({'success': True, 'routes': routes})

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint para verificar que el API está funcionando."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.datetime.now().isoformat(),
        'service': 'Metales Galvanizados API'
    })

# -------------------------
# CRUD Cotizaciones
# -------------------------
@app.route('/api/cotizaciones', methods=['GET'])
def list_cotizaciones():
    try:
        cotizaciones = Cotizacion.query.order_by(Cotizacion.fecha_emitida.desc()).all()
        data = [{
            'id': c.id,
            'cliente_id': c.cliente_id,
            'nombre_cliente': c.nombre_cliente,
            'producto': c.producto,
            'color': c.color,
            'fecha_emitida': c.fecha_emitida.isoformat() if c.fecha_emitida else None,
            'fecha_expiracion': c.fecha_expiracion.isoformat() if c.fecha_expiracion else None,
            'precio_unitario': float(c.precio_unitario) if c.precio_unitario is not None else None,
            'cantidad': float(c.cantidad) if c.cantidad is not None else None,
            'estado': c.estado,
            'usuario_id': c.usuario_id
        } for c in cotizaciones]
        return jsonify({'success': True, 'cotizaciones': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/cotizaciones/<int:cid>', methods=['GET'])
def get_cotizacion(cid):
    c = Cotizacion.query.get(cid)
    if not c:
        return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
    data = {
        'id': c.id,
        'cliente_id': c.cliente_id,
        'nombre_cliente': c.nombre_cliente,
        'producto': c.producto,
        'color': c.color,
        'fecha_emitida': c.fecha_emitida.isoformat() if c.fecha_emitida else None,
        'fecha_expiracion': c.fecha_expiracion.isoformat() if c.fecha_expiracion else None,
        'precio_unitario': float(c.precio_unitario) if c.precio_unitario is not None else None,
        'cantidad': float(c.cantidad) if c.cantidad is not None else None,
        'estado': c.estado,
        'usuario_id': c.usuario_id
    }
    return jsonify({'success': True, 'cotizacion': data})

@app.route('/api/cotizaciones', methods=['POST'])
def create_cotizacion():
    try:
        payload = request.get_json()
        c = Cotizacion(
            cliente_id=payload.get('cliente_id'),
            nombre_cliente=payload.get('nombre_cliente'),
            producto=payload.get('producto'),
            color=payload.get('color'),
            fecha_expiracion=payload.get('fecha_expiracion'),
            precio_unitario=payload.get('precio_unitario'),
            cantidad=payload.get('cantidad'),
            estado=payload.get('estado', 'emitida'),
            usuario_id=payload.get('usuario_id')
        )
        db.session.add(c)
        db.session.commit()
        return jsonify({'success': True, 'id': c.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/cotizaciones/<int:cid>', methods=['PUT'])
def update_cotizacion(cid):
    try:
        c = Cotizacion.query.get(cid)
        if not c:
            return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
        payload = request.get_json()
        for field in ['cliente_id','nombre_cliente','producto','color','fecha_expiracion','precio_unitario','cantidad','estado','usuario_id']:
            if field in payload:
                setattr(c, field, payload.get(field))
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/cotizaciones/<int:cid>', methods=['DELETE'])
def delete_cotizacion(cid):
    try:
        c = Cotizacion.query.get(cid)
        if not c:
            return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
        db.session.delete(c)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# -------------------------
# CRUD Pedidos (y detalles)
# -------------------------
@app.route('/api/pedidos', methods=['GET'])
def list_pedidos():
    try:
        pedidos = Pedido.query.order_by(Pedido.fecha_pedido.desc()).all()
        data = []
        for p in pedidos:
            detalles = PedidoDetalle.query.filter_by(pedido_id=p.id).all()
            detalles_list = [{
                'id': d.id, 'producto_id': d.producto_id, 'cantidad': int(d.cantidad), 'subtotal': float(d.subtotal)
            } for d in detalles]
            data.append({
                'id': p.id,
                'cliente_id': p.cliente_id,
                'fecha_pedido': p.fecha_pedido.isoformat() if p.fecha_pedido else None,
                'estado': p.estado,
                'prioridad': p.prioridad,
                'total': float(p.total) if p.total is not None else None,
                'detalles': detalles_list
            })
        return jsonify({'success': True, 'pedidos': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pedidos/<int:pid>', methods=['GET'])
def get_pedido(pid):
    p = Pedido.query.get(pid)
    if not p:
        return jsonify({'success': False, 'message': 'Pedido no encontrado'}), 404
    detalles = PedidoDetalle.query.filter_by(pedido_id=p.id).all()
    detalles_list = [{'id': d.id, 'producto_id': d.producto_id, 'cantidad': int(d.cantidad), 'subtotal': float(d.subtotal)} for d in detalles]
    return jsonify({'success': True, 'pedido': {
        'id': p.id,
        'cliente_id': p.cliente_id,
        'fecha_pedido': p.fecha_pedido.isoformat() if p.fecha_pedido else None,
        'estado': p.estado,
        'prioridad': p.prioridad,
        'total': float(p.total) if p.total is not None else None,
        'detalles': detalles_list
    }})

@app.route('/api/pedidos', methods=['POST'])
def create_pedido():
    try:
        payload = request.get_json()
        detalles_payload = payload.get('detalles', [])
        p = Pedido(
            cliente_id=payload.get('cliente_id'),
            estado=payload.get('estado', 'pendiente'),
            prioridad=payload.get('prioridad', 'normal'),
            total=payload.get('total') or 0
        )
        db.session.add(p)
        db.session.flush()  # obtener id
        total_calc = 0
        for d in detalles_payload:
            pd = PedidoDetalle(
                pedido_id=p.id,
                producto_id=d.get('producto_id'),
                cantidad=d.get('cantidad'),
                subtotal=d.get('subtotal')
            )
            db.session.add(pd)
            total_calc += float(d.get('subtotal') or 0)
        p.total = total_calc or p.total
        db.session.commit()
        return jsonify({'success': True, 'id': p.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pedidos/<int:pid>', methods=['PUT'])
def update_pedido(pid):
    try:
        p = Pedido.query.get(pid)
        if not p:
            return jsonify({'success': False, 'message': 'Pedido no encontrado'}), 404
        payload = request.get_json()
        # actualizar campos simples
        for field in ['cliente_id','estado','prioridad','total']:
            if field in payload:
                setattr(p, field, payload.get(field))
        # actualizar detalles (opcional): recibir lista completa y reemplazar
        if 'detalles' in payload:
            PedidoDetalle.query.filter_by(pedido_id=p.id).delete()
            total_calc = 0
            for d in payload['detalles']:
                pd = PedidoDetalle(
                    pedido_id=p.id,
                    producto_id=d.get('producto_id'),
                    cantidad=d.get('cantidad'),
                    subtotal=d.get('subtotal')
                )
                db.session.add(pd)
                total_calc += float(d.get('subtotal') or 0)
            p.total = total_calc
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pedidos/<int:pid>', methods=['DELETE'])
def delete_pedido(pid):
    try:
        p = Pedido.query.get(pid)
        if not p:
            return jsonify({'success': False, 'message': 'Pedido no encontrado'}), 404
        # eliminar detalles automáticamente por ondelete en modelo si existe, sino:
        PedidoDetalle.query.filter_by(pedido_id=p.id).delete()
        db.session.delete(p)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500



# =========================
# ENDPOINTS DE ML Y RUTAS OPTIMIZADO PARA MÚLTIPLES PUNTOS
# =========================

@app.route('/api/find-route', methods=['POST'])
def find_route():
    """Endpoint para encontrar la mejor ruta entre múltiples puntos (TSP)."""
    start_time = datetime.datetime.now()
    
    try:
        data = request.get_json()
        waypoints = data.get('waypoints', [])

        if not waypoints or len(waypoints) < 2:
            return jsonify({
                'success': False,
                'message': 'Se requieren al menos 2 puntos de ruta'
            }), 400

        # Usar grafo cacheado
        G = init_graph()

        # Encontrar nodos más cercanos para todos los waypoints
        waypoint_nodes = []
        for waypoint in waypoints:
            node = ox.nearest_nodes(G, waypoint[1], waypoint[0])
            waypoint_nodes.append(node)

        # El primer punto es el origen/depósito
        depot_node = waypoint_nodes[0]
        
        # Si solo hay 2 puntos, calcular ruta directa
        if len(waypoint_nodes) == 2:
            path, total_distance, total_time = shortest_route_stats(G, waypoint_nodes[0], waypoint_nodes[1])
            # Para volver al punto inicial en caso de 2 puntos
            return_path, return_distance, return_time = shortest_route_stats(G, waypoint_nodes[1], waypoint_nodes[0])
            
            # Combinar rutas (ida y vuelta)
            full_path = path + return_path[1:]  # Evitar duplicar el nodo final
            total_distance += return_distance
            total_time += return_time
            
        else:
            # Para 3 o más puntos, resolver TSP
            # Calcular matriz de distancias entre todos los puntos
            distance_matrix = []
            for i in range(len(waypoint_nodes)):
                row = []
                for j in range(len(waypoint_nodes)):
                    if i == j:
                        row.append(0)
                    else:
                        try:
                            _, dist, _ = shortest_route_stats(G, waypoint_nodes[i], waypoint_nodes[j])
                            row.append(dist)
                        except:
                            # Si no hay ruta, usar una distancia grande
                            row.append(float('inf'))
                distance_matrix.append(row)

            # Resolver TSP (algoritmo simple - nearest neighbor)
            def solve_tsp_nearest_neighbor(distance_matrix, depot=0):
                n = len(distance_matrix)
                unvisited = set(range(n))
                unvisited.remove(depot)
                tour = [depot]
                current = depot
                total_distance = 0

                while unvisited:
                    next_node = min(unvisited, key=lambda x: distance_matrix[current][x])
                    total_distance += distance_matrix[current][next_node]
                    tour.append(next_node)
                    unvisited.remove(next_node)
                    current = next_node

                # Volver al depósito
                total_distance += distance_matrix[current][depot]
                tour.append(depot)
                
                return tour, total_distance

            # Obtener tour óptimo
            optimal_tour, total_distance = solve_tsp_nearest_neighbor(distance_matrix)

            # Construir la ruta completa conectando los segmentos
            full_path = []
            total_time = 0
            
            for i in range(len(optimal_tour) - 1):
                start_idx = optimal_tour[i]
                end_idx = optimal_tour[i + 1]
                
                segment_path, segment_dist, segment_time = shortest_route_stats(
                    G, waypoint_nodes[start_idx], waypoint_nodes[end_idx]
                )
                
                # Para evitar duplicar nodos, omitir el primero en segmentos subsiguientes
                if full_path:
                    full_path.extend(segment_path[1:])
                else:
                    full_path.extend(segment_path)
                
                total_time += segment_time

        # Extraer coordenadas de la ruta completa
        route_coords = []
        for node in full_path:
            route_coords.append([float(G.nodes[node]['y']), float(G.nodes[node]['x'])])

        # Predecir tiempo total con ML
        is_thursday = datetime.datetime.now().weekday() == 3
        pred_time = predict_route_time_ml({
            'dist_m': total_distance,
            'base_time_sec': total_time,
            'is_thursday': int(is_thursday)
        })

        end_time = datetime.datetime.now()
        processing_time = (end_time - start_time).total_seconds() * 1000

        return jsonify({
            'success': True,
            'route': {
                'coordinates': route_coords,
                'distance_meters': round(total_distance, 2),
                'base_time_sec': round(total_time, 2),
                'predicted_time_min': round(pred_time['predicted_time_min'], 2)
            },
            'processing_time_ms': round(processing_time, 2)
        })

    except Exception as e:
        import traceback
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': f'Error al calcular ruta: {str(e)}'
        }), 500

# =========================
# INICIO DE LA APP
# =========================

if __name__ == '__main__':
    create_tables()  # Crea las tablas y datos iniciales si no existen
    app.run(debug=True, host='0.0.0.0', port=8080)