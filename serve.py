#!/usr/bin/env python3
"""Serve the game on the hosting machine.  --install fetches dependencies ONCE before serving.
Never run downloads on individual HTTP requests.  Run from a trusted server.
"""
import argparse,os,pathlib,subprocess,sys
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
ROOT=pathlib.Path(__file__).resolve().parent

class ModuleSafeHandler(SimpleHTTPRequestHandler):
    """Correct ESM MIME and prevent Windows registry text/plain mappings."""
    def guess_type(self, path):
        lower=path.lower().split('?',1)[0]
        if lower.endswith(('.js','.mjs')):return 'text/javascript'
        if lower.endswith('.wasm'):return 'application/wasm'
        if lower.endswith('.json'):return 'application/json'
        if lower.endswith('.glb'):return 'model/gltf-binary'
        return super().guess_type(path)


def main():
 a=argparse.ArgumentParser()
 a.add_argument('--host',default='127.0.0.1',help='use 0.0.0.0 for LAN hosting')
 a.add_argument('--port',type=int,default=8000)
 a.add_argument('--install',action='store_true',help='server-side one-time dependency installation')
 args=a.parse_args()
 os.chdir(ROOT)
 if args.install:subprocess.run([sys.executable,str(ROOT/'install_dependencies.py')],check=True)
 server=ThreadingHTTPServer((args.host,args.port),ModuleSafeHandler)
 print(f'Game launcher: http://{args.host}:{args.port}/')
 print('Server-side vendor must be prepared in advance; client requests never run installers.')
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
if __name__=='__main__':main()
