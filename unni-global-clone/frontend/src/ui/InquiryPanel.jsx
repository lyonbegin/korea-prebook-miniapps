import React,{useEffect,useRef,useState} from "react";
import {ArrowRight,CalendarDays,CheckCircle2,ChevronRight,Clock3,MessageCircle,RefreshCw,Send,ShieldAlert,Trash2,X} from "lucide-react";
import "../inquiries.css";
const STORE="unni_independent_inquiries_v1";
const api=(import.meta.env.VITE_GATEWAY_BASE||"").replace(/\/$/,"");
const safeRead=()=>{try{const v=JSON.parse(localStorage.getItem(STORE)||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const saveAll=items=>localStorage.setItem(STORE,JSON.stringify(items.slice(0,50)));
async function call(path,{method="GET",token="",data}={}){
 const r=await fetch(api+path,{method,headers:{"Content-Type":"application/json",...(token?{"X-Inquiry-Token":token}:{})},
  body:data===undefined?undefined:JSON.stringify(data),credentials:"omit"});
 const response=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(typeof response.detail==="string"?response.detail:"Request failed ("+r.status+")");
 return response;
}
function StatusView({item,onClose,onRemoved}){
 const[data,setData]=useState(null),[error,setError]=useState(""),[sending,setSending]=useState(false),[message,setMessage]=useState("");
 const[day,setDay]=useState(""),[time,setTime]=useState(""),[notice,setNotice]=useState("");
 const refresh=async()=>{try{const result=await call("/inquiries/"+item.id,{token:item.token});setData(result);setError("")}catch(e){setError(e.message)}};
 useEffect(()=>{
   refresh();
   const timer=window.setInterval(()=>{if(document.visibilityState==="visible")refresh()},15000);
   const onFocus=()=>refresh();
   window.addEventListener("focus",onFocus);
   return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)};
 },[item.id]);
 async function submitMessage(e){e.preventDefault();if(!message.trim())return;setSending(true);setNotice("");
   try{await call("/inquiries/"+item.id+"/messages",{method:"POST",token:item.token,data:{text:message.trim()}});
     setMessage("");setNotice("Saved to your inquiry; not yet delivered to the clinic.");await refresh()}
   catch(e){setError(e.message)}finally{setSending(false)}
 }
 async function submitTime(e){e.preventDefault();if(!day)return;setSending(true);
   try{await call("/inquiries/"+item.id+"/preferred-time",{method:"POST",token:item.token,data:{date:day,time:time||null}});
     setNotice("Preferred time saved. This is not a confirmed appointment.");await refresh()}
   catch(e){setError(e.message)}finally{setSending(false)}
 }
 async function deleteRecord(){if(!confirm("Permanently delete your independent inquiry and messages?"))return;
   try{await call("/inquiries/"+item.id,{method:"DELETE",token:item.token});saveAll(safeRead().filter(x=>x.id!==item.id));onRemoved?.();onClose?.();}
   catch(e){setError(e.message)}
 }
 return <div className="iq-status">
  <div className="iq-status-h"><CheckCircle2 size={23}/><div><strong>Received by this independent service</strong><small>Not sent to the original UNNI clinic. No booking has been confirmed.</small></div></div>
  <div className="iq-record"><b>Reference: {item.id.slice(0,8)}</b><span>Status: {data?.inquiry?.status||"Loading"}</span><span>Treatment: {data?.inquiry?.event_name||item.title||"—"}</span><span>Option: {data?.inquiry?.option_name||"Not selected"}</span></div>
  <div className="iq-messages-head"><h3>Messages</h3><button type="button" onClick={refresh}><RefreshCw size={15}/> Refresh</button></div><div className="iq-thread" aria-live="polite">{(data?.messages||[]).map(m=><div key={m.id} className={"iq-message "+(m.role==="visitor"?"visitor":"staff")}>
    <small>{m.role==="visitor"?"You":"Platform staff"}</small><p>{m.content}</p></div>)}
    {!data?.messages?.length&&<p className="iq-muted">No messages loaded.</p>}</div>
  <form onSubmit={submitMessage} className="iq-write"><label htmlFor="iq-reply">Add a message to your inquiry</label><textarea id="iq-reply" rows={2} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Avoid entering sensitive medical details until a provider is connected."/>
    <button type="submit" disabled={sending||!message.trim()}><Send size={16}/> Save message</button></form>
  <form onSubmit={submitTime} className="iq-booking"><h3><CalendarDays size={17}/> Preferred appointment time</h3>
    <p>This records your preferred time only. It does not check the clinic's live availability or create a reservation.</p>
    <div><label>Date<input type="date" required min={new Date().toISOString().slice(0,10)} value={day} onChange={e=>setDay(e.target.value)}/></label>
    <label>Time<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></div>
    <button disabled={!day||sending} type="submit">Save preference</button>
  </form>
  {notice&&<p role="status" className="iq-notice">{notice}</p>}{error&&<p role="alert" className="iq-error">{error}</p>}
  <button className="iq-delete" type="button" onClick={deleteRecord}><Trash2 size={15}/> Delete my inquiry data</button>
 </div>;
}
export function InquiryPanel({open,onClose,selection,title,route}){
 const[method,setMethod]=useState("email"),[contact,setContact]=useState(""),[message,setMessage]=useState(""),
   [consent,setConsent]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[created,setCreated]=useState(null);
 const closeRef=useRef(null);
 useEffect(()=>{if(!open)return;
   setCreated(null);setError("");setMessage("I would like to ask about this treatment.");setConsent(false);
   const previous=document.body.style.overflow;document.body.style.overflow="hidden";
   const esc=e=>{if(e.key==="Escape")onClose?.()};
   document.addEventListener("keydown",esc);closeRef.current?.focus();
   return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",esc)}
 },[open,route]);
 if(!open)return null;
 const option=selection?.option;
 async function create(e){e.preventDefault();if(!consent)return;setLoading(true);setError("");
   const payload={event_id:selection?.eventId||null,event_name:title||"Clinic consultation",
     option_index:option?.index||null,option_name:option?.title||null,
     source_option_id:option?.sourceOptionId||null,
     clinic_id:selection?.clinic?.id||null,clinic_name:selection?.clinic?.name||null,
     contact_method:method,contact_value:contact.trim(),language:"en",
     message:message.trim(),consent:true};
   try{const result=await call("/inquiries",{method:"POST",data:payload});
     const item={id:result.id,token:result.token,title:payload.event_name,createdAt:new Date().toISOString()};
     saveAll([item,...safeRead().filter(x=>x.id!==item.id)]);setCreated(item);
   }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 return <div className="iq-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
   <section className="iq-panel" role="dialog" aria-modal="true" aria-label="Independent consultation request">
     <header><strong>{created?"Your inquiry":"Consultation inquiry"}</strong><button ref={closeRef} onClick={onClose} aria-label="Close inquiry"><X size={22}/></button></header>
     {created?<StatusView item={created} onClose={onClose}/>:<form className="iq-form" onSubmit={create}>
       <div className="iq-context"><small>Selected source</small><strong>{title||"Clinic"}</strong>
         {option&&<><b>{option.title}</b><span>{option.prices?.salePrice||""} · {option.sourceOptionId?"Original option ID present":"Option index only"}</span></>}</div>
       <p className="iq-warning"><ShieldAlert size={19}/> This is an inquiry to your independent preview service. It is <b>not automatically sent to the original clinic.</b></p>
       <label>Preferred contact method<select value={method} onChange={e=>setMethod(e.target.value)}>
         <option value="email">Email</option><option value="phone">Phone</option><option value="wechat">WeChat ID</option><option value="alipay">Alipay contact</option></select></label>
       <label>Contact details<input required minLength={4} maxLength={180} value={contact} onChange={e=>setContact(e.target.value)} placeholder="For a reply from this independent service"/></label>
       <label>Inquiry message<textarea required maxLength={1000} rows={4} value={message} onChange={e=>setMessage(e.target.value)}/></label>
       <label className="iq-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
         <span>I agree to store my contact and message in this independent service's PostgreSQL database. I understand this is not an original clinic booking or medical consultation.</span></label>
       {error&&<p className="iq-error" role="alert">{error}</p>}
       <button className="iq-submit" type="submit" disabled={loading||!contact.trim()||!message.trim()||!consent}>
         {loading?"Submitting…":"Submit inquiry to independent service"} <ArrowRight size={17}/></button>
     </form>}
   </section>
 </div>;
}
export function InquiriesScreen(){
 const[items,setItems]=useState(safeRead),[selected,setSelected]=useState(null);
 const open=items.find(x=>x.id===selected);
 return <section className="iq-list-screen">
   <h1>My inquiries</h1><p>These inquiries are kept in this independent service. Clinic delivery and appointment confirmation are not connected.</p>
   {open?<><button className="iq-back" onClick={()=>setSelected(null)}>Back to inquiries</button><StatusView item={open} onRemoved={()=>{setItems(safeRead());setSelected(null)}} onClose={()=>setSelected(null)}/></>:
     items.length?items.map(x=><button className="iq-list-item" key={x.id} onClick={()=>setSelected(x.id)}>
       <MessageCircle size={22}/><span><b>{x.title}</b><small>{x.createdAt}</small></span><ChevronRight size={19}/></button>):
       <p className="iq-empty">No inquiries on this device. Open a procedure and choose Consultation to submit an inquiry.</p>}
 </section>;
}
