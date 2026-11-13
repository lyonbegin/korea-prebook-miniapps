import React from "react";
import {
  View, Text, Image, ScrollView, Pressable, StyleSheet
} from "react-native-web";

/**
 * A strict DOM host for RN component trees recovered from Hermes JS.
 * No screen layouts or example data are embedded here. It only renders
 * supplied, validated source-derived component trees.
 *
 * Contract:
 * {type:"View"|"Text"|"Image"|"ScrollView"|"Pressable",
 *  props:{style?:object, source?:{uri:string}, ...}, children?:[]|string,
 *  onPressRoute?:string}
 */
const PRIMITIVES = Object.freeze({View,Text,Image,ScrollView,Pressable});
const STYLE_KEYS = new Set([
  "alignContent","alignItems","alignSelf","aspectRatio","backgroundColor",
  "borderBottomColor","borderBottomWidth","borderColor","borderLeftWidth",
  "borderRadius","borderRightWidth","borderTopWidth","borderWidth",
  "bottom","color","display","flex","flexBasis","flexDirection","flexGrow",
  "flexShrink","flexWrap","fontFamily","fontSize","fontStyle","fontWeight",
  "gap","height","justifyContent","left","letterSpacing","lineHeight",
  "margin","marginBottom","marginHorizontal","marginLeft","marginRight",
  "marginTop","marginVertical","maxHeight","maxWidth","minHeight","minWidth",
  "opacity","overflow","padding","paddingBottom","paddingHorizontal",
  "paddingLeft","paddingRight","paddingTop","paddingVertical","position",
  "right","textAlign","textDecorationLine","top","width","zIndex"
]);
function safeStyle(input){
  if(!input||typeof input!=="object"||Array.isArray(input))return {};
  return Object.fromEntries(Object.entries(input).filter(([key,value])=>
    STYLE_KEYS.has(key)&&(typeof value==="number"||typeof value==="string")));
}
function safeImageSource(source){
  const url=source?.uri;
  if(typeof url!=="string")return undefined;
  if(!/^https:\/\//i.test(url)&&!/^\/assets\/original\//.test(url))return undefined;
  return {uri:url};
}
export function validateRecoveredTree(tree,{maxNodes=4000}={}){
  let count=0;
  function walk(node,depth){
    if(depth>90)throw new Error("Recovered Hermes view tree exceeds nesting limit");
    if(typeof node==="string"||typeof node==="number")return;
    if(!node||typeof node!=="object"||Array.isArray(node))throw new TypeError("Invalid native component node");
    if(!Object.hasOwn(PRIMITIVES,node.type))throw new Error("Unmapped native component: "+String(node.type));
    if(++count>maxNodes)throw new Error("Recovered Hermes tree exceeds node limit");
    const children=node.children;
    if(children===undefined||children===null)return;
    if(Array.isArray(children))children.forEach(item=>walk(item,depth+1));
    else walk(children,depth+1);
  }
  walk(tree,0);
  return {nodeCount:count};
}
function RecoveredNode({node,go,depth=0}){
  if(node===null||node===undefined||node===false)return null;
  if(typeof node==="string"||typeof node==="number")return String(node);
  if(depth>90)throw new Error("Hermes tree too deep");
  const Component=PRIMITIVES[node.type];
  if(!Component)throw new Error("Unsupported recovered RN component: "+node.type);
  const raw=node.props||{};
  const props={style:safeStyle(raw.style)};
  if(node.type==="Image")props.source=safeImageSource(raw.source);
  if(node.type==="ScrollView"&&raw.contentContainerStyle)
    props.contentContainerStyle=safeStyle(raw.contentContainerStyle);
  if(typeof raw.testID==="string")props.testID=raw.testID;
  if(typeof raw.accessibilityLabel==="string")props.accessibilityLabel=raw.accessibilityLabel;
  if(node.type==="Pressable"){
    props.accessibilityRole="button";
    props.onPress=()=>{
      const to=node.onPressRoute;
      if(typeof to==="string"&&to.startsWith("/")&&!to.startsWith("//"))go?.(to);
    };
  }
  const children=node.children;
  return <Component {...props}>{
    (Array.isArray(children)?children:children==null?[]:[children]).map((child,i)=>
      <RecoveredNode key={child?.key??i} node={child} go={go} depth={depth+1}/>)
  }</Component>;
}
export default function RecoveredHermesWebScreen({tree,go}){
  if(!tree)return <View accessibilityRole="alert"><Text>원본 Hermes 화면 트리가 아직 추출되지 않았습니다.</Text></View>;
  validateRecoveredTree(tree);
  return <RecoveredNode node={tree} go={go}/>;
}
