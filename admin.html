import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// Use only the browser-safe publishable key for THIS Auto Club Supabase project.
// Never put a service_role or sb_secret_ key in browser code.
const PROJECT_URL = 'https://nxlovetjigddieykrzny.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ';
const el = (id) => document.getElementById(id);
const notice = (msg) => { el('notice').textContent = msg; };
const configured = PUBLISHABLE_KEY.startsWith('sb_publishable_') || PUBLISHABLE_KEY.startsWith('eyJ');
const client = configured ? createClient(PROJECT_URL, PUBLISHABLE_KEY) : null;
if (!configured) notice('Setup needed: add your Supabase publishable key to admin.js before uploading.');
function node(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = String(text ?? ''); if(className)n.className=className;return n; }
function detail(parent, label, value) { const d=node('div');d.append(node('strong',label),node('span',value ?? 'Not supplied'));parent.append(d); }
function setLoggedIn(user) { el('login-panel').hidden=!!user;el('dashboard').hidden=!user; if(user)el('admin-email').textContent=user.email||''; }
async function refresh() {
  if(!client)return;
  const {data,error}=await client.from('dealerships').select('id,legal_name,contact_name,email,phone,city,state,dealer_license_number,status,created_at').order('created_at',{ascending:false}).limit(100);
  if(error){notice('Unable to load applications. Check administrator permissions.');return;}
  const list=el('applications');list.replaceChildren();
  if(!data.length){list.append(node('p','No applications found.'));return;}
  for(const d of data){
    const card=node('article',undefined,'application');
    card.append(node('h3',d.legal_name),node('span',d.status,'pill'));
    const meta=node('div',undefined,'meta');
    detail(meta,'Contact',d.contact_name);detail(meta,'Email',d.email);detail(meta,'Phone',d.phone);detail(meta,'City / State',[d.city,d.state].filter(Boolean).join(', '));detail(meta,'License number',d.dealer_license_number);detail(meta,'Submitted',new Date(d.created_at).toLocaleString());card.append(meta);
    const verify=node('div',undefined,'verify');const checkbox=node('input');checkbox.type='checkbox';checkbox.id='verified-'+d.id;
    const label=node('label','I independently verified this dealership’s active license and legal identity. This is not a test application.');label.htmlFor=checkbox.id;verify.append(checkbox,label);card.append(verify);
    const notesBox=node('div',undefined,'review-notes');const notesLabel=node('label','Review notes (required for every decision)');const notes=node('textarea');notes.id='notes-'+d.id;notes.maxLength=2000;notes.placeholder='Document the verification source and date, or explain the rejection / suspension.';notesLabel.htmlFor=notes.id;notesBox.append(notesLabel,notes);card.append(notesBox);
    const actions=node('div',undefined,'actions');const buttons=[];
    const updateButtons=()=>{for(const [btn,status] of buttons){btn.disabled=(status==='approved'&&!checkbox.checked)||!notes.value.trim();}};
    for(const [status,title,cls] of [['approved','Approve',''],['rejected','Reject','danger'],['suspended','Suspend','secondary'],['pending','Set pending','secondary']]){
      const btn=node('button',title,cls);btn.type='button';buttons.push([btn,status]);
      btn.addEventListener('click',async()=>{
        const reviewNotes=notes.value.trim();
        if(!reviewNotes){notice('Review notes are required.');notes.focus();return;}
        if(status==='approved'&&!checkbox.checked){notice('Independent license verification is required before approval.');return;}
        if(!confirm(`Change ${d.legal_name} to ${status}? This decision will be recorded.`))return;
        for(const [b] of buttons)b.disabled=true;
        const {error}=await client.rpc('review_dealership',{p_dealership_id:d.id,p_status:status,p_license_verified:checkbox.checked,p_review_notes:reviewNotes});
        if(error){notice(`Update failed: ${error.message}`);updateButtons();return;}
        notice(`Decision recorded: ${d.legal_name} changed to ${status}.`);await refresh();
      });actions.append(btn);
    }
    checkbox.addEventListener('change',updateButtons);notes.addEventListener('input',updateButtons);updateButtons();
    card.append(actions);list.append(card);
  }
}
async function checkAccess(){if(!client)return;const {data:{user},error}=await client.auth.getUser();if(error||!user){setLoggedIn(null);return;}const {data,error:roleError}=await client.rpc('is_auto_club_admin');if(roleError||data!==true){await client.auth.signOut();setLoggedIn(null);notice('This account is not authorized as a NEWGIGZ Auto Club administrator.');return;}setLoggedIn(user);await refresh();}
el('login').addEventListener('submit',async(e)=>{e.preventDefault();if(!client)return;notice('Signing in...');const {error}=await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});if(error){notice('Unable to sign in. Check your credentials.');return;}notice('');await checkAccess();});
el('refresh').addEventListener('click',refresh);
el('logout').addEventListener('click',async()=>{if(client)await client.auth.signOut();setLoggedIn(null);notice('Signed out.');});
if(client)checkAccess();
