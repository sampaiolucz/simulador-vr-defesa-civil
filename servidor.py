"""Servidor local do simulador (sem cache: o navegador sempre recebe a versão atual dos arquivos).

Uso:  python servidor.py [porta]      (padrão: 8080)
"""
import http.server
import os
import sys


class SemCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Simulador em http://localhost:{porta}  (Ctrl+C para parar)")
    http.server.ThreadingHTTPServer(("", porta), SemCache).serve_forever()
