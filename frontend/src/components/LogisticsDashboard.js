import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const styles = {
  dashboard: {
    padding: '24px',
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#212529',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6c757d',
  },
  clearButton: {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    padding: '24px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
  },
  cardIcon: {
    fontSize: '28px',
    padding: '14px',
    borderRadius: '12px',
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '120px',
  },
  kpiValue: {
    fontSize: '42px',
    fontWeight: '700',
    color: '#212529',
  },
  kpiUnit: {
    fontSize: '20px',
    fontWeight: '500',
    marginLeft: '8px',
    color: '#6c757d',
  },
  comparisonContainer: {
    width: '100%',
    marginTop: '16px',
  },
  comparisonRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    marginBottom: '8px',
  },
  comparisonLabel: {
    fontSize: '14px',
    color: '#6c757d',
  },
  comparisonValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#212529',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '12px',
  },
  badgeSuccess: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  badgeDanger: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  badgeWarning: {
    backgroundColor: '#fff3cd',
    color: '#856404',
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
    fontSize: '14px',
  },
  legendContent: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#6c757d',
    lineHeight: '1.6',
  },
  noData: {
    textAlign: 'center',
    fontSize: '18px',
    padding: '50px',
    color: '#6c757d',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  chartContainer: {
    width: '100%',
    height: '200px',
    marginTop: '10px',
  },
};

const GaugeChart = ({ value, color = '#2196F3' }) => {
  const data = {
    datasets: [
      {
        data: [value, 100 - value],
        backgroundColor: [color, '#e9ecef'],
        borderColor: ['#ffffff'],
        borderWidth: 2,
        circumference: 180,
        rotation: 270,
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

const ComparisonBarChart = ({ estimado, real, label }) => {
  const data = {
    labels: [label],
    datasets: [
      {
        label: 'Estimado',
        data: [estimado],
        backgroundColor: '#007bff',
        borderRadius: 6,
      },
      {
        label: 'Real',
        data: [real],
        backgroundColor: '#28a745',
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={styles.chartContainer}>
      <Bar data={data} options={options} />
    </div>
  );
};

const KpiCard = ({ icon, bgColor, iconColor, title, value, unit, description, calculation, chartData, comparison, badge, barChart }) => (
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
      {badge && (
        <span style={{
          ...styles.badge,
          ...(badge.type === 'success' ? styles.badgeSuccess : 
              badge.type === 'warning' ? styles.badgeWarning : 
              styles.badgeDanger)
        }}>
          {badge.text}
        </span>
      )}
    </div>
    
    {barChart && (
      <ComparisonBarChart 
        estimado={barChart.estimado} 
        real={barChart.real} 
        label={barChart.label} 
      />
    )}
    
    {comparison && (
      <div style={styles.comparisonContainer}>
        {comparison.map((item, idx) => (
          <div key={idx} style={styles.comparisonRow}>
            <span style={styles.comparisonLabel}>{item.label}:</span>
            <span style={styles.comparisonValue}>{item.value}</span>
          </div>
        ))}
      </div>
    )}
    
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

const LogisticsDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [metricasCount, setMetricasCount] = useState(0);

  const loadMetricasFromLocalStorage = () => {
    try {
      const metricas = JSON.parse(localStorage.getItem('metricas_rutas') || '[]');
      setMetricasCount(metricas.length);

      if (metricas.length === 0) {
        setKpis(null);
        return;
      }

      // Calcular promedios de tiempo
      const totalTiempoEstimado = metricas.reduce((sum, m) => sum + (m.tiempo_estimado_min || 0), 0);
      const totalTiempoReal = metricas.reduce((sum, m) => sum + (m.tiempo_real_min || 0), 0);
      const avgTiempoEstimado = totalTiempoEstimado / metricas.length;
      const avgTiempoReal = totalTiempoReal / metricas.length;

      // Calcular desviación de tiempo
      const desviacionTiempo = avgTiempoEstimado > 0 
        ? ((avgTiempoReal - avgTiempoEstimado) / avgTiempoEstimado) * 100 
        : 0;

      // Calcular promedios de distancia
      const totalDistanciaEstimada = metricas.reduce((sum, m) => sum + (m.distancia_estimada_km || 0), 0);
      const totalDistanciaReal = metricas.reduce((sum, m) => sum + (m.distancia_real_km || 0), 0);
      const avgDistanciaEstimada = totalDistanciaEstimada / metricas.length;
      const avgDistanciaReal = totalDistanciaReal / metricas.length;

      // Calcular desviación de distancia
      const desviacionDistancia = avgDistanciaEstimada > 0 
        ? ((avgDistanciaReal - avgDistanciaEstimada) / avgDistanciaEstimada) * 100 
        : 0;

      // Calcular entregas a tiempo
      const rutasATiempo = metricas.filter(m => !m.retraso).length;
      const cumplimientoPct = (rutasATiempo / metricas.length) * 100;

      // Calcular eficiencia de entregas
      const totalEntregasPlanificadas = metricas.reduce((sum, m) => sum + (m.entregas_planificadas || 0), 0);
      const totalEntregasCompletadas = metricas.reduce((sum, m) => sum + (m.entregas_completadas || 0), 0);
      const eficienciaPct = totalEntregasPlanificadas > 0 
        ? (totalEntregasCompletadas / totalEntregasPlanificadas) * 100 
        : 100;

      setKpis({
        // Tiempos
        tiempoPromedioEstimado: avgTiempoEstimado,
        tiempoPromedioReal: avgTiempoReal,
        desviacionTiempo,

        // Distancias
        distanciaPromedioEstimada: avgDistanciaEstimada,
        distanciaPromedioReal: avgDistanciaReal,
        desviacionDistancia,

        // Cumplimiento
        cumplimientoPct,
        eficienciaPct,

        // Totales
        totalRutas: metricas.length,
        totalEntregasPlanificadas,
        totalEntregasCompletadas,
      });

    } catch (error) {
      console.error('Error cargando métricas:', error);
      setKpis(null);
    }
  };

  useEffect(() => {
    loadMetricasFromLocalStorage();
  }, []);

  const handleClearData = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar todas las métricas guardadas?')) {
      localStorage.removeItem('metricas_rutas');
      setKpis(null);
      setMetricasCount(0);
      alert('✅ Todas las métricas han sido eliminadas');
    }
  };

  if (!kpis || metricasCount === 0) {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>📊 Dashboard de Rendimiento Logístico</h1>
            <p style={styles.subtitle}>Sistema de métricas locales</p>
          </div>
        </div>
        <div style={styles.noData}>
          <h2>📭 No hay datos disponibles</h2>
          <p>Completa al menos una ruta para comenzar a ver las métricas de rendimiento.</p>
          <p style={{marginTop: '20px', fontSize: '14px', color: '#6c757d'}}>
            Las métricas se guardarán automáticamente en tu navegador cada vez que finalices una ruta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>📊 Dashboard de Rendimiento Logístico</h1>
          <p style={styles.subtitle}>
            Métricas basadas en {kpis.totalRutas} rutas completadas • 
            {kpis.totalEntregasCompletadas} de {kpis.totalEntregasPlanificadas} entregas realizadas
          </p>
        </div>
        <button style={styles.clearButton} onClick={handleClearData}>
          🗑️ Limpiar Datos
        </button>
      </div>
      
      <div style={styles.grid}>
        
        {/* KPI 1: Entregas a Tiempo */}
        <KpiCard
          icon="✅"
          bgColor="#e7f5ec"
          iconColor="#28a745"
          title="Cumplimiento de Entregas"
          chartData={{ 
            value: Math.round(kpis.cumplimientoPct), 
            color: kpis.cumplimientoPct >= 85 ? '#28a745' : '#dc3545'
          }}
          badge={{
            type: kpis.cumplimientoPct >= 85 ? 'success' : 'danger',
            text: kpis.cumplimientoPct >= 85 ? '🎯 Excelente' : '⚠️ Necesita Mejora'
          }}
          description="Porcentaje de rutas completadas sin retraso significativo (tolerancia del 10% sobre el tiempo estimado)."
          calculation="Calculado a partir de las rutas finalizadas guardadas en localStorage, comparando si el tiempo real excede el estimado en más del 10%."
        />

        {/* KPI 2: Tiempo Estimado vs Real */}
        <KpiCard
          icon="⏱️"
          bgColor="#e3f2fd"
          iconColor="#2196F3"
          title="Tiempo: Estimado vs Real"
          value={Math.round(kpis.tiempoPromedioReal)}
          unit="min"
          barChart={{
            estimado: Math.round(kpis.tiempoPromedioEstimado),
            real: Math.round(kpis.tiempoPromedioReal),
            label: 'Tiempo Promedio'
          }}
          comparison={[
            { label: 'Tiempo Estimado', value: `${Math.round(kpis.tiempoPromedioEstimado)} min` },
            { label: 'Tiempo Real', value: `${Math.round(kpis.tiempoPromedioReal)} min` },
            { 
              label: 'Desviación', 
              value: `${kpis.desviacionTiempo > 0 ? '+' : ''}${kpis.desviacionTiempo.toFixed(1)}%`
            }
          ]}
          badge={{
            type: Math.abs(kpis.desviacionTiempo) <= 10 ? 'success' : 
                  Math.abs(kpis.desviacionTiempo) <= 20 ? 'warning' : 'danger',
            text: Math.abs(kpis.desviacionTiempo) <= 10 ? '🎯 Alta Precisión' : 
                  Math.abs(kpis.desviacionTiempo) <= 20 ? '⚠️ Precisión Aceptable' : '❌ Requiere Ajuste'
          }}
          description="Compara el tiempo predicho por el modelo de Machine Learning contra el tiempo real medido durante la entrega."
          calculation="Promedio calculado de todas las rutas guardadas en localStorage. El tiempo estimado viene del modelo ML y el real se mide con el timer durante la ruta."
        />

        {/* KPI 3: Distancia Estimada vs Real */}
        <KpiCard
          icon="🛣️"
          bgColor="#fff3e0"
          iconColor="#ff9800"
          title="Distancia: Estimada vs Real"
          value={kpis.distanciaPromedioReal.toFixed(1)}
          unit="km"
          barChart={{
            estimado: parseFloat(kpis.distanciaPromedioEstimada.toFixed(1)),
            real: parseFloat(kpis.distanciaPromedioReal.toFixed(1)),
            label: 'Distancia Promedio'
          }}
          comparison={[
            { label: 'Distancia Estimada', value: `${kpis.distanciaPromedioEstimada.toFixed(1)} km` },
            { label: 'Distancia Real', value: `${kpis.distanciaPromedioReal.toFixed(1)} km` },
            { 
              label: 'Desviación', 
              value: `${kpis.desviacionDistancia > 0 ? '+' : ''}${kpis.desviacionDistancia.toFixed(1)}%`
            }
          ]}
          badge={{
            type: Math.abs(kpis.desviacionDistancia) <= 5 ? 'success' : 
                  Math.abs(kpis.desviacionDistancia) <= 10 ? 'warning' : 'danger',
            text: Math.abs(kpis.desviacionDistancia) <= 5 ? '🎯 Muy Preciso' : 
                  Math.abs(kpis.desviacionDistancia) <= 10 ? '⚠️ Aceptable' : '❌ Revisar Rutas'
          }}
          description="Compara la distancia calculada por el algoritmo de rutas (OSM) contra la distancia real recorrida por el vehículo."
          calculation="Promedio de todas las rutas completadas. La distancia estimada viene del cálculo GPS y la real puede ser ajustada manualmente al finalizar la ruta."
        />

        {/* KPI 4: Eficiencia de Entregas */}
        <KpiCard
          icon="📦"
          bgColor="#f3e5f5"
          iconColor="#9c27b0"
          title="Eficiencia de Entregas"
          chartData={{ 
            value: Math.round(kpis.eficienciaPct),
            color: kpis.eficienciaPct >= 95 ? '#28a745' : kpis.eficienciaPct >= 85 ? '#ffc107' : '#dc3545'
          }}
          comparison={[
            { label: 'Entregas Planificadas', value: kpis.totalEntregasPlanificadas },
            { label: 'Entregas Completadas', value: kpis.totalEntregasCompletadas },
            { 
              label: 'Tasa de Éxito', 
              value: `${kpis.eficienciaPct.toFixed(1)}%`
            }
          ]}
          badge={{
            type: kpis.eficienciaPct >= 95 ? 'success' : 
                  kpis.eficienciaPct >= 85 ? 'warning' : 'danger',
            text: kpis.eficienciaPct >= 95 ? '🏆 Óptimo' : 
                  kpis.eficienciaPct >= 85 ? '✅ Bueno' : '⚠️ Mejorable'
          }}
          description="Porcentaje de entregas completadas vs entregas planificadas. Mide qué tan bien se ejecutan las rutas asignadas."
          calculation="Calculado sumando todas las entregas planificadas y completadas de las rutas guardadas en localStorage."
        />

      </div>
    </div>
  );
};

export default LogisticsDashboard;