import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// Replace the placeholder with the publishable key from THIS NEWGIGZ Auto Club Supabase project.
// Never use a service_role or sb_secret_ key in browser code.
const PROJECT_URL = 'https://nxlovetjigddieykrzny.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_jGV44_1rCOu4IyA-ZEcjFQ_WoMWq9HJ';
const el = (id) => document.getElementById(id);
const notice = (msg) => { el('notice').textContent = msg; };
const configured = PUBLISHABLE_KEY.startsWith('sb_publishable_') || PUBLISHABLE_KEY.startsWith('eyJ');
const client = configured ? createClient(PROJECT_URL, PUBLISHABLE_KEY) : null;
if (!configured) notice('Setup needed: add your Supabase publishable key to admin.js before uploading.');
function node(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = String(text ?? ''); if(className)n.className=className;return n; }
function detail(parent, label, value) { const d=node('div');d.append(node('strong',label),node('span',value||'Not supplied'));parent.append(d); }
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
    const verify=node('div',undefined,'verify');const checkbox=node('input');checkbox.type='checkbox';checkbox.id='verified-'+d.id;const label=node('label','I independently verified this dealership’s active license and legal identity. This is not a test application.');label.htmlFor=checkbox.id;verify.append(checkbox,label);card.append(verify);
    const actions=node('div',undefined,'actions');
    for(const [status,title,cls] of [['approved','Approve',''],['rejected','Reject','danger'],['suspended','Suspend','secondary'],['pending','Set pending','secondary']]){
      const btn=node('button',title,cls);btn.type='button';if(status==='approved')btn.disabled=!checkbox.checked;
      btn.addEventListener('click',async()=>{
        if(status==='approved'&&!checkbox.checked)return;
        if(!confirm(`Change ${d.legal_name} to ${status}?`))return;
        btn.disabled=true;
        const {error}=await client.rpc('review_dealership',{p_dealership_id:d.id,p_status:status});
        if(error){notice('Update failed. Check your admin permissions and try again.');btn.disabled=false;return;}
        notice(`Application status updated to ${status}.`);await refresh();
      });actions.append(btn);
    }
    checkbox.addEventListener('change',()=>{actions.querySelector('button').disabled=!checkbox.checked;});
    card.append(actions);list.append(card);
  }
}
async function checkAccess(){if(!client)return;const {data:{user},error}=await client.auth.getUser();if(error||!user){setLoggedIn(null);return;}const {data,error:roleError}=await client.rpc('is_auto_club_admin');if(roleError||data!==true){await client.auth.signOut();setLoggedIn(null);notice('This account is not authorized as a NEWGIGZ Auto Club administrator.');return;}setLoggedIn(user);await refresh();}
el('login').addEventListener('submit',async(e)=>{e.preventDefault();if(!client)return;notice('Signing in...');const {error}=await client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});if(error){notice('Unable to sign in. Check your credentials.');return;}notice('');await checkAccess();});
el('refresh').addEventListener('click',refresh);
el('logout').addEventListener('click',async()=>{if(client)await client.auth.signOut();setLoggedIn(null);notice('Signed out.');});
if(client)checkAccess();
