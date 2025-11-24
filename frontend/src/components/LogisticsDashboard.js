import React, { useState, useEffect } from 'react'; // <--- LÍNEA CORREGIDA
import { kpisAPI } from '../utils/api';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Registrar los componentes de Chart.js que vamos a usar
ChartJS.register(ArcElement, Tooltip, Legend);

// --- Estilos Mejorados para el Dashboard ---
const styles = {
  dashboard: {
    padding: '24px',
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#343a40',
    marginBottom: '24px',
    borderBottom: '3px solid #4CAF50',
    paddingBottom: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
  },
  cardIcon: {
    fontSize: '24px',
    padding: '12px',
    borderRadius: '50%',
    marginRight: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#495057',
  },
  cardContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#212529',
  },
  kpiUnit: {
    fontSize: '18px',
    fontWeight: '500',
    marginLeft: '8px',
    color: '#6c757d',
  },
  legend: {
    marginTop: '20px',
    width: '100%',
  },
  details: {
    border: '1px solid #e9ecef',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '600',
    color: '#007bff',
  },
  legendContent: {
    marginTop: '12px',
    fontSize: '14px',
    color: '#6c757d',
    textAlign: 'left',
    lineHeight: '1.6',
  },
  loading: {
    textAlign: 'center',
    fontSize: '18px',
    padding: '50px',
    color: '#333',
  },
  error: {
    textAlign: 'center',
    fontSize: '18px',
    padding: '50px',
    color: '#dc3545',
  },
};

// --- Componente de Gráfico de Dona (Gauge) ---
const GaugeChart = ({ value, color = '#2196F3' }) => {
  const data = {
    datasets: [
      {
        data: [value, 100 - value],
        backgroundColor: [color, '#e9ecef'],
        borderColor: ['#ffffff'],
        borderWidth: 2,
        circumference: 180, // Media dona
        rotation: 270,      // Empieza desde abajo
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%',
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  };
  return (
    <div style={{ position: 'relative', width: '150px', height: '85px' }}>
      <Doughnut data={data} options={options} />
      <div style={{
        position: 'absolute',
        top: '60%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center'
      }}>
        <span style={{ fontSize: '28px', fontWeight: 'bold', color: color }}>{value}</span>
        <span style={{ fontSize: '18px', color: color }}>%</span>
      </div>
    </div>
  );
};


// --- Componente de Tarjeta de KPI Mejorado ---
const KpiChartCard = ({ icon, bgColor, iconColor, title, value, unit, description, calculation, chartData }) => (
  <div style={styles.kpiCard}>
    <div style={styles.cardHeader}>
      <div style={{ ...styles.cardIcon, backgroundColor: bgColor, color: iconColor }}>{icon}</div>
      <h3 style={styles.cardTitle}>{title}</h3>
    </div>
    <div style={styles.cardContent}>
      {chartData ? (
        <GaugeChart value={chartData.value} color={chartData.color} />
      ) : (
        <p style={styles.kpiValue}>
          {value ?? '-'} <span style={styles.kpiUnit}>{unit}</span>
        </p>
      )}
    </div>
    <div style={styles.legend}>
      <details style={styles.details}>
        <summary style={styles.summary}>¿Qué significa esto?</summary>
        <div style={styles.legendContent}>
          <p><strong>Definición:</strong> {description}</p>
          <p><strong>Fuente del Dato:</strong> {calculation}</p>
        </div>
      </details>
    </div>
  </div>
);


// --- Componente Principal del Dashboard ---
const LogisticsDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setLoading(true);
        setError(null); // Limpiar errores anteriores
        const response = await kpisAPI.getLogisticsKpis();
        if (response.success) {
          setKpis(response.data.kpis);
        } else {
          throw new Error(response.message || 'Error al cargar los datos de KPIs');
        }
      } catch (err) {
        setError(err.message);
        console.error("Error fetching KPIs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, []);

  if (loading) return <div style={styles.loading}>🔄 Cargando Indicadores de Rendimiento...</div>;
  if (error) return <div style={styles.error}>❌ Error al cargar el dashboard: {error}</div>;

  return (
    <div style={styles.dashboard}>
      <h1 style={styles.title}>Dashboard de Rendimiento Logístico</h1>
      {kpis ? (
        <div style={styles.grid}>
          <KpiChartCard
            icon="✔️"
            bgColor="#e7f5ec" iconColor="#28a745"
            title="Entregas a Tiempo"
            chartData={{ value: kpis.cumplimientoEntregasPct, color: '#28a745' }}
            description="Porcentaje de entregas completadas sin ser marcadas como 'retraso'. Mide la fiabilidad y puntualidad del servicio."
            calculation="Calculado a partir de la tabla 'metricas_entregas', comparando el total de entregas contra las que tienen el campo 'retraso' en falso."
          />
          <KpiChartCard
            icon="⏱️"
            bgColor="#e3f2fd" iconColor="#2196F3"
            title="Tiempo Promedio de Entrega"
            value={kpis.tiempoPromedioEntregaMin}
            unit="min"
            description="Tiempo real promedio que toma una ruta desde que el conductor la inicia hasta que la marca como completada."
            calculation="Es el promedio de la columna 'tiempo_real_min' en la tabla 'metricas_entregas'."
          />
          <KpiChartCard
            icon="🛣️"
            bgColor="#fff3e0" iconColor="#ff9800"
            title="Kilometraje Promedio por Ruta"
            value={kpis.kilometrajePromedioKm}
            unit="km"
            description="Distancia promedio recorrida para completar una entrega. Un número menor indica una mayor eficiencia en la planificación de rutas."
            calculation="Es el promedio de la columna 'distancia_km' de todas las rutas en estado 'completada'."
          />
          <KpiChartCard
            icon="💰"
            bgColor="#f3e5f5" iconColor="#9c27b0"
            title="Costo Operativo Total"
            value={kpis.costoOperativoTotalBs}
            unit="Bs."
            description="Suma de los costos directos de distribución, incluyendo el desgaste por kilómetro y el gasto en combustible."
            calculation="Se calcula como: (Total de Km * Costo Fijo por Km) + (Total de Litros * Costo del Combustible). Los costos fijos se definen en el backend."
          />
          <KpiChartCard
            icon="⛽"
            bgColor="#ffebee" iconColor="#f44336"
            title="Consumo Total de Combustible"
            value={kpis.consumoCombustibleTotalLts}
            unit="Lts"
            description="Cantidad total de litros de combustible utilizados por la flota en las entregas registradas."
            calculation="Es la suma de la columna 'combustible_usado_lts' en la tabla 'metricas_entregas'."
          />
          <KpiChartCard
            icon="📦"
            bgColor="#e8eaf6" iconColor="#3f51b5"
            title="Quiebres de Inventario"
            chartData={{ 
              value: kpis.quiebresInventarioPct,
              color: kpis.quiebresInventarioPct > 10 ? '#f44336' : '#3f51b5' 
            }}
            description="Mide la frecuencia con la que un pedido no puede ser surtido por falta de stock. Un porcentaje bajo es ideal."
            calculation="Actualmente es un valor simulado en el backend para demostración. En una versión futura, se calcularía con base en pedidos cancelados por falta de stock."
          />
        </div>
      ) : (
        <p>No hay datos de KPIs disponibles para mostrar.</p>
      )}
    </div>
  );
};

export default LogisticsDashboard;