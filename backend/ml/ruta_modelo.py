"""
ruta_modelo.py

- Construye / descarga la red vial (zona El Alto).
- Aplica restricciones (cerrado parcial) alrededor de una lista de ferias.
- Genera dataset O-D simulado (normal vs. feria).
- Entrena RandomForest y guarda el modelo (joblib).
- Exporta opcionalmente geojson con puntos de ferias.
"""

import os
import joblib
import numpy as np
import pandas as pd
import geopandas as gpd
import networkx as nx
import osmnx as ox
from shapely.geometry import Point

# --------------------------
# CONFIG
# --------------------------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "")
MODEL_PATH = os.path.join(MODEL_DIR, "model_rf.pkl")
G_CACHE_PATH = os.path.join(MODEL_DIR, "graph_gpkg.gpkg")  # opcional cache

# Lista de 14 ferias (usar tus coordenadas georreferenciadas reales si las tienes)
# Formato: (lat, lon)
FERIA_POINTS = [
    (-16.4950, -68.1650),  # 1
    (-16.5200, -68.1800),  # 2
    (-16.5320, -68.1950),  # 3
    (-16.5100, -68.2050),  # 4
    (-16.4980, -68.1900),  # 5
    (-16.5030, -68.1750),  # 6
    (-16.4800, -68.2300),  # 7
    (-16.5800, -68.2100),  # 8
    (-16.4850, -68.2600),  # 9
    (-16.6450, -68.1400),  # 10
    (-16.5350, -68.2400),  # 11
    (-16.5450, -68.2000),  # 12
    (-16.4600, -68.2000),  # 13
    (-16.5050, -68.2000),  # 14
]

# --------------------------
# UTILIDADES (grafos y tiempos)
# --------------------------

def load_graph_z16(use_cache=True):
    """Descarga o carga (si existe) la red vial para El Alto (drive)."""
    if use_cache and os.path.exists(G_CACHE_PATH):
        try:
            G = ox.load_graphml(G_CACHE_PATH.replace(".gpkg", ".graphml"))
            print("Graph loaded from cache.")
            return G
        except Exception:
            pass

    place_name = "El Alto, La Paz, Bolivia"
    print("Downloading graph for:", place_name)
    G = ox.graph_from_place(place_name, network_type="drive", simplify=True)
    G = ox.utils_graph.get_largest_component(G, strongly=False)
    # opcional: guardar cache en GraphML
    try:
        ox.save_graphml(G, G_CACHE_PATH.replace(".gpkg", ".graphml"))
    except Exception:
        pass
    return G

def ensure_edge_speeds(G, fallback_kph=30.0):
    """Asegura speed_kph y travel_time en cada arista."""
    for u, v, k, data in G.edges(keys=True, data=True):
        length_m = data.get("length", None)
        if length_m is None:
            # longitud en metros aproximada
            if "geometry" in data:
                length_m = data["geometry"].length
            else:
                length_m = 20.0
            data["length"] = float(length_m)

        speed = data.get("speed_kph", None)
        if speed is None:
            maxspeed = data.get("maxspeed", None)
            if isinstance(maxspeed, list) and len(maxspeed) > 0:
                try:
                    speed = float(str(maxspeed[0]).split()[0])
                except:
                    speed = fallback_kph
            elif isinstance(maxspeed, (int, float)):
                speed = float(maxspeed)
            elif isinstance(maxspeed, str):
                import re
                nums = re.findall(r"\d+\.?\d*", maxspeed)
                if nums:
                    speed = float(nums[0])
                else:
                    speed = fallback_kph
            else:
                speed = fallback_kph
        data["speed_kph"] = float(speed)
        speed_mps = data["speed_kph"] * 1000.0 / 3600.0
        data["travel_time"] = data["length"] / max(speed_mps, 1e-3)

def graph_with_ferias_restrictions(G, feria_points, buffer_m=500):
    """
    Crea una copia del grafo y elimina aristas cuyo midpoint cae dentro de
    cualquiera de los buffers alrededor de las ferias (lista de (lat,lon)).
    Devuelve grafo modificado.
    """
    # Proyectar
    G_proj = ox.projection.project_graph(G)
    nodes_proj, edges_proj = ox.graph_to_gdfs(G_proj, nodes=True, edges=True)

    # Construir buffer combinado (CRS proyectado)
    pts_proj = []
    for lat, lon in feria_points:
        pt = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326").to_crs(nodes_proj.crs).geometry.values[0]
        pts_proj.append(pt)
    combined = gpd.GeoSeries(pts_proj, crs=nodes_proj.crs).unary_union.buffer(buffer_m)

    edges_proj = edges_proj.copy()
    edges_proj["midpoint"] = edges_proj.geometry.interpolate(0.5, normalized=True)
    to_remove = edges_proj[edges_proj["midpoint"].within(combined)].reset_index()

    G_mod = G_proj.copy()
    for idx, row in to_remove.iterrows():
        u, v, k = row["u"], row["v"], row["key"]
        if G_mod.has_edge(u, v, k):
            try:
                G_mod.remove_edge(u, v, k)
            except Exception:
                pass

    # reproyectar a WGS84 y devolver
    G_mod_wgs = ox.projection.project_graph(G_mod, to_crs="EPSG:4326")
    if G_mod_wgs.number_of_edges() > 0:
        G_mod_wgs = ox.utils_graph.get_largest_component(G_mod_wgs, strongly=False)
    return G_mod_wgs

def shortest_route_stats(G, orig_node, dest_node, weight="length"):
    """Calcula ruta más corta entre nodos; retorna path, dist (m), t (seg)."""
    try:
        path = nx.shortest_path(G, orig_node, dest_node, weight=weight)
        dist = 0.0
        tsec = 0.0
        for i in range(len(path)-1):
            u, v = path[i], path[i+1]
            # elegir la mejor key (menor weight)
            best = None
            bestw = float("inf")
            for k in G[u][v]:
                w = G[u][v][k].get(weight, float("inf"))
                if w < bestw:
                    bestw = w
                    best = G[u][v][k]
            if best:
                dist += best.get("length", 0.0)
                tsec += best.get("travel_time", 0.0)
        return path, float(dist), float(tsec)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None, np.nan, np.nan

def pick_random_nodes(G, center=None, max_nodes=200, radius_m=1200):
    """Elige hasta max_nodes nodos aleatorios dentro de radius_m del centro."""
    nodes_gdf, edges = ox.graph_to_gdfs(G, nodes=True, edges=True)
    
    # proyectar automáticamente a UTM correcto
    nodes_proj = ox.projection.project_gdf(nodes_gdf)
    utm_crs = nodes_proj.crs
    
    if center is None:
        center = nodes_proj.unary_union.centroid
    else:
        center = gpd.GeoSeries([Point(center[1], center[0])], crs="EPSG:4326").to_crs(utm_crs).geometry.values[0]
    
    nodes_proj["dist_center"] = nodes_proj.geometry.distance(center)
    sub = nodes_proj[nodes_proj["dist_center"] <= radius_m]
    if len(sub) < 10:
        sub = nodes_proj
    choices = sub.sample(min(max_nodes, len(sub)), random_state=42).index.tolist()
    return choices

def simulate_dataset(G_normal, G_feria, n_pairs=200, feria_center_latlon=None):
    """Genera pares O-D simulados (dist, tiempo base, time_real) con thursday/no."""
    od_nodes = pick_random_nodes(G_normal, center=feria_center_latlon, max_nodes=300, radius_m=1500)
    rows = []
    attempts = 0
    while len(rows) < n_pairs and attempts < n_pairs*20:
        attempts += 1
        o, d = np.random.choice(od_nodes, 2, replace=False)
        p_norm, dist_norm_m, t_norm_sec = shortest_route_stats(G_normal, o, d, weight="length")
        if p_norm is None or not np.isfinite(dist_norm_m):
            continue
        # decide si es jueves
        is_thursday = np.random.choice([0,1], p=[0.7,0.3])  # más no-jueves
        G_used = G_feria if is_thursday else G_normal
        p_used, dist_used_m, t_used_sec = shortest_route_stats(G_used, o, d, weight="length")
        if p_used is None or not np.isfinite(dist_used_m):
            continue
        feria_factor = 1.0 + (0.2 + 0.4*np.random.rand()) if is_thursday else 1.0 + (0.0 + 0.1*np.random.rand())
        noise = np.random.normal(loc=1.0, scale=0.05)
        time_real_sec = t_used_sec * feria_factor * max(noise, 0.8)
        rows.append({
            "orig": int(o), "dest": int(d),
            "dist_m": float(dist_used_m),
            "base_time_sec": float(t_used_sec),
            "time_real_sec": float(time_real_sec),
            "is_thursday": int(is_thursday)
        })
    df = pd.DataFrame(rows)
    return df

# --------------------------
# ENTRENAMIENTO
# --------------------------

def train_and_save_model(df, model_path=MODEL_PATH):
    from sklearn.ensemble import RandomForestRegressor
    features = ["dist_m", "base_time_sec", "is_thursday"]
    target = "time_real_sec"
    X = df[features]
    y = df[target]
    model = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
    model.fit(X, y)
    joblib.dump(model, model_path)
    print("Modelo guardado en:", model_path)
    return model

# --------------------------
# MAIN: pipeline completo
# --------------------------
def main():
    print("Cargando grafo...")
    G_normal = load_graph_z16()
    ensure_edge_speeds(G_normal, fallback_kph=30.0)

    print("Aplicando restricciones por ferias...")
    # Crea grafo con restricciones por todas las ferias
    G_feria = graph_with_ferias_restrictions(G_normal, FERIA_POINTS, buffer_m=500)
    ensure_edge_speeds(G_feria, fallback_kph=30.0)

    print("Generando dataset simulado...")
    df = simulate_dataset(G_normal, G_feria, n_pairs=300, feria_center_latlon=FERIA_POINTS[0])
    print("Filas generadas:", len(df))

    print("Entrenando modelo RandomForest...")
    model = train_and_save_model(df)

    # exportar ferias a GeoJSON (opcional)
    gdf_ferias = gpd.GeoDataFrame({
        "id": list(range(1, len(FERIA_POINTS)+1)),
        "geometry": [Point(lon, lat) for lat, lon in FERIA_POINTS]
    }, crs="EPSG:4326")
    out_geojson = os.path.join(MODEL_DIR, "ferias.geojson")
    gdf_ferias.to_file(out_geojson, driver="GeoJSON")
    print("Ferias guardadas en:", out_geojson)

if __name__ == "__main__":
    main()
