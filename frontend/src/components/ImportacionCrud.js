import React, { useState, useEffect, useCallback } from 'react';
import { importacionesAPI, proveedoresAPI, productosAPI } from '../utils/api';
import './Crud.css'; // Reutilizamos el mismo CSS de tus otros CRUDs

const ImportacionCrud = () => {
    const [importaciones, setImportaciones] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [currentData, setCurrentData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const estadosPosibles = ['En Cotizacion', 'Ordenado', 'En Transito', 'En Aduana', 'Recibido', 'Cancelado'];

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [impRes, provRes, prodRes] = await Promise.all([
                importacionesAPI.list(),
                proveedoresAPI.list(),
                productosAPI.list()
            ]);
            setImportaciones(impRes.data?.importaciones || []);
            setProveedores(provRes.data?.proveedores || []);
            setProductos(prodRes.data?.productos || []);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenModal = (data = null) => {
        setCurrentData(data ? { ...data } : { estado: 'En Cotizacion' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentData(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCurrentData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentData.id) {
                await importacionesAPI.update(currentData.id, currentData);
            } else {
                await importacionesAPI.create(currentData);
            }
            fetchData();
            handleCloseModal();
        } catch (error) {
            console.error("Error guardando importación:", error);
        }
    };

    if (loading) return <div className="loading">Cargando Módulo de Importaciones...</div>;

    return (
        <div className="crud-container">
            <h2>Gestión de Procesos de Importación</h2>
            <button className="btn-new" onClick={() => handleOpenModal()}>+ Nueva Importación</button>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Referencia</th>
                            <th>Proveedor</th>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Estado</th>
                            <th>Llegada Estimada</th>
                            <th>Costo Total (Bs.)</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {importaciones.map(item => (
                            <tr key={item.id}>
                                <td>{item.referencia}</td>
                                <td>{item.proveedor_nombre}</td>
                                <td>{item.producto_nombre}</td>
                                <td>{item.cantidad}</td>
                                <td><span className={`status-badge status-${item.estado.toLowerCase().replace(' ', '-')}`}>{item.estado}</span></td>
                                <td>{item.fecha_llegada_estimada ? new Date(item.fecha_llegada_estimada).toLocaleDateString() : 'N/A'}</td>
                                <td>{Number(item.total_importacion).toFixed(2)}</td>
                                <td>
                                    <button className="btn-edit" onClick={() => handleOpenModal(item)}>Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{currentData?.id ? 'Editar' : 'Crear'} Importación</h3>
                        <form onSubmit={handleSubmit}>
                            {/* Fila 1 */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Referencia</label>
                                    <input type="text" name="referencia" value={currentData.referencia || ''} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Estado</label>
                                    <select name="estado" value={currentData.estado || ''} onChange={handleChange}>
                                        {estadosPosibles.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* Fila 2 */}
                             <div className="form-row">
                                <div className="form-group">
                                    <label>Proveedor</label>
                                    <select name="proveedor_id" value={currentData.proveedor_id || ''} onChange={handleChange} required>
                                        <option value="">Seleccione un proveedor</option>
                                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Producto a Importar</label>
                                    <select name="producto_id" value={currentData.producto_id || ''} onChange={handleChange} required>
                                        <option value="">Seleccione un producto</option>
                                        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* Fila 3 */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cantidad (ej: Kilos)</label>
                                    <input type="number" name="cantidad" value={currentData.cantidad || ''} onChange={handleChange} required step="0.01"/>
                                </div>
                                <div className="form-group">
                                    <label>Precio Unitario (Bs.)</label>
                                    <input type="number" name="precio_unitario" value={currentData.precio_unitario || ''} onChange={handleChange} required step="0.01"/>
                                </div>
                                <div className="form-group">
                                    <label>Fecha Llegada Estimada</label>
                                    <input type="date" name="fecha_llegada_estimada" value={currentData.fecha_llegada_estimada?.split('T')[0] || ''} onChange={handleChange} />
                                </div>
                            </div>
                            
                            <h4>Costos Logísticos (Bs.)</h4>
                             <div className="form-row">
                                <div className="form-group">
                                    <label>Flete Marítimo</label>
                                    <input type="number" name="costo_flete_maritimo" value={currentData.costo_flete_maritimo || ''} onChange={handleChange} step="0.01"/>
                                </div>
                                 <div className="form-group">
                                    <label>Flete Terrestre</label>
                                    <input type="number" name="costo_flete_terrestre" value={currentData.costo_flete_terrestre || ''} onChange={handleChange} step="0.01"/>
                                </div>
                                 <div className="form-group">
                                    <label>Aduanas</label>
                                    <input type="number" name="costo_aduanas" value={currentData.costo_aduanas || ''} onChange={handleChange} step="0.01"/>
                                </div>
                                 <div className="form-group">
                                    <label>Otros</label>
                                    <input type="number" name="otros_costos" value={currentData.otros_costos || ''} onChange={handleChange} step="0.01"/>
                                </div>
                            </div>
                            
                            <div className="modal-actions">
                                <button type="submit" className="btn-save">Guardar</button>
                                <button type="button" className="btn-cancel" onClick={handleCloseModal}>Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportacionCrud;