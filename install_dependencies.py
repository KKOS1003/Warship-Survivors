#!/usr/bin/env python3
# coding: utf-8
"""Install exactly pinned Three.js and Open Water into vendor/. Can be run again.
Usage: python install_dependencies.py
Offline: python install_dependencies.py --three-tgz ~/Downloads/three-0.169.0.tgz --ocean-zip ~/Downloads/open-water-main.zip
Needs network for the first installation, but DOES NOT contact jsDelivr.
"""
import argparse, io, os, pathlib, shutil, tarfile, urllib.request, zipfile
ROOT=pathlib.Path(__file__).resolve().parent
UA={'User-Agent':'BattleshipSurvivorV22/1.0'}

def download(urls,manual,description):
 if manual:
  print('Using supplied',description,manual)
  return pathlib.Path(manual).expanduser().read_bytes()
 for url in urls:
  try:
   print('Downloading',description,'from',url)
   req=urllib.request.Request(url,headers=UA)
   with urllib.request.urlopen(req,timeout=35) as resp:return resp.read()
  except Exception as e:print('  Failed:',str(e)[:190])
 raise RuntimeError(description+' could not be downloaded. Obtain the official archives from npm/GitHub and use --three-tgz / --ocean-zip.')

def install_three(raw):
 folder=ROOT/'vendor/three'
 folder.mkdir(parents=True,exist_ok=True)
 n=0
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as tar:
  for member in tar:
   if not member.isfile() or not member.name.startswith('package/'):continue
   rel=member.name[len('package/'):]
   if not (rel.startswith('build/') or rel.startswith('examples/jsm/')):continue
   if '..' in pathlib.PurePosixPath(rel).parts:raise RuntimeError('Unsafe npm archive path')
   path=folder/rel;path.parent.mkdir(parents=True,exist_ok=True)
   with tar.extractfile(member) as src,path.open('wb') as dest:shutil.copyfileobj(src,dest)
   n+=1
 if not (folder/'build/three.module.js').exists() or not (folder/'examples/jsm/loaders/GLTFLoader.js').exists():
  raise RuntimeError('Three.js npm archive is incomplete')
 print('Installed Three.js 0.169.0:',n,'files')

def install_openwater(raw):
 folder=ROOT/'vendor/open-water/src'
 folder.mkdir(parents=True,exist_ok=True)
 n=0
 with zipfile.ZipFile(io.BytesIO(raw)) as archive:
  for name in archive.namelist():
   components=pathlib.PurePosixPath(name).parts
   if len(components)<3 or components[1]!='src' or name.endswith('/'):continue
   rel=pathlib.PurePosixPath(*components[2:]);
   if '..' in rel.parts:raise RuntimeError('Unsafe GitHub archive path')
   dest=folder.joinpath(*rel.parts);dest.parent.mkdir(parents=True,exist_ok=True)
   dest.write_bytes(archive.read(name));n+=1
 if not (folder/'main.js').exists() or not (folder/'ocean/ocean.js').exists():
  raise RuntimeError('Open Water ZIP is incomplete')
 print('Installed Open Water source:',n,'files')

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--three-tgz',help='Downloaded npm three-0.169.0.tgz, for offline installation')
 parser.add_argument('--ocean-zip',help='Downloaded GitHub open-water-main.zip, for offline installation')
 args=parser.parse_args()
 three=ROOT/'vendor/three/build/three.module.js';ocean=ROOT/'vendor/open-water/src/main.js'
 if args.three_tgz or not three.exists():
  data=download(['https://registry.npmjs.org/three/-/three-0.169.0.tgz','https://registry.npmmirror.com/three/-/three-0.169.0.tgz'],args.three_tgz,'Three.js 0.169.0 npm tarball')
  install_three(data)
 else:print('Three.js already available')
 if args.ocean_zip or not ocean.exists():
  data=download(['https://codeload.github.com/Leonxlnx/open-water/zip/refs/heads/main','https://github.com/Leonxlnx/open-water/archive/refs/heads/main.zip'],args.ocean_zip,'Open Water source ZIP')
  install_openwater(data)
 else:print('Open Water already available')
 print('Ready! Start: python -m http.server 8000')
 print('Open: http://localhost:8000/index-local.html')
if __name__=='__main__':main()
