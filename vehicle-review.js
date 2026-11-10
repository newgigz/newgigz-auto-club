import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// Use the same browser-safe publishable key as admin.js. NEVER use a secret/service_role key.
const PROJECT_URL = 'https://nxlovetjigddieykrzny.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ';
const el = id => document.getElementById(id);
const notice = msg => { el('notice').textContent = msg; };
const configured = PUBLISHABLE_KEY.startsWith('sb_publishable_') || PUBLISHABLE_KEY.startsWith('eyJ');
const client = configured ? createClient(PROJECT_URL, PUBLISHABLE_KEY) : null;
if (!configured) notice('Setup needed: add your browser-safe Supabase publishable key to vehicle-review.js.');
const node = (tag, value, className) => { const n = document.createElement(tag); if(value!==undefined)n.textContent=String(value??'');if(className)n.className=className;return n; };
function detail(parent,label,value){const d=node('div');d.append(node('strong',label),node('span',value===null||value===undefined||value===''?'Not supplied':value));parent.append(d);}
function setLoggedIn(user){el('login-panel').hidden=!!user;el('dashboard').hidden=!user;if(user)el('admin-email').textContent=user.email||'';}
async function refresh(){
  if(!client)return;
  const {data,error}=await client.from('vehicles').select('id,dealership_id,vin,year,make,model,trim,mileage,price,description,status,created_at').order('created_at',{ascending:false}).limit(100);
  if(error){notice(`Unable to load vehicle listings: ${error.message}`);return;}
  const list=el('vehicles');list.replaceChildren();
  if(!data?.length){list.append(node('p','No vehicle listings have been submitted yet.'));return;}
  const ids=[...new Set(data.map(v=>v.dealership_id))];
  const {data:dealers,error:dealerError}=await client.from('dealerships').select('id,legal_name,status').in('id',ids);
  if(dealerError){notice(`Unable to load dealership details: ${dealerError.message}`);return;}
  const dealerMap=new Map((dealers||[]).map(d=>[d.id,d]));
  for(const v of data){
    const d=dealerMap.get(v.dealership_id);
    const card=node('article',undefined,'vehicle');
    card.append(node('h3',`${v.year} ${v.make} ${v.model}${v.trim?' '+v.trim:''}`),node('span',v.status,'pill'));
    const meta=node('div',undefined,'meta');
    detail(meta,'Dealership',d?.legal_name||'Unknown');detail(meta,'Dealer status',d?.status||'Unknown');detail(meta,'VIN',v.vin);detail(meta,'Mileage',v.mileage?.toLocaleString());detail(meta,'Price',v.price==null?'':Number(v.price).toLocaleString('en-US',{style:'currency',currency:'USD'}));detail(meta,'Submitted',new Date(v.created_at).toLocaleString());detail(meta,'Description',v.description);
    card.append(meta);
    const label=node('label','Review notes (required for every decision)');const notes=node('textarea');notes.id='vehicle-notes-'+v.id;notes.maxLength=2000;notes.placeholder='Document the checks completed and reason for the decision.';label.htmlFor=notes.id;card.append(label,notes);
    const actions=node('div',undefined,'actions');const buttons=[];
    const updateButtons=()=>{for(const [b,status] of buttons)b.disabled=!notes.value.trim()||(status==='published'&&d?.status!=='approved');};
    for(const [status,title,cls] of [['published','Publish',''],['rejected','Reject','danger'],['archived','Archive','secondary']]){
      const btn=node('button',title,cls);btn.type='button';buttons.push([btn,status]);
      btn.addEventListener('click',async()=>{
        const reviewNotes=notes.value.trim();if(!reviewNotes){notice('Review notes are required.');notes.focus();return;}
        if(status==='published'&&d?.status!=='approved'){notice('Only approved dealerships may have published vehicles.');return;}
        if(!confirm(`Change ${v.year} ${v.make} ${v.model} to ${status}? This decision will be recorded.`))return;
        for(const [b] of buttons)b.disabled=true;
        const {error}=await client.rpc('review_vehicle',{p_vehicle_id:v.id,p_status:status,p_review_notes:reviewNotes});
        if(error){notice(`Review failed: ${error.message}`);updateButtons();return;}
        notice(`Vehicle review recorded: ${status}.`);await refresh();
      });actions.append(btn);
    }
    notes.addEventListener('input',updateButtons);updateButtons();card.append(actions);list.append(card);
  }
}
async function checkAccess(){if(!client)return;const {data:{user},error}=await client.auth.getUser();if(error||!user){setLoggedIn(null);return;}const {data,error:roleError}=await client.rpc('is_auto_club_admin');if(roleError||data!==true){await client.auth.signOut();setLoggedIn(null);notice('This account is not authorized as an administrator.');return;}setLoggedIn(user);await refresh();}
el('login').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;notice('Signing in...');const {error}=await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});if(error){notice('Unable to sign in. Check your credentials.');return;}notice('');await checkAccess();});
el('refresh').addEventListener('click',refresh);
el('logout').addEventListener('click',async()=>{if(client)await client.auth.signOut();setLoggedIn(null);notice('Signed out.');});
if(client)checkAccess();
