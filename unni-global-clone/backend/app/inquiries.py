"""First-party consultation-interest workflow for the user's INDEPENDENT service.

This is NOT the official Unni provider consultation/booking API.
No clinic delivery, medical diagnosis, appointment confirmation or payment occurs.
Access tokens are never stored in plaintext.
"""
from __future__ import annotations
import hashlib
import os
import re
import secrets
import uuid
from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

router=APIRouter(prefix="/inquiries",tags=["independent_inquiries"])

INQUIRY_SCHEMA="""
CREATE SCHEMA IF NOT EXISTS unni_clone;
CREATE TABLE IF NOT EXISTS unni_clone.inquiries (
 id UUID PRIMARY KEY,
 secret_hash TEXT UNIQUE NOT NULL,
 event_id TEXT,
 option_index INTEGER,
 source_option_id TEXT,
 clinic_id TEXT,
 clinic_name TEXT,
 event_name TEXT NOT NULL,
 option_name TEXT,
 contact_method TEXT NOT NULL,
 contact_value TEXT NOT NULL,
 language TEXT NOT NULL DEFAULT 'en',
 preferred_date DATE,
 preferred_time TIME,
 status TEXT NOT NULL DEFAULT 'pending_assignment',
 consent_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS unni_clone.inquiry_messages (
 id BIGSERIAL PRIMARY KEY,
 inquiry_id UUID NOT NULL REFERENCES unni_clone.inquiries(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('visitor','staff')),
 content TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unni_inquiry_messages
  ON unni_clone.inquiry_messages(inquiry_id, created_at);
"""
class CreateInquiry(BaseModel):
  event_id: str|None = Field(default=None,min_length=1,max_length=30,pattern=r"^[0-9]+$")
  event_name: str = Field(min_length=1,max_length=250)
  option_index: int|None = Field(default=None,ge=1,le=200)
  option_name: str|None = Field(default=None,max_length=250)
  source_option_id: str|None = Field(default=None,max_length=80)
  clinic_id: str|None = Field(default=None,max_length=50)
  clinic_name: str|None = Field(default=None,max_length=150)
  contact_method: Literal["email","phone","wechat","alipay"]
  contact_value: str=Field(min_length=4,max_length=180)
  language: Literal["en","ko","zh-CN","zh-TW","ja"] = "en"
  message: str=Field(min_length=1,max_length=1000)
  consent: bool
  @field_validator("contact_value")
  @classmethod
  def validate_contact(cls,v):
    if any(x in v for x in ("\n","\r","\x00")):
      raise ValueError("Invalid contact")
    return v.strip()

class AddMessage(BaseModel):
  text: str=Field(min_length=1,max_length=1000)

class PreferredDate(BaseModel):
  preferred_date: date = Field(alias="date")
  preferred_time: time|None = Field(default=None,alias="time")
  @field_validator("preferred_date")
  @classmethod
  def future_only(cls,v):
    if v<datetime.now(timezone.utc).date():
      raise ValueError("Date is in the past")
    return v

def pool_of(request):
  p=getattr(request.app.state,"pg",None)
  if p is None:
    raise HTTPException(status_code=503,detail="Storage unavailable")
  return p

def secret_digest(secret):
  return hashlib.sha256(secret.encode("utf-8")).hexdigest()

async def resolve(request,inquiry_id:uuid.UUID,token:str|None):
  if not token or len(token)>160:
    raise HTTPException(status_code=401,detail="Inquiry access token required")
  pool=pool_of(request)
  record=await pool.fetchrow("""SELECT id,event_id,option_index,source_option_id,clinic_id,clinic_name,
     event_name,option_name,contact_method,language,preferred_date,preferred_time,
     status,created_at,updated_at FROM unni_clone.inquiries
     WHERE id=$1 AND secret_hash=$2""",inquiry_id,secret_digest(token))
  if not record:
    raise HTTPException(status_code=404,detail="Inquiry not found")
  return pool,record

@router.post("",status_code=201)
async def create_inquiry(payload:CreateInquiry,request:Request):
  if not payload.consent:
    raise HTTPException(status_code=400,detail="Explicit data processing consent required")
  # A new token is disclosed once to the visitor and stored only as a hash.
  token=secrets.token_urlsafe(32)
  record_id=uuid.uuid4()
  now=datetime.now(timezone.utc)
  pool=pool_of(request)
  async with pool.acquire() as conn:
    async with conn.transaction():
      await conn.execute("""INSERT INTO unni_clone.inquiries
       (id,secret_hash,event_id,option_index,source_option_id,clinic_id,clinic_name,
        event_name,option_name,contact_method,contact_value,language,consent_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
        record_id,secret_digest(token),payload.event_id,payload.option_index,
        payload.source_option_id,payload.clinic_id,payload.clinic_name,
        payload.event_name,payload.option_name,payload.contact_method,payload.contact_value,payload.language,now)
      await conn.execute("""INSERT INTO unni_clone.inquiry_messages
           (inquiry_id,role,content) VALUES ($1,'visitor',$2)""",
           record_id,payload.message)
  return {"id":str(record_id),"token":token,"status":"pending_assignment",
          "clinic_not_notified":True,"appointment_confirmed":False,
          "message":"Received by independent UNNI mobile preview. Not sent to the original clinic."}

@router.get("/{inquiry_id}")
async def inquiry_status(inquiry_id:uuid.UUID,request:Request,
                         x_inquiry_token:str|None=Header(default=None)):
  pool,row=await resolve(request,inquiry_id,x_inquiry_token)
  messages=await pool.fetch("""SELECT id,role,content,created_at
        FROM unni_clone.inquiry_messages WHERE inquiry_id=$1 ORDER BY created_at,id""",inquiry_id)
  return {"inquiry":dict(row),"messages":[dict(m) for m in messages],
          "clinic_not_notified":row["status"]=="pending_assignment",
          "appointment_confirmed":False}

@router.delete("/{inquiry_id}")
async def delete_inquiry(inquiry_id:uuid.UUID,request:Request,
                         x_inquiry_token:str|None=Header(default=None)):
  pool,row=await resolve(request,inquiry_id,x_inquiry_token)
  await pool.execute("DELETE FROM unni_clone.inquiries WHERE id=$1",inquiry_id)
  return {"ok":True,"deleted":True}

@router.post("/{inquiry_id}/messages",status_code=201)
async def add_message(inquiry_id:uuid.UUID,payload:AddMessage,request:Request,
                      x_inquiry_token:str|None=Header(default=None)):
  pool,row=await resolve(request,inquiry_id,x_inquiry_token)
  if row["status"] in ("closed","cancelled"):
    raise HTTPException(status_code=409,detail="Inquiry closed")
  await pool.execute("""INSERT INTO unni_clone.inquiry_messages
       (inquiry_id,role,content) VALUES ($1,'visitor',$2)""",inquiry_id,payload.text)
  return {"ok":True,"status":row["status"],"not_delivered_to_clinic":True}

@router.post("/{inquiry_id}/preferred-time")
async def preferred_time(inquiry_id:uuid.UUID,payload:PreferredDate,request:Request,
                         x_inquiry_token:str|None=Header(default=None)):
  pool,row=await resolve(request,inquiry_id,x_inquiry_token)
  await pool.execute("""UPDATE unni_clone.inquiries
       SET preferred_date=$2,preferred_time=$3,updated_at=now()
       WHERE id=$1""",inquiry_id,payload.preferred_date,payload.preferred_time)
  return {"ok":True,"status":"preference_recorded",
          "appointment_confirmed":False,"clinic_not_notified":True}

class StaffMessage(BaseModel):
  text:str=Field(min_length=1,max_length=1000)

@router.post("/{inquiry_id}/staff-reply")
async def staff_reply(inquiry_id:uuid.UUID,payload:StaffMessage,request:Request,
                     x_staff_token:str|None=Header(default=None)):
  expected=os.getenv("UNNI_STAFF_TOKEN")
  if not expected:
    raise HTTPException(status_code=503,detail="Staff integration is not configured")
  if not x_staff_token or not secrets.compare_digest(x_staff_token,expected):
    raise HTTPException(status_code=403,detail="Not authorized")
  pool=pool_of(request)
  exists=await pool.fetchval("SELECT true FROM unni_clone.inquiries WHERE id=$1",inquiry_id)
  if not exists:raise HTTPException(status_code=404,detail="Inquiry not found")
  async with pool.acquire() as conn:
    async with conn.transaction():
      await conn.execute("""INSERT INTO unni_clone.inquiry_messages
        (inquiry_id,role,content) VALUES ($1,'staff',$2)""",inquiry_id,payload.text)
      await conn.execute("""UPDATE unni_clone.inquiries SET status='staff_replied',
        updated_at=now() WHERE id=$1""",inquiry_id)
  return {"ok":True,"status":"staff_replied"}
