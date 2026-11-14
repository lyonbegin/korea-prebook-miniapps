import React,{useEffect,useState} from "react";
import RecoveredHermesWebScreen from "./RecoveredHermesWebScreen.jsx";
import HermesSourceWebScreen from "./HermesSourceWebScreen.jsx";

const SCREENS = Object.freeze(["home","hospital-list"]);
const LABELS = Object.freeze({
  home:"원본 Hermes 홈",
  "hospital-list":"원본 Hermes 병원 목록",
});
export default function HermesGptPreview({go}){
  const requested = new URLSearchParams(window.location.search).get("screen") || "home";
  const screen = SCREENS.includes(requested) ? requested : "home";
  const [state,setState] = useState({loading:true,error:null,generated:null});
  useEffect(()=>{
    let active = true;
    const controller = new AbortController();
    setState({loading:true,error:null,generated:null});
    // This file exists ONLY after original-HBC verification and GPT conversion.
    fetch("/hermes-generated/"+screen+".json",{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error("검증된 원본 Hermes 변환 파일이 아직 연결되지 않았습니다.");
        return response.json();
      })
      .then(json=>{
        if(!active)return;
        if(json.screen_id!==screen || !json.tree || !Array.isArray(json.source_function_ids)){
          throw new Error("원본 Hermes 변환 결과 형식이 유효하지 않습니다.");
        }
        setState({loading:false,error:null,generated:json});
      })
      .catch(e=>{
        if(active)setState({loading:false,error:String(e.message||e),generated:null});
      });
    return ()=>{active=false;controller.abort()};
  },[screen]);
  return <div style={{maxWidth:560,minHeight:"100vh",margin:"auto",background:"#fff",paddingBottom:20}}>
    <header style={{padding:"16px 12px",borderBottom:"1px solid #e5e7eb"}}>
      <h1 style={{fontSize:18,margin:0}}>{LABELS[screen]} · 모바일 웹</h1>
      <nav aria-label="원본 Hermes 화면 선택" style={{display:"flex",gap:12,marginTop:10}}>
        {SCREENS.map(id=><a key={id} href={"/native/hermes-preview?screen="+id}
           style={{fontSize:13,textDecoration:"underline"}}>{LABELS[id]}</a>)}
      </nav>
    </header>
    {!state.generated&&<React.Fragment>
      <p style={{fontSize:12,padding:"9px 12px",margin:0,color:"#5e6776",background:"#f5f7fa"}}>
        Hermes HBC 96 화면 함수와 공개 원본 API를 기준으로 복원한 React 모바일 웹입니다.
        원본 Android 바이트코드를 브라우저에서 직접 실행한 화면은 아닙니다.
      </p>
      <HermesSourceWebScreen screen={screen} go={go}/>
    </React.Fragment>}
    {state.generated&&<React.Fragment>
      <p style={{fontSize:12,padding:"8px 12px",color:"#667085"}}>
        확인된 원본 함수: {state.generated.source_function_ids.join(", ")}
        {" · "}변환 상태: {state.generated.status==="complete"?"완전":"부분"}
      </p>
      <RecoveredHermesWebScreen tree={state.generated.tree} go={go}/>
      {!!state.generated.unresolved?.length&&<details style={{padding:12}}>
        <summary>추가 연결이 필요한 원본 기능 ({state.generated.unresolved.length})</summary>
        <ul>{state.generated.unresolved.map((x,i)=><li key={i}>{x}</li>)}</ul>
      </details>}
    </React.Fragment>}
  </div>;
}
