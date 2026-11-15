import argparse
import getpass
import re
from sqlalchemy import select, delete
from .db import SessionLocal
from .models import Owner, AuthSession
from .security import passwords
from .seed import seed

def main():
    parser=argparse.ArgumentParser(description='AI EMPIRE server administration')
    parser.add_argument('command',choices=['seed','create-owner','reset-password'])
    parser.add_argument('--email')
    args=parser.parse_args()
    with SessionLocal() as db:
        if args.command=='seed':seed(db);print('Catalog seeded. No customer or financial data was created.');return
        email=(args.email or input('Owner email: ')).strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):parser.error('A valid email is required')
        owner=db.scalar(select(Owner).where(Owner.email==email))
        if args.command=='create-owner' and owner:parser.error('Owner already exists. Use reset-password.')
        if args.command=='reset-password' and not owner:parser.error('Owner does not exist.')
        password=getpass.getpass('Password (at least 14 characters): ')
        if len(password)<14 or len(password)>256:parser.error('Password must contain 14–256 characters')
        if password!=getpass.getpass('Repeat password: '):parser.error('Passwords differ')
        if owner:
            owner.password_hash=passwords.hash(password)
            db.execute(delete(AuthSession).where(AuthSession.owner_id==owner.id))
        else:db.add(Owner(email=email,password_hash=passwords.hash(password)))
        db.commit();print('Owner saved. Sign in at /admin. Existing sessions revoked after a password reset.')

if __name__=='__main__':main()
