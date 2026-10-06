<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from './api'

type Obj = Record<string, unknown>
type Profile = { profileId: string; name: string; credentialConfigurationId: string; credentialData: Obj }
type Offer = { offerId: string; profileId?: string; authMethod: string; expiresAt: number; txCodeValue?: string; credentialOffer: string }

const profiles = ref<Profile[]>([]), selected = ref<string[]>([]), search = ref(''), error = ref(''), copied = ref('')
const authMethod = ref<'PRE_AUTHORIZED'|'AUTHORIZED'>('PRE_AUTHORIZED')
const valueMode = ref<'BY_REFERENCE'|'BY_VALUE'>('BY_REFERENCE')
const issuerStateMode = ref<'INCLUDE'|'OMIT'>('INCLUDE')
const expiresInSeconds = ref(3600), useTxCode = ref(false), generateCode = ref(true), txCodeValue = ref(''), txCodeLength = ref(6)
const overrides = ref('{}'), advanced = ref(false), loading = ref(false), result = ref<Offer|null>(null)
const credentialValues = ref<Record<string, Obj>>({})
type CredentialField = { path: string[]; label: string; value: unknown; kind: 'text'|'number'|'boolean'|'json' }

const visibleProfiles = computed(() => profiles.value.filter(p => [p.name,p.profileId,p.credentialConfigurationId].join(' ').toLowerCase().includes(search.value.toLowerCase())))
const selectedProfiles = computed(() => selected.value.map(id => profiles.value.find(p => p.profileId === id)).filter(Boolean) as Profile[])
const expiry = computed(() => expiresInSeconds.value === -1 ? 'No expiration' : expiresInSeconds.value < 3600 ? `${expiresInSeconds.value/60} minutes` : `${expiresInSeconds.value/3600} hour${expiresInSeconds.value>3600?'s':''}`)

function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T}
function humanize(value:string){return value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase())}
function fieldsFor(profile:Profile):CredentialField[]{
  const fields:CredentialField[]=[]
  const walk=(value:unknown,path:string[])=>{
    if(Array.isArray(value)){fields.push({path,label:humanize(path.at(-1)||''),value,kind:'json'});return}
    if(value!==null&&typeof value==='object'){for(const [key,child] of Object.entries(value))walk(child,[...path,key]);return}
    fields.push({path,label:humanize(path.at(-1)||''),value,kind:typeof value==='boolean'?'boolean':typeof value==='number'?'number':'text'})
  }
  walk(credentialValues.value[profile.profileId]??profile.credentialData,[]);return fields
}
function fieldValue(profileId:string,path:string[]){let value:unknown=credentialValues.value[profileId];for(const key of path)value=(value as Obj)?.[key];return Array.isArray(value)?JSON.stringify(value,null,2):value}
function updateField(profileId:string,field:CredentialField,event:Event){
  const element=event.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;let value:unknown=element.value
  if(field.kind==='boolean')value=element.value==='true';else if(field.kind==='number')value=Number(element.value);else if(field.kind==='json'){try{value=JSON.parse(element.value)}catch{return}}
  const data=clone(credentialValues.value[profileId]||{});let target:Obj=data
  field.path.slice(0,-1).forEach(key=>target=target[key] as Obj);target[field.path.at(-1)!]=value;credentialValues.value={...credentialValues.value,[profileId]:data}
}

async function loadProfiles() {
  loading.value=true; error.value=''
  try { profiles.value=await api('/issuer2/profiles'); credentialValues.value=Object.fromEntries(profiles.value.map(p=>[p.profileId,clone(p.credentialData)])); if (!selected.value.length && profiles.value[0]) selected.value=[profiles.value[0].profileId] }
  catch(e){ error.value=e instanceof Error?e.message:'Could not load profiles.' } finally { loading.value=false }
}
function toggle(id:string){ selected.value=selected.value.includes(id)?selected.value.filter(x=>x!==id):[...selected.value,id] }
function initials(name:string){ return name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() }
async function createOffer(){
  if(!selected.value.length){error.value='Select at least one credential profile.';return}
  loading.value=true;error.value=''
  try{
    const runtimeOverrides:unknown=JSON.parse(overrides.value||'{}')
    if(!runtimeOverrides||Array.isArray(runtimeOverrides)||typeof runtimeOverrides!=='object') throw new Error('Runtime overrides must be a JSON object.')
    const baseOverrides=runtimeOverrides as Obj
    const profileOverrides=(profileId:string)=>({...baseOverrides,credentialData:credentialValues.value[profileId]})
    const common:Obj={authMethod:authMethod.value,valueMode:valueMode.value,expiresInSeconds:expiresInSeconds.value}
    if(authMethod.value==='AUTHORIZED') common.issuerStateMode=issuerStateMode.value
    if(authMethod.value==='PRE_AUTHORIZED'&&useTxCode.value){
      common.txCode={input_mode:'numeric',length:txCodeLength.value,description:'Enter the PIN provided by the issuer'}
      if(!generateCode.value) common.txCodeValue=txCodeValue.value
    }
    const body=selected.value.length===1?{...common,profileId:selected.value[0],runtimeOverrides:profileOverrides(selected.value[0]!)}:{...common,credentials:selected.value.map(profileId=>({profileId,runtimeOverrides:profileOverrides(profileId)}))}
    result.value=await api('/issuer2/credential-offers',{method:'POST',body:JSON.stringify(body)})
  }catch(e){error.value=e instanceof Error?e.message:'Could not create offer.'}finally{loading.value=false}
}
async function copy(value:string,label:string){await navigator.clipboard.writeText(value);copied.value=label;setTimeout(()=>copied.value='',1600)}
function reset(){result.value=null;error.value=''}
onMounted(loadProfiles)
</script>

<template>
  <div class="shell">
    <aside>
      <a class="brand" href="#"><img src="/bextrust-mark.svg" alt=""><span><b>Bextrust</b><small>Issuer</small></span></a>
      <nav><a class="active" href="#"><span>＋</span>Create offer</a><a href="#profiles"><span>▣</span>Profiles</a><a href="#"><span>↻</span>History</a></nav>
      <div class="status"><i></i><div><strong>Issuer service</strong><small>Connected</small></div></div>
    </aside>
    <main>
      <header><div><small>ISSUER PORTAL</small><h1>Create credential offer</h1></div><button title="Reload" @click="loadProfiles">↻</button></header>
      <div class="content">
        <div v-if="error" class="alert"><b>!</b><div><strong>Something went wrong</strong><p>{{error}}</p></div><button @click="error=''">×</button></div>

        <section v-if="result" class="success">
          <div class="success-mark">✓</div><small>OFFER READY</small><h2>Your credential offer is ready</h2>
          <p>Share this offer with the holder. It expires {{new Date(result.expiresAt).toLocaleString()}}.</p>
          <div class="offer"><code>{{result.credentialOffer}}</code><button @click="copy(result.credentialOffer,'offer')">{{copied==='offer'?'Copied!':'Copy'}}</button></div>
          <div v-if="result.txCodeValue" class="pin"><small>TRANSACTION CODE</small><strong>{{result.txCodeValue}}</strong><button @click="copy(result.txCodeValue!,'pin')">{{copied==='pin'?'Copied!':'Copy PIN'}}</button></div>
          <dl><div><dt>Offer ID</dt><dd>{{result.offerId}}</dd></div><div><dt>Flow</dt><dd>{{result.authMethod==='PRE_AUTHORIZED'?'Pre-authorized':'Authorization code'}}</dd></div><div><dt>Delivery</dt><dd>{{valueMode==='BY_REFERENCE'?'By reference':'By value'}}</dd></div></dl>
          <div class="actions"><button class="secondary" @click="copy(JSON.stringify(result,null,2),'json')">{{copied==='json'?'Copied JSON!':'Copy response JSON'}}</button><button class="primary" @click="reset">Create another offer</button></div>
        </section>

        <template v-else>
          <section class="intro"><div><h2>Issue with confidence.</h2><p>Select credentials, enter the holder details, and generate an OpenID4VCI offer.</p></div><div class="steps"><b>1</b><i></i><span>2</span><i></i><span>3</span><i></i><span>4</span></div></section>
          <form @submit.prevent="createOffer">
            <section id="profiles" class="panel">
              <div class="panel-head"><div class="title"><b>01</b><div><h3>Choose credentials</h3><p>Select one or more profiles to include in this offer.</p></div></div><small>{{selected.length}} selected</small></div>
              <label class="search"><span>⌕</span><input v-model="search" type="search" placeholder="Search credential profiles…"></label>
              <p v-if="loading&&!profiles.length" class="empty">Loading credential profiles…</p>
              <div v-else class="profile-grid">
                <button v-for="(profile,index) in visibleProfiles" :key="profile.profileId" type="button" class="profile" :class="{selected:selected.includes(profile.profileId)}" @click="toggle(profile.profileId)">
                  <b :class="`tone-${index%4}`">{{initials(profile.name)}}</b><span><strong>{{profile.name}}</strong><small>{{profile.credentialConfigurationId}}</small><code>{{profile.profileId}}</code></span><i>✓</i>
                </button>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><div class="title"><b>02</b><div><h3>Credential details</h3><p>Review and edit the data that will be issued to the holder.</p></div></div></div>
              <div v-if="!selectedProfiles.length" class="empty">Select a credential profile first.</div>
              <div v-for="profile in selectedProfiles" :key="profile.profileId" class="credential-editor">
                <div class="credential-editor-head"><span class="profile-icon">{{initials(profile.name)}}</span><div><strong>{{profile.name}}</strong><small>{{profile.credentialConfigurationId}}</small></div></div>
                <div class="details-grid">
                  <label v-for="field in fieldsFor(profile)" :key="field.path.join('.')" class="field" :class="{wide:field.kind==='json'}">
                    <span>{{field.label}} <small>{{field.path.join('.')}}</small></span>
                    <select v-if="field.kind==='boolean'" :value="String(fieldValue(profile.profileId,field.path))" @change="updateField(profile.profileId,field,$event)"><option value="true">True</option><option value="false">False</option></select>
                    <textarea v-else-if="field.kind==='json'" :value="String(fieldValue(profile.profileId,field.path))" spellcheck="false" @change="updateField(profile.profileId,field,$event)"></textarea>
                    <input v-else :type="field.kind==='number'?'number':'text'" :value="String(fieldValue(profile.profileId,field.path) ?? '')" @input="updateField(profile.profileId,field,$event)">
                  </label>
                </div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><div class="title"><b>03</b><div><h3>Configure the offer</h3><p>Choose how the wallet will receive and authorize the credential.</p></div></div></div>
              <div class="form-grid">
                <fieldset><legend>Authorization flow</legend><label :class="{chosen:authMethod==='PRE_AUTHORIZED'}"><input v-model="authMethod" value="PRE_AUTHORIZED" type="radio"><span><b>Pre-authorized</b><small>No sign-in required</small></span></label><label :class="{chosen:authMethod==='AUTHORIZED'}"><input v-model="authMethod" value="AUTHORIZED" type="radio"><span><b>Authorization code</b><small>Holder signs in first</small></span></label></fieldset>
                <fieldset><legend>Offer delivery</legend><label :class="{chosen:valueMode==='BY_REFERENCE'}"><input v-model="valueMode" value="BY_REFERENCE" type="radio"><span><b>By reference</b><small>Shorter, recommended URL</small></span></label><label :class="{chosen:valueMode==='BY_VALUE'}"><input v-model="valueMode" value="BY_VALUE" type="radio"><span><b>By value</b><small>Offer embedded in URL</small></span></label></fieldset>
                <label class="field"><span>Expires after <small>{{expiry}}</small></span><select v-model.number="expiresInSeconds"><option :value="300">5 minutes</option><option :value="900">15 minutes</option><option :value="3600">1 hour</option><option :value="86400">24 hours</option><option :value="-1">Never</option></select></label>
                <label v-if="authMethod==='AUTHORIZED'" class="field"><span>Issuer state</span><select v-model="issuerStateMode"><option value="INCLUDE">Include issuer_state</option><option value="OMIT">Omit issuer_state</option></select></label>
              </div>
              <div v-if="authMethod==='PRE_AUTHORIZED'" class="transaction"><label class="switch-row"><input v-model="useTxCode" type="checkbox"><i></i><span><b>Protect with a transaction code</b><small>Require the holder to enter a numeric PIN.</small></span></label><div v-if="useTxCode" class="tx-fields"><label><input v-model="generateCode" type="checkbox"> Generate a random PIN</label><label v-if="!generateCode" class="field"><span>PIN</span><input v-model="txCodeValue" required inputmode="numeric"></label><label class="field"><span>Length</span><input v-model.number="txCodeLength" type="number" min="4" max="12"></label></div></div>
            </section>

            <section class="panel compact"><button class="advanced" type="button" @click="advanced=!advanced"><span><b>04</b><strong>Advanced overrides</strong><small>Optional · Mapping, disclosure, status and other API controls</small></span><i>{{advanced?'−':'+'}}</i></button><div v-if="advanced" class="advanced-body"><label class="field"><span>Overrides JSON</span><textarea v-model="overrides" spellcheck="false" placeholder='{"selectiveDisclosure":{"fields":{}}}'></textarea></label><p>These settings are merged with each credential's data using the <code>CredentialOfferRuntimeOverrides</code> schema.</p></div></section>
            <footer><div><strong>{{selectedProfiles.length?selectedProfiles.map(p=>p.name).join(', '):'No credential selected'}}</strong><small>{{authMethod==='PRE_AUTHORIZED'?'Pre-authorized flow':'Authorization code flow'}} · {{expiry}}</small></div><button class="primary" :disabled="loading||!selected.length">{{loading?'Creating offer…':'Create credential offer →'}}</button></footer>
          </form>
        </template>
      </div>
    </main>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');
:root{font-family:'DM Sans',sans-serif;color:#202822;background:#f4f5f1}*{box-sizing:border-box}body{margin:0}button,input,select,textarea{font:inherit}button{cursor:pointer}.shell{display:grid;grid-template-columns:248px 1fr;min-height:100vh}.shell>aside{position:fixed;width:248px;inset:0 auto 0 0;background:#192b23;color:#fff;padding:30px 20px;display:flex;flex-direction:column}.brand{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none;font:800 20px Manrope;padding:0 10px 38px}.brand b{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#d9f44b;color:#193025}.shell nav{display:grid;gap:7px}.shell nav a{display:flex;gap:12px;align-items:center;color:#90a098;text-decoration:none;padding:12px;border-radius:9px;font-size:13px;font-weight:600}.shell nav a.active{background:#2a4137;color:#fff}.shell nav a:not(.active){opacity:.55}.shell nav span{font-size:18px}.status{margin-top:auto;border-top:1px solid #ffffff18;padding:22px 8px 0;display:flex;align-items:center;gap:10px}.status i{width:8px;height:8px;border-radius:50%;background:#d9f44b}.status strong,.status small{display:block;font-size:11px}.status small{color:#91a198;margin-top:3px}.shell>main{grid-column:2}.shell header{height:104px;background:#fff;border-bottom:1px solid #e1e6df;padding:25px clamp(28px,5vw,70px);display:flex;justify-content:space-between;align-items:center}.shell header small,.success>small{letter-spacing:.16em;color:#849088;font-size:9px;font-weight:700}.shell h1{font:700 24px Manrope;margin:4px 0 0}.shell header button{width:38px;height:38px;border:1px solid #dfe4de;background:#fff;border-radius:9px;font-size:19px}.content{max-width:1080px;margin:auto;padding:46px clamp(28px,5vw,70px) 70px}.intro{display:flex;justify-content:space-between;align-items:center;margin-bottom:27px}.intro h2{font:800 36px Manrope;letter-spacing:-.05em;margin:0}.intro p{color:#6e7a73;margin:7px 0 0}.steps{display:flex;align-items:center}.steps b,.steps span{display:grid;place-items:center;width:28px;height:28px;border:1px solid #ccd3ce;border-radius:50%;font-size:10px}.steps b{background:#233e32;color:#fff}.steps i{width:24px;height:1px;background:#ccd3ce}.panel{background:#fff;border:1px solid #e0e5df;border-radius:15px;padding:27px;margin-bottom:17px;box-shadow:0 10px 35px #23382d08}.panel-head{display:flex;justify-content:space-between;margin-bottom:21px}.panel-head>small{background:#f1f3ef;padding:6px 8px;border-radius:6px;font-size:10px;height:max-content}.title{display:flex;gap:12px}.title>b,.advanced span>b{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#ebf0dd;color:#586737;font-size:10px}.title h3{font:700 17px Manrope;margin:2px 0 4px}.title p{color:#7c8881;font-size:12px;margin:0}.search{display:flex;align-items:center;gap:8px;border:1px solid #dce2dc;border-radius:9px;padding:0 12px;height:42px;margin-bottom:15px;color:#849088}.search input{width:100%;border:0;outline:0;background:transparent}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.profile{position:relative;display:flex;align-items:center;gap:12px;text-align:left;background:#fbfcfa;border:1px solid #dfe4df;border-radius:10px;padding:14px;min-width:0;color:#222d27}.profile.selected{border-color:#748652;background:#f8faef;box-shadow:inset 0 0 0 1px #748652}.profile>b{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:9px;background:#e2eade;color:#456650;font-size:11px}.profile .tone-1{background:#eee8d9;color:#7a6030}.profile .tone-2{background:#e5e7f0;color:#56618c}.profile .tone-3{background:#f0e2e0;color:#8b544c}.profile>span{display:grid;min-width:0}.profile strong{font-size:12px}.profile small,.profile code{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#849089;font-size:9px;margin-top:2px}.profile code{color:#a1aaa5}.profile>i{display:none;position:absolute;right:9px;top:9px;background:#627642;color:#fff;border-radius:50%;width:17px;height:17px;place-items:center;font-size:9px;font-style:normal}.profile.selected>i{display:grid}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 25px}.form-grid fieldset{border:0;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:7px}.form-grid legend{font-size:11px;font-weight:700;margin-bottom:8px}.form-grid fieldset label{display:flex;gap:7px;border:1px solid #dce2dc;border-radius:9px;padding:11px;cursor:pointer}.form-grid fieldset label.chosen{border-color:#748652;background:#f8faef}.form-grid input[type=radio]{accent-color:#657746}.form-grid fieldset b,.form-grid fieldset small{display:block;font-size:11px}.form-grid fieldset small{font-size:9px;color:#7d8982;margin-top:3px}.field{display:grid;gap:7px;font-size:11px;font-weight:600}.field>span{display:flex;justify-content:space-between}.field>span small{font-weight:400;color:#859088}.field input,.field select,.field textarea{width:100%;border:1px solid #dce2dc;border-radius:9px;background:#fbfcfa;padding:11px;outline:none}.field textarea{min-height:150px;resize:vertical;font-family:monospace;line-height:1.5}.transaction{border-top:1px solid #edf0eb;margin-top:23px;padding-top:19px}.switch-row{display:flex;align-items:center;gap:9px;cursor:pointer}.switch-row>input{position:absolute;opacity:0}.switch-row>i{width:34px;height:20px;border-radius:20px;background:#cbd2cd;position:relative}.switch-row>i:after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:.2s}.switch-row>input:checked+i{background:#657746}.switch-row>input:checked+i:after{transform:translateX(14px)}.switch-row b,.switch-row small{display:block;font-size:11px}.switch-row small{font-size:9px;color:#849088;margin-top:2px}.tx-fields{display:flex;align-items:end;gap:14px;margin:15px 0 0 43px;font-size:10px}.compact{padding:0;overflow:hidden}.advanced{width:100%;padding:19px 27px;border:0;background:#fff;display:flex;justify-content:space-between;align-items:center}.advanced>span{display:flex;align-items:center;gap:11px}.advanced strong{font:700 13px Manrope}.advanced small{color:#929c96;font-size:10px}.advanced>i{font-size:20px;font-style:normal}.advanced-body{padding:22px 27px;border-top:1px solid #edf0eb}.advanced-body p{font-size:10px;color:#7d8882;margin-bottom:0}.shell footer{position:sticky;bottom:14px;background:#fff;border:1px solid #dde3dd;border-radius:12px;padding:14px 16px;box-shadow:0 14px 40px #1a2c231b;display:flex;justify-content:space-between;align-items:center}.shell footer strong,.shell footer small{display:block}.shell footer strong{font-size:11px;max-width:480px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shell footer small{font-size:9px;color:#7d8982;margin-top:3px}.primary,.secondary{border:0;border-radius:8px;padding:11px 16px;font-weight:700;font-size:11px}.primary{background:#d9f44b;color:#1a2b23}.primary:disabled{opacity:.5}.secondary{background:#fff;border:1px solid #dce2dc;color:#36423b}.alert{display:flex;gap:10px;background:#fff6f2;border:1px solid #efc8bb;color:#793d2d;padding:13px;border-radius:10px;margin-bottom:17px}.alert>b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#c9694d;color:#fff}.alert strong,.alert p{font-size:11px}.alert p{margin:2px 0 0}.alert button{margin-left:auto;border:0;background:transparent}.empty{text-align:center;color:#829087;padding:30px}.success{max-width:750px;margin:25px auto;background:#fff;border:1px solid #dfe4de;border-radius:17px;padding:42px;text-align:center}.success-mark{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 18px;border-radius:50%;background:#d9f44b;font-size:24px}.success h2{font:800 27px Manrope;margin:6px 0}.success>p{color:#77827b;font-size:12px}.offer{display:flex;gap:10px;align-items:center;text-align:left;background:#f4f6f2;border:1px solid #dfe4de;border-radius:9px;padding:9px;margin:24px 0}.offer code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:10px}.offer button,.pin button{border:0;background:#fff;border-radius:6px;padding:8px 10px;font-size:10px;font-weight:700}.pin{display:grid;gap:6px;background:#203b2f;color:#fff;border-radius:10px;padding:16px}.pin small{color:#aabbb2;letter-spacing:.13em;font-size:8px}.pin strong{font:800 28px Manrope;letter-spacing:.15em}.pin button{justify-self:center}.success dl{display:grid;grid-template-columns:2fr 1fr 1fr;text-align:left;margin:22px 0;padding:16px 0;border-block:1px solid #e6eae5}.success dl div{padding:0 12px;border-left:1px solid #e6eae5;min-width:0}.success dl div:first-child{border:0}.success dt{font-size:8px;color:#859089;letter-spacing:.1em}.success dd{font-size:10px;margin:5px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.actions{display:flex;justify-content:center;gap:9px}
@media(max-width:820px){.shell{display:block}.shell>aside{position:static;width:auto;height:68px;padding:0 18px;flex-direction:row;align-items:center}.brand{padding:0}.shell nav{margin-left:auto;display:flex}.shell nav a:not(.active){display:none}.status{display:none}.shell>main{display:block}.profile-grid,.form-grid{grid-template-columns:1fr}}@media(max-width:560px){.content{padding:28px 15px 55px}.shell header{height:86px;padding:18px}.intro h2{font-size:29px}.steps{display:none}.panel{padding:20px}.profile-grid{grid-template-columns:1fr}.form-grid fieldset{grid-template-columns:1fr}.advanced small{display:none}.shell footer{flex-direction:column;align-items:stretch;gap:11px}.shell footer .primary{width:100%}.success{padding:27px 18px}.success dl{grid-template-columns:1fr}.success dl div{border:0;border-top:1px solid #e6eae5;padding:9px}.actions{flex-direction:column}}
.credential-editor{border:1px solid #e1e6e0;border-radius:11px;overflow:hidden;margin-top:13px}.credential-editor:first-of-type{margin-top:0}.credential-editor-head{display:flex;align-items:center;gap:10px;background:#f7f9f5;border-bottom:1px solid #e4e8e3;padding:13px 15px}.credential-editor-head .profile-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:#e2eade;color:#456650;font-size:10px;font-weight:800}.credential-editor-head strong,.credential-editor-head small{display:block;font-size:11px}.credential-editor-head small{color:#839087;font-size:9px;margin-top:2px}.details-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px 18px;padding:18px}.details-grid .wide{grid-column:1/-1}.details-grid .field>span{gap:10px}.details-grid .field>span small{max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.details-grid textarea{min-height:95px}@media(max-width:560px){.details-grid{grid-template-columns:1fr}}
/* Bextrust product theme */
:root{color:#111827;background:#f4f7fb;--brand:#176bff;--brand-bright:#4185ff;--ink:#05070b;--line:#dce3ee;--muted:#6d7889}
body{background:#f4f7fb}.shell>aside{background:var(--ink)}
.brand{gap:11px}.brand img{width:38px;height:38px}.brand>span{display:grid;line-height:1}.brand>span b{display:block;width:auto;height:auto;background:transparent;color:#fff;font:800 20px Manrope}.brand>span small{margin-top:5px;color:#96a3b7;font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.shell nav a{color:#a6b0c0}.shell nav a.active{background:#176bff26;color:#fff;box-shadow:inset 3px 0 0 var(--brand)}.status{border-top-color:#ffffff18}.status i{background:var(--brand-bright);box-shadow:0 0 0 4px #176bff24}.status small{color:#93a0b2}
.shell header{border-bottom-color:var(--line)}.shell header small,.success>small{color:#6f7c8e}.shell header button{border-color:var(--line)}
.intro p,.title p,.form-grid fieldset small,.field>span small,.switch-row small,.advanced small,.advanced-body p,.shell footer small,.success>p{color:var(--muted)}
.steps b{background:var(--ink)}.steps b,.steps span{border-color:#cbd4e1}.steps i{background:#cbd4e1}
.panel,.success{border-color:var(--line);box-shadow:0 10px 35px #0812260a}.panel-head>small{background:#eef3fa}.title>b,.advanced span>b{background:#e7efff;color:#0b54d1}
.search,.profile,.form-grid fieldset label,.field input,.field select,.field textarea,.secondary,.credential-editor{border-color:var(--line)}.profile{background:#fbfcff;color:#111827}.profile.selected,.form-grid fieldset label.chosen{border-color:var(--brand);background:#f1f6ff;box-shadow:inset 0 0 0 1px var(--brand)}.profile>b,.profile .tone-1,.profile .tone-2,.profile .tone-3,.credential-editor-head .profile-icon{background:#e7efff;color:#0b54d1}.profile>i{background:var(--brand)}.form-grid input[type=radio]{accent-color:var(--brand)}
.field input,.field select,.field textarea{background:#fbfcff}.field input:focus,.field select:focus,.field textarea:focus,.search:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px #176bff1f}.transaction,.advanced-body{border-color:#e6ebf2}.switch-row>input:checked+i{background:var(--brand)}.advanced,.shell footer{background:#fff}.shell footer{border-color:var(--line);box-shadow:0 14px 40px #08122617}
.primary{background:var(--brand);color:#fff}.primary:hover{background:var(--brand-bright)}.secondary{color:#1d2939}.success-mark{background:var(--brand);color:#fff}.offer{background:#f3f6fb;border-color:var(--line)}.pin{background:var(--ink)}.pin small{color:#a9b5c6}.success dl,.success dl div{border-color:#e3e9f1}.credential-editor-head{background:#f4f7fb;border-color:#e3e9f1}
</style>
