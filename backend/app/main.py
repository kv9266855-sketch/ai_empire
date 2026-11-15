import asyncio
import io
import secrets
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
from collections import Counter, defaultdict
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError
from sqlalchemy import select, func, text, delete
from .config import settings, ROOT
from .db import get_db, SessionLocal, engine
from .models import Owner, AuthSession, Lead, Record, Configuration, Task, TaskLog, Audit, now
from .schemas import LoginIn, LeadIn, LeadPatch, TaskIn, SettingsIn, RESOURCE_SCHEMAS
from .security import passwords, DUMMY_HASH, owner_session, enforce_rate, ip_hash, token_hash, audit
from . import agents

def serialize(row):
    if isinstance(row,Record):
        result={'id':row.id,**row.data,'created_at':row.created_at.isoformat(),'updated_at':row.updated_at.isoformat()}
        if row.kind=='agents': result['configured']=agents.provider_ready(row.data['provider'])
        return result
    return {c.name: (getattr(row,c.name).isoformat() if hasattr(getattr(row,c.name),'isoformat') else getattr(row,c.name)) for c in row.__table__.columns if c.name not in {'password_hash','ip_hash','consent_at'}}

def valid_data(kind,data):
    schema=RESOURCE_SCHEMAS.get(kind)
    if not schema: raise HTTPException(404,'unknown_resource')
    try: return schema.model_validate(data).model_dump(mode='json')
    except ValidationError as exc: raise HTTPException(422,exc.errors(include_context=False))

@asynccontextmanager
async def lifespan(app):
    if settings.environment != 'test' and settings.database_url.startswith('sqlite'):
        raise RuntimeError('SQLite is permitted only in tests. Configure PostgreSQL DATABASE_URL.')
    if settings.environment == 'production' and (not settings.cookie_secure or len(settings.ip_hash_salt)<32):
        raise RuntimeError('Production requires COOKIE_SECURE=true and IP_HASH_SALT with at least 32 characters.')
    with SessionLocal() as db: db.execute(text('SELECT 1'))
    job=asyncio.create_task(agents.worker()) if settings.enable_worker else None
    yield
    await agents.shutdown()
    if job:
        job.cancel()
        await asyncio.gather(job,return_exceptions=True)

app=FastAPI(title='AI EMPIRE API',version='3.0.0',lifespan=lifespan,docs_url='/api/docs' if settings.environment!='production' else None,redoc_url=None)
app.add_middleware(CORSMiddleware,allow_origins=settings.origins,allow_credentials=True,allow_methods=['GET','POST','PATCH','DELETE','OPTIONS'],allow_headers=['Content-Type','X-CSRF-Token'])

@app.middleware('http')
async def perimeter(request,call_next):
    origin=request.headers.get('origin')
    if request.url.path.startswith('/api/') and origin and origin.rstrip('/') not in settings.origins:
        return JSONResponse({'error':'origin_not_allowed'},status_code=403)
    if request.method in {'POST','PATCH','PUT'}:
        max_size=5*1024*1024 if request.url.path=='/api/v1/admin/uploads' else 32768
        try: content_length=int(request.headers.get('content-length','0'))
        except ValueError: return JSONResponse({'error':'invalid_content_length'},status_code=400)
        if content_length>max_size: return JSONResponse({'error':'body_too_large'},status_code=413)
        # Bound streamed/chunked input as well as Content-Length.
        size=0; chunks=[]
        async for chunk in request.stream():
            size+=len(chunk)
            if size>max_size: return JSONResponse({'error':'body_too_large'},status_code=413)
            chunks.append(chunk)
        request._body=b''.join(chunks)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    response.headers['X-Frame-Options']='DENY'
    response.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    if settings.cookie_secure: response.headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains'
    if request.url.path.startswith(('/api/v1/admin','/api/v1/auth','/admin')): response.headers['Cache-Control']='no-store'
    return response

@app.exception_handler(RequestValidationError)
async def validation_error(request,exc):
    errors={}
    for e in exc.errors():
        name=str(e['loc'][-1]); kind=e['type']
        errors[name]='consent_required' if name=='consent' else ('required' if kind=='missing' else 'too_short' if kind=='string_too_short' else 'too_long' if kind=='string_too_long' else 'invalid')
    return JSONResponse({'errors':errors},status_code=422)

@app.get('/health')
def health(db=Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'status':'ok','database':'postgresql' if db.bind.dialect.name=='postgresql' else 'test-only-sqlite'}

@app.post('/api/v1/auth/login')
def login(body:LoginIn,request:Request,response:Response,db=Depends(get_db)):
    enforce_rate(db,'login:'+ip_hash(request),[(900,8),(86400,100)])
    owner=db.scalar(select(Owner).where(Owner.email==body.email.lower()))
    try: correct=passwords.verify(body.password,owner.password_hash if owner else DUMMY_HASH)
    except Exception: correct=False
    if not owner or not correct:
        audit(db,body.email.lower(),'login_failed');db.commit()
        raise HTTPException(401,'invalid_credentials')
    token=secrets.token_urlsafe(48);csrf=secrets.token_urlsafe(32)
    old=request.cookies.get('empire_session')
    if old: db.execute(delete(AuthSession).where(AuthSession.id==token_hash(old)))
    db.execute(delete(AuthSession).where(AuthSession.expires_at<now()))
    db.add(AuthSession(id=token_hash(token),owner_id=owner.id,csrf=csrf,expires_at=now()+timedelta(hours=settings.session_hours)))
    audit(db,owner.email,'login');db.commit()
    response.set_cookie('empire_session',token,max_age=settings.session_hours*3600,httponly=True,secure=settings.cookie_secure,samesite='strict',path='/')
    return {'user':{'id':owner.id,'email':owner.email,'role':owner.role},'csrf_token':csrf}

@app.get('/api/v1/auth/me')
def me(auth=Depends(owner_session)):
    owner,session=auth
    return {'user':{'id':owner.id,'email':owner.email,'role':owner.role},'csrf_token':session.csrf}

@app.post('/api/v1/auth/logout',status_code=204)
def logout(response:Response,auth=Depends(owner_session),db=Depends(get_db)):
    db.delete(auth[1]);audit(db,auth[0].email,'logout');db.commit()
    response.delete_cookie('empire_session',path='/')

@app.post('/api/v1/leads',status_code=201)
def submit_lead(body:LeadIn,request:Request,db=Depends(get_db)):
    enforce_rate(db,'lead:'+ip_hash(request),[(600,5),(86400,30)])
    if body.website or body.elapsed_ms<3000: return {'id':str(uuid4()),'status':'received'}
    lead=Lead(**body.model_dump(exclude={'consent','website','elapsed_ms'}),ip_hash=ip_hash(request))
    db.add(lead);db.commit()
    return {'id':lead.id,'status':'received'}

@app.get('/api/v1/public/bootstrap')
def bootstrap(db=Depends(get_db)):
    payload={k:[] for k in ['services','pricing','portfolio','products']}
    payload['content']={l:{} for l in ['all','ru','ua','en']}
    public_kinds=['services','pricing','portfolio','products','content']
    for row in db.scalars(select(Record).where(Record.kind.in_(public_kinds)).order_by(Record.created_at)):
        if row.kind=='content': payload['content'][row.data['lang']][row.data['key']]=row.data['value']
        elif row.data.get('active',True): payload[row.kind].append(serialize(row))
    return payload

@app.get('/api/v1/admin/overview')
def overview(auth=Depends(owner_session),db=Depends(get_db)):
    income=db.scalars(select(Record).where(Record.kind=='finance')).all()
    agent_rows=db.scalars(select(Record).where(Record.kind=='agents')).all()
    return {'leads':db.scalar(select(func.count()).select_from(Lead)), 'projects':db.scalar(select(func.count()).select_from(Record).where(Record.kind=='projects')),
        'revenue_usd':round(sum(r.data['amount_usd'] for r in income if r.data['kind']=='income'),2),
        'ai_spend_usd':round(agents.spent(db),4), 'active_agents':sum(bool(r.data.get('enabled')) for r in agent_rows),
        'recent_leads':[serialize(r) for r in db.scalars(select(Lead).order_by(Lead.created_at.desc()).limit(5))],
        'recent_tasks':[serialize(r) for r in db.scalars(select(Task).order_by(Task.created_at.desc()).limit(5))]}

@app.get('/api/v1/admin/analytics')
def analytics(auth=Depends(owner_session),db=Depends(get_db)):
    leads=db.scalars(select(Lead)).all();days=Counter(r.created_at.date().isoformat() for r in leads);statuses=Counter(r.status for r in leads);months=defaultdict(float)
    for row in db.scalars(select(Record).where(Record.kind=='finance')):
        if row.data['kind']=='income':months[row.data['occurred_on'][:7]]+=row.data['amount_usd']
    return {'leads_by_day':[{'date':d,'count':days[d]} for d in sorted(days)],'leads_by_status':[{'status':s,'count':n} for s,n in statuses.items()], 'revenue_by_month':[{'month':m,'amount':round(months[m],2)} for m in sorted(months)]}

@app.get('/api/v1/admin/settings')
def get_settings(auth=Depends(owner_session),db=Depends(get_db)):
    c=db.get(Configuration,1)
    return {'monthly_budget_usd':c.monthly_budget_usd,'automation_enabled':c.automation_enabled,'public_theme':c.public_theme}

@app.patch('/api/v1/admin/settings')
def patch_settings(body:SettingsIn,auth=Depends(owner_session),db=Depends(get_db)):
    cfg=db.scalar(select(Configuration).where(Configuration.id==1).with_for_update())
    for key,value in body.model_dump(exclude_none=True).items():setattr(cfg,key,value)
    if not cfg.automation_enabled: cancel_all(db)
    audit(db,auth[0].email,'settings_updated');db.commit()
    return {'monthly_budget_usd':cfg.monthly_budget_usd,'automation_enabled':cfg.automation_enabled,'public_theme':cfg.public_theme}

def cancel_all(db,agent_id=None):
    q=select(Task).where(Task.status.in_(['queued','running']))
    if agent_id:q=q.where(Task.agent_id==agent_id)
    for task in db.scalars(q):
        task.cancel_requested=True
        if task.status=='queued':task.status='cancelled'
        agents.log(db,task.id,'Cancellation requested by owner.','warning')

@app.post('/api/v1/admin/tasks/stop-all')
def stop_all(auth=Depends(owner_session),db=Depends(get_db)):
    cfg=db.scalar(select(Configuration).where(Configuration.id==1).with_for_update());cfg.automation_enabled=False
    cancel_all(db);audit(db,auth[0].email,'tasks_stop_all');db.commit()
    return {'status':'stopped','automation_enabled':False}

@app.post('/api/v1/admin/tasks/{task_id}/cancel')
def cancel_task(task_id:str,auth=Depends(owner_session),db=Depends(get_db)):
    task=db.get(Task,task_id)
    if not task:raise HTTPException(404,'not_found')
    if task.status in {'queued','running'}:
        task.cancel_requested=True
        if task.status=='queued':task.status='cancelled'
        agents.log(db,task.id,'Cancellation requested by owner.','warning')
    audit(db,auth[0].email,'task_cancelled',task.id);db.commit()
    return serialize(task)

@app.get('/api/v1/admin/tasks/{task_id}/logs')
def task_logs(task_id:str,auth=Depends(owner_session),db=Depends(get_db)):
    if not db.get(Task,task_id):raise HTTPException(404,'not_found')
    return {'items':[serialize(r) for r in db.scalars(select(TaskLog).where(TaskLog.task_id==task_id).order_by(TaskLog.created_at).limit(200))]}

@app.post('/api/v1/admin/agents/{agent_id}/{action}')
def control_agent(agent_id:str,action:str,auth=Depends(owner_session),db=Depends(get_db)):
    if action not in {'start','stop'}:raise HTTPException(404,'not_found')
    row=db.get(Record,agent_id)
    if not row or row.kind!='agents':raise HTTPException(404,'not_found')
    if action=='start' and not agents.provider_ready(row.data['provider']):raise HTTPException(409,'provider_not_configured')
    row.data={**row.data,'enabled':action=='start'}
    if action=='stop':cancel_all(db,agent_id)
    audit(db,auth[0].email,'agent_'+action,agent_id);db.commit()
    return serialize(row)

@app.post('/api/v1/admin/uploads',status_code=201)
async def upload(file:UploadFile=File(...),auth=Depends(owner_session),db=Depends(get_db)):
    raw=await file.read(5*1024*1024+1)
    if len(raw)>5*1024*1024:raise HTTPException(413,'image_too_large')
    try:
        img=Image.open(io.BytesIO(raw))
        if img.format not in {'JPEG','PNG','WEBP','AVIF'} or img.width*img.height>25000000:raise ValueError()
        img.load();img.thumbnail((2400,2400));img=img.convert('RGB')
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError):raise HTTPException(422,'invalid_image')
    target=Path(settings.uploads_dir);target.mkdir(parents=True,exist_ok=True)
    name=secrets.token_hex(16)+'.webp';img.save(target/name,'WEBP',quality=84,method=4)
    audit(db,auth[0].email,'image_uploaded',name);db.commit()
    return {'url':'/uploads/'+name,'width':img.width,'height':img.height}

@app.get('/api/v1/admin/{kind}')
def list_resource(kind:str,limit:int=Query(100,ge=1,le=200),offset:int=Query(0,ge=0),search:str=Query('',max_length=100),auth=Depends(owner_session),db=Depends(get_db)):
    model={'leads':Lead,'crm':Lead,'tasks':Task,'audit':Audit}.get(kind,Record)
    if model==Record and kind not in RESOURCE_SCHEMAS:raise HTTPException(404,'unknown_resource')
    q=select(model)
    if model==Record:q=q.where(Record.kind==kind)
    if search and model==Lead:q=q.where(Lead.name.ilike('%'+search+'%') | Lead.contact.ilike('%'+search+'%'))
    total=db.scalar(select(func.count()).select_from(q.subquery()))
    return {'items':[serialize(r) for r in db.scalars(q.order_by(model.created_at.desc()).offset(offset).limit(limit))],'total':total}

@app.post('/api/v1/admin/{kind}',status_code=201)
def create_resource(kind:str,body:dict,auth=Depends(owner_session),db=Depends(get_db)):
    if kind=='tasks':
        try:data=TaskIn.model_validate(body)
        except ValidationError as exc:raise HTTPException(422,exc.errors(include_context=False))
        cfg=db.scalar(select(Configuration).where(Configuration.id==1).with_for_update())
        if not cfg.automation_enabled:raise HTTPException(409,'automation_disabled')
        agent=db.get(Record,data.agent_id)
        if not agent or agent.kind!='agents':raise HTTPException(404,'agent_not_found')
        if not agent.data['enabled'] or not agents.provider_ready(agent.data['provider']):raise HTTPException(409,'agent_not_ready')
        if data.max_cost_usd+1e-9<agents.minimum_reservation(agent.data,data.prompt):raise HTTPException(422,'reservation_too_small_for_token_limit')
        if agents.spent(db)+data.max_cost_usd>cfg.monthly_budget_usd or agents.spent(db,agent.id)+data.max_cost_usd>agent.data['monthly_budget_usd']:raise HTTPException(409,'budget_exceeded')
        row=Task(agent_id=agent.id,prompt=data.prompt,reserved_usd=data.max_cost_usd)
        db.add(row);db.flush();agents.log(db,row.id,'Task queued; budget reserved.')
    else:
        data=valid_data(kind,body)
        check_unique(db,kind,data)
        if kind=='agents' and data['enabled'] and not agents.provider_ready(data['provider']):raise HTTPException(409,'provider_not_configured')
        row=Record(kind=kind,data=data);db.add(row);db.flush()
    audit(db,auth[0].email,kind+'_created',row.id);db.commit();return serialize(row)

def check_unique(db,kind,data,exclude=None):
    fields={'content':['lang','key'],'pricing':['category','tier'],'products':['slug'],'services':['slug']}.get(kind)
    if fields:
        # Catalog writes share a lock so uniqueness is consistent across API workers.
        db.scalar(select(Configuration).where(Configuration.id==1).with_for_update())
        for row in db.scalars(select(Record).where(Record.kind==kind)):
            if row.id!=exclude and all(row.data[f]==data[f] for f in fields):raise HTTPException(409,'duplicate_record')

@app.patch('/api/v1/admin/{kind}/{record_id}')
def update_resource(kind:str,record_id:str,body:dict,auth=Depends(owner_session),db=Depends(get_db)):
    if kind in {'leads','crm'}:
        row=db.get(Lead,record_id)
        if not row:raise HTTPException(404,'not_found')
        try:data=LeadPatch.model_validate(body).model_dump(exclude_none=True)
        except ValidationError as exc:raise HTTPException(422,exc.errors(include_context=False))
        for key,value in data.items():setattr(row,key,value)
    else:
        if kind not in RESOURCE_SCHEMAS:raise HTTPException(404,'unknown_resource')
        row=db.get(Record,record_id)
        if not row or row.kind!=kind:raise HTTPException(404,'not_found')
        data=valid_data(kind,{**row.data,**body});check_unique(db,kind,data,record_id)
        if kind=='agents':
            if data['enabled'] and not agents.provider_ready(data['provider']):raise HTTPException(409,'provider_not_configured')
            if not data['enabled']:cancel_all(db,record_id)
        row.data=data
    audit(db,auth[0].email,kind+'_updated',record_id);db.commit();return serialize(row)

@app.delete('/api/v1/admin/{kind}/{record_id}',status_code=204)
def delete_resource(kind:str,record_id:str,auth=Depends(owner_session),db=Depends(get_db)):
    if kind in {'leads','crm'}:row=db.get(Lead,record_id)
    elif kind in RESOURCE_SCHEMAS:
        row=db.get(Record,record_id)
        if row and row.kind!=kind:row=None
    else:raise HTTPException(404,'unknown_resource')
    if not row:raise HTTPException(404,'not_found')
    if kind=='agents' and db.scalar(select(Task.id).where(Task.agent_id==record_id).limit(1)):raise HTTPException(409,'agent_has_task_history_disable_instead')
    db.delete(row);audit(db,auth[0].email,kind+'_deleted',record_id);db.commit()

@app.get('/js/runtime.js')
def runtime(db=Depends(get_db)):
    # Overrides the static stub: tells the page the API exists and which public theme is active.
    import json
    c=db.get(Configuration,1)
    theme=c.public_theme if c and c.public_theme in {'winter','classic'} else 'winter'
    body='window.SITE_RUNTIME='+json.dumps({'api':True,'theme':theme})+';'
    return Response(body,media_type='application/javascript',headers={'Cache-Control':'no-cache'})

@app.get('/')
def homepage(): return FileResponse(ROOT/'index.html')

@app.get('/admin')
@app.get('/admin/')
def admin_page():return FileResponse(ROOT/'admin'/'index.html')

@app.get('/robots.txt')
def robots():
    body='User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n'
    if settings.public_base_url:body+='Sitemap: '+settings.public_base_url.rstrip('/')+'/sitemap.xml\n'
    return Response(body,media_type='text/plain')

@app.get('/sitemap.xml')
def sitemap():
    if not settings.public_base_url:raise HTTPException(404,'Configure PUBLIC_BASE_URL for sitemap')
    from xml.sax.saxutils import escape
    paths=['/']+[f'/{d.relative_to(ROOT).as_posix().removesuffix("index.html")}' for name in ['services','products','portfolio'] for d in (ROOT/name).glob('**/index.html')]
    return Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+escape(settings.public_base_url.rstrip('/')+p)+'</loc></url>' for p in paths)+'</urlset>',media_type='application/xml')

# Only named public directories are exposed, never the project root, .env, or backend.
for directory in ['css','js','assets','services','products','portfolio','admin']:
    app.mount('/'+directory,StaticFiles(directory=ROOT/directory,html=True,check_dir=False),name=directory)
Path(settings.uploads_dir).mkdir(parents=True,exist_ok=True)
app.mount('/uploads',StaticFiles(directory=settings.uploads_dir),name='uploads')
