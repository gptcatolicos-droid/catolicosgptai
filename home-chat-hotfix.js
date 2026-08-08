const express = require('express');

const HOME_CHAT_STYLE = `
<style id="cgpt-home-chat-hotfix">
  .welcome-cards,.welcome-card{display:none!important}
  .chat-input-wrap{
    position:sticky!important;bottom:0!important;z-index:35!important;width:100%!important;
    padding:12px 16px calc(12px + env(safe-area-inset-bottom))!important;
    background:rgba(249,246,240,.94)!important;
    backdrop-filter:blur(18px) saturate(140%)!important;
    -webkit-backdrop-filter:blur(18px) saturate(140%)!important;
    border-top:1px solid rgba(94,27,34,.08)!important;
    box-shadow:0 -8px 24px rgba(37,27,21,.05)!important
  }
  .chat-input-wrap form{
    display:flex!important;align-items:center!important;gap:8px!important;
    width:min(100%,820px)!important;margin:0 auto!important;padding:6px!important;
    background:#fff!important;border:1px solid rgba(94,27,34,.14)!important;
    border-radius:24px!important;box-shadow:0 8px 30px rgba(37,27,21,.08)!important
  }
  .chat-input-wrap textarea,
  .chat-input-wrap input[type="text"],
  .chat-input-wrap input:not([type]){
    display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;
    flex:1 1 auto!important;width:100%!important;min-width:0!important;min-height:50px!important;max-height:160px!important;
    margin:0!important;padding:13px 14px!important;border:0!important;outline:0!important;resize:none!important;
    background:transparent!important;color:#251B15!important;
    font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
    font-size:16px!important;line-height:1.35!important;box-shadow:none!important
  }
  .chat-input-wrap textarea::placeholder,.chat-input-wrap input::placeholder{color:#958A84!important;opacity:1!important}
  .chat-input-wrap button[type="submit"],.chat-input-wrap form>button:last-child{
    display:inline-flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;
    flex:0 0 auto!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;
    margin:0!important;padding:0!important;align-items:center!important;justify-content:center!important;border:0!important;
    border-radius:16px!important;background:#5E1B22!important;color:#fff!important;
    box-shadow:0 6px 16px rgba(94,27,34,.2)!important
  }
  .chat-disclaimer,.ai-disclaimer,.composer-disclaimer{display:none!important}
  #welcome-screen{padding-bottom:1rem!important}
  @media(max-width:767px){
    .chat-input-wrap{padding-left:10px!important;padding-right:10px!important}
    .chat-input-wrap form{border-radius:20px!important}
  }
</style>`;

const HOME_CHAT_SCRIPT = `
<script id="cgpt-home-chat-hotfix-js">
(function(){
  function cleanupHome(){
    document.querySelectorAll('.welcome-cards,.welcome-card').forEach(function(el){
      el.style.setProperty('display','none','important');
    });

    document.querySelectorAll('p,small,span').forEach(function(el){
      var text=(el.textContent||'').replace(/\\s+/g,' ').trim();
      if(
        text==='CatólicosGPT · Conforme al Magisterio constante de la Iglesia · Puede contener imprecisiones' ||
        text==='Conforme al Magisterio constante de la Iglesia · Puede contener imprecisiones' ||
        text==='Puede contener imprecisiones'
      ){
        el.style.setProperty('display','none','important');
      }
    });

    document.querySelectorAll('.chat-input-wrap,.chat-input-wrap form').forEach(function(el){
      el.style.removeProperty('display');
      el.style.removeProperty('visibility');
      el.style.removeProperty('opacity');
      el.style.removeProperty('height');
      el.style.removeProperty('min-height');
    });

    document.querySelectorAll('.chat-input-wrap textarea,.chat-input-wrap input[type="text"],.chat-input-wrap input:not([type]),.chat-input-wrap button[type="submit"]').forEach(function(el){
      el.style.setProperty('display',el.tagName==='BUTTON'?'inline-flex':'block','important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('pointer-events','auto','important');
    });
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',cleanupHome)}
  else{cleanupHome()}
  setTimeout(cleanupHome,250);
  setTimeout(cleanupHome,900);
})();
</script>`;

function installHomeChatHotfix(){
  if(express.response.__cgptHomeChatHotfixInstalled)return;
  express.response.__cgptHomeChatHotfixInstalled=true;
  const originalSend=express.response.send;

  express.response.send=function patchedHomeChatSend(body){
    try{
      const contentType=String(this.getHeader('Content-Type')||'');
      if(
        typeof body==='string' &&
        body.includes('<head>') &&
        !body.includes('id="cgpt-home-chat-hotfix"') &&
        (!contentType || contentType.includes('text/html'))
      ){
        body=body.replace('<head>',`<head>${HOME_CHAT_STYLE}`);
        body=body.replace('</body>',`${HOME_CHAT_SCRIPT}</body>`);
      }
    }catch(err){
      console.warn('[Home Chat Hotfix] No se pudo aplicar:',err.message);
    }
    return originalSend.call(this,body);
  };
}

module.exports={installHomeChatHotfix};
