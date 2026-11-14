import React,{useEffect,useState} from "react";
import {View,Text,ScrollView,Image,Pressable} from "react-native-web";
import {Hospital,Search,Gift,Bell,ChevronRight,ArrowLeft,RefreshCw} from "lucide-react";
import {fetchNativeCatalog} from "./lib/originalGateway.js";
import {nativeHomeBanners,nativeHomeMenuItems} from "./nativeDataAdapters.js";
import NativeHospitalListScreen from "./NativeHospitalListScreen.jsx";
import {staticHomeData} from "./HermesPagesStaticData.js";

/* HBC96 source-derived WEB renderer, not an Android Hermes bytecode runtime.
 * Verified function references:
 * #45594 HomeScreen: ScrollView gap12 paddingTop12
 * #45644 HomeScreenGNB: logo + search,giftbox,bell
 * #45992-46003 HomeNavigationSection: flex row gap12 marginHorizontal12
 *   white cards borderRadius16 padding12 gap12 icon40
 * #45648-45649 MedicalAppointmentSection: borderRadius16 marginHorizontal12
 *   paddingVertical12, headings and "모든 증상 보기" action
 * #45959 HomeBusinessRegistrationInformation: legal text
 * Hospital list #48385-48386/#30064 handled by NativeHospitalListScreen.
 */
const t={fontFamily:'-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'};
const S={
  screen:{backgroundColor:"#f6f7fa",flex:1,minHeight:"100vh"},
  gnb:{backgroundColor:"#fff",height:58,paddingHorizontal:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  logo:{...t,fontWeight:"800",fontSize:21,color:"#171a21",letterSpacing:-1},
  nav:{flexDirection:"row",gap:12,marginHorizontal:12},
  card:{flex:1,backgroundColor:"#fff",borderRadius:16,padding:12,gap:12,justifyContent:"center",alignItems:"center",minHeight:110},
  navLabel:{...t,fontSize:15,lineHeight:20,fontWeight:"700",color:"#16191e",textAlign:"center"},
  appointment:{marginHorizontal:12,borderRadius:16,backgroundColor:"#fff",paddingVertical:12},
  headings:{flexDirection:"row",gap:10,marginHorizontal:12},
  section:{paddingHorizontal:12,paddingTop:12,paddingBottom:12},
  heading:{...t,fontSize:18,fontWeight:"700",color:"#1b1d22"},
  divider:{height:1,backgroundColor:"#f1f2f4",marginHorizontal:12,marginVertical:8},
  symptom:{width:"25%",paddingVertical:12,paddingHorizontal:2,alignItems:"center",gap:7},
  symptomText:{...t,color:"#333842",textAlign:"center",fontSize:12,lineHeight:16},
  action:{marginHorizontal:12,paddingVertical:12,alignItems:"center",justifyContent:"center",borderRadius:9,backgroundColor:"#f5f7fa"},
  actionText:{...t,color:"#343c49",fontWeight:"650",fontSize:13},
  status:{...t,fontSize:12,color:"#667085",lineHeight:18},
  legal:{paddingHorizontal:14,paddingVertical:20,gap:10},
  legalText:{...t,fontSize:11,color:"#7a8290"},
  tab:{paddingHorizontal:10,paddingVertical:9,borderRadius:8},
  activeTab:{backgroundColor:"#eff4ff"},
};
const supportedLink=(input)=>{
  try{
    const u=new URL(input,"https://my-doctor.io");
    if(u.origin==="https://my-doctor.io"&&
       /^\/(hospital|medical-cost|telemedicine|pharmacy|dept-hub)(\/|$)/.test(u.pathname))
      return u.pathname+u.search;
  }catch{}
  return null;
};
function unwrapConfig(payload){
  let value=payload?.data?.data?.value??payload?.data?.value;
  if(typeof value==="string"){try{value=JSON.parse(value)}catch{return []}}
  if(!Array.isArray(value))return [];
  return value.filter(x=>x&&typeof x.title==="string"&&
    typeof x.imageUrl==="string"&&/^https:\/\/img\.my-doctor\.io\//.test(x.imageUrl))
    .slice(0,5);
}
function useOriginalHomeData(staticMode=false){
 const [data,setData]=useState(()=>staticMode?staticHomeData:{menu:[],cards:[],banners:[],loading:true,errors:[]});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
   if(staticMode){setData(staticHomeData);return;}
   const abort=new AbortController();
   const jobs=[
     fetchNativeCatalog("app-config",{config_key:"HomeNavigationConfig"},abort.signal)
       .then(v=>({field:"cards",value:unwrapConfig(v)}))
       .catch(()=>({field:"cards",value:[],error:"홈 바로가기"})),
     fetchNativeCatalog("home-menu",{},abort.signal)
       .then(v=>({field:"menu",value:nativeHomeMenuItems(v.data)}))
       .catch(()=>({field:"menu",value:[],error:"진료 메뉴"})),
     fetchNativeCatalog("home-banner",{},abort.signal)
       .then(v=>({field:"banners",value:nativeHomeBanners(v.data)}))
       .catch(()=>({field:"banners",value:[],error:"원본 배너"})),
   ];
   Promise.all(jobs).then(result=>{
     if(abort.signal.aborted)return;
     const next={menu:[],cards:[],banners:[],loading:false,errors:[]};
     result.forEach(item=>{next[item.field]=item.value;if(item.error)next.errors.push(item.error)});
     setData(next);
   });
   return ()=>abort.abort();
 },[retry,staticMode]);
 return {...data,refresh:()=>{if(staticMode)return;setData(v=>({...v,loading:true}));setRetry(x=>x+1)}};
}
function NativeButton({children,onPress,style,accessibilityLabel}){
 return <Pressable onPress={onPress} accessibilityRole="button"
   accessibilityLabel={accessibilityLabel} style={style}>{children}</Pressable>;
}
function HermesGnb({go}){
 return <View style={S.gnb}>
   <NativeButton onPress={()=>go("/")} accessibilityLabel="나만의닥터 홈">
     <Text style={S.logo}>나만의닥터</Text>
   </NativeButton>
   <View style={{flexDirection:"row",alignItems:"center",gap:18}}>
     <NativeButton onPress={()=>go("/medical-cost")} accessibilityLabel="검색"><Search size={22} color="#252b34"/></NativeButton>
     <NativeButton onPress={()=>go("/telemedicine/all-department")} accessibilityLabel="혜택"><Gift size={22} color="#252b34"/></NativeButton>
     <NativeButton onPress={()=>go("/healthLab")} accessibilityLabel="알림"><Bell size={22} color="#252b34"/></NativeButton>
   </View>
 </View>;
}
function HermesHomeNavigation({cards,go}){
 const [pending,setPending]=useState(null);
 return <View style={{gap:8}}><View style={S.nav} data-testid="hermes-source-home-nav">
   <NativeButton style={S.card} onPress={()=>go("/hospital")} accessibilityLabel="병원 약국 찾기">
     <Hospital size={40} strokeWidth={1.6} color="#222a36" />
     <Text style={S.navLabel}>병원/약국{"\n"}찾기</Text>
   </NativeButton>
   {cards.map((item,i)=><NativeButton key={i} style={S.card}
     onPress={()=>{
       const dest=supportedLink(item.navigationUrl);
       if(dest)go(dest);
       else setPending(item.title.replace(/\n/g," "));
     }} accessibilityLabel={item.title.replace(/\n/g," ")}>
     {item.imageUrl?<Image source={{uri:item.imageUrl}} style={{width:40,height:40}} resizeMode="contain"/>:
      <View style={{width:40,height:40,alignItems:"center",justifyContent:"center"}}><Hospital color="#8997a8" size={28}/></View>}
     <Text style={S.navLabel}>{item.title}</Text>
   </NativeButton>)}
 </View>{pending&&<View style={{marginHorizontal:12,padding:12,borderRadius:12,backgroundColor:"#fff"}}>
   <Text style={S.status}>{pending}: 원본 앱 전용 화면입니다. 웹 경로가 확인되면 연결됩니다.</Text>
   <NativeButton style={{paddingTop:8}} onPress={()=>setPending(null)}><Text style={S.actionText}>닫기</Text></NativeButton>
 </View>}</View>;
}
function MedicalSection({data,go}){
 const [tab,setTab]=useState("telemedicine");
 const [pending,setPending]=useState(null);
 const navigateTo=(item)=>{
   if(item.path)go(item.path);
   else setPending(item.label);
 };
 return <View style={S.appointment} data-testid="hermes-source-medical">
   <View style={S.headings}>
     {[
       {key:"telemedicine",title:"비대면 진료"},
       {key:"booking",title:"최저가 병원 예약"}
     ].map(x=><NativeButton key={x.key}
       style={{...S.tab,...(tab===x.key?S.activeTab:{})}}
       onPress={()=>setTab(x.key)} accessibilityLabel={x.title}>
       <Text style={{...S.heading,fontSize:15,color:tab===x.key?"#326dff":"#7b8290"}}>{x.title}</Text>
     </NativeButton>)}
   </View>
   <View style={S.divider}/>
   <View style={S.section}>
     <Text style={S.heading}>{tab==="telemedicine"?"비대면 진료":"최저가 병원 예약"}</Text>
     {tab==="telemedicine"?
      <View style={{flexDirection:"row",flexWrap:"wrap",paddingTop:10}}>
        {data.menu.map((item,i)=><NativeButton key={item.id??i} style={S.symptom}
           onPress={()=>navigateTo(item)} accessibilityLabel={item.label}>
           {item.image?
             <Image source={{uri:item.image}} style={{width:40,height:40}} resizeMode="contain"/>:
             <View style={{height:40,width:40,borderRadius:20,backgroundColor:"#eff3fa",alignItems:"center",justifyContent:"center"}}>
               <Hospital size={20} color="#6a7584"/>
             </View>}
           <Text style={S.symptomText}>{item.label}</Text>
         </NativeButton>)}
      </View>:
      <View style={{paddingVertical:18,alignItems:"center"}}>
        <NativeButton onPress={()=>go("/medical-cost")} style={S.action}>
          <Text style={S.actionText}>가격 비교 화면 열기</Text>
        </NativeButton>
      </View>}
   </View>
   {pending&&<Text style={{...S.status,marginHorizontal:12,paddingVertical:8}}>{pending}: 원본 메뉴 데이터는 확인됐으며 웹 이동 경로는 아직 확인되지 않았습니다.</Text>}
   <View style={S.divider}/>
   <NativeButton style={S.action} onPress={()=>go("/telemedicine/all-department")}>
     <Text style={S.actionText}>모든 증상 보기  ›</Text>
   </NativeButton>
 </View>;
}
function OriginalBanner({banners,go}){
 return <View style={{marginHorizontal:12,gap:12}}>
   {banners.slice(0,3).map((banner,i)=><NativeButton key={banner.id??i}
     accessibilityLabel="원본 홈 배너"
     onPress={()=>{if(banner.path)go(banner.path)}}
     style={{overflow:"hidden",borderRadius:14,backgroundColor:banner.color||"#fff"}}>
     <Image source={{uri:banner.image}} style={{height:120,width:"100%"}} resizeMode="cover"/>
   </NativeButton>)}
 </View>;
}
export default function HermesSourceWebScreen({screen="home",go,staticMode=false}){
 const data=useOriginalHomeData(staticMode);
 if(screen==="hospital-list")return <View style={{backgroundColor:"#fff",minHeight:"100vh"}}>
   <View style={{...S.gnb,justifyContent:"flex-start",gap:14}}>
     <NativeButton onPress={()=>go("/native/hermes-preview?screen=home")} accessibilityLabel="뒤로"><ArrowLeft size={23} color="#222"/></NativeButton>
     <Text style={S.heading}>병원 찾기</Text>
   </View>
   <NativeHospitalListScreen go={go} legacyLinks={[]} />
 </View>;
 return <View style={S.screen} data-testid="hermes-source-web-home">
   <HermesGnb go={go}/>
   <ScrollView contentContainerStyle={{gap:12,paddingTop:12,paddingBottom:25}}>
     <HermesHomeNavigation cards={data.cards} go={go}/>
     <MedicalSection data={data} go={go}/>
     <OriginalBanner banners={data.banners} go={go}/>
     {data.loading&&<Text style={{...S.status,paddingHorizontal:14}}>원본 앱 공개 메뉴를 불러오는 중입니다.</Text>}
     {data.errors.length>0&&<View style={{marginHorizontal:12,padding:12,backgroundColor:"#fff",borderRadius:8}}>
        <Text style={S.status}>연결되지 않은 원본 데이터: {data.errors.join(", ")}</Text>
        <NativeButton onPress={data.refresh} style={{flexDirection:"row",gap:6,paddingVertical:8}}>
          <RefreshCw size={14} color="#326dff"/><Text style={S.status}>다시 불러오기</Text>
        </NativeButton>
     </View>}
     <View style={S.legal}>
       <Text style={S.legalText}>이용약관   개인정보처리방침   위치기반서비스이용약관</Text>
       <Text style={S.legalText}>광고 문의 : sales@merakiplace.kr</Text>
     </View>
   </ScrollView>
 </View>;
}
