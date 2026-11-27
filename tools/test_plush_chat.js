// Isolated regression for the ToolPkg chat-service preflight; no network or chat data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../clawd_pet/main.js'), 'utf8');
const start = src.indexOf('async function sendToChat(text) {');
const end = src.indexOf('// ==================== 养成', start);
assert(start >= 0 && end > start);
const routine = src.slice(start, end);
async function scenario(connected) {
  const order = [];
  let errorMessage = '';
  const c = {
    busy: false, ctx: {}, pendingLinkTimer: null, pendingLink: null,
    Host: { callStatic() {} },
    settings: { chat: { roleCardId:'', senderName:'', notifyReply:false,
      hideUserMessage:false, timeoutMs:180000 } },
    stopSpeech() {}, bubbleCall() {}, setWork() {}, petPlay() {},
    sayText(msg) { errorMessage = msg; },
    cleanReply(text) { return text; },
    splitSegments(text) { return [text]; },
    parseLinkTags() { return {seq: []}; },
    comboOverReply(parts) { return parts; },
    speak() {}, bump() {},
    async ensureChatId() { order.push('ensureChatId'); return 'test-chat'; },
    Tools: { Chat: {
      async startService(options) {
        order.push('startService');
        assert.equal(options.keep_if_exists, true);
        return {isConnected: connected};
      },
      async sendMessage() { order.push('sendMessage'); return {aiResponse: 'ok'}; }
    } },
    Date, String, clearTimeout, JSON
  };
  vm.createContext(c);
  vm.runInContext(routine + '\nthis.run = sendToChat;', c);
  const result = await c.run('hello');
  return {order, result, errorMessage};
}
(async () => {
  const ok = await scenario(true);
  assert.equal(ok.result.ok, true);
  assert.deepEqual(ok.order, ['startService','ensureChatId','sendMessage']);
  const failed = await scenario(false);
  assert.equal(failed.result.ok, false);
  assert.deepEqual(failed.order, ['startService']);
  assert.match(failed.errorMessage, /聊天服务未连接/);
  console.log('PASS: chat service connects before chat creation and sending; failure stops safely');
})().catch(error => { console.error(error); process.exitCode = 1; });
