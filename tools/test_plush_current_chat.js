// Current-chat binding regression. Uses synthetic chats only.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../clawd_pet/main.js'),'utf8');
const a=code.indexOf('let inputChatTarget = null;'),b=code.indexOf('async function ensureChatId()',a);
const c=code.indexOf('async function sendToChat(text, selectedChatId)'),d=code.indexOf('// ==================== 养成',c);
const e=code.indexOf('async function openInput()'),f=code.indexOf('function onPoke(',e);
assert(a>=0&&b>a&&c>=0&&d>c&&e>=0&&f>e);
async function scenario(currentId, title='测试对话 A') {
  const sent=[],labels=[];
  const state={
    settings:{chat:{chatId:'old-chat',timeoutMs:180000}},
    busy:false,draft:'',ctx:{},pendingLinkTimer:null,pendingLink:null,
    Host:{callStatic(){}},Date,JSON,String,clearTimeout,
    stopSpeech(){},bubbleCall(name,data){if(name==='input')labels.push(data.title);},
    setWork(){},petPlay(){},sayText(text){labels.push(text);},
    saveSettingsBestEffort:async()=>true,ensureChatId:async()=>{throw Error('must not use saved binding');},
    Tools:{Chat:{
      async listChats(){return {currentChatId:currentId,chats:[{id:'chat-a',title}]};},
      async startService(){return {isConnected:true};},
      async sendMessage(text,chatId){sent.push({text,chatId});return {aiResponse:'reply'};}
    }},
    cleanReply:x=>x,splitSegments:x=>[x],parseLinkTags:()=>({seq:[]}),
    comboOverReply:x=>x,speak(){},bump(){}
  };
  vm.createContext(state);
  vm.runInContext(code.slice(a,b)+code.slice(c,d)+code.slice(e,f)+
    '\nthis.open=openInput;this.send=sendToChat;this.target=()=>inputChatTarget;this.clear=()=>{inputChatTarget=null}',state);
  await state.open();
  return {state,sent,labels};
}
(async()=>{
  const a=await scenario('chat-a');
  assert.equal(a.state.target(),'chat-a');
  assert.equal(a.labels[0],'正在与：测试对话 A');
  // Current Operit chat may change before submission. Send only to snapshotted A.
  a.state.Tools.Chat.listChats=async()=>({currentChatId:'chat-b',chats:[]});
  const locked=a.state.target();
  const result=await a.state.send('你好',locked);
  assert.equal(result.ok,true);
  assert.deepEqual(a.sent,[{text:'你好',chatId:'chat-a'}]);
  const missing=await scenario(null);
  assert.equal(missing.state.target(),null);
  assert.match(missing.labels[0],/无法识别/);
  assert.deepEqual(missing.sent,[]);
  const b=await scenario('chat-b','对话 B');
  assert.equal(b.state.target(),'chat-b');
  assert.equal(b.labels[0],'正在与：当前对话');
  console.log('PASS: double-tap binding, recipient lock, missing-current fail-closed, title fallback');
})().catch(e=>{console.error(e);process.exitCode=1});
