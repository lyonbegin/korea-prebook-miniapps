import React from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const root=createRoot(document.getElementById("root"));
const render=Component=>root.render(<React.StrictMode><Component/></React.StrictMode>);
if(import.meta.env.VITE_GITHUB_PAGES==="1"){
  import("./HermesPagesApp.jsx").then(({default:App})=>render(App));
}else{
  import("./App.jsx").then(({default:App})=>render(App));
}
