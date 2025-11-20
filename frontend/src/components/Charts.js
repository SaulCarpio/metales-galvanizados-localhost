import React from 'react';

// SummaryCards: muestra métricas claras (total + estados) y una barra segmentada horizontal
export const SummaryCards = ({ title, rows = [] }) => {
  const total = rows.length;
  const byEstado = rows.reduce((acc, r) => { acc[r.estado] = (acc[r.estado] || 0) + 1; return acc; }, {});
  const colors = { emitida: '#0077aa', pendiente: '#ffc107', completada: '#28a745', cancelada: '#dc3545' };
  const segments = Object.entries(byEstado).map(([k,v])=>({ key:k, value:v, color: colors[k] || '#6f42c1' }));
  return (
    <div style={{display:'flex',gap:12,alignItems:'center'}}>
      <div style={{minWidth:160,padding:12,border:'1px solid #eee',borderRadius:6,background:'#fff'}}>
        <div style={{fontSize:12,color:'#666'}}>{title}</div>
        <div style={{fontSize:22,fontWeight:700}}>{total}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{height:36,display:'flex',alignItems:'center'}}>
          <div style={{flex:1, height:12, display:'flex', borderRadius:6, overflow:'hidden', background:'#f3f3f3'}}>
            {segments.map(s=> (
              <div key={s.key} style={{flex:s.value, background:s.color}} title={`${s.key}: ${s.value}`} />
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
          {segments.map(s=> (
            <div key={s.key} style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
              <span style={{width:12,height:12,background:s.color,display:'inline-block',borderRadius:3}} />
              <strong style={{minWidth:80}}>{s.key}</strong>
              <span style={{color:'#333'}}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// InventoryList: muestra productos con barras de stock (más legible que gráfico complejo)
export const InventoryList = ({ rows = [] }) => {
  // rows expect objects with producto / cantidad / minimo or stock
  const items = rows.map(r => ({
    label: r.producto || r.producto_id || 'SinProducto',
    value: Number(r.cantidad || r.stock || 0),
    min: Number(r.minimo || 0)
  }));
  // Ordenar por menor stock
  items.sort((a,b)=>a.value - b.value);
  return (
    <div>
      <h4 style={{marginTop:0}}>Control de Existencias (ordenado por stock)</h4>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {items.slice(0,8).map(it=> (
          <div key={it.label} style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:160,fontSize:13}}>{it.label}</div>
            <div style={{flex:1,height:12,background:'#eee',borderRadius:6,overflow:'hidden'}}>
              <div style={{width:`${Math.min(100, (it.value/(it.min||1))*100)}%`,height:'100%',background: it.value <= it.min ? '#dc3545' : '#28a745'}} />
            </div>
            <div style={{width:80,textAlign:'right',fontSize:13}}>{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
