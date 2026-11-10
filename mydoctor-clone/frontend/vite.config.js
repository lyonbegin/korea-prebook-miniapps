import{defineConfig}from"vite";
import react from"@vitejs/plugin-react";
const proxyTarget=process.env.MD_TEST_PROXY_TARGET;
const proxy=proxyTarget?{"/gateway":{target:proxyTarget,changeOrigin:true},"/catalog":{target:proxyTarget,changeOrigin:true},"/native":{target:proxyTarget,changeOrigin:true},"/^\\/health$/":{target:proxyTarget,changeOrigin:true}}:{};
export default defineConfig({plugins:[react()],server:{host:"0.0.0.0",port:5173,allowedHosts:["mydoctor-mobile-web-production.up.railway.app","healthcheck.railway.app"],proxy},preview:{host:"0.0.0.0",allowedHosts:["mydoctor-mobile-web-production.up.railway.app","healthcheck.railway.app"]}});
