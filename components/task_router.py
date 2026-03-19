#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple

VAULT = Path('/home/xionglei/Vault_OS')
INBOX = VAULT / '_Inbox'
ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_DIR = ROOT / 'components'
SKILL_MAP = COMPONENTS_DIR / 'skill_map.json'
APPROVAL_PREFIX = 'openclaw_approval_'
SEMANTIC_LOG = Path.home() / '.openclaw' / 'logs' / 'lifeonline' / 'semantic_gate.log'

CN2EN = {
    '健康': 'health', '事业': 'career', '财务': 'finance', '学习': 'learning',
    '关系': 'relationship', '生活': 'life', '兴趣': 'hobby', '成长': 'growth'
}


def now():
    return dt.datetime.now()


def ts_hm():
    return now().strftime('%Y-%m-%dT%H:%M')


def ts_full():
    return now().strftime('%Y-%m-%d %H:%M:%S')


def load_skill_map() -> Dict:
    if SKILL_MAP.exists():
        return json.loads(SKILL_MAP.read_text(encoding='utf-8'))
    return {'skills': []}


def detect_dimension(text: str) -> str:
    for cn, en in CN2EN.items():
        if cn in text:
            return en
    m = re.search(r"\b(health|career|finance|learning|relationship|life|hobby|growth)\b", text, flags=re.I)
    if m:
        return m.group(1).lower()
    return 'growth'


def detect_urls(text: str) -> List[str]:
    return re.findall(r'https?://[^\s)]+', text)


def skills_from_text(text: str, smap: Dict) -> List[Dict]:
    hit = []
    low = text.lower()
    for s in smap.get('skills', []):
        if any(k.lower() in low for k in s.get('keywords', [])):
            hit.append(s)
    return hit


def log_semantic_event(event: Dict) -> None:
    SEMANTIC_LOG.parent.mkdir(parents=True, exist_ok=True)
    with SEMANTIC_LOG.open('a', encoding='utf-8') as f:
        f.write(json.dumps(event, ensure_ascii=False) + '\n')


def run_internal_ai(prompt: str) -> str:
    cp = subprocess.run([
        'openclaw', 'agent', '--session-id', 'task-router-semantic', '--message', prompt, '--json', '--timeout', '90'
    ], capture_output=True, text=True, timeout=120)
    if cp.returncode != 0:
        raise RuntimeError(cp.stderr.strip()[:200])
    data = json.loads(cp.stdout)
    payloads = data.get('result', {}).get('payloads', [])
    text = '\n'.join([p.get('text', '') for p in payloads if isinstance(p, dict)]).strip()
    if not text:
        raise RuntimeError('empty ai output')
    return text


def semantic_gate(text: str, plan: Dict) -> Tuple[bool, float, str]:
    if not plan.get('steps'):
        return False, 0.0, 'no_skills_detected'

    imperative_hints = ['请', '帮我', '帮忙', '执行', '立即', '现在', '请你']
    learning_hints = ['如何', '怎么', '学习', '原理', '介绍', '教程']
    low = text.lower()

    # heuristic fast path
    if any(h in text for h in imperative_hints) and not any(h in text for h in learning_hints):
        base_ok = True
    else:
        base_ok = False

    prompt = (
        '你是任务意图判定器。判断下面文本是否是“要求系统立即执行”的任务指令，而非讨论/学习/描述。\n'
        '只输出一行 JSON: {"is_actionable":true|false,"confidence":0-1,"reason":"..."}\n\n'
        f'用户文本: {text}\n'
        f'候选步骤: {json.dumps(plan.get("steps", []), ensure_ascii=False)}\n'
    )
    try:
        out = run_internal_ai(prompt)
        m = re.search(r'\{[\s\S]*\}', out)
        if not m:
            raise RuntimeError('no_json')
        j = json.loads(m.group(0))
        ok = bool(j.get('is_actionable', False))
        conf = float(j.get('confidence', 0))
        reason = str(j.get('reason', ''))
        return ok, conf, reason
    except Exception:
        return base_ok, (0.72 if base_ok else 0.35), ('heuristic_fallback')


def build_plan(text: str, url_override: str = '') -> Dict:
    smap = load_skill_map()
    hits = skills_from_text(text, smap)
    hit_names = {x['name'] for x in hits}
    dim = detect_dimension(text)
    urls = [url_override] if url_override else detect_urls(text)

    steps = []
    for h in hits:
        name = h['name']
        if name == 'web_scrape':
            if urls:
                for u in urls:
                    steps.append({'skill': 'web_scrape', 'params': {'url': u, 'dimension': dim}, 'risk': h.get('risk', 'medium')})
            else:
                steps.append({'skill': 'web_scrape', 'params': {'url': '', 'dimension': dim}, 'risk': h.get('risk', 'medium')})
        elif name == 'archive_to_dimension':
            steps.append({'skill': 'archive_to_dimension', 'params': {'dimension': dim}, 'risk': h.get('risk', 'medium')})
        elif name == 'create_reminder':
            steps.append({'skill': 'create_reminder', 'params': {'title': text[:80], 'dimension': dim, 'cadence': 'daily'}, 'risk': h.get('risk', 'low')})
        elif name == 'delete_file':
            paths = re.findall(r'(/[^\s]+\.md)', text)
            steps.append({'skill': 'delete_file', 'params': {'paths': paths}, 'risk': h.get('risk', 'critical')})
        elif name == 'modify_sensitive':
            paths = re.findall(r'(/[^\s]+\.md)', text)
            items = [{'path': p, 'mode': 'append_note', 'note': '审批后执行敏感文件修改'} for p in paths]
            steps.append({'skill': 'modify_sensitive', 'params': {'items': items}, 'risk': h.get('risk', 'critical')})

    if 'archive_to_dimension' in hit_names and 'web_scrape' not in hit_names:
        steps.append({'skill': 'archive_to_dimension', 'params': {'dimension': dim}, 'risk': 'medium'})

    max_risk = 'low'
    if any(s['risk'] == 'critical' for s in steps):
        max_risk = 'critical'
    elif any(s['risk'] == 'high' for s in steps):
        max_risk = 'high'
    elif any(s['risk'] == 'medium' for s in steps):
        max_risk = 'medium'

    return {'input': text, 'generatedAt': ts_hm(), 'steps': steps, 'risk': max_risk}


def write_approval_for_plan(plan: Dict, semantic: Dict, threshold: float) -> Path:
    INBOX.mkdir(parents=True, exist_ok=True)
    n = now()
    ts = n.strftime('%Y-%m-%d_%H%M%S_%f')
    p = INBOX / f'{APPROVAL_PREFIX}{ts}.md'

    task_name = plan.get('input', '')[:60] or '执行自动任务计划'
    step_desc = ' -> '.join([s.get('skill', '') for s in plan.get('steps', [])]) or '无步骤'
    task_description = f"根据用户指令生成自动任务计划，共 {len(plan.get('steps', []))} 步：{step_desc}"
    expected_result = '审批通过后按步骤自动执行；任一步失败则中断并记录日志。'

    fm = {
        'type': 'note', 'dimension': '_inbox', 'status': 'pending', 'privacy': 'private',
        'date': n.strftime('%Y-%m-%d'), 'source': 'openclaw', 'created': ts_hm(),
        'approval_status': 'pending', 'approval_operation': 'execute_task_plan', 'approval_action': 'execute_task_plan',
        'approval_scope': f"执行{len(plan.get('steps', []))}步任务计划",
        'approval_expires_at': (n + dt.timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M'),
        'approval_risk': plan.get('risk', 'medium'),
        'task_name': task_name, 'task_description': task_description, 'expected_result': expected_result,
        'semantic_confidence': round(float(semantic.get('confidence', 0.0)), 4),
        'semantic_reason': str(semantic.get('reason', '')),
        'semantic_threshold': float(threshold),
    }
    order = ['type', 'dimension', 'status', 'privacy', 'date', 'source', 'created', 'approval_status', 'approval_operation', 'approval_action', 'approval_scope', 'approval_expires_at', 'approval_risk', 'task_name', 'task_description', 'expected_result', 'semantic_confidence', 'semantic_reason', 'semantic_threshold']

    scope = f"步骤数={len(plan.get('steps', []))}"
    body = (
        f"## OpenClaw 审批请求\n\n"
        f"### 任务信息\n"
        f"- 任务名称: {task_name}\n"
        f"- 任务内容: {task_description}\n"
        f"- 预期结果: {expected_result}\n\n"
        f"### 语义门控审计\n"
        f"- 判定置信度: {float(semantic.get('confidence', 0.0)):.4f}\n"
        f"- 判定理由: {semantic.get('reason', '')}\n"
        f"- 使用阈值: {float(threshold):.4f}\n"
        f"- 判定结论: {'通过' if semantic.get('isActionable') else '拦截'}\n\n"
        f"### 执行与风险\n"
        f"- 操作类型: execute_task_plan\n"
        f"- 风险等级: {plan.get('risk', 'medium')}\n"
        f"- 影响范围: {scope}\n"
        f"- 触发原因: 由任务路由器自动生成\n"
        f"- 技术载荷: `{json.dumps({'plan': plan, 'semantic': semantic, 'threshold': threshold}, ensure_ascii=False)}`\n\n"
        f"### 用户操作说明\n"
        f"将 frontmatter 字段 `approval_status` 改为 `approved` 或 `rejected`。\n\n"
        f"---\n*[OpenClaw] 审批请求创建于 {ts_full()}，24小时后自动取消*\n"
    )
    lines = ['---'] + [f"{k}: {fm[k]}" for k in order] + ['---', '', body]
    p.write_text('\n'.join(lines), encoding='utf-8')
    return p


def main() -> int:
    ap = argparse.ArgumentParser(description='LifeOnline Task Router')
    sub = ap.add_subparsers(dest='cmd', required=True)

    p_plan = sub.add_parser('plan')
    p_plan.add_argument('--text', required=True)
    p_plan.add_argument('--url', default='')
    p_plan.add_argument('--submit', action='store_true')
    p_plan.add_argument('--dry-run', action='store_true', help='仅生成计划，不提交审批')
    p_plan.add_argument('--require-url-for-scrape', action='store_true', help='命中爬取技能但无URL时报错')
    p_plan.add_argument('--semantic-threshold', type=float, default=0.65)

    args = ap.parse_args()
    if args.cmd == 'plan':
        plan = build_plan(args.text, args.url)

        if args.require_url_for_scrape:
            missing_url_steps = [s for s in plan.get('steps', []) if s.get('skill') == 'web_scrape' and not str(s.get('params', {}).get('url', '')).strip()]
            if missing_url_steps:
                print(json.dumps({'status': 'error', 'error': 'require_url_for_scrape_failed', 'message': '检测到爬取技能，但未提供URL。请通过文本携带URL或使用 --url 参数。', 'plan': plan}, ensure_ascii=False, indent=2))
                return 2

        is_actionable, conf, reason = semantic_gate(args.text, plan)
        semantic = {'isActionable': is_actionable, 'confidence': conf, 'reason': reason}
        threshold = float(args.semantic_threshold)
        out = {'plan': plan, 'dryRun': bool(args.dry_run), 'semantic': semantic, 'semanticThreshold': threshold}
        decision = 'pass' if (is_actionable and conf >= threshold) else 'reject'
        log_semantic_event({
            'ts': ts_full(),
            'decision': decision,
            'is_actionable': bool(is_actionable),
            'text': args.text,
            'confidence': round(float(conf), 4),
            'reason': reason,
            'threshold': round(float(threshold), 4),
            'steps': [s.get('skill', '') for s in plan.get('steps', [])],
        })

        if (not is_actionable) or conf < threshold:
            out['status'] = 'rejected_by_semantic_gate'
            print(json.dumps(out, ensure_ascii=False, indent=2))
            return 0

        if args.submit and not args.dry_run:
            apath = write_approval_for_plan(plan, semantic, threshold)
            out['approvalFile'] = str(apath)
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
