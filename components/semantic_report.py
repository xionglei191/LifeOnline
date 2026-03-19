#!/usr/bin/env python3
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
from pathlib import Path
from typing import Dict, List

LOG_PATH = Path.home() / '.openclaw' / 'logs' / 'lifeonline' / 'semantic_gate.log'


def parse_ts(s: str) -> dt.datetime | None:
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S'):
        try:
            return dt.datetime.strptime(s, fmt)
        except Exception:
            pass
    return None


def in_range(t: dt.datetime, start: dt.datetime | None, end: dt.datetime | None) -> bool:
    if start and t < start:
        return False
    if end and t > end:
        return False
    return True


def load_rows(path: Path, start: dt.datetime | None, end: dt.datetime | None) -> List[Dict]:
    rows: List[Dict] = []
    if not path.exists():
        return rows
    for ln in path.read_text(encoding='utf-8').splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            j = json.loads(ln)
        except Exception:
            continue
        t = parse_ts(str(j.get('ts', '')))
        if not t:
            continue
        if in_range(t, start, end):
            rows.append(j)
    return rows


def avg(xs: List[float]) -> float:
    return (sum(xs) / len(xs)) if xs else 0.0


def bucketize(conf: float, step: float = 0.1) -> str:
    lo = max(0.0, min(1.0, (int(conf / step) * step)))
    hi = min(1.0, lo + step)
    return f'{lo:.1f}-{hi:.1f}'


def suggest_threshold(rows: List[Dict]) -> Dict:
    # 仅在存在 is_actionable 字段时提供精确影响评估
    has_actionable = any('is_actionable' in r for r in rows)
    current_default = 0.70
    candidates = [round(x, 2) for x in [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85]]

    def predict(r: Dict, th: float) -> str:
        ia = bool(r.get('is_actionable', r.get('decision') == 'pass'))
        c = float(r.get('confidence', 0.0))
        return 'pass' if (ia and c >= th) else 'reject'

    baseline = [predict(r, current_default) for r in rows]
    impacts = []
    for th in candidates:
        pred = [predict(r, th) for r in rows]
        flips = sum(1 for a, b in zip(baseline, pred) if a != b)
        pass_n = sum(1 for x in pred if x == 'pass')
        reject_n = len(pred) - pass_n
        impacts.append({'threshold': th, 'flipCountVs0.70': flips, 'pass': pass_n, 'reject': reject_n})

    # 经验建议区间：max(pass_conf_p25, reject_conf_p75)
    pass_conf = sorted(float(r.get('confidence', 0.0)) for r in rows if r.get('decision') == 'pass')
    rej_conf = sorted(float(r.get('confidence', 0.0)) for r in rows if r.get('decision') == 'reject')

    def pct(arr: List[float], p: float) -> float:
        if not arr:
            return 0.0
        idx = int((len(arr)-1) * p)
        return arr[idx]

    lower = pct(rej_conf, 0.75)
    upper = pct(pass_conf, 0.25)
    if lower > upper:
        lower, upper = upper, lower

    return {
        'hasIsActionable': has_actionable,
        'recommendedRange': {'min': round(lower, 2), 'max': round(upper, 2)},
        'impactSimulation': impacts,
        'note': 'impactSimulation 基于 is_actionable + confidence 重新判定；推荐区间采用拒绝样本75分位与通过样本25分位的交叠近似。'
    }


def build_report(rows: List[Dict]) -> Dict:
    total = len(rows)
    pass_rows = [r for r in rows if r.get('decision') == 'pass']
    reject_rows = [r for r in rows if r.get('decision') == 'reject']

    pass_n = len(pass_rows)
    reject_n = len(reject_rows)

    conf_pass = [float(r.get('confidence', 0.0)) for r in pass_rows]
    conf_rej = [float(r.get('confidence', 0.0)) for r in reject_rows]

    dist = collections.Counter(bucketize(float(r.get('confidence', 0.0))) for r in rows)
    dist_sorted = dict(sorted(dist.items(), key=lambda kv: kv[0]))

    reasons = collections.Counter(str(r.get('reason', '')).strip() or 'unknown' for r in reject_rows)
    top5 = [{'reason': k, 'count': v} for k, v in reasons.most_common(5)]

    return {
        'summary': {
            'total': total,
            'pass': pass_n,
            'reject': reject_n,
            'passRate': round((pass_n / total) if total else 0.0, 4),
            'rejectRate': round((reject_n / total) if total else 0.0, 4),
        },
        'confidence': {
            'passAvg': round(avg(conf_pass), 4),
            'rejectAvg': round(avg(conf_rej), 4),
            'distribution': dist_sorted,
        },
        'rejectReasonsTop5': top5,
        'thresholdAdvice': suggest_threshold(rows),
    }


def parse_date(s: str, end_of_day: bool = False) -> dt.datetime:
    d = dt.datetime.strptime(s, '%Y-%m-%d')
    if end_of_day:
        return d.replace(hour=23, minute=59, second=59)
    return d


def main() -> int:
    ap = argparse.ArgumentParser(description='Semantic gate analysis report')
    ap.add_argument('--log', default=str(LOG_PATH))
    ap.add_argument('--days', type=int, default=0, help='最近N天')
    ap.add_argument('--from-date', default='', help='起始日期 YYYY-MM-DD')
    ap.add_argument('--to-date', default='', help='结束日期 YYYY-MM-DD')
    ap.add_argument('--pretty', action='store_true')
    args = ap.parse_args()

    end = None
    start = None
    now = dt.datetime.now()

    if args.days and args.days > 0:
        start = now - dt.timedelta(days=args.days)
        end = now

    if args.from_date:
        start = parse_date(args.from_date)
    if args.to_date:
        end = parse_date(args.to_date, end_of_day=True)

    rows = load_rows(Path(args.log), start, end)
    report = {
        'timeRange': {
            'from': start.isoformat(sep=' ', timespec='seconds') if start else None,
            'to': end.isoformat(sep=' ', timespec='seconds') if end else None,
        },
        'logPath': str(Path(args.log)),
        'report': build_report(rows),
    }
    if args.pretty:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
