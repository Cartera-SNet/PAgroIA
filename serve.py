"""
Servidor mínimo para publicar la página de AgroIA en Railway.
Solo entrega los archivos HTML/CSS/JS tal cual (no es un backend).
La API sigue siendo la del backend (FastAPI en Render).
"""
import os
import http.server
import socketserver

PORT = int(os.environ.get("PORT", 8000))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")   # que se vean los cambios al publicar
        super().end_headers()


with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"AgroIA Web sirviendo en el puerto {PORT}")
    httpd.serve_forever()
