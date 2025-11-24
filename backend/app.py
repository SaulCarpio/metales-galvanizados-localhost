# =========================
# IMPORTS Y CONFIGURACIÓN - CORREGIDO
# =========================
from flask import Flask, jsonify, request, Response
from fpdf import FPDF
import io
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
import traceback
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
import json
# CORRECCIÓN CRÍTICA: Importar TODOS los modelos necesarios
from models import (
    db, User, Role, CodigosVerificacion, Cotizacion, Pedido, PedidoDetalle,
    Proveedor, OrdenCompra, OrdenCompraDetalle, CuentaPagar, CuentaCobrar, 
    MovimientoPago, InventarioSucursal, MetodoPago,
    Cliente, Producto, Vehiculo, Sucursal, MetricaEntrega, ProcesoImportacion, InventarioMovimiento, Ruta # <-- ¡Correcto!
)
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
    expiracion = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)  # ✅ CORREGIDO
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
    if codigo.expiracion < datetime.datetime.utcnow():  # ✅ CORREGIDO
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

# =========================================================
# ENDPOINTS DE COTIZACIONES
# =========================================================

class PDF(FPDF):
    """Clase personalizada para crear el PDF con cabecera y pie de página."""
    def header(self):
        # Puedes añadir aquí tu logo si quieres: self.image('path/to/logo.png', 10, 8, 33)
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'METALES GALVANIZADOS Y ACEROS S.R.L.', 0, 1, 'C')
        self.set_font('Arial', '', 10)
        self.cell(0, 5, 'Dirección: Zona Cruce Lagunas, El Alto, La Paz', 0, 1, 'C')
        self.cell(0, 5, 'Teléfono: (+591) 777-12345', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Página {self.page_no()}', 0, 0, 'C')

def generate_quote_pdf(cotizacion):
    """Función interna para generar el contenido del PDF (versión final y corregida)."""
    try:
        pdf = PDF()
        pdf.add_page()
        pdf.set_font('Arial', 'B', 12)
        
        # Título y Fechas
        pdf.cell(0, 10, f"Cotización Nro: {cotizacion.id}", 0, 1, 'L')
        pdf.set_font('Arial', '', 11)
        fecha_emision_str = cotizacion.fecha_emitida.strftime('%d/%m/%Y') if cotizacion.fecha_emitida else 'N/A'
        fecha_expiracion_str = cotizacion.fecha_expiracion.strftime('%d/%m/%Y') if cotizacion.fecha_expiracion else 'N/A'
        pdf.cell(0, 7, f"Fecha de Emisión: {fecha_emision_str}", 0, 1, 'L')
        pdf.cell(0, 7, f"Válida hasta: {fecha_expiracion_str}", 0, 1, 'L')
        pdf.ln(10)

        # Datos del Cliente
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(0, 7, "Datos del Cliente:", 0, 1, 'L')
        pdf.set_font('Arial', '', 11)
        pdf.cell(0, 7, f"  Nombre: {str(cotizacion.nombre_cliente or 'N/A')}", 0, 1, 'L')
        pdf.ln(5)

        # Encabezados de la Tabla
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(90, 8, 'Descripción', 1, 0, 'C')
        pdf.cell(30, 8, 'Cantidad', 1, 0, 'C')
        pdf.cell(35, 8, 'P. Unitario (Bs)', 1, 0, 'C')
        pdf.cell(35, 8, 'Subtotal (Bs)', 1, 1, 'C')
        
        pdf.set_font('Arial', '', 10)
        total_general = 0

        # Lógica para manejar 'detalles'
        detalles = cotizacion.detalles
        if isinstance(detalles, str):
            try:
                detalles = json.loads(detalles)
            except json.JSONDecodeError:
                detalles = {}
        
        if not isinstance(detalles, dict):
            detalles = {}

        calaminas = detalles.get('calaminas', [])
        if isinstance(calaminas, list) and len(calaminas) > 0:
            for item in calaminas:
                if not isinstance(item, dict): continue
                
                largo = item.get('largo') or item.get('longitud') or 0
                cantidad = float(item.get('cantidad', 0))
                subtotal = float(item.get('subtotal', 0))
                p_unit = (subtotal / cantidad) if cantidad > 0 else 0
                
                descripcion = str(f"Calamina {cotizacion.producto or ''} ({cotizacion.color or ''}) - {largo}m")
                
                pdf.cell(90, 8, descripcion, 1)
                pdf.cell(30, 8, str(int(cantidad)), 1, 0, 'C')
                pdf.cell(35, 8, f"{p_unit:.2f}", 1, 0, 'R')
                pdf.cell(35, 8, f"{subtotal:.2f}", 1, 1, 'R')
                total_general += subtotal
        
        # Fila de Total
        pdf.ln(5)
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(155, 10, 'TOTAL COTIZADO', 1, 0, 'R')
        pdf.cell(35, 10, f"{total_general:.2f} Bs.", 1, 1, 'R')
        
        # --- LA CORRECCIÓN CLAVE ---
        # La salida ya es un objeto de bytes (bytearray), no necesitamos .encode()
        pdf_output = pdf.output(dest='S')
        
        return io.BytesIO(pdf_output)

    except Exception as e:
        print("💥 CRASH DENTRO DE generate_quote_pdf:")
        traceback.print_exc()
        raise e

@app.route('/api/cotizaciones/<int:cot_id>/pdf', methods=['GET'])
def get_cotizacion_pdf(cot_id):
    """Endpoint para servir el PDF de una cotización específica."""
    try:
        cotizacion = Cotizacion.query.get_or_404(cot_id)
        pdf_buffer = generate_quote_pdf(cotizacion)
        
        return Response(
            pdf_buffer,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'inline; filename=cotizacion_{cot_id}.pdf'}
        )
    except Exception as e:
        return jsonify({'success': False, 'message': f"Error interno al generar el PDF: {str(e)}"}), 500

@app.route('/api/cotizaciones', methods=['GET'])
def list_cotizaciones():
    """Endpoint para listar todas las cotizaciones."""
    try:
        cotizaciones = Cotizacion.query.order_by(Cotizacion.fecha_emitida.desc()).all()
        data = []
        for c in cotizaciones:
            data.append({
                'id': c.id,
                'cliente_id': c.cliente_id,
                'nombre_cliente': c.nombre_cliente or (f'Cliente {c.cliente_id}' if c.cliente_id else 'Sin cliente'),
                'producto': c.producto or '',
                'color': c.color or '',
                'cantidad': float(c.cantidad) if c.cantidad is not None else 0,
                'precio_unitario': float(c.precio_unitario) if c.precio_unitario is not None else 0,
                'estado': c.estado or 'emitida',
                'fecha_emitida': c.fecha_emitida.isoformat() if c.fecha_emitida else None,
                'fecha_expiracion': c.fecha_expiracion.isoformat() if c.fecha_expiracion else None,
                'detalles': c.detalles,
            })
        return jsonify({'success': True, 'cotizaciones': data})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/cotizaciones', methods=['POST'])
def create_cotizacion():
    """Endpoint para crear una nueva cotización."""
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({'success': False, 'message': 'Datos inválidos'}), 400
        
        c = Cotizacion(
            cliente_id=payload.get('cliente_id'),
            nombre_cliente=payload.get('nombre_cliente', ''),
            producto=payload.get('producto', 'Varios'),
            color=payload.get('color', ''),
            fecha_expiracion=payload.get('fecha_expiracion'),
            precio_unitario=float(payload.get('precio_unitario', 0)),
            cantidad=float(payload.get('cantidad', 0)),
            estado=payload.get('estado', 'emitida'),
            usuario_id=payload.get('usuario_id'),
            detalles=payload.get('detalles', {})
        )
        
        db.session.add(c)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'id': c.id,
            'message': 'Cotización creada exitosamente'
        }), 201
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@app.route('/api/cotizaciones/<int:cot_id>', methods=['DELETE'])
def delete_cotizacion(cot_id):
    """Endpoint para eliminar una cotización."""
    try:
        cotizacion = Cotizacion.query.get(cot_id)
        if not cotizacion:
            return jsonify({'success': False, 'message': 'Cotización no encontrada'}), 404
        
        db.session.delete(cotizacion)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Cotización eliminada correctamente'})
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =========================================================
# ENDPOINTS DE PEDIDOS - COMPLETOS (GET Y POST)
# =========================================================

@app.route('/api/pedidos', methods=['GET'])
def list_pedidos():
    """
    Lista todos los pedidos con información completa del cliente.
    """
    try:
        # Usamos relaciones de SQLAlchemy para hacer la consulta más eficiente
        pedidos_query = Pedido.query.options(
            db.joinedload(Pedido.cliente).joinedload(Cliente.usuario),
            db.joinedload(Pedido.detalles).joinedload(PedidoDetalle.producto)
        ).order_by(Pedido.fecha_pedido.desc()).all()
        
        data = []
        for p in pedidos_query:
            cliente_info = {}
            if p.cliente and p.cliente.usuario:
                cliente_info = {
                    'nombre': p.cliente.usuario.nombre,
                    'telefono': p.cliente.telefono,
                    'direccion': p.cliente.direccion
                }

            detalles_list = [{
                'producto_nombre': d.producto.nombre if d.producto else 'N/A',
                'cantidad': float(d.cantidad),
                'subtotal': float(d.subtotal)
            } for d in p.detalles]

            data.append({
                'id': p.id,
                'cliente_id': p.cliente_id,
                'cliente_info': cliente_info,
                'fecha_pedido': p.fecha_pedido.isoformat() if p.fecha_pedido else None,
                'estado': p.estado,
                'prioridad': p.prioridad,
                'total': float(p.total),
                'detalles': detalles_list
            })
        
        return jsonify({'success': True, 'pedidos': data})
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/pedidos', methods=['POST'])
def create_pedido():
    """
    Crea un nuevo pedido.
    """
    try:
        data = request.get_json()
        if not data or not data.get('cliente_id') or not data.get('detalles'):
            return jsonify({'success': False, 'message': 'Datos incompletos.'}), 400

        total_calculado = sum(float(item.get('subtotal', 0)) for item in data['detalles'])

        nuevo_pedido = Pedido(
            cliente_id=data.get('cliente_id'),
            total=total_calculado,
            estado='pendiente',
            prioridad=data.get('prioridad', 'normal')
        )
        db.session.add(nuevo_pedido)
        db.session.flush()

        for item in data['detalles']:
            detalle = PedidoDetalle(
                pedido_id=nuevo_pedido.id,
                producto_id=item.get('producto_id'),
                cantidad=item.get('cantidad'),
                subtotal=item.get('subtotal')
            )
            db.session.add(detalle)

        db.session.commit()
        return jsonify({'success': True, 'id': nuevo_pedido.id, 'message': 'Pedido creado con éxito.'}), 201

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
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
        data = []
        
        for m in movs:
            # Obtener información de la cuenta pagar si existe
            cuenta_pagar_info = None
            if m.cuenta_pagar_id:
                cp = CuentaPagar.query.get(m.cuenta_pagar_id)
                if cp:
                    cuenta_pagar_info = {
                        'referencia': cp.referencia,
                        'proveedor_id': cp.proveedor_id
                    }
            
            # Obtener información de la cuenta cobrar si existe
            cuenta_cobrar_info = None
            if m.cuenta_cobrar_id:
                cc = CuentaCobrar.query.get(m.cuenta_cobrar_id)
                if cc:
                    cuenta_cobrar_info = {
                        'referencia': cc.referencia if hasattr(cc, 'referencia') else None,
                        'cliente_id': cc.cliente_id if hasattr(cc, 'cliente_id') else None
                    }
            
            # Obtener información del método de pago si existe
            metodo_pago_info = None
            if m.metodo_pago_id:
                mp = MetodoPago.query.get(m.metodo_pago_id)
                if mp:
                    metodo_pago_info = {
                        'nombre': mp.nombre if hasattr(mp, 'nombre') else None
                    }
            
            data.append({
                'id': m.id,
                'cuenta_pagar_id': m.cuenta_pagar_id,
                'cuenta_pagar_info': cuenta_pagar_info,
                'cuenta_cobrar_id': m.cuenta_cobrar_id,
                'cuenta_cobrar_info': cuenta_cobrar_info,
                'monto': float(m.monto),
                'fecha_pago': m.fecha_pago.isoformat() if m.fecha_pago else None,
                'metodo_pago_id': m.metodo_pago_id,
                'metodo_pago_info': metodo_pago_info,
                'referencia_pago': m.referencia_pago,
                'nota': m.nota
            })
        
        return jsonify({'success': True, 'movimientos': data})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/movimientos-pago', methods=['POST'])
def create_movimiento_pago():
    try:
        payload = request.get_json()
        
        # Validar datos obligatorios
        if not payload.get('monto'):
            return jsonify({'success': False, 'message': 'El monto es obligatorio'}), 400
        
        # Procesar metodo_pago_id correctamente (puede ser string vacío, null o número)
        metodo_pago_id = payload.get('metodo_pago_id')
        if metodo_pago_id == '' or metodo_pago_id is None:
            metodo_pago_id = None
        else:
            try:
                metodo_pago_id = int(metodo_pago_id)
            except (ValueError, TypeError):
                metodo_pago_id = None
        
        # Procesar cuenta_pagar_id
        cuenta_pagar_id = payload.get('cuenta_pagar_id')
        if cuenta_pagar_id == '' or cuenta_pagar_id is None:
            cuenta_pagar_id = None
        else:
            cuenta_pagar_id = int(cuenta_pagar_id)
        
        # Procesar cuenta_cobrar_id
        cuenta_cobrar_id = payload.get('cuenta_cobrar_id')
        if cuenta_cobrar_id == '' or cuenta_cobrar_id is None:
            cuenta_cobrar_id = None
        else:
            cuenta_cobrar_id = int(cuenta_cobrar_id)
        
        # Crear movimiento
        m = MovimientoPago(
            cuenta_pagar_id=cuenta_pagar_id,
            cuenta_cobrar_id=cuenta_cobrar_id,
            monto=float(payload.get('monto')),
            metodo_pago_id=metodo_pago_id,
            referencia_pago=payload.get('referencia_pago', ''),
            nota=payload.get('nota', '')
        )
        db.session.add(m)
        db.session.flush()  # Para obtener el ID antes de commit

        # Actualizar saldos en cuentas
        if m.cuenta_pagar_id:
            cp = CuentaPagar.query.get(m.cuenta_pagar_id)
            if cp:
                cp.monto_pagado = (cp.monto_pagado or 0) + float(m.monto)
                # Actualizar estado
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
        
        return jsonify({
            'success': True, 
            'id': m.id,
            'message': 'Movimiento registrado correctamente'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False, 
            'message': f'Error al crear movimiento: {str(e)}'
        }), 500


# =========================
# CRUD InventarioSucursal (Control de existencias) - CORREGIDO
# =========================

@app.route('/api/inventario', methods=['GET'])
def list_inventario():
    """
    Lista todos los registros de inventario de todas las sucursales.
    Este es el endpoint que faltaba y causaba el error 405.
    """
    print("✅ Endpoint de LISTAR Inventario alcanzado.")
    try:
        inventario_items = InventarioSucursal.query.order_by(InventarioSucursal.sucursal_id, InventarioSucursal.producto_id).all()
        data = []
        for i in inventario_items:
            data.append({
                'id': i.id,
                'producto_id': i.producto_id,
                'sucursal_id': i.sucursal_id,
                'cantidad': float(i.cantidad) if i.cantidad is not None else 0,
                'estado': i.estado,
                'ultimo_movimiento': i.ultimo_movimiento.isoformat() if i.ultimo_movimiento else None
            })
        # La clave 'inventario' debe coincidir con la que espera tu frontend
        return jsonify({'success': True, 'inventario': data})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventario', methods=['POST'])
def create_inventario():
    """
    Crea un nuevo registro de inventario.
    """
    try:
        payload = request.get_json() or {}

        # Validaciones básicas
        producto_id = payload.get('producto_id')
        sucursal_id = payload.get('sucursal_id')
        cantidad = payload.get('cantidad', 0)
        estado = payload.get('estado', 'disponible')

        if not producto_id or not sucursal_id:
            return jsonify({'success': False, 'message': 'Producto y Sucursal son obligatorios'}), 400

        # Verificar que exista producto y sucursal
        producto = Producto.query.get(producto_id)
        sucursal = Sucursal.query.get(sucursal_id)
        if not producto or not sucursal:
            return jsonify({'success': False, 'message': 'Producto o Sucursal no existen'}), 400

        # Validar cantidad
        try:
            cantidad = float(cantidad)
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Cantidad inválida'}), 400

        # Crear inventario
        nuevo = InventarioSucursal(
            producto_id=producto_id,
            sucursal_id=sucursal_id,
            cantidad=cantidad,
            estado=estado
        )

        db.session.add(nuevo)
        db.session.commit()

        return jsonify({'success': True, 'id': nuevo.id}), 201

    except Exception as e:
        db.session.rollback()
        print("ERROR Inventario:", e)
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'Error interno del servidor'}), 500


@app.route('/api/inventario/<int:iid>', methods=['GET'])
def get_inventario(iid):
    """
    Obtiene un registro de inventario específico por su ID.
    """
    try:
        i = InventarioSucursal.query.get(iid)
        if not i:
            return jsonify({'success': False, 'message': 'Registro de inventario no encontrado'}), 404

        return jsonify({
            'success': True,
            'inventario': {
                'id': i.id,
                'producto_id': i.producto_id,
                'sucursal_id': i.sucursal_id,
                'cantidad': float(i.cantidad) if i.cantidad is not None else 0,
                'estado': i.estado,
                'ultimo_movimiento': i.ultimo_movimiento.isoformat() if i.ultimo_movimiento else None
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventario/<int:iid>', methods=['PUT'])
def update_inventario(iid):
    """
    Actualiza un registro de inventario existente.
    """
    try:
        i = InventarioSucursal.query.get(iid)
        if not i:
            return jsonify({'success': False, 'message': 'Registro de inventario no encontrado'}), 404

        payload = request.get_json() or {}

        # Actualizar campos si vienen en payload
        for field in ['producto_id', 'sucursal_id', 'cantidad', 'estado']:
            if field in payload:
                if field == 'cantidad':
                    try:
                        setattr(i, field, float(payload[field]))
                    except (ValueError, TypeError):
                        return jsonify({'success': False, 'message': 'Cantidad inválida'}), 400
                else:
                    setattr(i, field, payload[field])
        
        # Actualizar la fecha del último movimiento
        i.ultimo_movimiento = datetime.datetime.utcnow()

        db.session.commit()
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/inventario/<int:iid>', methods=['DELETE'])
def delete_inventario(iid):
    """
    Elimina un registro de inventario.
    """
    try:
        i = InventarioSucursal.query.get(iid)
        if not i:
            return jsonify({'success': False, 'message': 'Registro de inventario no encontrado'}), 404

        db.session.delete(i)
        db.session.commit()
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
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
# ENDPOINTS DE GESTIÓN DE RUTAS (CICLO DE VIDA)
# =========================

@app.route('/api/rutas/<int:ruta_id>/start', methods=['POST'])
def start_route(ruta_id):
    """ Marcar una ruta como 'en_camino' y registrar la fecha de inicio. """
    ruta = Ruta.query.get(ruta_id)
    if not ruta:
        return jsonify({'success': False, 'message': 'Ruta no encontrada'}), 404

    ruta.estado = 'en_camino'
    ruta.fecha_inicio = datetime.datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'message': f'Ruta {ruta_id} iniciada.'})

@app.route('/api/rutas/<int:ruta_id>/complete', methods=['POST', 'OPTIONS'])
def complete_ruta(ruta_id):
    """Endpoint para completar una ruta - VERSIÓN CORREGIDA"""
    if request.method == 'OPTIONS':
        # Respuesta CORS más robusta
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, PUT, DELETE')
        return response, 200

    try:
        # Verificar que ruta_id sea válido
        if not ruta_id or ruta_id <= 0:
            return jsonify({'success': False, 'message': 'ID de ruta inválido'}), 400

        ruta = Ruta.query.get(ruta_id)
        if not ruta:
            return jsonify({'success': False, 'message': f'Ruta {ruta_id} no encontrada'}), 404

        print(f"✅ Finalizando Ruta #{ruta_id}")

        # Actualizar estado de la ruta
        ruta.estado = 'completada'
        ruta.fecha_fin = datetime.datetime.utcnow()

        # Buscar pedidos asociados a esta ruta
        pedidos = Pedido.query.filter_by(ruta_id=ruta_id).all()
        
        print(f"   - Encontrados {len(pedidos)} pedidos para la ruta")
        
        # Actualizar estado de cada pedido
        pedidos_actualizados = 0
        for p in pedidos:
            p.estado = 'entregado'
            pedidos_actualizados += 1
            print(f"   - Pedido #{p.id} marcado como entregado")

        # Crear métricas de entrega
        if ruta.fecha_inicio and ruta.fecha_fin:
            tiempo_real_min = int((ruta.fecha_fin - ruta.fecha_inicio).total_seconds() / 60)
            tiempo_estimado = ruta.tiempo_estimado_min or 0
            
            metrica = MetricaEntrega(
                ruta_id=ruta_id,
                tiempo_real_min=tiempo_real_min,
                retraso=(tiempo_real_min > tiempo_estimado),
                combustible_usado_lts=0  # Puedes calcular esto según la distancia
            )
            db.session.add(metrica)
            print(f"   - Métrica creada: {tiempo_real_min} min (estimado: {tiempo_estimado} min)")

        db.session.commit()
        
        return jsonify({
            'success': True, 
            'ruta_id': ruta_id, 
            'pedidos_actualizados': pedidos_actualizados,
            'message': f'Ruta {ruta_id} finalizada exitosamente con {pedidos_actualizados} pedidos entregados'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error finalizando ruta {ruta_id}:")
        traceback.print_exc()
        return jsonify({
            'success': False, 
            'message': f'Error finalizando ruta: {str(e)}'
        }), 500

# =========================
# ENDPOINT DE KPIS LOGÍSTICOS - VERIFICADO
# =========================

@app.route('/api/kpis/logistics', methods=['GET'])
def get_logistics_kpis():
    """
    Calcula y devuelve los KPIs clave basados en las rutas completadas.
    """
    print("✅ Endpoint de KPIs alcanzado.") 
    
    try:
        # 1. Tiempo Promedio de Entrega
        avg_time = db.session.query(func.avg(MetricaEntrega.tiempo_real_min)).scalar() or 0
        
        # 2. Kilometraje Promedio por Ruta
        avg_km = db.session.query(func.avg(Ruta.distancia_km)).filter(Ruta.estado == 'completada').scalar() or 0
        
        # 3. Cumplimiento de Entregas a Tiempo
        total_entregas = db.session.query(func.count(MetricaEntrega.id)).scalar() or 0
        entregas_a_tiempo = db.session.query(func.count(MetricaEntrega.id)).filter(MetricaEntrega.retraso == False).scalar() or 0
        cumplimiento_pct = (entregas_a_tiempo / total_entregas * 100) if total_entregas > 0 else 100
        
        # 4. Consumo Total de Combustible 
        total_combustible = db.session.query(func.sum(MetricaEntrega.combustible_usado_lts)).scalar() or 0
        
        # 5. Costo Operativo Total
        COSTO_POR_KM = 3.5
        COSTO_DIESEL_POR_LITRO = 3.72
        
        total_km_recorridos = db.session.query(func.sum(Ruta.distancia_km)).filter(Ruta.estado == 'completada').scalar() or 0
        costo_por_distancia = float(total_km_recorridos or 0) * COSTO_POR_KM
        costo_por_combustible = float(total_combustible or 0) * COSTO_DIESEL_POR_LITRO
        costo_operativo_total = costo_por_distancia + costo_por_combustible
        
        # 6. Quiebres de Inventario (simulado)
        quiebres_inventario_pct = random.uniform(2, 5)

        kpis = {
            "tiempoPromedioEntregaMin": round(avg_time, 1),
            "kilometrajePromedioKm": round(float(avg_km or 0), 1),
            "cumplimientoEntregasPct": round(cumplimiento_pct, 1),
            "consumoCombustibleTotalLts": round(float(total_combustible or 0), 1),
            "costoOperativoTotalBs": round(costo_operativo_total, 2),
            "quiebresInventarioPct": round(quiebres_inventario_pct, 1)
        }

        return jsonify({'success': True, 'kpis': kpis})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error calculando KPIs: {str(e)}'}), 500
    
# =========================================================
# CRUD PROCESO DE IMPORTACIONES con Lógica de Inventario
# =========================================================

@app.route('/api/importaciones', methods=['GET'])
def list_importaciones():
    try:
        importaciones = ProcesoImportacion.query.order_by(ProcesoImportacion.fecha_orden.desc()).all()
        data = []
        for i in importaciones:
            i.calcular_total() # Asegurarse que el total esté actualizado
            data.append({
                'id': i.id,
                'referencia': i.referencia,
                'proveedor_id': i.proveedor_id,
                'proveedor_nombre': i.proveedor.nombre if i.proveedor else 'N/A',
                'producto_id': i.producto_id,
                'producto_nombre': i.producto.nombre if i.producto else 'N/A',
                'cantidad': float(i.cantidad or 0),
                'estado': i.estado,
                'fecha_orden': i.fecha_orden.isoformat() if i.fecha_orden else None,
                'fecha_llegada_estimada': i.fecha_llegada_estimada.isoformat() if i.fecha_llegada_estimada else None,
                'fecha_llegada_real': i.fecha_llegada_real.isoformat() if i.fecha_llegada_real else None,
                'total_importacion': float(i.total_importacion or 0)
            })
        return jsonify({'success': True, 'importaciones': data})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/importaciones', methods=['POST'])
def create_importacion():
    try:
        data = request.get_json()
        nueva_importacion = ProcesoImportacion(
            proveedor_id=data.get('proveedor_id'),
            producto_id=data.get('producto_id'),
            referencia=data.get('referencia'),
            descripcion=data.get('descripcion'),
            cantidad=data.get('cantidad'),
            precio_unitario=data.get('precio_unitario'),
            fecha_llegada_estimada=data.get('fecha_llegada_estimada'),
            estado=data.get('estado', 'En Cotizacion')
        )
        # Asignar costos
        for field in ['costo_flete_maritimo', 'costo_flete_terrestre', 'costo_aduanas', 'otros_costos']:
            if field in data:
                setattr(nueva_importacion, field, data.get(field))
        
        nueva_importacion.calcular_total()
        db.session.add(nueva_importacion)
        db.session.commit()
        return jsonify({'success': True, 'id': nueva_importacion.id}), 201
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/importaciones/<int:import_id>', methods=['PUT'])
def update_importacion(import_id):
    try:
        importacion = ProcesoImportacion.query.get(import_id)
        if not importacion:
            return jsonify({'success': False, 'message': 'Importación no encontrada'}), 404
        
        data = request.get_json()
        estado_anterior = importacion.estado
        
        # Actualizar campos
        campos_actualizables = [
            'proveedor_id', 'producto_id', 'referencia', 'descripcion', 'cantidad', 
            'precio_unitario', 'fecha_llegada_estimada', 'estado', 'costo_flete_maritimo',
            'costo_flete_terrestre', 'costo_aduanas', 'otros_costos'
        ]
        for field in campos_actualizables:
            if field in data:
                setattr(importacion, field, data.get(field))

        importacion.calcular_total()

        # --- LÓGICA DE NEGOCIO: ACTUALIZAR INVENTARIO ---
        if importacion.estado == 'Recibido' and estado_anterior != 'Recibido':
            print(f"✅ Procesando recepción de importación ID {importacion.id}")
            importacion.fecha_llegada_real = datetime.datetime.utcnow()

            # ID de la sucursal principal donde se recibe la materia prima (ajustar si es necesario)
            SUCURSAL_PRINCIPAL_ID = 1 

            # Buscar si ya hay stock de ese producto en la sucursal
            stock_existente = InventarioSucursal.query.filter_by(
                producto_id=importacion.producto_id,
                sucursal_id=SUCURSAL_PRINCIPAL_ID
            ).first()

            if stock_existente:
                stock_existente.cantidad += importacion.cantidad
                print(f"   - Stock actualizado para producto {importacion.producto_id}: {stock_existente.cantidad}")
            else:
                nuevo_stock = InventarioSucursal(
                    producto_id=importacion.producto_id,
                    sucursal_id=SUCURSAL_PRINCIPAL_ID,
                    cantidad=importacion.cantidad
                )
                db.session.add(nuevo_stock)
                print(f"   - Nuevo stock creado para producto {importacion.producto_id}: {importacion.cantidad}")
            
            # Registrar el movimiento de inventario
            movimiento = InventarioMovimiento(
                producto_id=importacion.producto_id,
                cantidad=importacion.cantidad,
                tipo='entrada por importacion',
                referencia=f"Importacion ID {importacion.id}"
            )
            db.session.add(movimiento)

        db.session.commit()
        return jsonify({'success': True, 'message': 'Importación actualizada'})
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/dispatch-route', methods=['POST', 'OPTIONS'])
def dispatch_route():
    """Endpoint para despachar una ruta con múltiples pedidos - VERSIÓN DEFINITIVA"""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        data = request.get_json()
        
        print("📩 Recibiendo solicitud de despacho:", data)

        if not data:
            return jsonify({'success': False, 'message': 'Faltan datos.'}), 400

        conductor_id = data.get('conductor_id')
        vehiculo_id = data.get('vehiculo_id')
        pedido_ids = data.get('pedido_ids', [])
        route_details = data.get('route_details', {})

        # Validaciones básicas
        if not conductor_id:
            return jsonify({'success': False, 'message': 'Se requiere conductor_id.'}), 400
        if not vehiculo_id:
            return jsonify({'success': False, 'message': 'Se requiere vehiculo_id.'}), 400
        if not pedido_ids:
            return jsonify({'success': False, 'message': 'Se requieren pedido_ids.'}), 400

        print(f"🔍 Buscando vehículo ID: {vehiculo_id}")
        # Verificar vehículo
        vehiculo = Vehiculo.query.get(vehiculo_id)
        if not vehiculo:
            print(f"❌ Vehículo {vehiculo_id} no encontrado")
            return jsonify({'success': False, 'message': f'Vehículo ID {vehiculo_id} no encontrado.'}), 404

        print(f"✅ Vehículo encontrado: {vehiculo.placa}")

        # ✅ USAR datetime.datetime.now() EXPLÍCITAMENTE
        nueva_ruta = Ruta(
            conductor_id=conductor_id,
            estado='en_camino',
            fecha_programada=datetime.datetime.now(),  # ✅ datetime.datetime.now()
            fecha_inicio=datetime.datetime.now(),      # ✅ datetime.datetime.now()
            distancia_km=float(route_details.get('distance_km', 0)),
            tiempo_estimado_min=int(route_details.get('time_min', 0))
        )
        
        db.session.add(nueva_ruta)
        db.session.flush()  # Generar ID sin commit

        print(f"✅ Ruta creada con ID: {nueva_ruta.id}")

        # Actualizar Pedidos
        pedidos_actualizados = 0
        pedidos_no_encontrados = []
        
        for pedido_id in pedido_ids:
            print(f"🔍 Buscando pedido ID: {pedido_id}")
            pedido = Pedido.query.get(pedido_id)
            if pedido:
                pedido.vehiculo_id = vehiculo_id
                pedido.ruta_id = nueva_ruta.id
                pedido.estado = 'en_camino'
                pedidos_actualizados += 1
                print(f"   ✅ Pedido #{pedido_id} asignado a ruta {nueva_ruta.id}")
            else:
                pedidos_no_encontrados.append(pedido_id)
                print(f"   ❌ Pedido #{pedido_id} no encontrado")

        if pedidos_actualizados == 0:
            db.session.rollback()
            return jsonify({
                'success': False, 
                'message': 'No se encontraron pedidos válidos para asignar.',
                'pedidos_no_encontrados': pedidos_no_encontrados
            }), 400

        db.session.commit()
        
        print(f"🎉 Ruta despachada exitosamente: {nueva_ruta.id} con {pedidos_actualizados} pedidos")
        
        return jsonify({
            'success': True, 
            'data': {
                'ruta_id': nueva_ruta.id,
                'pedidos_actualizados': pedidos_actualizados,
                'vehiculo_asignado': vehiculo.placa
            },
            'message': f'Ruta iniciada correctamente con {pedidos_actualizados} pedidos en vehículo {vehiculo.placa}'
        }), 200

    except Exception as e:
        db.session.rollback()
        print("❌ ERROR CRÍTICO en dispatch_route:")
        print(f"   Tipo de error: {type(e).__name__}")
        print(f"   Mensaje: {str(e)}")
        traceback.print_exc()
        
        return jsonify({
            'success': False, 
            'message': f'Error interno del servidor: {str(e)}',
            'error_type': type(e).__name__
        }), 500


@app.route('/api/pedidos/<int:pedido_id>/asignar-vehiculo', methods=['POST', 'OPTIONS'])
def asignar_vehiculo_a_pedido(pedido_id):
    """
    Endpoint para asignar un vehículo a un pedido específico.
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        vehiculo_id = data.get('vehiculo_id')
        
        if not vehiculo_id:
            return jsonify({'success': False, 'message': 'Se requiere vehiculo_id'}), 400
        
        # Buscar el pedido
        pedido = Pedido.query.get(pedido_id)
        if not pedido:
            return jsonify({'success': False, 'message': 'Pedido no encontrado'}), 404
        
        # Verificar que el vehículo existe
        vehiculo = Vehiculo.query.get(vehiculo_id)
        if not vehiculo:
            return jsonify({'success': False, 'message': 'Vehículo no encontrado'}), 404
        
        # Verificar que el pedido no tenga ya un vehículo asignado
        if pedido.vehiculo_id:
            return jsonify({
                'success': False, 
                'message': f'El pedido ya tiene asignado el vehículo {pedido.vehiculo_id}'
            }), 400
        
        # Asignar el vehículo al pedido
        pedido.vehiculo_id = vehiculo_id
        pedido.estado = 'asignado'  # Opcional: cambiar estado
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Vehículo {vehiculo.placa} asignado correctamente al Pedido #{pedido_id}',
            'pedido': {
                'id': pedido.id,
                'vehiculo_id': pedido.vehiculo_id,
                'estado': pedido.estado
            }
        })
        
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
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