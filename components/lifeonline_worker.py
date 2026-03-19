#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_DIR = ROOT / "components"
VAULT = Path("/home/xionglei/Vault_OS")
INBOX = VAULT / "_Inbox"
LOG_DIR = Path.home() / ".openclaw" / "logs" / "lifeonline"
LOG_FILE = LOG_DIR / "lifeonline.log"
ERR_FILE = LOG_DIR / "error.log"
STATE_FILE = LOG_DIR / "state.json"
EXEC_LOG_FILE = LOG_DIR / "exec.log"
AUTO_SOURCES_FILE = COMPONENTS_DIR / "auto_sources.json"
TRIGGER_ALIASES_FILE = COMPONENTS_DIR / "trigger_aliases.json"
PENDING_QUERIES_FILE = COMPONENTS_DIR / "pending_queries.json"
WHATSAPP_RETRY_FILE = COMPONENTS_DIR / "whatsapp_retry_queue.json"
TASK_ROUTER_FILE = COMPONENTS_DIR / "task_router.py"
QUERY_LOG_FILE = LOG_DIR / "query_followup.log"
APPROVAL_PREFIX = "openclaw_approval_"
OWNER_WHATSAPP = "+447354918289"

DIMENSION_DIR = {
    "health": "健康",
    "career": "事业",
    "finance": "财务",
    "learning": "学习",
    "relationship": "关系",
    "life": "生活",
    "hobby": "兴趣",
    "growth": "成长",
}
CN_TO_DIM = {v: k for k, v in DIMENSION_DIR.items()}
VALID_DIMENSIONS = set(DIMENSION_DIR.keys())


def now_local() -> dt.datetime:
    return dt.datetime.now()


def ts_hm() -> str:
    return now_local().strftime("%Y-%m-%dT%H:%M")


def ts_full() -> str:
    return now_local().strftime("%Y-%m-%d %H:%M:%S")


def ensure_dirs() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def log(msg: str) -> None:
    ensure_dirs()
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{ts_full()}] {msg}\n")


def log_err(msg: str) -> None:
    ensure_dirs()
    with ERR_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{ts_full()}] {msg}\n")


def exec_log(op: str, target: str, result: str) -> None:
    ensure_dirs()
    with EXEC_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{ts_full()}]\top={op}\ttarget={target}\tresult={result}\n")


def query_log(event: Dict) -> None:
    ensure_dirs()
    with QUERY_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": ts_full(), **event}, ensure_ascii=False) + "\n")


def load_state() -> Dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {"consecutive_failures": 0}
    return {"consecutive_failures": 0}


def save_state(state: Dict) -> None:
    ensure_dirs()
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_frontmatter(text: str) -> Tuple[Dict[str, str], List[str], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("missing frontmatter start")

    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        raise ValueError("missing frontmatter end")

    raw_fm_lines = lines[1:end]
    body = "\n".join(lines[end + 1 :])
    fm: Dict[str, str] = {}
    order: List[str] = []

    for ln in raw_fm_lines:
        if not ln.strip() or ":" not in ln:
            continue
        k, v = ln.split(":", 1)
        key = k.strip()
        val = v.strip()
        fm[key] = val
        order.append(key)

    return fm, order, body


def dump_frontmatter(fm: Dict[str, str], order: List[str], body: str) -> str:
    keys = list(order)
    for k in fm.keys():
        if k not in keys:
            keys.append(k)
    out = ["---"]
    for k in keys:
        out.append(f"{k}: {fm[k]}")
    out.append("---")
    out.append("")
    out.append(body.rstrip("\n"))
    out.append("")
    return "\n".join(out)


def parse_fm_datetime(v: str) -> dt.datetime | None:
    try:
        return dt.datetime.strptime(v, "%Y-%m-%dT%H:%M")
    except Exception:
        return None


def load_triggers() -> List[str]:
    if TRIGGER_ALIASES_FILE.exists():
        try:
            j = json.loads(TRIGGER_ALIASES_FILE.read_text(encoding="utf-8"))
            aliases = [str(x).strip() for x in j.get("aliases", []) if str(x).strip()]
            if aliases:
                return aliases
        except Exception as e:
            log_err(f"trigger alias parse failed: {e}")
    default = {"aliases": ["小熊同学", "小熊", "熊同学", "bear"], "caseInsensitive": True}
    TRIGGER_ALIASES_FILE.write_text(json.dumps(default, ensure_ascii=False, indent=2), encoding="utf-8")
    return default["aliases"]


def load_pending_queries() -> Dict:
    if PENDING_QUERIES_FILE.exists():
        try:
            return json.loads(PENDING_QUERIES_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {"items": []}
    return {"items": []}


def save_pending_queries(data: Dict) -> None:
    PENDING_QUERIES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_whatsapp_retry_queue() -> Dict:
    if WHATSAPP_RETRY_FILE.exists():
        try:
            return json.loads(WHATSAPP_RETRY_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {"items": []}
    return {"items": []}


def save_whatsapp_retry_queue(data: Dict) -> None:
    WHATSAPP_RETRY_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def next_query_id() -> str:
    return "q_" + now_local().strftime("%Y%m%d_%H%M%S_%f")


def extract_command_text(body: str, aliases: List[str]) -> str:
    lines = [x.strip() for x in body.splitlines() if x.strip()]
    txt = "\n".join(lines)
    for a in aliases:
        p = re.compile(re.escape(a), re.I)
        m = p.search(txt)
        if m:
            cmd = txt[m.end():].lstrip("，,:： \n")
            return cmd.strip()
    return ""


def extract_reply_text(body: str) -> Tuple[str, str]:
    # format: 小熊同学 回复 q_xxx: ...
    m = re.search(r"回复\s*(q_\d{8}_\d{6}_\d+)\s*[:：]\s*(.+)", body, flags=re.S)
    if not m:
        return "", ""
    return m.group(1).strip(), m.group(2).strip()


def router_plan(command_text: str, submit: bool) -> Tuple[bool, Dict]:
    cmd = [
        "python3", str(TASK_ROUTER_FILE), "plan",
        "--text", command_text,
        "--require-url-for-scrape",
        "--semantic-threshold", "0.70",
    ]
    if submit:
        cmd.append("--submit")
    cp = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    out = (cp.stdout or "").strip()
    if not out:
        return False, {"status": "error", "error": cp.stderr.strip()[:200]}
    try:
        data = json.loads(out)
    except Exception:
        return False, {"status": "error", "error": out[:200]}
    return cp.returncode == 0, data


def check_whatsapp_connected() -> Tuple[bool, str]:
    try:
        cp = subprocess.run([
            "openclaw", "channels", "status", "--json", "--probe"
        ], capture_output=True, text=True, timeout=60)
        if cp.returncode != 0:
            return False, f"status_failed:{cp.stderr.strip()[:120]}"
        data = json.loads(cp.stdout)
        wa = data.get("channels", {}).get("whatsapp", {})
        connected = bool(wa.get("connected", False))
        running = bool(wa.get("running", False))
        detail = f"running={running},connected={connected}"
        exec_log("whatsapp_precheck", OWNER_WHATSAPP, detail)
        return (running and connected), detail
    except Exception as e:
        detail = f"precheck_error:{e}"
        exec_log("whatsapp_precheck", OWNER_WHATSAPP, detail)
        return False, detail


def enqueue_whatsapp_retry(message: str, reason: str, source: str = "question") -> None:
    q = load_whatsapp_retry_queue()
    q.setdefault("items", []).append({
        "id": next_query_id(),
        "message": message,
        "target": OWNER_WHATSAPP,
        "source": source,
        "attempts": 0,
        "maxAttempts": 3,
        "status": "pending",
        "created": ts_hm(),
        "lastReason": reason,
    })
    save_whatsapp_retry_queue(q)
    exec_log("whatsapp_queue", OWNER_WHATSAPP, f"enqueued:{reason}")


def retry_whatsapp_queue() -> None:
    q = load_whatsapp_retry_queue()
    items = q.get("items", [])
    if not items:
        return
    ok_conn, detail = check_whatsapp_connected()
    if not ok_conn:
        exec_log("whatsapp_retry", OWNER_WHATSAPP, f"skip_not_connected:{detail}")
        return

    changed = False
    for it in items:
        if it.get("status") != "pending":
            continue
        attempts = int(it.get("attempts", 0))
        max_attempts = int(it.get("maxAttempts", 3))
        if attempts >= max_attempts:
            it["status"] = "failed"
            it["lastReason"] = "max_attempts_exceeded"
            changed = True
            exec_log("whatsapp_retry", it.get("id", ""), "permanent_failed")
            continue

        cp = subprocess.run([
            "openclaw", "message", "send",
            "--channel", "whatsapp",
            "--target", str(it.get("target", OWNER_WHATSAPP)),
            "--message", str(it.get("message", "")),
        ], capture_output=True, text=True, timeout=60)
        it["attempts"] = attempts + 1
        if cp.returncode == 0:
            it["status"] = "sent"
            it["sentAt"] = ts_hm()
            it["lastReason"] = "ok"
            exec_log("whatsapp_retry", it.get("id", ""), f"sent_attempt={it['attempts']}")
        else:
            err = (cp.stderr or cp.stdout or "send_failed")[:160]
            it["lastReason"] = err
            if it["attempts"] >= max_attempts:
                it["status"] = "failed"
                exec_log("whatsapp_retry", it.get("id", ""), f"permanent_failed:{err}")
            else:
                exec_log("whatsapp_retry", it.get("id", ""), f"retry_failed_attempt={it['attempts']}:{err}")
        changed = True

    if changed:
        save_whatsapp_retry_queue(q)


def send_whatsapp_question(text: str) -> bool:
    ok_conn, detail = check_whatsapp_connected()
    if not ok_conn:
        enqueue_whatsapp_retry(text, f"precheck_not_connected:{detail}")
        return False

    cp = subprocess.run([
        "openclaw", "message", "send",
        "--channel", "whatsapp",
        "--target", OWNER_WHATSAPP,
        "--message", text,
    ], capture_output=True, text=True, timeout=60)
    ok = cp.returncode == 0
    if ok:
        exec_log("whatsapp_question", OWNER_WHATSAPP, "ok")
        return True

    err = (cp.stderr or cp.stdout or "send_failed")[:160]
    exec_log("whatsapp_question", OWNER_WHATSAPP, f"failed:{err}")
    enqueue_whatsapp_retry(text, f"send_failed:{err}")
    return False


def list_md(folder: Path) -> List[Path]:
    if not folder.exists():
        return []
    return sorted(folder.glob("*.md"))


def write_approval(action: str, reason: str, payload: Dict, scope: str = "", risk: str = "high", task_name: str = "", task_description: str = "", expected_result: str = "") -> Path:
    INBOX.mkdir(parents=True, exist_ok=True)
    now = now_local()
    ts = now.strftime("%Y-%m-%d_%H%M%S_%f")
    name = f"{APPROVAL_PREFIX}{ts}.md"
    p = INBOX / name
    task_name = task_name or f"审批任务：{action}"
    task_description = task_description or reason
    expected_result = expected_result or "审批通过后按任务内容执行；拒绝则不执行。"

    fm = {
        "type": "note",
        "dimension": "_inbox",
        "status": "pending",
        "privacy": "private",
        "date": now.strftime("%Y-%m-%d"),
        "source": "openclaw",
        "created": ts_hm(),
        "approval_status": "pending",
        "approval_operation": action,
        "approval_action": action,
        "approval_scope": scope or "未指定",
        "approval_expires_at": (now + dt.timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M"),
        "approval_risk": risk,
        "task_name": task_name,
        "task_description": task_description,
        "expected_result": expected_result,
    }
    order = ["type", "dimension", "status", "privacy", "date", "source", "created", "approval_status", "approval_operation", "approval_action", "approval_scope", "approval_expires_at", "approval_risk", "task_name", "task_description", "expected_result"]
    body = (
        f"## OpenClaw 审批请求\n\n"
        f"### 任务信息\n"
        f"- 任务名称: {task_name}\n"
        f"- 任务内容: {task_description}\n"
        f"- 预期结果: {expected_result}\n\n"
        f"### 执行与风险\n"
        f"- 操作类型: {action}\n"
        f"- 风险等级: {risk}\n"
        f"- 影响范围: {scope or '未指定'}\n"
        f"- 触发原因: {reason}\n"
        f"- 技术载荷: `{json.dumps(payload, ensure_ascii=False)}`\n\n"
        f"### 用户操作说明\n"
        f"将 frontmatter 字段 `approval_status` 改为 `approved` 或 `rejected`。\n\n"
        f"---\n*[OpenClaw] 审批请求创建于 {ts_full()}，24小时后自动取消*\n"
    )
    p.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
    exec_log("approval_request", str(p), "created")
    return p


def run_internal_ai(prompt: str) -> str:
    cmd = [
        "openclaw",
        "agent",
        "--session-id",
        "lifeonline-worker",
        "--message",
        prompt,
        "--json",
        "--timeout",
        "90",
    ]
    cp = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if cp.returncode != 0:
        raise RuntimeError(f"openclaw agent failed: {cp.stderr.strip()[:300]}")
    data = json.loads(cp.stdout)
    payloads = data.get("result", {}).get("payloads", [])
    text = "\n".join([p.get("text", "") for p in payloads if isinstance(p, dict)])
    if not text.strip():
        raise RuntimeError("internal ai empty output")
    return text.strip()


def classify_dimension(content: str) -> str:
    prompt = (
        "你是 LifeOnline 分类助手。\n"
        "只返回一个英文 key：health/career/finance/learning/relationship/life/hobby/growth。\n"
        "不要解释，不要额外文本。\n\n"
        f"笔记内容:\n{content[:5000]}"
    )
    try:
        ans = run_internal_ai(prompt).lower()
        m = re.search(r"\b(health|career|finance|learning|relationship|life|hobby|growth)\b", ans)
        if m:
            return m.group(1)
    except Exception as e:
        log_err(f"classify via internal model failed: {e}")

    # fallback
    text = content
    kw = [
        ("health", ["跑步", "睡眠", "饮食", "体检", "锻炼", "心理"]),
        ("career", ["项目", "开会", "工作", "职业", "交付", "客户"]),
        ("finance", ["投资", "支出", "收入", "预算", "理财", "资产"]),
        ("learning", ["阅读", "课程", "学习", "笔记", "知识", "认知"]),
        ("relationship", ["家人", "朋友", "社交", "人脉", "聚会"]),
        ("life", ["家务", "购物", "出行", "租房", "居住", "打扫"]),
        ("hobby", ["摄影", "游戏", "旅行", "音乐", "写作", "创作"]),
    ]
    for d, kws in kw:
        if any(k in text for k in kws):
            return d
    return "growth"


def extract_actions(content: str) -> List[Tuple[str, str]]:
    prompt = (
        "从笔记中提取明确待办事项。\n"
        "输出格式：每行一个，形如 '- 行动描述' 或 '- 行动描述 (due: YYYY-MM-DD)'。\n"
        "没有则输出 '无'。\n\n"
        f"笔记内容:\n{content[:5000]}"
    )
    result = ""
    try:
        result = run_internal_ai(prompt)
    except Exception as e:
        log_err(f"extract actions via internal model failed: {e}")

    actions: List[Tuple[str, str]] = []
    lines = [x.strip() for x in result.splitlines() if x.strip()]
    for ln in lines:
        if ln == "无":
            return []
        if ln.startswith("- "):
            raw = ln[2:].strip()
            m = re.search(r"\(\s*due\s*:\s*(\d{4}-\d{2}-\d{2})\s*\)\s*$", raw, flags=re.I)
            due = ""
            if m:
                due = m.group(1)
                raw = re.sub(r"\(\s*due\s*:\s*\d{4}-\d{2}-\d{2}\s*\)\s*$", "", raw, flags=re.I).strip()
            if raw:
                actions.append((raw, due))

    if actions:
        return actions

    # fallback
    for seg in re.split(r"[。；\n]", content):
        seg = seg.strip(" -\t")
        if seg and any(x in seg for x in ["需要", "待办", "TODO", "要", "记得"]):
            actions.append((seg[:80], ""))
    return actions[:5]


def append_note(body: str, line: str) -> str:
    body = body.rstrip("\n")
    return f"{body}\n\n---\n*{line}*\n"


def create_task_file(source_note: Path, dim: str, privacy: str, action: str, due: str, idx: int) -> Path:
    t = now_local()
    date = t.strftime("%Y-%m-%d")
    hhmmss = t.strftime("%H%M%S")
    suffix = f"_{idx}" if idx > 0 else ""
    name = f"openclaw_task_{date}_{hhmmss}{suffix}.md"
    dim_dir = VAULT / DIMENSION_DIR[dim]
    dim_dir.mkdir(parents=True, exist_ok=True)
    p = dim_dir / name

    fm = {
        "type": "task",
        "dimension": dim,
        "status": "pending",
        "priority": "medium",
        "privacy": privacy if privacy in {"public", "private", "sensitive"} else "private",
        "date": date,
        "tags": "[自动提取]",
        "source": "openclaw",
        "created": ts_hm(),
    }
    if due:
        fm["due"] = due

    order = ["type", "dimension", "status", "priority", "privacy", "date", "due", "tags", "source", "created"]
    order = [x for x in order if x in fm]
    body = (
        f"## {action}\n\n"
        f"**来源笔记**: [[{source_note.name}]]\n\n"
        f"---\n*[OpenClaw] 自动提取自笔记 ({ts_full()})*\n"
    )
    p.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
    return p


def handle_bear_flow(path: Path, fm: Dict[str, str], order: List[str], body: str) -> Tuple[bool, str]:
    if str(fm.get("assistant_handled", "")).lower() == "true":
        return True, f"skip(already handled): {path.name}"

    aliases = load_triggers()

    # 回复闭环
    qid, reply_text = extract_reply_text(body)
    if qid:
        pq = load_pending_queries()
        items = pq.get("items", [])
        item = next((x for x in items if x.get("id") == qid and x.get("status") == "pending"), None)
        if not item:
            return True, f"reply_without_pending: {path.name}"

        merged = f"{item.get('command', '')}\n补充信息: {reply_text}"
        ok, out = router_plan(merged, submit=True)
        if ok and out.get("approvalFile"):
            item["status"] = "resolved"
            item["resolvedAt"] = ts_hm()
            item["approvalFile"] = out.get("approvalFile")
            save_pending_queries(pq)
            query_log({"event": "reply_resolved", "queryId": qid, "note": path.name, "approvalFile": out.get("approvalFile")})
            body2 = append_note(body, f"[OpenClaw] 已根据回复继续执行，审批单: {out.get('approvalFile')} ({ts_full()})")
            fm["updated"] = ts_hm()
            fm["assistant_handled"] = "true"
            path.write_text(dump_frontmatter(fm, order, body2), encoding="utf-8")
            exec_log("bear_reply", path.name, "resolved_to_approval")
            return True, f"bear_reply_resolved: {path.name}"

        # 仍不清楚，继续提问
        ask = f"小磊哥，关于任务({qid})我还需要补充信息：{out.get('message', '请补充目标URL、时间或范围')}。请回复：小熊同学 回复 {qid}: <补充内容>"
        send_whatsapp_question(ask)
        query_log({"event": "reply_still_unclear", "queryId": qid, "note": path.name, "detail": out})
        exec_log("bear_reply", path.name, "asked_again")
        return True, f"bear_reply_asked_again: {path.name}"

    # 主动呼唤触发
    cmd_text = extract_command_text(body, aliases)
    if not cmd_text:
        return False, ""

    ok, out = router_plan(cmd_text, submit=True)
    if ok and out.get("approvalFile"):
        body2 = append_note(body, f"[OpenClaw] 已识别命令并创建审批: {out.get('approvalFile')} ({ts_full()})")
        fm["updated"] = ts_hm()
        fm["assistant_handled"] = "true"
        path.write_text(dump_frontmatter(fm, order, body2), encoding="utf-8")
        exec_log("bear_trigger", path.name, "approval_created")
        query_log({"event": "trigger_to_approval", "note": path.name, "command": cmd_text, "approvalFile": out.get("approvalFile")})
        return True, f"bear_trigger_approval: {path.name}"

    # 信息不足 -> WhatsApp提问 + pending_query
    qid = next_query_id()
    ask = f"小磊哥，我识别到你的命令：{cmd_text}。但信息还不完整（{out.get('message', out.get('status', 'unknown'))}）。请回复：小熊同学 回复 {qid}: <补充内容>"
    send_whatsapp_question(ask)
    pq = load_pending_queries()
    pq.setdefault("items", []).append({
        "id": qid,
        "status": "pending",
        "sourceNote": path.name,
        "command": cmd_text,
        "question": ask,
        "created": ts_hm(),
        "router": out,
    })
    save_pending_queries(pq)
    query_log({"event": "trigger_need_more_info", "queryId": qid, "note": path.name, "command": cmd_text, "router": out})

    body2 = append_note(body, f"[OpenClaw] 命令信息不足，已发起澄清提问 query_id={qid} ({ts_full()})")
    fm["updated"] = ts_hm()
    fm["assistant_handled"] = "true"
    path.write_text(dump_frontmatter(fm, order, body2), encoding="utf-8")
    exec_log("bear_trigger", path.name, "asked_whatsapp")
    return True, f"bear_trigger_asked: {path.name}"


def process_inbox_file(path: Path) -> Tuple[bool, str]:
    if path.name.startswith(APPROVAL_PREFIX):
        return True, f"skip(approval file): {path.name}"

    txt = path.read_text(encoding="utf-8")
    fm, order, body = parse_frontmatter(txt)

    if fm.get("dimension", "") != "_inbox":
        return True, f"skip(not _inbox): {path.name}"

    handled, hmsg = handle_bear_flow(path, fm, order, body)
    if handled:
        return True, hmsg

    dim = classify_dimension(f"{json.dumps(fm, ensure_ascii=False)}\n\n{body}")
    if dim not in VALID_DIMENSIONS:
        dim = "growth"

    fm["dimension"] = dim
    fm["updated"] = ts_hm()

    body2 = append_note(body, f"[OpenClaw] 已从 _Inbox 归档到 {DIMENSION_DIR[dim]} 维度 ({ts_full()})")

    actions = extract_actions(body)
    created_tasks = []
    for i, (action, due) in enumerate(actions):
        try:
            created_tasks.append(create_task_file(path, dim, fm.get("privacy", "private"), action, due, i))
        except Exception as e:
            log_err(f"create task failed for {path.name}: {e}")

    if created_tasks:
        body2 = append_note(body2, f"[OpenClaw] 已提取 {len(created_tasks)} 个行动项 ({ts_full()})")

    content = dump_frontmatter(fm, order, body2)

    target_dir = VAULT / DIMENSION_DIR[dim]
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / path.name

    # 同步附件：同名不同后缀
    attachment_exts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".pdf"]
    attachments: List[Path] = []
    for ext in attachment_exts:
        att = path.with_suffix(ext)
        if att.exists() and att.is_file():
            attachments.append(att)

    tmp = path.with_suffix(path.suffix + ".tmp_openclaw")
    tmp.write_text(content, encoding="utf-8")
    shutil.move(str(tmp), str(path))
    shutil.move(str(path), str(target))

    moved_attachments = 0
    for att in attachments:
        att_target = target_dir / att.name
        try:
            shutil.move(str(att), str(att_target))
            moved_attachments += 1
        except Exception as e:
            log_err(f"move attachment failed {att.name}: {e}")

    return True, f"processed {path.name} -> {DIMENSION_DIR[dim]}, tasks={len(created_tasks)}, moved with {moved_attachments} attachments"


def update_failure_state(fail: int) -> None:
    state = load_state()
    if fail > 0:
        state["consecutive_failures"] = int(state.get("consecutive_failures", 0)) + 1
    else:
        state["consecutive_failures"] = 0
    if state["consecutive_failures"] >= 3:
        log_err("ALERT: 连续 3 次处理失败，请人工检查 lifeonline_worker.py 与输入数据格式")
    save_state(state)


def run_inbox_scan() -> int:
    if not INBOX.exists():
        log_err(f"inbox path missing: {INBOX}")
        return 1

    files = sorted(INBOX.glob("*.md"))
    log(f"scan start, files={len(files)}")
    ok, fail = 0, 0
    for p in files:
        try:
            success, msg = process_inbox_file(p)
            if success:
                ok += 1
                log(msg)
            else:
                fail += 1
                log_err(msg)
        except ValueError as e:
            # 协议不符合：记录但不计入失败（按任务书要求跳过）
            log_err(f"protocol skip {p.name}: {e}")
        except Exception as e:
            fail += 1
            log_err(f"process failed {p.name}: {e}")

    log(f"scan done, ok={ok}, fail={fail}")
    update_failure_state(fail)
    return 0 if fail == 0 else 2


def iter_dimension_files() -> List[Path]:
    out: List[Path] = []
    for cn in DIMENSION_DIR.values():
        d = VAULT / cn
        if not d.exists():
            continue
        out.extend(sorted(d.glob("*.md")))
    return out


def week_bounds(today: dt.date) -> Tuple[dt.date, dt.date]:
    start = today - dt.timedelta(days=today.weekday())
    end = start + dt.timedelta(days=6)
    return start, end


def collect_stats(date_from: dt.date, date_to: dt.date) -> Dict:
    by_dim_new = {k: 0 for k in VALID_DIMENSIONS}
    by_dim_done = {k: 0 for k in VALID_DIMENSIONS}
    done_tasks = 0
    undone_tasks = 0
    milestones: List[str] = []

    for p in iter_dimension_files():
        try:
            fm, _, _ = parse_frontmatter(p.read_text(encoding="utf-8"))
        except Exception:
            continue

        d = fm.get("date", "")
        try:
            d_obj = dt.datetime.strptime(d, "%Y-%m-%d").date()
        except Exception:
            continue
        if not (date_from <= d_obj <= date_to):
            continue

        dim = fm.get("dimension", "")
        if dim not in VALID_DIMENSIONS:
            # infer from folder name
            dim = CN_TO_DIM.get(p.parent.name, "growth")

        by_dim_new[dim] += 1
        if fm.get("status", "") == "done":
            by_dim_done[dim] += 1

        if fm.get("type", "") == "task":
            st = fm.get("status", "")
            if st == "done":
                done_tasks += 1
            elif st in {"pending", "in_progress"}:
                undone_tasks += 1

        if fm.get("type", "") == "milestone":
            milestones.append(p.stem)

    return {
        "by_dim_new": by_dim_new,
        "by_dim_done": by_dim_done,
        "done_tasks": done_tasks,
        "undone_tasks": undone_tasks,
        "milestones": milestones[:20],
    }


def ai_summary(stats: Dict, scope: str) -> str:
    lines = [
        f"范围: {scope}",
        f"完成任务: {stats['done_tasks']}",
        f"未完成任务: {stats['undone_tasks']}",
    ]
    for d in ["health", "career", "finance", "learning", "relationship", "life", "hobby", "growth"]:
        lines.append(f"{d}: 新增{stats['by_dim_new'][d]} 完成{stats['by_dim_done'][d]}")
    if stats["milestones"]:
        lines.append("里程碑: " + "、".join(stats["milestones"][:8]))

    prompt = (
        "根据以下数据生成中文总结，150-200字，积极、简洁、非流水账。\n"
        "只输出总结正文。\n\n" + "\n".join(lines)
    )
    try:
        return run_internal_ai(prompt).strip()
    except Exception as e:
        log_err(f"ai summary failed: {e}")
        return "今天保持了持续记录与执行，重点事项有推进，后续可聚焦未完成任务逐项清理。"


def build_table(stats: Dict) -> str:
    rows = ["| 维度 | 新增 | 完成 |", "|------|------|------|"]
    for d in ["health", "career", "finance", "learning", "relationship", "life", "hobby", "growth"]:
        rows.append(f"| {DIMENSION_DIR[d]} | {stats['by_dim_new'][d]} | {stats['by_dim_done'][d]} |")
    return "\n".join(rows)


def run_daily_report() -> int:
    today = now_local().date()
    stats = collect_stats(today, today)
    summary = ai_summary(stats, f"{today}")

    out_dir = VAULT / "_Daily"
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"openclaw_review_{today.strftime('%Y-%m-%d')}_230000.md"
    path = out_dir / filename

    fm = {
        "type": "review",
        "dimension": "growth",
        "status": "done",
        "privacy": "private",
        "date": today.strftime("%Y-%m-%d"),
        "tags": "[日报, 自动生成]",
        "source": "openclaw",
        "created": ts_hm(),
    }
    order = ["type", "dimension", "status", "privacy", "date", "tags", "source", "created"]

    milestones = "\n".join([f"- {m}" for m in stats["milestones"]]) if stats["milestones"] else "- 无"
    body = (
        f"# {today.strftime('%Y-%m-%d')} 日报\n\n"
        f"{summary}\n\n"
        f"## 今日数据\n\n"
        f"{build_table(stats)}\n\n"
        f"## 今日里程碑\n\n{milestones}\n\n"
        f"---\n*[OpenClaw] 自动生成 ({ts_full()})*\n"
    )
    path.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
    log(f"daily report generated: {path}")
    update_failure_state(0)
    return 0


def run_weekly_report() -> int:
    today = now_local().date()
    start, end = week_bounds(today)
    stats = collect_stats(start, end)
    iso_year, iso_week, _ = today.isocalendar()
    summary = ai_summary(stats, f"{start}~{end}")

    out_dir = VAULT / "_Weekly"
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"openclaw_review_{iso_year}-W{iso_week:02d}_233000.md"
    path = out_dir / filename

    fm = {
        "type": "review",
        "dimension": "growth",
        "status": "done",
        "privacy": "private",
        "date": today.strftime("%Y-%m-%d"),
        "tags": "[周报, 自动生成]",
        "source": "openclaw",
        "created": ts_hm(),
    }
    order = ["type", "dimension", "status", "privacy", "date", "tags", "source", "created"]

    milestones = "\n".join([f"- {m}" for m in stats["milestones"]]) if stats["milestones"] else "- 无"
    body = (
        f"# {iso_year}-W{iso_week:02d} 周报\n\n"
        f"{summary}\n\n"
        f"## 本周数据\n\n"
        f"{build_table(stats)}\n\n"
        f"## 本周里程碑\n\n{milestones}\n\n"
        f"---\n*[OpenClaw] 自动生成 ({ts_full()})*\n"
    )
    path.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
    log(f"weekly report generated: {path}")
    update_failure_state(0)
    return 0


def load_auto_config() -> Dict:
    if AUTO_SOURCES_FILE.exists():
        try:
            return json.loads(AUTO_SOURCES_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            log_err(f"auto config parse failed: {e}")
    default_cfg = {
        "web_sources": [],
        "reminders": [],
        "archive": {"enabled": True, "days": 7, "dimension": "growth"},
        "delete_requests": [],
        "sensitive_updates": [],
    }
    AUTO_SOURCES_FILE.write_text(json.dumps(default_cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    return default_cfg


def scrape_to_vault(cfg: Dict) -> None:
    for src in cfg.get("web_sources", []):
        url = src.get("url", "").strip()
        if not url:
            continue
        dim = src.get("dimension", "learning")
        if dim not in VALID_DIMENSIONS:
            dim = "learning"
        try:
            cp = subprocess.run(["curl", "-L", "-sS", url], capture_output=True, text=True, timeout=30)
            text = cp.stdout.strip()
            text = re.sub(r"<script[\s\S]*?</script>", "", text, flags=re.I)
            text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.I)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()[:2000]
            if not text:
                raise RuntimeError("empty scraped text")

            now = now_local()
            filename = f"openclaw_note_{now.strftime('%Y-%m-%d')}_{now.strftime('%H%M%S')}.md"
            out = VAULT / DIMENSION_DIR[dim] / filename
            out.parent.mkdir(parents=True, exist_ok=True)
            fm = {
                "type": "note",
                "dimension": dim,
                "status": "pending",
                "privacy": src.get("privacy", "private"),
                "date": now.strftime("%Y-%m-%d"),
                "tags": json.dumps(src.get("tags", ["自动爬取"]), ensure_ascii=False),
                "source": "openclaw",
                "created": ts_hm(),
            }
            order = ["type", "dimension", "status", "privacy", "date", "tags", "source", "created"]
            body = f"## {src.get('title', url)}\n\n来源: {url}\n\n{text}\n\n---\n*[OpenClaw] 自动爬取 ({ts_full()})*\n"
            out.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
            exec_log("auto_scrape", str(out), "ok")
        except Exception as e:
            exec_log("auto_scrape", url, f"failed:{e}")
            log_err(f"auto scrape failed {url}: {e}")


def create_periodic_reminders(cfg: Dict) -> None:
    today = now_local().date()
    for r in cfg.get("reminders", []):
        title = r.get("title", "").strip()
        if not title:
            continue
        cadence = r.get("cadence", "daily")
        if cadence == "weekly":
            wd = int(r.get("weekday", 0))
            if today.weekday() != wd:
                continue
        dim = r.get("dimension", "growth")
        if dim not in VALID_DIMENSIONS:
            dim = "growth"

        base = f"openclaw_task_{today.strftime('%Y-%m-%d')}_"
        existing = list((VAULT / DIMENSION_DIR[dim]).glob(base + "*.md"))
        if any(title in x.read_text(encoding="utf-8", errors="ignore") for x in existing[:20]):
            continue

        now = now_local()
        filename = f"openclaw_task_{today.strftime('%Y-%m-%d')}_{now.strftime('%H%M%S')}.md"
        out = VAULT / DIMENSION_DIR[dim] / filename
        out.parent.mkdir(parents=True, exist_ok=True)
        fm = {
            "type": "task",
            "dimension": dim,
            "status": "pending",
            "priority": r.get("priority", "medium"),
            "privacy": r.get("privacy", "private"),
            "date": today.strftime("%Y-%m-%d"),
            "tags": "[提醒, 自动创建]",
            "source": "openclaw",
            "created": ts_hm(),
        }
        if r.get("due"):
            fm["due"] = r.get("due")
        order = ["type", "dimension", "status", "priority", "privacy", "date", "due", "tags", "source", "created"]
        order = [x for x in order if x in fm]
        body = f"## {title}\n\n---\n*[OpenClaw] 定期提醒自动创建 ({ts_full()})*\n"
        out.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
        exec_log("auto_reminder", str(out), "ok")


def execute_archive_old_inbox(days: int, dim: str) -> List[Dict[str, str]]:
    target_dim = dim if dim in VALID_DIMENSIONS else "growth"
    cutoff = now_local() - dt.timedelta(days=days)
    moved = 0
    moved_pairs: List[Dict[str, str]] = []
    for p in list_md(INBOX):
        if p.name.startswith(APPROVAL_PREFIX):
            continue
        try:
            fm, order, body = parse_frontmatter(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if fm.get("dimension", "") != "_inbox":
            continue
        created = parse_fm_datetime(fm.get("created", ""))
        if not created or created > cutoff:
            continue
        fm["dimension"] = target_dim
        fm["updated"] = ts_hm()
        body2 = append_note(body, f"[OpenClaw] _Inbox 超期兜底归档到 {DIMENSION_DIR[target_dim]} ({ts_full()})")
        p.write_text(dump_frontmatter(fm, order, body2), encoding="utf-8")
        dst = VAULT / DIMENSION_DIR[target_dim] / p.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(p), str(dst))
        moved_pairs.append({"from": str(p), "to": str(dst)})
        moved += 1
    exec_log("archive_old_inbox", f"days={days}", f"moved={moved}")
    return moved_pairs


def execute_delete_files(paths: List[str]) -> None:
    deleted = 0
    for s in paths:
        p = Path(s)
        if not p.exists() or p.is_dir():
            continue
        try:
            p.unlink()
            deleted += 1
            exec_log("delete_file", str(p), "deleted")
        except Exception as e:
            exec_log("delete_file", str(p), f"failed:{e}")
            log_err(f"delete file failed {p}: {e}")
    exec_log("delete_files_batch", f"count={len(paths)}", f"deleted={deleted}")


def execute_sensitive_modifications(items: List[Dict]) -> None:
    modified = 0
    for item in items:
        path = Path(str(item.get("path", "")))
        mode = item.get("mode", "append_note")
        note = item.get("note", "[OpenClaw] sensitive 文件已审批修改")
        if not path.exists() or path.is_dir():
            continue
        try:
            txt = path.read_text(encoding="utf-8")
            fm, order, body = parse_frontmatter(txt)
            if fm.get("privacy", "") != "sensitive":
                exec_log("modify_sensitive", str(path), "skipped_not_sensitive")
                continue
            if mode == "set_status":
                fm["status"] = str(item.get("status", fm.get("status", "pending")))
                fm["updated"] = ts_hm()
                body2 = append_note(body, f"{note} ({ts_full()})")
            else:
                fm["updated"] = ts_hm()
                body2 = append_note(body, f"{note} ({ts_full()})")
            path.write_text(dump_frontmatter(fm, order, body2), encoding="utf-8")
            modified += 1
            exec_log("modify_sensitive", str(path), "modified")
        except Exception as e:
            exec_log("modify_sensitive", str(path), f"failed:{e}")
            log_err(f"modify sensitive failed {path}: {e}")
    exec_log("modify_sensitive_batch", f"count={len(items)}", f"modified={modified}")


def execute_task_plan(plan: Dict) -> None:
    steps = list(plan.get("steps", []))
    exec_log("task_plan", plan.get("input", ""), f"start steps={len(steps)}")
    rollback_stack: List[Dict] = []

    def do_rollback() -> None:
        for cp in reversed(rollback_stack):
            skill = cp.get("skill", "")
            try:
                exec_log("rollback_step", skill, "start")
                if skill in {"web_scrape", "create_reminder"}:
                    for f in cp.get("created_files", []):
                        p = Path(f)
                        if p.exists() and p.is_file():
                            p.unlink()
                elif skill == "archive_to_dimension":
                    for pair in cp.get("moved_pairs", []):
                        src = Path(pair.get("to", ""))
                        dst = Path(pair.get("from", ""))
                        if src.exists() and src.is_file():
                            dst.parent.mkdir(parents=True, exist_ok=True)
                            shutil.move(str(src), str(dst))
                elif skill == "delete_file":
                    for b in cp.get("backups", []):
                        p = Path(b.get("path", ""))
                        p.parent.mkdir(parents=True, exist_ok=True)
                        p.write_text(b.get("content", ""), encoding="utf-8")
                elif skill == "modify_sensitive":
                    for b in cp.get("backups", []):
                        p = Path(b.get("path", ""))
                        p.parent.mkdir(parents=True, exist_ok=True)
                        p.write_text(b.get("content", ""), encoding="utf-8")
                exec_log("rollback_step", skill, "ok")
            except Exception as e:
                exec_log("rollback_step", skill, f"failed:{e}")
        exec_log("rollback_done", plan.get("input", ""), f"steps={len(rollback_stack)}")

    for i, step in enumerate(steps, start=1):
        skill = step.get("skill", "")
        params = step.get("params", {})
        try:
            exec_log("task_plan_step", f"{i}:{skill}", "start")
            if skill == "web_scrape":
                dim = params.get("dimension", "learning")
                d = VAULT / DIMENSION_DIR.get(dim, "学习")
                before = {str(x) for x in d.glob("openclaw_note_*.md")}
                src = {
                    "title": params.get("title", params.get("url", "")),
                    "url": params.get("url", ""),
                    "dimension": dim,
                    "privacy": params.get("privacy", "private"),
                    "tags": params.get("tags", ["自动爬取"]),
                }
                scrape_to_vault({"web_sources": [src]})
                after = {str(x) for x in d.glob("openclaw_note_*.md")}
                rollback_stack.append({"skill": skill, "created_files": sorted(list(after - before))})
            elif skill == "create_reminder":
                dim = params.get("dimension", "growth")
                d = VAULT / DIMENSION_DIR.get(dim, "成长")
                before = {str(x) for x in d.glob("openclaw_task_*.md")}
                create_periodic_reminders({"reminders": [params]})
                after = {str(x) for x in d.glob("openclaw_task_*.md")}
                rollback_stack.append({"skill": skill, "created_files": sorted(list(after - before))})
            elif skill == "archive_to_dimension":
                moved_pairs = execute_archive_old_inbox(int(params.get("days", 7)), params.get("dimension", "growth"))
                rollback_stack.append({"skill": skill, "moved_pairs": moved_pairs})
            elif skill == "delete_file":
                paths = [str(x) for x in params.get("paths", [])]
                backups = []
                for s in paths:
                    p = Path(s)
                    if p.exists() and p.is_file():
                        backups.append({"path": str(p), "content": p.read_text(encoding="utf-8")})
                execute_delete_files(paths)
                rollback_stack.append({"skill": skill, "backups": backups})
            elif skill == "modify_sensitive":
                items = list(params.get("items", []))
                backups = []
                for it in items:
                    p = Path(str(it.get("path", "")))
                    if p.exists() and p.is_file():
                        backups.append({"path": str(p), "content": p.read_text(encoding="utf-8")})
                execute_sensitive_modifications(items)
                rollback_stack.append({"skill": skill, "backups": backups})
            else:
                raise RuntimeError(f"unsupported skill: {skill}")
            exec_log("task_plan_step", f"{i}:{skill}", "ok")
        except Exception as e:
            exec_log("task_plan_step", f"{i}:{skill}", f"failed:{e}")
            exec_log("task_plan", plan.get("input", ""), f"aborted_at={i}")
            do_rollback()
            raise
    exec_log("task_plan", plan.get("input", ""), "completed")


def has_pending_approval(action: str) -> bool:
    for ap in list_md(INBOX):
        if not ap.name.startswith(APPROVAL_PREFIX):
            continue
        try:
            afm, _, _ = parse_frontmatter(ap.read_text(encoding="utf-8"))
            op = afm.get("approval_operation", "") or afm.get("approval_action", "")
            if afm.get("approval_status", "") == "pending" and op == action:
                return True
        except Exception:
            continue
    return False


def process_approvals() -> None:
    for p in list_md(INBOX):
        if not p.name.startswith(APPROVAL_PREFIX):
            continue
        try:
            fm, order, body = parse_frontmatter(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        st = fm.get("approval_status", "pending")
        action = fm.get("approval_operation", "") or fm.get("approval_action", "")
        exp = parse_fm_datetime(fm.get("approval_expires_at", ""))

        if st == "pending" and exp and now_local() > exp:
            fm["approval_status"] = "cancelled"
            fm["status"] = "done"
            body = append_note(body, f"[OpenClaw] 审批超时自动取消 ({ts_full()})")
            p.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
            exec_log("approval", str(p), "auto_cancelled")
            continue

        if st == "rejected":
            if fm.get("status", "") != "done":
                fm["status"] = "done"
                body = append_note(body, f"[OpenClaw] 审批已拒绝 ({ts_full()})")
                p.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
                exec_log("approval", str(p), "rejected_done")
            continue

        if st != "approved":
            continue

        if "executed" in body:
            continue

        payload = {}
        m = re.search(r"载荷:\s*`(.+?)`", body)
        if m:
            try:
                payload = json.loads(m.group(1))
            except Exception:
                payload = {}

        try:
            if action == "archive_old_inbox":
                execute_archive_old_inbox(int(payload.get("days", 7)), payload.get("dimension", "growth"))
            elif action == "delete_files":
                execute_delete_files(list(payload.get("paths", [])))
            elif action == "modify_sensitive":
                execute_sensitive_modifications(list(payload.get("items", [])))
            elif action == "execute_task_plan":
                execute_task_plan(dict(payload.get("plan", {})))
            else:
                exec_log("approval", str(p), f"unknown_action:{action}")
                continue

            fm["status"] = "done"
            body = append_note(body, f"[OpenClaw] 审批通过并已执行 ({ts_full()}) #executed")
            p.write_text(dump_frontmatter(fm, order, body), encoding="utf-8")
            exec_log("approval", str(p), "executed")
        except Exception as e:
            exec_log("approval", str(p), f"execute_failed:{e}")
            log_err(f"approval execute failed {p}: {e}")


def run_auto_exec() -> int:
    cfg = load_auto_config()
    process_approvals()
    retry_whatsapp_queue()

    scrape_to_vault(cfg)
    create_periodic_reminders(cfg)

    # 高风险：批量移动 _Inbox 超期文件，需审批
    arc = cfg.get("archive", {})
    if arc.get("enabled", True):
        days = int(arc.get("days", 7))
        cutoff = now_local() - dt.timedelta(days=days)
        candidates = []
        for p in list_md(INBOX):
            if p.name.startswith(APPROVAL_PREFIX):
                continue
            try:
                fm, _, _ = parse_frontmatter(p.read_text(encoding="utf-8"))
                if fm.get("dimension", "") != "_inbox":
                    continue
                c = parse_fm_datetime(fm.get("created", ""))
                if c and c <= cutoff:
                    candidates.append(p)
            except Exception:
                continue

        if len(candidates) == 1:
            execute_archive_old_inbox(days, arc.get("dimension", "growth"))
        elif len(candidates) > 1:
            if not has_pending_approval("archive_old_inbox"):
                write_approval(
                    "archive_old_inbox",
                    f"_Inbox 超过{days}天文件共{len(candidates)}个，属于批量移动高风险操作",
                    {"days": days, "dimension": arc.get("dimension", "growth"), "count": len(candidates)},
                    scope=f"_Inbox -> {DIMENSION_DIR.get(arc.get('dimension', 'growth'), '成长')}，文件数={len(candidates)}",
                    risk="high",
                    task_name="归档超期 Inbox 文件",
                    task_description=f"将 _Inbox 中超过 {days} 天的 {len(candidates)} 个文件归档到指定维度目录。",
                    expected_result="这些超期文件将不再停留在 _Inbox，并移动到目标维度目录。",
                )

    # 高风险：删除文件，统一审批
    del_reqs = cfg.get("delete_requests", [])
    for req in del_reqs:
        paths = [str(x) for x in req.get("paths", []) if str(x).strip()]
        if not paths:
            continue
        if not has_pending_approval("delete_files"):
            write_approval(
                "delete_files",
                req.get("reason", "请求删除文件，属于高风险操作"),
                {"paths": paths},
                scope=f"删除文件 {len(paths)} 个",
                risk="critical",
                task_name="删除指定文件",
                task_description=f"删除 {len(paths)} 个文件，路径来自当前删除请求。",
                expected_result="目标文件将从文件系统移除，后续无法在看板中继续使用这些文件。",
            )

    # 高风险：修改 sensitive 文件，统一审批
    sens_reqs = cfg.get("sensitive_updates", [])
    for req in sens_reqs:
        items = req.get("items", [])
        if not items:
            continue
        if not has_pending_approval("modify_sensitive"):
            write_approval(
                "modify_sensitive",
                req.get("reason", "请求修改 sensitive 文件，属于高风险操作"),
                {"items": items},
                scope=f"sensitive 文件 {len(items)} 个",
                risk="critical",
                task_name="修改敏感文件内容",
                task_description=f"对 {len(items)} 个 privacy:sensitive 文件执行已配置修改操作。",
                expected_result="敏感文件将按审批内容更新，并追加操作记录。",
            )

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="LifeOnline OpenClaw worker")
    parser.add_argument("command", choices=["scan-inbox", "daily-report", "weekly-report", "auto-exec"], help="task command")
    args = parser.parse_args()

    if args.command == "scan-inbox":
        return run_inbox_scan()
    if args.command == "daily-report":
        return run_daily_report()
    if args.command == "weekly-report":
        return run_weekly_report()
    if args.command == "auto-exec":
        return run_auto_exec()
    return 0


if __name__ == "__main__":
    sys.exit(main())
