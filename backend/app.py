# =========================
# IMPORTS Y CONFIGURACIÓN
# =========================
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from flask_migrate import Migrate
from dotenv import load_dotenv
import os
import random
import string
from flask_bcrypt import Bcrypt
import datetime
import joblib
import numpy as np
import osmnx as ox
import networkx as nx
from models import db, User, Role, CodigosVerificacion, Cotizacion, Pedido, PedidoDetalle
from models import Proveedor, OrdenCompra, OrdenCompraDetalle, CuentaPagar, CuentaCobrar, MovimientoPago, InventarioSucursal, MetodoPago
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
migrate = Migrate(app, db)
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

    # Cargar el modelo entrenado (usa la función que cachea el modelo)
    model = load_ml_model()
    if not model:
        # No se pudo cargar el modelo — devolver estimación basada en base_time_sec
        return jsonify({'success': True, 'predicted_time_sec': base_time_sec, 'predicted_time_min': round(base_time_sec / 60.0, 2)})

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
            'nombre_cliente': c.nombre_cliente,
            'producto': c.producto,
            'color': c.color,
            'cantidad': float(c.cantidad) if c.cantidad is not None else None,
            'estado': c.estado,
        } for c in cotizaciones]
        return jsonify({'success': True, 'cotizaciones': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# === RUTA MODIFICADA ===
@app.route('/api/cotizaciones/<int:cid>', methods=['GET'])
def get_cotizacion(cid):
    c = Cotizacion.query.get(cid)
    if not c:
        return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
    
    # Se crea el diccionario base con los datos principales
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

    # --- CAMBIO CLAVE ---
    # Si existen datos en la columna 'detalles', se añaden a la respuesta.
    # Esto "fusiona" los detalles (calaminas, cumbreras, etc.) con los datos principales.
    if c.detalles:
        data.update(c.detalles)

    return jsonify({'success': True, 'cotizacion': data})

# === RUTA MODIFICADA ===
@app.route('/api/cotizaciones', methods=['POST'])
def create_cotizacion():
    try:
        payload = request.get_json()

        # --- CAMBIO CLAVE ---
        # Se extraen los detalles del payload para guardarlos en el campo JSON.
        detalles_para_db = {
            'calaminas': payload.get('calaminas', []),
            'cumbreras': payload.get('cumbreras', []),
            'tipo_cumbrera': payload.get('tipo_cumbrera'),
            'total_calaminas': payload.get('total_calaminas'),
            'total_cumbreras': payload.get('total_cumbreras')
        }

        c = Cotizacion(
            cliente_id=payload.get('cliente_id'),
            nombre_cliente=payload.get('nombre_cliente'),
            producto=payload.get('producto'),
            color=payload.get('color'),
            fecha_expiracion=payload.get('fecha_expiracion'),
            precio_unitario=payload.get('precio_unitario'),
            cantidad=payload.get('cantidad'),
            estado=payload.get('estado', 'emitida'),
            usuario_id=payload.get('usuario_id'),
            
            # Se asigna el diccionario de detalles al nuevo campo del modelo.
            detalles=detalles_para_db
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
        
        # Actualiza los campos normales
        for field in ['cliente_id','nombre_cliente','producto','color','fecha_expiracion','precio_unitario','cantidad','estado','usuario_id']:
            if field in payload:
                setattr(c, field, payload.get(field))

        # --- CAMBIO SUGERIDO ---
        # Si quieres que se puedan actualizar los detalles, añade esta lógica
        if 'calaminas' in payload or 'cumbreras' in payload:
            detalles_actualizados = c.detalles or {}
            detalles_actualizados.update({
                'calaminas': payload.get('calaminas', detalles_actualizados.get('calaminas')),
                'cumbreras': payload.get('cumbreras', detalles_actualizados.get('cumbreras')),
                # ... puedes añadir otros campos de detalles aquí
            })
            c.detalles = detalles_actualizados
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/cotizaciones/<int:cid>', methods=['DELETE'])
def delete_cotizacion(cid):
    # Esta ruta no necesita cambios, ya funciona correctamente.
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
            detalles_list = [{'id': d.id, 'producto_id': d.producto_id, 'cantidad': int(d.cantidad), 'subtotal': float(d.subtotal)} for d in detalles]
            data.append({
                'id': p.id,
                'cliente_id': p.cliente_id,
                'fecha_pedido': p.fecha_pedido.isoformat() if p.fecha_pedido else None,
                'estado': p.estado,
                'prioridad': p.prioridad,
                'total': float(p.total) if p.total else 0,
                'vehiculo_id': p.vehiculo_id,  # 🔥 VEHÍCULO ASIGNADO
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
        # campos simples
        for field in ['cliente_id','estado','prioridad','total','vehiculo_id']:
            if field in payload:
                setattr(p, field, payload.get(field))
        # detalles
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
# CRUD Proveedores
# =========================
@app.route('/api/proveedores', methods=['GET'])
def list_proveedores():
    try:
        provs = Proveedor.query.order_by(Proveedor.nombre).all()
        data = [{'id': p.id, 'nombre': p.nombre, 'contacto': p.contacto, 'telefono': p.telefono, 'direccion': p.direccion, 'datos_extra': p.datos_extra} for p in provs]
        return jsonify({'success': True, 'proveedores': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/proveedores/<int:pid>', methods=['GET'])
def get_proveedor(pid):
    p = Proveedor.query.get(pid)
    if not p:
        return jsonify({'success': False, 'message': 'Proveedor no encontrado'}), 404
    return jsonify({'success': True, 'proveedor': {'id': p.id, 'nombre': p.nombre, 'contacto': p.contacto, 'telefono': p.telefono, 'direccion': p.direccion, 'datos_extra': p.datos_extra}})


@app.route('/api/proveedores', methods=['POST'])
def create_proveedor():
    try:
        payload = request.get_json()
        p = Proveedor(
            nombre=payload.get('nombre'),
            contacto=payload.get('contacto'),
            telefono=payload.get('telefono'),
            direccion=payload.get('direccion'),
            datos_extra=payload.get('datos_extra')
        )
        db.session.add(p)
        db.session.commit()
        return jsonify({'success': True, 'id': p.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/proveedores/<int:pid>', methods=['PUT'])
def update_proveedor(pid):
    try:
        p = Proveedor.query.get(pid)
        if not p:
            return jsonify({'success': False, 'message': 'Proveedor no encontrado'}), 404
        payload = request.get_json()
        for field in ['nombre','contacto','telefono','direccion','datos_extra']:
            if field in payload:
                setattr(p, field, payload.get(field))
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/proveedores/<int:pid>', methods=['DELETE'])
def delete_proveedor(pid):
    try:
        p = Proveedor.query.get(pid)
        if not p:
            return jsonify({'success': False, 'message': 'Proveedor no encontrado'}), 404
        db.session.delete(p)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================
# CRUD Órdenes de Compra
# =========================
@app.route('/api/ordenes-compra', methods=['GET'])
def list_ordenes_compra():
    try:
        ordenes = OrdenCompra.query.order_by(OrdenCompra.fecha.desc()).all()
        data = []
        for o in ordenes:
            detalles = [{'id': d.id, 'producto_id': d.producto_id, 'cantidad': float(d.cantidad), 'precio_unitario': float(d.precio_unitario), 'subtotal': float(d.subtotal)} for d in o.detalles]
            data.append({'id': o.id, 'proveedor_id': o.proveedor_id, 'referencia': o.referencia, 'fecha': o.fecha.isoformat() if o.fecha else None, 'estado': o.estado, 'total': float(o.total), 'detalles': detalles})
        return jsonify({'success': True, 'ordenes': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/ordenes-compra/<int:oid>', methods=['GET'])
def get_orden_compra(oid):
    o = OrdenCompra.query.get(oid)
    if not o:
        return jsonify({'success': False, 'message': 'Orden no encontrada'}), 404
    detalles = [{'id': d.id, 'producto_id': d.producto_id, 'cantidad': float(d.cantidad), 'precio_unitario': float(d.precio_unitario), 'subtotal': float(d.subtotal)} for d in o.detalles]
    return jsonify({'success': True, 'orden': {'id': o.id, 'proveedor_id': o.proveedor_id, 'referencia': o.referencia, 'fecha': o.fecha.isoformat() if o.fecha else None, 'estado': o.estado, 'total': float(o.total), 'detalles': detalles}})


@app.route('/api/ordenes-compra', methods=['POST'])
def create_orden_compra():
    try:
        payload = request.get_json()
        detalles_payload = payload.get('detalles', [])
        o = OrdenCompra(
            proveedor_id=payload.get('proveedor_id'),
            referencia=payload.get('referencia'),
            estado=payload.get('estado', 'borrador')
        )
        db.session.add(o)
        db.session.flush()
        total_calc = 0
        for d in detalles_payload:
            subtotal = float(d.get('cantidad', 0)) * float(d.get('precio_unitario', 0))
            od = OrdenCompraDetalle(
                orden_id=o.id,
                producto_id=d.get('producto_id'),
                cantidad=d.get('cantidad'),
                precio_unitario=d.get('precio_unitario'),
                subtotal=subtotal
            )
            db.session.add(od)
            total_calc += subtotal
        o.total = total_calc
        db.session.commit()
        return jsonify({'success': True, 'id': o.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/ordenes-compra/<int:oid>', methods=['PUT'])
def update_orden_compra(oid):
    try:
        o = OrdenCompra.query.get(oid)
        if not o:
            return jsonify({'success': False, 'message': 'Orden no encontrada'}), 404
        payload = request.get_json()
        for field in ['proveedor_id','referencia','estado']:
            if field in payload:
                setattr(o, field, payload.get(field))
        if 'detalles' in payload:
            OrdenCompraDetalle.query.filter_by(orden_id=o.id).delete()
            total_calc = 0
            for d in payload['detalles']:
                subtotal = float(d.get('cantidad', 0)) * float(d.get('precio_unitario', 0))
                od = OrdenCompraDetalle(orden_id=o.id, producto_id=d.get('producto_id'), cantidad=d.get('cantidad'), precio_unitario=d.get('precio_unitario'), subtotal=subtotal)
                db.session.add(od)
                total_calc += subtotal
            o.total = total_calc
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/ordenes-compra/<int:oid>', methods=['DELETE'])
def delete_orden_compra(oid):
    try:
        o = OrdenCompra.query.get(oid)
        if not o:
            return jsonify({'success': False, 'message': 'Orden no encontrada'}), 404
        OrdenCompraDetalle.query.filter_by(orden_id=o.id).delete()
        db.session.delete(o)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================
# CRUD Finanzas: Cuentas y Movimientos
# =========================
@app.route('/api/cuentas-pagar', methods=['GET'])
def list_cuentas_pagar():
    try:
        cuentas = CuentaPagar.query.order_by(CuentaPagar.fecha_emision.desc()).all()
        data = [{'id': c.id, 'proveedor_id': c.proveedor_id, 'referencia': c.referencia, 'monto_total': float(c.monto_total), 'monto_pagado': float(c.monto_pagado), 'fecha_emision': c.fecha_emision.isoformat() if c.fecha_emision else None, 'fecha_vencimiento': c.fecha_vencimiento.isoformat() if c.fecha_vencimiento else None, 'estado': c.estado, 'descripcion': c.descripcion} for c in cuentas]
        return jsonify({'success': True, 'cuentas_pagar': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/cuentas-pagar/<int:cid>', methods=['GET'])
def get_cuenta_pagar(cid):
    c = CuentaPagar.query.get(cid)
    if not c:
        return jsonify({'success': False, 'message': 'Cuenta no encontrada'}), 404
    return jsonify({'success': True, 'cuenta': {'id': c.id, 'proveedor_id': c.proveedor_id, 'referencia': c.referencia, 'monto_total': float(c.monto_total), 'monto_pagado': float(c.monto_pagado), 'fecha_emision': c.fecha_emision.isoformat() if c.fecha_emision else None, 'fecha_vencimiento': c.fecha_vencimiento.isoformat() if c.fecha_vencimiento else None, 'estado': c.estado, 'descripcion': c.descripcion}})


@app.route('/api/cuentas-pagar', methods=['POST'])
def create_cuenta_pagar():
    try:
        payload = request.get_json()
        c = CuentaPagar(
            proveedor_id=payload.get('proveedor_id'),
            referencia=payload.get('referencia'),
            monto_total=payload.get('monto_total'),
            monto_pagado=payload.get('monto_pagado', 0),
            fecha_vencimiento=payload.get('fecha_vencimiento'),
            moneda=payload.get('moneda', 'BOB'),
            estado=payload.get('estado', 'pendiente'),
            descripcion=payload.get('descripcion')
        )
        db.session.add(c)
        db.session.commit()
        return jsonify({'success': True, 'id': c.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/cuentas-pagar/<int:cid>', methods=['PUT'])
def update_cuenta_pagar(cid):
    try:
        c = CuentaPagar.query.get(cid)
        if not c:
            return jsonify({'success': False, 'message': 'Cuenta no encontrada'}), 404
        payload = request.get_json()
        for field in ['proveedor_id','referencia','monto_total','monto_pagado','fecha_vencimiento','moneda','estado','descripcion']:
            if field in payload:
                setattr(c, field, payload.get(field))
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/cuentas-pagar/<int:cid>', methods=['DELETE'])
def delete_cuenta_pagar(cid):
    try:
        c = CuentaPagar.query.get(cid)
        if not c:
            return jsonify({'success': False, 'message': 'Cuenta no encontrada'}), 404
        db.session.delete(c)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/movimientos-pago', methods=['GET'])
def list_movimientos_pago():
    try:
        movs = MovimientoPago.query.order_by(MovimientoPago.fecha_pago.desc()).all()
        data = [{'id': m.id, 'cuenta_pagar_id': m.cuenta_pagar_id, 'cuenta_cobrar_id': m.cuenta_cobrar_id, 'monto': float(m.monto), 'fecha_pago': m.fecha_pago.isoformat() if m.fecha_pago else None, 'metodo_pago_id': m.metodo_pago_id, 'referencia_pago': m.referencia_pago, 'nota': m.nota} for m in movs]
        return jsonify({'success': True, 'movimientos': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/movimientos-pago', methods=['POST'])
def create_movimiento_pago():
    try:
        payload = request.get_json()
        m = MovimientoPago(
            cuenta_pagar_id=payload.get('cuenta_pagar_id'),
            cuenta_cobrar_id=payload.get('cuenta_cobrar_id'),
            monto=payload.get('monto'),
            metodo_pago_id=payload.get('metodo_pago_id'),
            referencia_pago=payload.get('referencia_pago'),
            nota=payload.get('nota')
        )
        db.session.add(m)

        # actualizar saldos en cuentas
        if m.cuenta_pagar_id:
            cp = CuentaPagar.query.get(m.cuenta_pagar_id)
            if cp:
                cp.monto_pagado = (cp.monto_pagado or 0) + float(m.monto)
                # actualizar estado
                if float(cp.monto_pagado) >= float(cp.monto_total):
                    cp.estado = 'pagada'
                else:
                    cp.estado = 'parcial'
        if m.cuenta_cobrar_id:
            cc = CuentaCobrar.query.get(m.cuenta_cobrar_id)
            if cc:
                cc.monto_pagado = (cc.monto_pagado or 0) + float(m.monto)
                if float(cc.monto_pagado) >= float(cc.monto_total):
                    cc.estado = 'cobrado'
                else:
                    cc.estado = 'parcial'

        db.session.commit()
        return jsonify({'success': True, 'id': m.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================
# CRUD InventarioSucursal (Control de existencias)
# =========================
@app.route('/api/inventario', methods=['GET'])
def list_inventario():
    try:
        items = InventarioSucursal.query.order_by(InventarioSucursal.id).all()
        data = [{'id': i.id, 'producto_id': i.producto_id, 'sucursal_id': i.sucursal_id, 'cantidad': float(i.cantidad), 'estado': i.estado, 'ultimo_movimiento': i.ultimo_movimiento.isoformat() if i.ultimo_movimiento else None} for i in items]
        return jsonify({'success': True, 'inventario': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventario/<int:iid>', methods=['GET'])
def get_inventario(iid):
    i = InventarioSucursal.query.get(iid)
    if not i:
        return jsonify({'success': False, 'message': 'Registro inventario no encontrado'}), 404
    return jsonify({'success': True, 'inventario': {'id': i.id, 'producto_id': i.producto_id, 'sucursal_id': i.sucursal_id, 'cantidad': float(i.cantidad), 'estado': i.estado, 'ultimo_movimiento': i.ultimo_movimiento.isoformat() if i.ultimo_movimiento else None}})


@app.route('/api/inventario', methods=['POST'])
def create_inventario():
    try:
        payload = request.get_json()

        # Validaciones
        if not payload.get('producto_id') or not payload.get('sucursal_id'):
            return jsonify({'success': False, 'message': 'Producto y Sucursal son obligatorios'}), 400

        i = InventarioSucursal(
            producto_id=int(payload.get('producto_id')),
            sucursal_id=int(payload.get('sucursal_id')),
            cantidad=float(payload.get('cantidad', 0)),
            estado=payload.get('estado', 'disponible')
        )
        db.session.add(i)
        db.session.commit()
        return jsonify({'success': True, 'id': i.id}), 201
    except Exception as e:
        db.session.rollback()
        print("ERROR Inventario:", e)  # <-- log en consola del backend
        return jsonify({'success': False, 'message': str(e)}), 500



@app.route('/api/inventario/<int:iid>', methods=['PUT'])
def update_inventario(iid):
    try:
        i = InventarioSucursal.query.get(iid)
        if not i:
            return jsonify({'success': False, 'message': 'Registro inventario no encontrado'}), 404
        payload = request.get_json()
        for field in ['producto_id','sucursal_id','cantidad','estado']:
            if field in payload:
                setattr(i, field, payload.get(field))
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventario/<int:iid>', methods=['DELETE'])
def delete_inventario(iid):
    try:
        i = InventarioSucursal.query.get(iid)
        if not i:
            return jsonify({'success': False, 'message': 'Registro inventario no encontrado'}), 404
        db.session.delete(i)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# =========================
# CRUD PRODUCTOS
# =========================
@app.route('/api/productos', methods=['GET'])
def list_productos():
    try:
        from models import Producto
        productos = Producto.query.order_by(Producto.nombre).all()
        data = [{
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'categoria': p.categoria,
            'precio': float(p.precio) if p.precio else 0,
            'stock': p.stock,
            'activo': p.activo
        } for p in productos]
        return jsonify({'success': True, 'productos': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/productos/<int:pid>', methods=['GET'])
def get_producto(pid):
    from models import Producto
    p = Producto.query.get(pid)
    if not p:
        return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404
    return jsonify({
        'success': True,
        'producto': {
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'categoria': p.categoria,
            'precio': float(p.precio) if p.precio else 0,
            'stock': p.stock,
            'activo': p.activo
        }
    })

@app.route('/api/productos', methods=['POST'])
def create_producto():
    try:
        from models import Producto
        payload = request.get_json()
        p = Producto(
            nombre=payload.get('nombre'),
            descripcion=payload.get('descripcion'),
            categoria=payload.get('categoria'),
            precio=payload.get('precio'),
            stock=payload.get('stock', 0),
            activo=payload.get('activo', True)
        )
        db.session.add(p)
        db.session.commit()
        return jsonify({'success': True, 'id': p.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/productos/<int:pid>', methods=['PUT'])
def update_producto(pid):
    try:
        from models import Producto
        p = Producto.query.get(pid)
        if not p:
            return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404
        payload = request.get_json()
        for field in ['nombre', 'descripcion', 'categoria', 'precio', 'stock', 'activo']:
            if field in payload:
                setattr(p, field, payload.get(field))
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/productos/<int:pid>', methods=['DELETE'])
def delete_producto(pid):
    try:
        from models import Producto
        p = Producto.query.get(pid)
        if not p:
            return jsonify({'success': False, 'message': 'Producto no encontrado'}), 404
        db.session.delete(p)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

# =========================
# CRUD VEHÍCULOS
# =========================
@app.route('/api/vehiculos', methods=['GET'])
def list_vehiculos():
    try:
        from models import Vehiculo
        vehiculos = Vehiculo.query.order_by(Vehiculo.placa).all()
        data = [{
            'id': v.id,
            'placa': v.placa,
            'marca': v.marca,
            'modelo': v.modelo,
            'capacidad': v.capacidad
        } for v in vehiculos]
        return jsonify({'success': True, 'vehiculos': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/vehiculos/<int:vid>', methods=['GET'])
def get_vehiculo(vid):
    from models import Vehiculo
    v = Vehiculo.query.get(vid)
    if not v:
        return jsonify({'success': False, 'message': 'Vehículo no encontrado'}), 404
    return jsonify({
        'success': True,
        'vehiculo': {
            'id': v.id,
            'placa': v.placa,
            'marca': v.marca,
            'modelo': v.modelo,
            'capacidad': v.capacidad
        }
    })

@app.route('/api/vehiculos', methods=['POST'])
def create_vehiculo():
    try:
        from models import Vehiculo
        payload = request.get_json()
        v = Vehiculo(
            placa=payload.get('placa'),
            marca=payload.get('marca'),
            modelo=payload.get('modelo'),
            capacidad=payload.get('capacidad', 0)
        )
        db.session.add(v)
        db.session.commit()
        return jsonify({'success': True, 'id': v.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/vehiculos/<int:vid>', methods=['PUT'])
def update_vehiculo(vid):
    try:
        from models import Vehiculo
        v = Vehiculo.query.get(vid)
        if not v:
            return jsonify({'success': False, 'message': 'Vehículo no encontrado'}), 404
        payload = request.get_json()
        for field in ['placa', 'marca', 'modelo', 'capacidad']:
            if field in payload:
                setattr(v, field, payload.get(field))
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/vehiculos/<int:vid>', methods=['DELETE'])
def delete_vehiculo(vid):
    try:
        from models import Vehiculo
        v = Vehiculo.query.get(vid)
        if not v:
            return jsonify({'success': False, 'message': 'Vehículo no encontrado'}), 404
        db.session.delete(v)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    

# =========================
# CRUD CLIENTES
# =========================
@app.route('/api/clientes', methods=['GET'])
def list_clientes():
    try:
        from models import Cliente, User
        clientes = Cliente.query.join(User).all()
        data = [{
            'id': c.id,
            'usuario_id': c.usuario_id,
            'nombre': User.query.get(c.usuario_id).nombre if c.usuario_id else '',
            'email': User.query.get(c.usuario_id).email if c.usuario_id else '',
            'direccion': c.direccion,
            'telefono': c.telefono,
            'nit': c.nit
        } for c in clientes]
        return jsonify({'success': True, 'clientes': data})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/clientes/<int:cid>', methods=['GET'])
def get_cliente(cid):
    from models import Cliente, User
    c = Cliente.query.get(cid)
    if not c:
        return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404
    usuario = User.query.get(c.usuario_id) if c.usuario_id else None
    return jsonify({
        'success': True,
        'cliente': {
            'id': c.id,
            'usuario_id': c.usuario_id,
            'nombre': usuario.nombre if usuario else '',
            'email': usuario.email if usuario else '',
            'direccion': c.direccion,
            'telefono': c.telefono,
            'nit': c.nit
        }
    })

@app.route('/api/clientes', methods=['POST'])
def create_cliente():
    try:
        from models import Cliente, User
        payload = request.get_json()
        
        # Crear usuario primero si viene email
        usuario_id = None
        if payload.get('email'):
            usuario = User(
                nombre=payload.get('nombre', ''),
                email=payload.get('email'),
                rol_id=2,  # rol usuario normal
                activo=True
            )
            usuario.set_password('cliente123')  # Password temporal
            usuario.temp_password = True
            db.session.add(usuario)
            db.session.flush()
            usuario_id = usuario.id
        
        c = Cliente(
            usuario_id=usuario_id,
            direccion=payload.get('direccion'),
            telefono=payload.get('telefono'),
            nit=payload.get('nit')
        )
        db.session.add(c)
        db.session.commit()
        return jsonify({'success': True, 'id': c.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/clientes/<int:cid>', methods=['PUT'])
def update_cliente(cid):
    try:
        from models import Cliente, User
        c = Cliente.query.get(cid)
        if not c:
            return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404
        
        payload = request.get_json()
        
        # Actualizar usuario si existe
        if c.usuario_id and payload.get('nombre'):
            usuario = User.query.get(c.usuario_id)
            if usuario:
                usuario.nombre = payload.get('nombre')
        
        for field in ['direccion', 'telefono', 'nit']:
            if field in payload:
                setattr(c, field, payload.get(field))
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/clientes/<int:cid>', methods=['DELETE'])
def delete_cliente(cid):
    try:
        from models import Cliente, User
        c = Cliente.query.get(cid)
        if not c:
            return jsonify({'success': False, 'message': 'Cliente no encontrado'}), 404
        
        # Opcional: eliminar usuario asociado
        if c.usuario_id:
            usuario = User.query.get(c.usuario_id)
            if usuario:
                db.session.delete(usuario)
        
        db.session.delete(c)
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