import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
const allowedHosts=["healthcheck.railway.app","unni-mobile-web-production.up.railway.app"];
// Optional same-origin proxy for CI testing the checked-out frontend source;
// production is unaffected when UNNI_TEST_PROXY_TARGET is not set.
const qaProxy=process.env.UNNI_TEST_PROXY_TARGET?{
  "/gateway":{target:process.env.UNNI_TEST_PROXY_TARGET,changeOrigin:true},
  "/catalog":{target:process.env.UNNI_TEST_PROXY_TARGET,changeOrigin:true},
  "/inquiries":{target:process.env.UNNI_TEST_PROXY_TARGET,changeOrigin:true}
}:{};

export default defineConfig({
 plugins:[react()],
 server:{host:"0.0.0.0",port:5173,allowedHosts,proxy:qaProxy},
 preview:{host:"0.0.0.0",allowedHosts,strictPort:true}
});
