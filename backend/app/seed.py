from sqlalchemy import select
from .models import Record, Configuration

def seed(db):
    if not db.get(Configuration, 1): db.add(Configuration(id=1, monthly_budget_usd=50, automation_enabled=False))
    if db.scalar(select(Record).where(Record.kind == 'pricing').limit(1)) is None:
        for category in ['web','assistants','automation','saas']:
            for tier, price in [('start',299),('growth',799),('custom',1999)]:
                db.add(Record(kind='pricing', data={'category':category,'tier':tier,'name':tier.upper(),'price_usd':price,'interval':'month' if category == 'saas' else 'once','description':'Предварительная стоимость. Объём и итоговая цена согласуются после брифа.','features':['Обсуждение задачи','Настройка решения','Передача и поддержка запуска'],'active':True}))
    if db.scalar(select(Record).where(Record.kind == 'services').limit(1)) is None:
        for slug, title, description, image in [
            ('web','Web development','Сайты и приложения с подключением CRM.','web'),
            ('automation','AI automation','Связываем заявки, процессы и бизнес-системы.','automation'),
            ('assistants','AI assistants','Ассистенты для обработки обращений и записи.','assistant'),
            ('leadgen','Lead generation','Инструменты поиска и квалификации лидов.','portfolio'),
            ('saas','SaaS products','Продукты по подписке для повседневных процессов.','products')]:
            db.add(Record(kind='services',data={'slug':slug,'title':title,'description':description,'image':f'/assets/images/{image}.webp','features':[],'active':True}))
    if db.scalar(select(Record).where(Record.kind == 'products').limit(1)) is None:
        for slug,title,description in [('adminbot','AI Administrator','Запись, ответы и заявки в одном интерфейсе.'),('leadfinder','AI Lead Finder','Поиск и квалификация потенциальных клиентов.'),('proposal','Proposal Builder','Подготовка коммерческого предложения по брифу.')]:
            db.add(Record(kind='products',data={'slug':slug,'title':title,'description':description,'image':'/assets/images/products.webp','status':'soon','url':f'/products/{slug}/','active':True}))
    db.commit()
