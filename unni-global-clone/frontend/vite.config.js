import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
const allowedHosts=["healthcheck.railway.app","unni-mobile-web-production.up.railway.app"];
export default defineConfig({
 plugins:[react()],
 server:{host:"0.0.0.0",port:5173,allowedHosts},
 preview:{host:"0.0.0.0",allowedHosts,strictPort:true}
});
