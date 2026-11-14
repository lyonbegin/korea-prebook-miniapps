import observedNavigation from "./data/original-menu-20261109.json";

/**
 * Static GitHub Pages inputs.
 * Source: previously verified HBC96 component/label audit + observed
 * public website navigation (2026-11-09). Public web menu links are not
 * represented as native app API or private hospital records.
 */
const root=(key)=>observedNavigation.roots.find(item=>item.key===key);
const groups=(key)=>root(key)?.groups??[];
const toPublicLink=(item)=>({label:item.label,path:item.href,
  evidence:"original-public-web-navigation-20261109"});
export const publicMenuGroups=(key)=>groups(key).map(group=>({
  title:group.title,links:group.links.map(toPublicLink)
}));
export const publicLinks=(key)=>publicMenuGroups(key).flatMap(group=>group.links);
export const allObservedPublicLinks=observedNavigation.roots.flatMap(r=>groups(r.key).flatMap(g=>g.links.map(toPublicLink)));
export const originalHbcHomeCards=[
 {title:"다이어트\n주사 기록",nativeScreen:"WegovyRecordBridgeScreen",
  shouldCheckLogin:true,imageUrl:null,navigationUrl:null},
 {title:"수액\n최저가 예약",nativeScreen:"IvFluidPurposeScreen",
  shouldCheckLogin:false,imageUrl:null,navigationUrl:null}
];
export const staticHomeData={
 cards:originalHbcHomeCards,
 menu:publicLinks("telemedicine").slice(0,20).map((item,i)=>({
  ...item,id:"observed-public-"+i,image:null,source:"original-public-web-navigation"
 })),
 banners:[],errors:[],loading:false
};
export function findObservedPublicLink(target){
 if(typeof target!=="string")return null;
 const source=target.split("?")[0];
 return allObservedPublicLinks.find(x=>{
   try{return decodeURIComponent(x.path.split("?")[0])===decodeURIComponent(source)}
   catch{return false}
 })??null;
}
