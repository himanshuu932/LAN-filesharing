from http.server import SimpleHTTPRequestHandler, HTTPServer
import os
import json
import urllib.parse
import string
import ctypes
import socket
import mimetypes

PORT = 8000
BASE_DIR = os.path.dirname(__file__)

def list_drives():
    """List all logical drives on a Windows system."""
    drives = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drives.append(f"{letter}:\\")
        bitmask >>= 1
    return drives

def is_hidden_or_system(path):
    """Check if a file is hidden or system on Windows."""
    try:
        attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
        if attrs == -1:
            return False
        return bool(attrs & 2 or attrs & 4)
    except Exception:
        return False

class FileBrowser(SimpleHTTPRequestHandler):
    """Custom HTTP handler for file browsing, upload, download, and preview."""

    # ---------- Security Helpers ----------
    def _is_safe_path(self, path, check_exists=True):
        """Prevent path traversal attacks."""
        try:
            abs_path = os.path.abspath(path)
        except Exception:
            return False

        valid_drives = [os.path.abspath(d) for d in list_drives()]
        if not any(abs_path.startswith(drive) for drive in valid_drives):
            return False

        if check_exists and not os.path.exists(abs_path):
            return False

        return True

    # ---------- CORS ----------
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        return super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "OK")
        self.end_headers()

    # ---------- GET ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        # --- Get Local IP ---
        if parsed.path == '/ip':
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
            except Exception:
                local_ip = "127.0.0.1"
            finally:
                s.close()
            self._json_response({"ip": local_ip})
            return

        # --- List Drives ---
        if parsed.path == '/drives':
            drives = list_drives()
            self._json_response(drives)
            return

        # --- List Files in Directory ---
        if parsed.path == '/files':
            path = os.path.normpath(params.get('path', [''])[0])
            if not self._is_safe_path(path, check_exists=True) or not os.path.isdir(path):
                self.send_error(404, "Path not found or is not a directory")
                return

            try:
                dirs, files = [], []
                for name in os.listdir(path):
                    full_path = os.path.join(path, name)
                    if is_hidden_or_system(full_path):
                        continue
                    try:
                        is_dir = os.path.isdir(full_path)
                        size = os.path.getsize(full_path) if not is_dir else 0
                        item = {"name": name, "is_dir": is_dir, "size": size}
                        (dirs if is_dir else files).append(item)
                    except (FileNotFoundError, PermissionError):
                        continue

                dirs.sort(key=lambda x: x["name"].lower())
                files.sort(key=lambda x: x["name"].lower())
                self._json_response(dirs + files)
            except PermissionError:
                self.send_error(403, "Access denied")
            except Exception as e:
                print(f"Error listing files: {e}")
                self.send_error(500, "Internal server error")
            return

        # --- File Preview (View) ---
        if parsed.path == '/view':
            file_path = os.path.normpath(params.get('path', [''])[0])
            if not self._is_safe_path(file_path, check_exists=True) or not os.path.isfile(file_path):
                self.send_error(404, "File not found")
                return

            try:
                mime_type, _ = mimetypes.guess_type(file_path.replace("\\", "/"))
                if not mime_type:
                    mime_type = "application/octet-stream"

                file_size = os.path.getsize(file_path)
                range_header = self.headers.get("Range")

                with open(file_path, "rb") as f:
                    if range_header:
                        # Handle partial content (e.g. for video/pdf)
                        byte_range = range_header.replace("bytes=", "").split("-")
                        start = int(byte_range[0])
                        end = int(byte_range[1]) if byte_range[1] else file_size - 1
                        f.seek(start)
                        chunk = f.read(end - start + 1)

                        self.send_response(206)
                        self.send_header("Content-Type", mime_type)
                        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                        self.send_header("Content-Length", len(chunk))
                        self.end_headers()
                        self.wfile.write(chunk)
                    else:
                        # Send entire file
                        self.send_response(200)
                        self.send_header("Content-Type", mime_type)
                        self.send_header("Content-Length", str(file_size))
                        self.end_headers()
                        self.wfile.write(f.read())

            except Exception as e:
                print(f"⚠️ Error in /view: {e}")
                try:
                    self.send_error(500, "Error reading file")
                except:
                    pass
            return

        # --- File Download ---
        if parsed.path == '/download':
            file_path = os.path.normpath(params.get('path', [''])[0])
            if not self._is_safe_path(file_path, check_exists=True) or not os.path.isfile(file_path):
                self.send_error(404, "File not found")
                return

            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(file_path)}"')
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            except Exception as e:
                print(f"Error downloading file: {e}")
                self.send_error(500, "Could not read file")
            return

        # Default static file serving
        super().do_GET()

    # ---------- POST ----------
    def do_POST(self):
        if self.path != '/upload':
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_error(400, "Bad request: Not multipart/form-data")
                return

            boundary = content_type.split('boundary=')[-1].encode()
            data = self.rfile.read(content_length)

            parts = data.split(b'--' + boundary)
            filename, filedata, folderpath = None, None, ''

            for part in parts:
                if b'filename="' in part:
                    try:
                        headers, filedata = part.split(b'\r\n\r\n', 1)
                        filedata = filedata.rstrip(b'\r\n--')
                        filename_line = [line for line in headers.split(b'\r\n') if b'filename=' in line][0]
                        filename = filename_line.split(b'filename=')[1].split(b'"')[1].decode('utf-8', errors='ignore')
                    except Exception:
                        continue
                elif b'name="path"' in part:
                    try:
                        body = part.split(b'\r\n\r\n', 1)[1].rstrip(b'\r\n--')
                        folderpath = body.decode('utf-8').strip()
                    except Exception:
                        continue

            if filename and filedata is not None and folderpath:
                target_folder = os.path.normpath(folderpath)
                if not self._is_safe_path(target_folder, check_exists=True) or not os.path.isdir(target_folder):
                    self.send_error(403, "Access denied: Invalid upload path")
                    return

                filename = os.path.basename(filename)
                target_path = os.path.join(target_folder, filename)
                if not self._is_safe_path(target_path, check_exists=False):
                    self.send_error(403, "Access denied: Invalid target path")
                    return

                with open(target_path, 'wb') as f:
                    f.write(filedata)

                self._text_response("File uploaded successfully")
            else:
                self.send_error(400, "Bad upload request (missing file or path)")

        except Exception as e:
            print(f"Error during upload: {e}")
            self.send_error(500, f"Error during upload: {e}")

    # ---------- Response Helpers ----------
    def _json_response(self, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text_response(self, text, code=200):
        body = text.encode('utf-8')
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

# ---------- Main ----------
if __name__ == "__main__":
    os.chdir(BASE_DIR)
    print(f"✅ File Browser running at http://0.0.0.0:{PORT}")
    print("Serving files from:", BASE_DIR)
    httpd = HTTPServer(("0.0.0.0", PORT), FileBrowser)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()
