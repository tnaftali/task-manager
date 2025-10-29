#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
from urllib.parse import urlparse, parse_qs

PORT = 8765
TASKS_FILE = 'tasks.json'

class TaskManagerHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/save-tasks':
            # Get content length
            content_length = int(self.headers['Content-Length'])
            # Read the posted data
            post_data = self.rfile.read(content_length)

            try:
                # Parse JSON data
                tasks = json.loads(post_data.decode('utf-8'))

                # Save to file
                with open(TASKS_FILE, 'w') as f:
                    json.dump(tasks, f, indent=2)

                # Send success response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())

                print(f'Tasks saved successfully ({len(tasks)} tasks)')

            except Exception as e:
                print(f'Error saving tasks: {e}')
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    # Ensure tasks.json exists
    if not os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, 'w') as f:
            json.dump([], f)

    with socketserver.TCPServer(("", PORT), TaskManagerHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Tasks will be saved to {TASKS_FILE}")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
