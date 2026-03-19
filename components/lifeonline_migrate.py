#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

ROOT = Path('/home/xionglei/LifeOnline')
COMP = ROOT / 'components'
LOG_DIR = Path.home() / '.openclaw' / 'logs' / 'lifeonline'

TOOL_VERSION = '1.1.0'
SCHEMA_VERSION = '1.1.0'
SUPPORTED_SCHEMA_MAJOR = 1

FILES = [
    COMP / 'lifeonline_worker.py',
    COMP / 'task_router.py',
    COMP / 'auto_sources.json',
    COMP / 'skill_map.json',
    ROOT / 'README_MIGRATION.md',
]


def parse_major(v: str) -> int:
    try:
        return int(str(v).split('.')[0])
    except Exception:
        return 0


def export_bundle(out_path: Path, with_logs: bool) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        base = Path(td) / 'lifeonline_export'
        (base / 'components').mkdir(parents=True, exist_ok=True)

        for f in FILES:
            if f.exists():
                rel = f.relative_to(ROOT)
                dst = base / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dst)

        crontab_txt = ''
        cp = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if cp.returncode == 0:
            crontab_txt = cp.stdout
        (base / 'crontab_lifeonline.txt').write_text(crontab_txt, encoding='utf-8')

        if with_logs and LOG_DIR.exists():
            shutil.copytree(LOG_DIR, base / 'logs_lifeonline', dirs_exist_ok=True)

        manifest = {
            'createdAt': dt.datetime.now().isoformat(timespec='seconds'),
            'root': str(ROOT),
            'toolVersion': TOOL_VERSION,
            'schemaVersion': SCHEMA_VERSION,
            'compat': {'minImporterMajor': SUPPORTED_SCHEMA_MAJOR, 'maxImporterMajor': SUPPORTED_SCHEMA_MAJOR},
            'files': [str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()],
        }
        (base / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

        with tarfile.open(out_path, 'w:gz') as tar:
            tar.add(base, arcname='lifeonline_export')
    return out_path


def check_manifest_compat(base: Path) -> None:
    mf = base / 'manifest.json'
    if not mf.exists():
        raise RuntimeError('invalid bundle: manifest.json missing')
    data = json.loads(mf.read_text(encoding='utf-8'))
    schema = data.get('schemaVersion', '1.0.0')
    major = parse_major(schema)

    if major == 0:
        raise RuntimeError(f'invalid schemaVersion: {schema}')
    if major != SUPPORTED_SCHEMA_MAJOR:
        raise RuntimeError(
            f'incompatible schemaVersion={schema}; importer supports major {SUPPORTED_SCHEMA_MAJOR}. '
            f'请先使用对应版本迁移工具升级导出包。'
        )


def import_bundle(archive: Path, apply_crontab: bool) -> None:
    with tempfile.TemporaryDirectory() as td:
        with tarfile.open(archive, 'r:gz') as tar:
            tar.extractall(td)
        base = Path(td) / 'lifeonline_export'
        if not base.exists():
            raise RuntimeError('invalid bundle: missing lifeonline_export root')

        check_manifest_compat(base)

        for src in (base / 'components').glob('*'):
            dst = COMP / src.name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

        readme = base / 'README_MIGRATION.md'
        if readme.exists():
            shutil.copy2(readme, ROOT / 'README_MIGRATION.md')

        if apply_crontab:
            cfile = base / 'crontab_lifeonline.txt'
            if cfile.exists() and cfile.read_text(encoding='utf-8').strip():
                subprocess.run(['crontab', str(cfile)], check=False)

        logs_src = base / 'logs_lifeonline'
        if logs_src.exists():
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copytree(logs_src, LOG_DIR, dirs_exist_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(description='LifeOnline migration tool')
    sub = ap.add_subparsers(dest='cmd', required=True)

    p_exp = sub.add_parser('export')
    p_exp.add_argument('--out', default=str(ROOT / 'backups' / f"lifeonline_export_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.tar.gz"))
    p_exp.add_argument('--with-logs', action='store_true')

    p_imp = sub.add_parser('import')
    p_imp.add_argument('--archive', required=True)
    p_imp.add_argument('--no-crontab', action='store_true')

    args = ap.parse_args()
    if args.cmd == 'export':
        out = export_bundle(Path(args.out), args.with_logs)
        print(json.dumps({'status': 'ok', 'archive': str(out), 'schemaVersion': SCHEMA_VERSION, 'toolVersion': TOOL_VERSION}, ensure_ascii=False))
        return 0
    if args.cmd == 'import':
        import_bundle(Path(args.archive), apply_crontab=not args.no_crontab)
        print(json.dumps({'status': 'ok', 'imported': str(args.archive), 'supportedSchemaMajor': SUPPORTED_SCHEMA_MAJOR}, ensure_ascii=False))
        return 0
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
