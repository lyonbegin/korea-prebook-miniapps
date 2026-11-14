import{defineConfig}from"vite";
import react from"@vitejs/plugin-react";
const proxyTarget=process.env.MD_TEST_PROXY_TARGET;
const githubPages=process.env.VITE_GITHUB_PAGES==="1";
const proxy=proxyTarget?{"/gateway":{target:proxyTarget,changeOrigin:true},"/catalog":{target:proxyTarget,changeOrigin:true},"^/native/catalog/":{target:proxyTarget,changeOrigin:true},"/^\\/health$/":{target:proxyTarget,changeOrigin:true}}:{};
export default defineConfig({base:githubPages?"/korea-prebook-miniapps/":"/",plugins:[react()],resolve:{alias:[{find:/^react-native$/,replacement:"react-native-web"}]},server:{host:"0.0.0.0",port:5173,allowedHosts:[".up.railway.app","healthcheck.railway.app"],proxy},preview:{host:"0.0.0.0",proxy,allowedHosts:["mydoctor-mobile-web-production.up.railway.app","healthcheck.railway.app"]}});
