import http.server
import socketserver
import os

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # quieter

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"=" * 50)
    print(f"  DarkBeat server running!")
    print(f"  Open on this PC:  http://localhost:{PORT}")
    print(f"  Open on phone:    http://<your-pc-ip>:{PORT}")
    print(f"=" * 50)
    print(f"  Press Ctrl+C to stop")
    print(f"=" * 50)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
