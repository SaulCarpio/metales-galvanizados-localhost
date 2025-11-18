from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from flask_bcrypt import Bcrypt

# =========================
# INICIALIZACIÓN DE EXTENSIONES
# =========================
db = SQLAlchemy()
mail = Mail()
bcrypt = Bcrypt()


# =========================
# MODELOS BASE DEL SISTEMA
# =========================

class Role(db.Model):
    """
    Modelo de roles de usuario (admin, usuario, etc).
    """
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False)
    descripcion = db.Column(db.Text)
    usuarios = db.relationship('User', backref='role', lazy=True)


class User(db.Model):
    """
    Modelo de usuarios del sistema.
    Incluye métodos para encriptar/verificar contraseñas con bcrypt.
    """
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    rol_id = db.Column(db.Integer, db.ForeignKey('roles.id'))
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    activo = db.Column(db.Boolean, default=True)
    creado_en = db.Column(db.DateTime, server_default=db.func.now())
    temp_password = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


# =========================
# CLIENTES (PERFIL DE USUARIO)
# =========================

class Cliente(db.Model):
    """
    Perfil extendido para usuarios tipo cliente.
    """
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), unique=True)
    direccion = db.Column(db.Text)
    telefono = db.Column(db.String(20))
    nit = db.Column(db.String(50))


# =========================
# VEHÍCULOS
# =========================

class Vehiculo(db.Model):
    """
    Información de vehículos de la empresa.
    """
    __tablename__ = 'vehiculos'
    id = db.Column(db.Integer, primary_key=True)
    placa = db.Column(db.String(20), unique=True, nullable=False)
    marca = db.Column(db.String(50))
    modelo = db.Column(db.String(50))
    capacidad = db.Column(db.Integer)


# =========================
# CONDUCTORES (PERFIL DE USUARIO)
# =========================

class Conductor(db.Model):
    """
    Perfil extendido para usuarios tipo conductor.
    """
    __tablename__ = 'conductores'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), unique=True)
    licencia = db.Column(db.String(50), unique=True, nullable=False)
    vehiculo_id = db.Column(db.Integer, db.ForeignKey('vehiculos.id'))


# =========================
# PRODUCTOS
# =========================

class Producto(db.Model):
    """
    Catálogo de productos.
    """
    __tablename__ = 'productos'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    categoria = db.Column(db.String(100))
    precio = db.Column(db.Numeric(10,2), nullable=False)
    stock = db.Column(db.Integer, default=0)
    activo = db.Column(db.Boolean, default=True)


# =========================
# PEDIDOS
# =========================

class Pedido(db.Model):
    """
    Pedido realizado por un cliente.
    """
    __tablename__ = 'pedidos'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'))
    fecha_pedido = db.Column(db.DateTime, server_default=db.func.now())
    estado = db.Column(db.String(50), default='pendiente')
    prioridad = db.Column(db.String(20), default='normal')
    total = db.Column(db.Numeric(10,2), nullable=False)


# =========================
# DETALLES DE PEDIDO
# =========================

class PedidoDetalle(db.Model):
    """
    Detalle de productos en un pedido.
    """
    __tablename__ = 'pedido_detalles'
    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id', ondelete='CASCADE'))
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'))
    cantidad = db.Column(db.Integer, nullable=False)
    subtotal = db.Column(db.Numeric(10,2), nullable=False)


# =========================
# RUTAS DE ENTREGA
# =========================

class Ruta(db.Model):
    """
    Ruta asignada para un pedido.
    """
    __tablename__ = 'rutas'
    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id'))
    conductor_id = db.Column(db.Integer, db.ForeignKey('conductores.id'))
    fecha_programada = db.Column(db.DateTime)
    estado = db.Column(db.String(50), default='pendiente')


# =========================
# DETALLES DE RUTA
# =========================

class RutaDetalle(db.Model):
    """
    Detalle de puntos (lat/lon) de una ruta.
    """
    __tablename__ = 'ruta_detalles'
    id = db.Column(db.Integer, primary_key=True)
    ruta_id = db.Column(db.Integer, db.ForeignKey('rutas.id', ondelete='CASCADE'))
    lat = db.Column(db.Numeric(9,6))
    lon = db.Column(db.Numeric(9,6))
    orden = db.Column(db.Integer)


# =========================
# MOVIMIENTOS DE INVENTARIO
# =========================

class InventarioMovimiento(db.Model):
    """
    Registro de entradas y salidas de inventario.
    """
    __tablename__ = 'inventario_movimientos'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'))
    cantidad = db.Column(db.Integer, nullable=False)
    tipo = db.Column(db.String(20), nullable=False)  # entrada / salida
    fecha = db.Column(db.DateTime, server_default=db.func.now())


# =========================
# MÉTRICAS DE ENTREGAS
# =========================

class MetricaEntrega(db.Model):
    """
    Métricas de desempeño de entregas (tiempo, retraso, combustible).
    """
    __tablename__ = 'metricas_entregas'
    id = db.Column(db.Integer, primary_key=True)
    ruta_id = db.Column(db.Integer, db.ForeignKey('rutas.id'))
    tiempo_entrega = db.Column(db.Integer)
    retraso = db.Column(db.Boolean)
    combustible_usado = db.Column(db.Numeric(10,2))


# =========================
# MÉTODOS DE PAGO
# =========================

class MetodoPago(db.Model):
    """
    Métodos de pago disponibles.
    """
    __tablename__ = 'metodos_pago'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False)
    descripcion = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)


# =========================
# PAGOS
# =========================

class Pago(db.Model):
    """
    Registro de pagos realizados por pedidos.
    """
    __tablename__ = 'pagos'
    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id'))
    metodo_id = db.Column(db.Integer, db.ForeignKey('metodos_pago.id'))
    monto = db.Column(db.Numeric(10,2), nullable=False)
    fecha = db.Column(db.DateTime, server_default=db.func.now())
    estado = db.Column(db.String(50), default='pendiente')


# =========================
# GRAFO VIAL: NODOS Y ARISTAS
# =========================

class Nodo(db.Model):
    """
    Nodo/intersección del grafo vial (para rutas urbanas).
    """
    __tablename__ = 'nodos'
    id = db.Column(db.Integer, primary_key=True)
    osmid = db.Column(db.BigInteger)
    lat = db.Column(db.Numeric(9,6), nullable=False)
    lon = db.Column(db.Numeric(9,6), nullable=False)
    descripcion = db.Column(db.Text)


class Arista(db.Model):
    """
    Arista/calle del grafo vial, con atributos de restricción y velocidad.
    """
    __tablename__ = 'aristas'
    id = db.Column(db.Integer, primary_key=True)
    osmid = db.Column(db.BigInteger)
    origen_id = db.Column(db.Integer, db.ForeignKey('nodos.id'), nullable=False)
    destino_id = db.Column(db.Integer, db.ForeignKey('nodos.id'), nullable=False)
    longitud_m = db.Column(db.Numeric(9,2))
    velocidad_max_kmh = db.Column(db.Numeric(5,2))
    restriccion = db.Column(db.Boolean, default=False)
    dia_restriccion = db.Column(db.String(20))
    motivo_restriccion = db.Column(db.Text)
    atributos = db.Column(db.JSON)


# =========================
# NOTA DE VENTA (PROFORMAS)
# =========================

class NotaVenta(db.Model):
    """
    Registro de proformas o notas de venta (simplificado).
    """
    __tablename__ = 'nota_venta'
    id = db.Column(db.Integer, primary_key=True)
    nro_proforma = db.Column(db.String(20), unique=True, nullable=False)
    cliente = db.Column(db.String(150), nullable=False)
    cel = db.Column(db.String(20))
    vendedor = db.Column(db.String(100), nullable=False)
    fecha = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    producto = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(50))
    cantidad = db.Column(db.Integer, nullable=False)
    longitud = db.Column(db.Numeric(10,2))
    precio_unitario = db.Column(db.Numeric(10,2), nullable=False)
    importe = db.Column(db.Numeric(10,2), nullable=False)
    subtotal = db.Column(db.Numeric(10,2), nullable=False)
    anticipo = db.Column(db.Numeric(10,2))
    saldo = db.Column(db.Numeric(10,2))
    total = db.Column(db.Numeric(10,2), nullable=False)
    fecha_entrega = db.Column(db.DateTime)
    nombre_cliente = db.Column(db.String(150))
    nit = db.Column(db.String(50))
    firma_caja = db.Column(db.String(100))
    firma_cliente = db.Column(db.String(100))


# =========================
# SUCURSALES / ALMACENES (ERP)
# =========================

class Sucursal(db.Model):
    """
    Sucursales físicas (ej: Sucursal 1 Cruce Lagunas, Sucursal 2 Mercedario).
    """
    __tablename__ = 'sucursales'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False, unique=True)
    direccion = db.Column(db.Text)
    telefono = db.Column(db.String(50))
    contacto = db.Column(db.String(150))


class Almacen(db.Model):
    """
    Almacenes/sectores dentro de una sucursal (opcional).
    """
    __tablename__ = 'almacenes'
    id = db.Column(db.Integer, primary_key=True)
    sucursal_id = db.Column(db.Integer, db.ForeignKey('sucursales.id'), nullable=False)
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    sucursal = db.relationship('Sucursal', backref='almacenes')


class InventarioSucursal(db.Model):
    """
    Cantidad de bobinas / productos por sucursal y estado.
    - 'estado' p. ej. 'en_produccion', 'sellado', 'disponible'.
    """
    __tablename__ = 'inventario_sucursal'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    sucursal_id = db.Column(db.Integer, db.ForeignKey('sucursales.id'), nullable=False)
    cantidad = db.Column(db.Numeric(12,3), nullable=False, default=0)  # metros / unidades
    estado = db.Column(db.String(50), nullable=False, default='disponible')
    ultimo_movimiento = db.Column(db.DateTime, server_default=db.func.now())
    producto = db.relationship('Producto', backref='stocks')
    sucursal = db.relationship('Sucursal', backref='stocks')
    __table_args__ = (db.Index('ix_inventario_prod_suc_estado', 'producto_id', 'sucursal_id', 'estado'),)


# =========================
# PROVEEDORES Y DISTRIBUIDORES
# =========================

class Proveedor(db.Model):
    __tablename__ = 'proveedores'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    contacto = db.Column(db.String(150))
    telefono = db.Column(db.String(50))
    direccion = db.Column(db.Text)
    datos_extra = db.Column(db.JSON)  # RFC, NIT, condiciones, etc.


class Distribuidor(db.Model):
    __tablename__ = 'distribuidores'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    contacto = db.Column(db.String(150))
    telefono = db.Column(db.String(50))
    direccion = db.Column(db.Text)
    datos_extra = db.Column(db.JSON)


# =========================
# FINANZAS: CUENTAS POR PAGAR / COBRAR y PAGOS PARCIALES
# =========================

class CuentaPagar(db.Model):
    """
    Cuentas por pagar a proveedores.
    """
    __tablename__ = 'cuentas_pagar'
    id = db.Column(db.Integer, primary_key=True)
    proveedor_id = db.Column(db.Integer, db.ForeignKey('proveedores.id'), nullable=False)
    referencia = db.Column(db.String(200))  # factura, orden de compra, etc.
    monto_total = db.Column(db.Numeric(14,2), nullable=False)
    monto_pagado = db.Column(db.Numeric(14,2), nullable=False, default=0)
    fecha_emision = db.Column(db.DateTime, server_default=db.func.now())
    fecha_vencimiento = db.Column(db.DateTime)
    moneda = db.Column(db.String(10), default='BOB')
    estado = db.Column(db.String(50), default='pendiente')  # pendiente, parcial, pagada, vencida
    descripcion = db.Column(db.Text)
    proveedor = db.relationship('Proveedor', backref='cuentas_pagar')


class CuentaCobrar(db.Model):
    """
    Cuentas por cobrar a distribuidores o clientes, con producto y cantidad en metros.
    """
    __tablename__ = 'cuentas_cobrar'
    id = db.Column(db.Integer, primary_key=True)
    distribuidor_id = db.Column(db.Integer, db.ForeignKey('distribuidores.id'), nullable=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=True)
    referencia = db.Column(db.String(200))  # nota de venta, contrato, etc.
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=True)
    cantidad_metros = db.Column(db.Numeric(12,3))
    monto_total = db.Column(db.Numeric(14,2), nullable=False)
    monto_pagado = db.Column(db.Numeric(14,2), nullable=False, default=0)
    fecha_emision = db.Column(db.DateTime, server_default=db.func.now())
    fecha_vencimiento = db.Column(db.DateTime)
    estado = db.Column(db.String(50), default='pendiente')  # pendiente, parcial, cobrado
    distribuidor = db.relationship('Distribuidor', backref='cuentas_cobrar')
    cliente = db.relationship('Cliente', backref='cuentas_cobrar')
    producto = db.relationship('Producto')


class MovimientoPago(db.Model):
    """
    Movimientos de pago (tanto para cuentas por pagar como por cobrar).
    Relaciona pagos parciales con las cuentas.
    """
    __tablename__ = 'movimientos_pago'
    id = db.Column(db.Integer, primary_key=True)
    cuenta_pagar_id = db.Column(db.Integer, db.ForeignKey('cuentas_pagar.id'), nullable=True)
    cuenta_cobrar_id = db.Column(db.Integer, db.ForeignKey('cuentas_cobrar.id'), nullable=True)
    monto = db.Column(db.Numeric(14,2), nullable=False)
    fecha_pago = db.Column(db.DateTime, server_default=db.func.now())
    metodo_pago_id = db.Column(db.Integer, db.ForeignKey('metodos_pago.id'), nullable=True)
    referencia_pago = db.Column(db.String(200))  # nro transacción, banco
    nota = db.Column(db.Text)

    cuenta_pagar = db.relationship('CuentaPagar', backref='pagos')
    cuenta_cobrar = db.relationship('CuentaCobrar', backref='pagos')
    metodo_pago = db.relationship('MetodoPago')


# =========================
# PRESUPUESTO / COMPRAS (compra de bobina con costos adicionales)
# =========================

class PresupuestoCompra(db.Model):
    """
    Presupuesto (orden/registro) de compra de bobina con desglose de costos:
    flete_marítimo, flete_terrestre y aduanas.
    """
    __tablename__ = 'presupuestos_compra'
    id = db.Column(db.Integer, primary_key=True)
    proveedor_id = db.Column(db.Integer, db.ForeignKey('proveedores.id'), nullable=True)
    referencia = db.Column(db.String(200))
    descripcion = db.Column(db.Text)
    cantidad_bobinas = db.Column(db.Integer, nullable=False, default=1)
    precio_bobina = db.Column(db.Numeric(14,2), nullable=False)
    costo_flete_maritimo = db.Column(db.Numeric(14,2), default=0)
    costo_flete_terrestre = db.Column(db.Numeric(14,2), default=0)
    costo_aduanas = db.Column(db.Numeric(14,2), default=0)
    otros_costos = db.Column(db.Numeric(14,2), default=0)
    total_compra = db.Column(db.Numeric(16,2), nullable=False)
    fecha = db.Column(db.DateTime, server_default=db.func.now())
    estado = db.Column(db.String(50), default='borrador')  # borrador, aprobado, recibido, cancelado
    proveedor = db.relationship('Proveedor')

    def calcular_total(self):
        subtotal = (self.cantidad_bobinas or 0) * (self.precio_bobina or 0)
        extras = (self.costo_flete_maritimo or 0) + (self.costo_flete_terrestre or 0) + (self.costo_aduanas or 0) + (self.otros_costos or 0)
        self.total_compra = subtotal + extras


# =========================
# CONTROL DE PRECIOS / HISTORIAL
# =========================

class PrecioProducto(db.Model):
    """
    Precio por metro cuadrado por tipo de cliente (cliente minorista / distribuidor).
    """
    __tablename__ = 'precios_producto'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    tipo_cliente = db.Column(db.String(50), nullable=False)  # 'cliente', 'distribuidor'
    precio_m2 = db.Column(db.Numeric(14,4), nullable=False)
    fecha_inicio = db.Column(db.DateTime, server_default=db.func.now())
    fecha_fin = db.Column(db.DateTime, nullable=True)
    activo = db.Column(db.Boolean, default=True)
    producto = db.relationship('Producto', backref='precios')


class HistorialPrecio(db.Model):
    """
    Registra cambios de precio para control y reportes (subida por crisis, etc).
    """
    __tablename__ = 'historial_precios'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    tipo_cliente = db.Column(db.String(50))
    precio_anterior = db.Column(db.Numeric(14,4))
    precio_nuevo = db.Column(db.Numeric(14,4))
    porcentaje_cambio = db.Column(db.Numeric(6,2))
    motivo = db.Column(db.Text)
    fecha = db.Column(db.DateTime, server_default=db.func.now())
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)


# =========================
# VENTAS: COTIZACIONES
# =========================

class Cotizacion(db.Model):
    """
    Cotizaciones de venta:
    - Fecha de emisión + expiración por defecto 3 días.
    """
    __tablename__ = 'cotizaciones'
    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=True)
    nombre_cliente = db.Column(db.String(200))  # si no hay cliente en tabla
    producto = db.Column(db.String(200), nullable=False)  # 'calamina', 'calamina plastica', ...
    color = db.Column(db.String(100))
    fecha_emitida = db.Column(db.DateTime, server_default=db.func.now())
    fecha_expiracion = db.Column(db.DateTime, nullable=False)
    precio_unitario = db.Column(db.Numeric(14,4))
    cantidad = db.Column(db.Numeric(12,3))
    estado = db.Column(db.String(50), default='emitida')  # emitida, aceptada, vencida, cancelada
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)


# =========================
# REPORTES (opcional)
# =========================

class ReporteGuardado(db.Model):
    """
    Opcional: guardar configuraciones de reportes (filtros y resultados cacheados).
    """
    __tablename__ = 'reportes_guardados'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200))
    tipo_reporte = db.Column(db.String(100))  # 'presupuesto', 'movimientos', 'control_precios'
    filtro = db.Column(db.JSON)  # filtros aplicados (sucursal, rango fechas, producto, ...)
    resultado_cache = db.Column(db.JSON)  # opcional, guardar datos para graficar
    creado_en = db.Column(db.DateTime, server_default=db.func.now())
    creado_por = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)


# =========================
# MODELO DE MACHINE LEARNING
# =========================

class ModeloML(db.Model):
    """
    Registro de modelos de Machine Learning (ej. Random Forest).
    """
    __tablename__ = 'modelo_ml'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(50))  # RandomForest, SVM, etc.
    ruta_archivo = db.Column(db.String(255))  # Ruta al archivo .pkl o URI (s3://...)
    fecha_entrenamiento = db.Column(db.DateTime, server_default=db.func.now())
    activo = db.Column(db.Boolean, default=True)
    # opcionales: metricas, hiperparams, creado_por (puedes ampliarlo según necesites)


class PrediccionML(db.Model):
    """
    Registro de predicciones realizadas por el modelo ML.
    """
    __tablename__ = 'predicciones_ml'
    id = db.Column(db.Integer, primary_key=True)
    modelo_id = db.Column(db.Integer, db.ForeignKey('modelo_ml.id'))
    entrada = db.Column(db.JSON, nullable=False)
    resultado = db.Column(db.String(100))
    probabilidad = db.Column(db.Numeric(6,4), nullable=True)
    fecha = db.Column(db.DateTime, server_default=db.func.now())
    # puedes relacionar con Pedido o Ruta si deseas: p.ej. pedido_id = db.Column(...)


# Fin del archivo models.py
# =========================
# CÓDIGOS DE VERIFICACIÓN
# =========================

class CodigosVerificacion(db.Model):
    """
    Almacena códigos de verificación para recuperación de contraseña.
    """
    __tablename__ = 'codigos_verificacion'
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    codigo = db.Column(db.String(10), nullable=False)
    expiracion = db.Column(db.DateTime, nullable=False)
    usado = db.Column(db.Boolean, default=False)
    usuario = db.relationship('User', backref='codigos_verificacion')
