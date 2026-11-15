"""Single-request Claude adapter and isolated Codex CLI adapter.

No client-supplied executable, arguments, URLs, or filesystem paths are accepted.
Provider billing limits remain mandatory for Codex: CLI token usage is observed,
not controllable through a dollar cap. It is disabled unless explicitly configured.
"""
import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import httpx
from sqlalchemy import select, func
from .config import settings
from .db import SessionLocal
from .models import Task, TaskLog, Record, Configuration, now

ACTIVE = {}
STOPPING = False

def provider_ready(provider):
    if provider == 'claude':
        return bool(settings.anthropic_api_key and settings.claude_input_usd_per_million > 0 and settings.claude_output_usd_per_million > 0)
    return bool(settings.codex_executable and Path(settings.codex_executable).is_file() and settings.codex_workspace and Path(settings.codex_workspace).is_dir() and settings.codex_input_usd_per_million > 0 and settings.codex_output_usd_per_million > 0)

def month_start():
    return now().replace(day=1,hour=0,minute=0,second=0,microsecond=0)

def spent(db, agent_id=None):
    q = select(Task).where(Task.created_at >= month_start())
    if agent_id: q = q.where(Task.agent_id == agent_id)
    return sum(t.reserved_usd if t.status in {'queued','running'} else t.cost_usd for t in db.scalars(q))

def minimum_reservation(agent, prompt):
    if agent['provider'] == 'codex': return 0.01
    # UTF-8 byte length is a conservative upper bound on input token count.
    input_bound = len((agent['system_prompt'] + prompt).encode('utf-8')) + 512
    return input_bound * settings.claude_input_usd_per_million / 1_000_000 + agent['max_output_tokens'] * settings.claude_output_usd_per_million / 1_000_000

def log(db, task_id, message, level='info'):
    db.add(TaskLog(task_id=task_id, message=message[:20000], level=level))

async def claude(agent, prompt):
    async with httpx.AsyncClient(timeout=settings.agent_timeout_seconds, follow_redirects=False) as client:
        response = await client.post('https://api.anthropic.com/v1/messages',
            headers={'x-api-key':settings.anthropic_api_key,'anthropic-version':settings.anthropic_api_version},
            json={'model':agent['model'],'max_tokens':agent['max_output_tokens'], 'system':agent['system_prompt'], 'messages':[{'role':'user','content':prompt}]})
        response.raise_for_status()
        payload = response.json()
    result = '\n'.join(x.get('text','') for x in payload.get('content',[]) if x.get('type') == 'text')
    usage = payload.get('usage',{})
    if not isinstance(usage.get('input_tokens'), int) or not isinstance(usage.get('output_tokens'),int):
        raise RuntimeError('Provider omitted usage; reservation retained')
    cost = (usage['input_tokens']*settings.claude_input_usd_per_million + usage['output_tokens']*settings.claude_output_usd_per_million)/1_000_000
    return result, cost

async def codex(agent, prompt):
    # Codex inherits its server-side login. An intentionally small environment
    # avoids exposing database and Anthropic secrets to the subprocess.
    env = {k:v for k,v in os.environ.items() if k in {'PATH','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','SYSTEMROOT','TEMP','TMP','CODEX_HOME','OPENAI_API_KEY'}}
    process = await asyncio.create_subprocess_exec(settings.codex_executable, 'exec', '--json', '--sandbox','read-only', '--skip-git-repo-check', '-c','approval_policy="never"', '-m',agent['model'], '-', cwd=settings.codex_workspace, env=env,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, limit=1024*1024)
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate((agent['system_prompt']+'\n\n'+prompt).encode()), settings.agent_timeout_seconds)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        process.kill()
        await process.wait()
        raise
    if process.returncode: raise RuntimeError('Codex exited unsuccessfully; inspect server-side CLI configuration')
    messages, usage = [], None
    for line in stdout.decode('utf-8',errors='replace').splitlines():
        try: event=json.loads(line)
        except ValueError: continue
        item=event.get('item',{})
        if event.get('type')=='item.completed' and item.get('type')=='agent_message': messages.append(item.get('text',''))
        if event.get('type')=='turn.completed': usage=event.get('usage')
    if usage is None: raise RuntimeError('Codex omitted usage; reservation retained')
    return '\n'.join(messages), (usage.get('input_tokens',0)*settings.codex_input_usd_per_million + usage.get('output_tokens',0)*settings.codex_output_usd_per_million)/1_000_000

async def execute(task_id, agent_data, prompt):
    try:
        output, cost = await (claude(agent_data,prompt) if agent_data['provider']=='claude' else codex(agent_data,prompt))
        with SessionLocal() as db:
            task=db.get(Task,task_id)
            task.output=output[:100000]
            task.cost_usd=round(cost,8)
            task.status='cancelled' if task.cancel_requested else 'completed'
            log(db,task_id,'Provider completed. Usage recorded in USD.')
            if cost > task.reserved_usd:
                cfg=db.get(Configuration,1); cfg.automation_enabled=False
                log(db,task_id,'Actual cost exceeded reservation; all automation disabled. Review provider billing caps.','warning')
            db.commit()
    except asyncio.CancelledError:
        with SessionLocal() as db:
            task=db.get(Task,task_id); task.status='cancelled'; task.cost_usd=task.reserved_usd
            log(db,task_id,'Cancelled locally. Full reservation retained because upstream usage may have accrued.','warning'); db.commit()
    except Exception as exc:
        # Do not persist raw upstream errors: they can contain credentials or request data.
        with SessionLocal() as db:
            task=db.get(Task,task_id); task.status='failed'; task.cost_usd=task.reserved_usd
            task.error='Provider request failed or timed out. Check server configuration and provider account.'
            log(db,task_id,type(exc).__name__+': '+task.error,'error'); db.commit()
    finally:
        ACTIVE.pop(task_id,None)

async def worker():
    global STOPPING
    STOPPING=False
    # A prior process may have exited after the provider began charging.
    with SessionLocal() as db:
        for task in db.scalars(select(Task).where(Task.status=='running')):
            task.status='interrupted'; task.cost_usd=task.reserved_usd
            log(db,task.id,'Worker restarted; reservation retained for interrupted request.','warning')
        db.commit()
    while not STOPPING:
        with SessionLocal() as db:
            for task in db.scalars(select(Task).where(Task.status=='running',Task.cancel_requested.is_(True))):
                if task.id in ACTIVE: ACTIVE[task.id].cancel()
            cfg=db.get(Configuration,1)
            if cfg and cfg.automation_enabled and not ACTIVE:
                task=db.scalar(select(Task).where(Task.status=='queued').order_by(Task.created_at).with_for_update(skip_locked=True).limit(1))
                if task:
                    agent=db.get(Record,task.agent_id)
                    if not agent or not agent.data.get('enabled') or not provider_ready(agent.data['provider']):
                        task.status='failed';task.error='Agent is disabled or provider is not configured.'
                        log(db,task.id,task.error,'warning');db.commit()
                    else:
                        task.status='running';log(db,task.id,'Provider request started.');db.commit()
                        ACTIVE[task.id]=asyncio.create_task(execute(task.id,dict(agent.data),task.prompt))
        await asyncio.sleep(.5)

async def shutdown():
    global STOPPING
    STOPPING=True
    pending=list(ACTIVE.values())
    for job in pending: job.cancel()
    if pending: await asyncio.gather(*pending,return_exceptions=True)
