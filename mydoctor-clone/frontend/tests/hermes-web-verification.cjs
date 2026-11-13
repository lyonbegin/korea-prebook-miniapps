/* Verify that native React layout primitives can render inside a browser DOM.
 * This is a renderer compatibility test, not evidence that the proprietary
 * Hermes bundle is directly executable on the web.
 */
const assert = require("node:assert/strict");
const React = require("react");
const {renderToStaticMarkup} = require("react-dom/server");
const {
  View, Text, ScrollView, Image, Pressable, StyleSheet
} = require("react-native-web");

const s = StyleSheet.create({
  screen: {gap:12,paddingTop:12,backgroundColor:"#ffffff"},
  card: {flex:1,backgroundColor:"#ffffff",borderRadius:16,padding:12,gap:12},
  icon: {width:40,height:40}
});
const jsx = React.createElement;
const ui = jsx(ScrollView,
  {testID:"hbc96-web-native-scroll",contentContainerStyle:s.screen},
  jsx(View,{style:s.card,testID:"hbc96-card"},
    jsx(Text,{testID:"hbc96-title"},"Hermes native view renderer"),
    jsx(Pressable,{accessibilityRole:"button",onPress:()=>{}},
      jsx(Text,null,"Interactive native pressable")),
    jsx(Image,{style:s.icon,source:{uri:"https://example.com/sample.png"},
      accessibilityLabel:"native image"})
  )
);
const html = renderToStaticMarkup(ui);
assert.match(html,/Hermes native view renderer/);
assert.match(html,/Interactive native pressable/);
assert.match(html,/hbc96-web-native-scroll/);
assert.match(html,/hbc96-card/);
assert.match(html,/hbc96-title/);
console.log("REACT_NATIVE_WEB_BRIDGE_RENDER_PASS",html.length);
console.log("ORIGINAL_HBC_WEB_EXECUTION_NOT_YET_VERIFIED");
