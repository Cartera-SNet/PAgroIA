/* ==========================================================
   AgroIA - Modelo de Machine Learning (árbol de decisión)
   Generado por entrenar_modelo.py. NO editar a mano.
   Fuente de datos: Kaggle · Plant-Health-Data (ziya07)
   https://www.kaggle.com/datasets/ziya07/plant-health-data  (licencia CC0)
   Variables de entrada: temperatura del aire, humedad del aire, humedad del suelo.
   Efectividad: 87.25 % (validación cruzada de 5 partes, 1200 filas); 84.58 % en la prueba 80/20.
   ========================================================== */
const MODELO_ML = {"fuente": "Kaggle - Plant-Health-Data (ziya07)", "variables": ["temperatura", "humedad_aire", "humedad_suelo"], "clases": ["Healthy", "High Stress", "Moderate Stress"], "arbol": {"f": "humedad_suelo", "u": 19.9976, "izq": {"clase": "High Stress", "prob": {"Healthy": 0.0, "High Stress": 1.0, "Moderate Stress": 0.0}}, "der": {"f": "humedad_suelo", "u": 30.0098, "izq": {"clase": "Moderate Stress", "prob": {"Healthy": 0.0, "High Stress": 0.1209, "Moderate Stress": 0.8791}}, "der": {"clase": "Healthy", "prob": {"Healthy": 0.7438, "High Stress": 0.1269, "Moderate Stress": 0.1294}}}}};

/* Recorre el árbol y devuelve { clase, prob } con las probabilidades de cada clase en la hoja. */
function mlPredecir(v) {
  let n = MODELO_ML.arbol;
  while (!n.clase) n = (v[n.f] <= n.u) ? n.izq : n.der;
  return { clase: n.clase, prob: n.prob };
}
