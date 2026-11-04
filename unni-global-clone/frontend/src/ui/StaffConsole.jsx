import React,{useState} from "react";
import {ArrowLeft,CheckCircle2,ChevronRight,LockKeyhole,MessageCircle,RefreshCw,Send,ShieldAlert,X} from "lucide-react";
import "../staff-console.css";

const API=(import.meta.env.VITE_GATEWAY_BASE||"").replace(/\/$/,"");
async function staffRequest(path,token,{method="GET",data}={}){
 const response=await fetch(API+path,{
  method,credentials:"omit",cache:"no-store",
  headers:{"X-Staff-Token":token,...(data===undefined?{}:{"Content-Type":"application/json"})},
  ...(data===undefined?{}:{body:JSON.stringify(data)})
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(typeof payload.detail==="string"?payload.detail:"Operator request failed ("+response.status+")");
 return payload;
}
const fmt=value=>value?new Date(value).toLocaleString():"—";

export default function StaffConsole(){
 const[token,setToken]=useState("");
 const[authorized,setAuthorized]=useState(false);
 const[rows,setRows]=useState([]);
 const[filter,setFilter]=useState("all");
 const[selection,setSelection]=useState(null);
 const[reply,setReply]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 async function reload(key=token,chosenFilter=filter){
  const path="/inquiries/staff/queue"+(chosenFilter==="all"?"":"?status="+encodeURIComponent(chosenFilter));
  const result=await staffRequest(path,key);
  setRows(result.items||[]);
  setAuthorized(true);
 }
 async function unlock(e){
  e.preventDefault();if(!token.trim())return;
  setBusy(true);setError("");setNotice("");
  try{await reload(token.trim())}catch(e){setError(e.message);setAuthorized(false)}
  finally{setBusy(false)}
 }
 async function open(id){
  setBusy(true);setError("");setNotice("");
  try{const result=await staffRequest("/inquiries/staff/"+id,token);setSelection(result)}
  catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function refresh(){
  setBusy(true);setError("");
  try{
   await reload();
   if(selection)await open(selection.inquiry.id);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function send(e){
  e.preventDefault();if(!reply.trim()||!selection)return;
  setBusy(true);setError("");setNotice("");
  try{
   await staffRequest("/inquiries/"+selection.inquiry.id+"/staff-reply",token,{method:"POST",data:{text:reply.trim()}});
   setReply("");setNotice("Reply saved in the independent inquiry. It has not been forwarded to the original clinic.");
   const id=selection.inquiry.id;await reload();await open(id);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function closeInquiry(){
  if(!selection||!window.confirm("Close this independent inquiry? Further visitor messages will be disabled."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const id=selection.inquiry.id;
   await staffRequest("/inquiries/staff/"+id+"/close",token,{method:"POST"});
   await reload();await open(id);
   setNotice("Inquiry closed in the independent service only.");
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function changeFilter(value){
  setFilter(value);setBusy(true);setError("");setSelection(null);
  try{await reload(token,value)}catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 function logout(){setToken("");setAuthorized(false);setRows([]);setSelection(null);setReply("");setError("");setNotice("")}
 return <section className="stf-screen">
  <header className="stf-header"><div><small>INDEPENDENT SERVICE</small><h1>Consultation inbox</h1></div><LockKeyhole size={22}/></header>
  <p className="stf-warning"><ShieldAlert size={18}/> This is your separate service's inquiry database, not the original UNNI clinic's messaging or booking system. No clinic delivery or appointment confirmation is implied.</p>
  {!authorized?<form className="stf-login" onSubmit={unlock}>
    <label htmlFor="stf-token">Operator access token</label>
    <input id="stf-token" autoComplete="off" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Enter configured UNNI_STAFF_TOKEN" required/>
    <p>The access token is kept only in this page's memory. It is never stored in local storage or added to a URL. The Railway API must have UNNI_STAFF_TOKEN configured.</p>
    <button type="submit" disabled={busy||!token.trim()}>{busy?"Checking…":"Open inbox"}</button>
   </form>:
   <><div className="stf-controls"><select value={filter} aria-label="Filter inquiries" onChange={e=>changeFilter(e.target.value)} disabled={busy}>
      <option value="all">All inquiries</option><option value="pending_assignment">Awaiting reply</option><option value="staff_replied">Staff replied</option><option value="closed">Closed</option>
    </select><button disabled={busy} onClick={refresh}><RefreshCw size={16}/> Refresh</button><button onClick={logout}><X size={16}/> Sign out</button></div>
    {selection?<div className="stf-detail">
      <button className="stf-back" onClick={()=>{setSelection(null);setReply("");setNotice("")}}><ArrowLeft size={16}/> All inquiries</button>
      <h2>{selection.inquiry.event_name}</h2>
      <div className="stf-record"><span>Status: <b>{selection.inquiry.status}</b></span>
       <span>Clinic: {selection.inquiry.clinic_name||"—"} {selection.inquiry.clinic_id?"("+selection.inquiry.clinic_id+")":""}</span>
       <span>Selected option: {selection.inquiry.option_name||"—"} {selection.inquiry.option_index?"#"+selection.inquiry.option_index:""}</span>
       <span>Original option UUID: {selection.inquiry.source_option_id||"Not verified"}</span>
       <span>Contact ({selection.inquiry.contact_method}): <b>{selection.inquiry.contact_value}</b></span>
       <span>Preferred date: {selection.inquiry.preferred_date||"—"} {selection.inquiry.preferred_time||""}</span>
       <span>Updated: {fmt(selection.inquiry.updated_at)}</span>
      </div>
      <h3>Messages</h3><div className="stf-thread" aria-live="polite">{(selection.messages||[]).map(m=>
       <article key={m.id} className={"stf-message "+m.role}><small>{m.role==="staff"?"Your operator":"Visitor"} · {fmt(m.created_at)}</small><p>{m.content}</p></article>)}</div>
      {selection.inquiry.status!=="closed"&&<form className="stf-reply" onSubmit={send}>
       <label htmlFor="stf-reply-text">Reply from independent operator</label>
       <textarea id="stf-reply-text" maxLength={1000} rows={3} required value={reply} onChange={e=>setReply(e.target.value)}/>
       <button disabled={busy||!reply.trim()} type="submit"><Send size={16}/> Save reply</button>
      </form>}
      {selection.inquiry.status!=="closed"&&<button className="stf-close" disabled={busy} onClick={closeInquiry}>Close inquiry</button>}
    </div>:
     <div className="stf-list"><h2>{rows.length} inquiries (maximum 50 displayed)</h2>
       {rows.map(item=><button className="stf-item" key={item.id} onClick={()=>open(item.id)} disabled={busy}>
        <MessageCircle size={19}/><span><b>{item.event_name}</b><small>{item.option_name||item.clinic_name||"General inquiry"}</small><small>{item.status} · {fmt(item.updated_at)}</small></span><ChevronRight size={17}/>
       </button>)}
       {!rows.length&&<p className="stf-empty">No inquiries match this filter.</p>}
     </div>}
   </>}
  {notice&&<p role="status" className="stf-notice"><CheckCircle2 size={16}/>{notice}</p>}
  {error&&<p role="alert" className="stf-error">{error}</p>}
 </section>;
