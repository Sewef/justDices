import{O as t,p as d,r as c,s as p}from"./roller-D54M9f9w.js";async function u(){return{id:await t.player.getId(),name:await t.player.getName(),color:await t.player.getColor(),role:await t.player.getRole()}}async function b(s,e){await t.broadcast.sendMessage("justdices.dice-roll",{sender:s,user:s.name,text:e},{destination:"ALL"})}function f(){t.broadcast.onMessage("justdices.api.request",async s=>{const e=s.data;if(!e||!e.callId||!e.requesterId){console.warn("[API] Invalid request payload",e);return}const i={callId:e.callId,requesterId:e.requesterId,expressionIn:e.expression};try{const a=await d(e.expression);if(!a){console.error("[API] Parse failed"),await t.broadcast.sendMessage("justdices.api.response",{...i,ok:!1,error:"PARSE_ERROR",destination:"ALL"});return}const o=await c(a.rollExpression,a.mode||"normal");if(!o){console.error("[API] Roll failed"),await t.broadcast.sendMessage("justdices.api.response",{...i,ok:!1,error:"ROLL_ERROR",destination:"ALL"});return}const r={expression:`${e.expression} (${o.expression})`,rolls:o.rolls,total:o.total,hidden:!!a.hidden,allDiceMin:o.allDiceMin,allDiceMax:o.allDiceMax};if(e.showInLogs){const l=await u();await b(l,r)}const n={...i,ok:!0,expressionOut:o.expression,rolls:o.rolls,data:o};await t.broadcast.sendMessage("justdices.api.response",n,{destination:"ALL"})}catch(a){console.error("[API] Exception during roll",a),await t.broadcast.sendMessage("justdices.api.response",{...i,ok:!1,error:String(a),destination:"ALL"})}})}document.querySelector("#app").innerHTML=`
  <div id="inputRow">
    <form id="input">
      <div class="input-group">
        <input type="text" id="inputField" placeholder="1d8+6..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
        <button type="button" id="hiddenRollButton" title="Hidden roll" aria-label="Hidden roll">🙈</button>
        <button type="button" id="rollButton" title="Roll it" aria-label="Roll it">⚔️</button>
        <button type="submit" style="display: none;"></button>
        <button type="button" id="toggleDicePanel" title="Quick Rolls panel" aria-label="Quick Rolls panel">🎲</button>
      </div>
    </form>
  </div>

  <div id="logContainer">
    <h3>Rolls History</h3>
    <div id="logCards"></div>
  </div>
`;t.onReady(()=>t.player.getName().then(s=>{f(),p(s)}));
